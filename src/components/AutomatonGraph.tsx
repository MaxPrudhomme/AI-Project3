import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3-selection';
import * as d3Force from 'd3-force';
import * as d3Zoom from 'd3-zoom';
import * as d3Drag from 'd3-drag';
import { Automaton } from '@/lib/automaton';
import { Player } from '@/lib/player';
import type { Biomes } from '@/lib/world';

interface AutomatonGraphProps {
  automaton: Automaton;
  player: Player;
}

interface NodeData {
  id: string;
  biome: string;
  variant: string;
  discovered: boolean;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface LinkData {
  id: string;
  source: NodeData;
  target: NodeData;
  weight: number;
}

const NODE_RADIUS = 50;
const ANIMATION_DURATION = 4000; // ms for one complete cycle
const DOTS_PER_EDGE = 5; // Number of dots per edge for continuous flow
const DOT_SPACING = 0.2; // Spacing between dots (as fraction of path length)

// Generate a deterministic random color based on biome name (hash-based)
const getBiomeColor = (biome: string): string => {
  // Hash function for deterministic randomness
  let hash = 0;
  for (let i = 0; i < biome.length; i++) {
    const char = biome.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Use hash to generate HSL color with good saturation and lightness
  const hue = Math.abs(hash) % 360;
  const saturation = 50 + (Math.abs(hash) % 30); // 50-80%
  const lightness = 40 + (Math.abs(hash >> 8) % 30); // 40-70%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Generate random string of 8-10 characters
const generateRandomString = (): string => {
  const length = 8 + Math.floor(Math.random() * 3); // 8-10 characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export function AutomatonGraph({ automaton, player }: AutomatonGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3Force.Simulation<NodeData, LinkData> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const randomTextIntervalRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });

  const { nodes, links } = useMemo(() => {
    const states = automaton.getStates();
    
    const nodeMap = new Map<string, NodeData>();
    states.forEach((state) => {
      nodeMap.set(state.biome, {
        id: state.biome,
        biome: state.biome,
        variant: state.variant,
        discovered: state.discovered,
      });
    });

    const linksData: LinkData[] = [];
    states.forEach((state) => {
      state.transitions.forEach((transition) => {
        const source = nodeMap.get(state.biome);
        const target = nodeMap.get(transition.to.biome);
        if (source && target) {
          linksData.push({
            id: `${state.biome}-${transition.to.biome}`,
            source,
            target,
            weight: transition.weight,
          });
        }
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links: linksData,
    };
  }, [automaton, player]);

  // Handle window resize
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        setDimensions({
          width: svgRef.current.clientWidth || window.innerWidth,
          height: svgRef.current.clientHeight || window.innerHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = dimensions.width;
    const height = dimensions.height;

    // Clear previous content
    svg.selectAll('*').remove();

    // Set up zoom behavior (disabled scrollwheel)
    const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 2])
      .on('zoom', (event) => {
        container.attr('transform', event.transform.toString());
      })
      .filter((event) => {
        // Disable scrollwheel zoom, allow drag and pinch
        return event.type !== 'wheel';
      });

    svg.call(zoom);

    // Create container group for zoom/pan
    const container = svg.append('g');

    // Initialize node positions using hash-based deterministic positioning
    const hashString = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };

    nodes.forEach((node) => {
      const hash = hashString(node.id);
      const angle = (hash % 360) * (Math.PI / 180);
      const radius = 150 + (hash % 150);
      node.x = width / 2 + radius * Math.cos(angle);
      node.y = height / 2 + radius * Math.sin(angle);
    });

    // Create force simulation
    const simulation = d3Force.forceSimulation<NodeData>(nodes)
      .force('link', d3Force.forceLink<NodeData, LinkData>(links)
        .id((d) => d.id)
        .distance(250)
        .strength(0.4))
      .force('charge', d3Force.forceManyBody().strength(-700))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('collision', d3Force.forceCollide().radius(NODE_RADIUS + 20));

    simulationRef.current = simulation;

    // Create link group
    const linkGroup = container.append('g').attr('class', 'links');
    const nodeGroup = container.append('g').attr('class', 'nodes');

    // Create links (invisible, just for path calculation)
    const linkElements = linkGroup
      .selectAll<SVGPathElement, LinkData>('path.link')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', 'none');

    // Create animated dots for links - multiple dots per edge
    const linkDotsData: Array<{ link: LinkData; dotIndex: number }> = [];
    links.forEach((link) => {
      for (let i = 0; i < DOTS_PER_EDGE; i++) {
        linkDotsData.push({ link, dotIndex: i });
      }
    });

    const linkDots = linkGroup
      .selectAll<SVGCircleElement, { link: LinkData; dotIndex: number }>('circle.link-dot')
      .data(linkDotsData)
      .enter()
      .append('circle')
      .attr('class', 'link-dot')
      .attr('r', 4)
      .attr('fill', (d) => {
        // Use the source node's color from the nodes array
        const sourceNode = nodes.find(n => n.id === d.link.source.id);
        return sourceNode ? getBiomeColor(sourceNode.biome) : '#666666';
      });

    // Create nodes
    const nodeElements = nodeGroup
      .selectAll<SVGCircleElement, NodeData>('circle.node')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('r', NODE_RADIUS)
      .attr('fill', (d) => getBiomeColor(d.biome))
      .attr('stroke', 'hsl(var(--primary))')
      .attr('stroke-width', 2)
      .style('cursor', 'move')
      .style('filter', 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))');

    // Create node labels - centered in nodes using transform for positioning
    const nodeLabels = nodeGroup
      .selectAll<SVGGElement, NodeData>('g.node-label')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-label')
      .each(function (d) {
        const g = d3.select(this);
        
        // Add biome text - first line
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('y', -6)
          .attr('font-size', '12px')
          .attr('font-weight', 'bold')
          .attr('fill', 'hsl(var(--foreground))')
          .attr('class', 'biome-text')
          .text(d.discovered ? d.biome : generateRandomString());
        
        // Add variant text - second line
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('y', 10)
          .attr('font-size', '10px')
          .attr('fill', 'hsl(var(--muted-foreground))')
          .attr('class', 'variant-text')
          .text(d.discovered ? d.variant : generateRandomString());
      });

    // Add drag behavior
    const drag = d3Drag.drag<SVGCircleElement, NodeData>()
      .on('start', (event, d: NodeData) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d: NodeData) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d: NodeData) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeElements.call(drag);

    // Function to check if a point is too close to any node
    const isPointNearNode = (x: number, y: number, excludeIds: string[]): boolean => {
      return nodes.some((node) => {
        if (excludeIds.includes(node.id) || !node.x || !node.y) return false;
        const dist = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
        return dist < NODE_RADIUS + 5; // 5px buffer
      });
    };

    // Function to calculate edge path avoiding nodes
    const getEdgePath = (link: LinkData): string => {
      const source = link.source;
      const target = link.target;
      
      if (!source.x || !source.y || !target.x || !target.y) {
        return '';
      }

      // Calculate angle from source to target
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Start and end points on node perimeters
      const startX = source.x + Math.cos(angle) * NODE_RADIUS;
      const startY = source.y + Math.sin(angle) * NODE_RADIUS;
      const endX = target.x - Math.cos(angle) * NODE_RADIUS;
      const endY = target.y - Math.sin(angle) * NODE_RADIUS;

      // Perpendicular vector for offset
      const perpX = -dy / distance;
      const perpY = dx / distance;

      // Check multiple points along the path for node intersections
      let maxOffset = 0;
      const excludeIds = [source.id, target.id];
      
      // Sample points along the direct path
      for (let t = 0.1; t < 0.9; t += 0.1) {
        const testX = startX + (endX - startX) * t;
        const testY = startY + (endY - startY) * t;
        
        if (isPointNearNode(testX, testY, excludeIds)) {
          // Find the closest node to this point
          let minDist = Infinity;
          for (const node of nodes) {
            if (excludeIds.includes(node.id) || !node.x || !node.y) continue;
            const dist = Math.sqrt(
              Math.pow(testX - node.x, 2) + Math.pow(testY - node.y, 2)
            );
            minDist = Math.min(minDist, dist);
          }
          
          // Calculate needed offset
          const neededOffset = NODE_RADIUS + 10 - minDist;
          maxOffset = Math.max(maxOffset, neededOffset);
        }
      }

      // Apply offset with smooth curve
      const offset = maxOffset;
      const cp1x = startX + (endX - startX) * 0.3 + perpX * offset;
      const cp1y = startY + (endY - startY) * 0.3 + perpY * offset;
      const cp2x = startX + (endX - startX) * 0.7 + perpX * offset;
      const cp2y = startY + (endY - startY) * 0.7 + perpY * offset;

      // Create cubic bezier path
      return `M ${startX},${startY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${endX},${endY}`;
    };

    // Function to get point along path at given progress (0-1)
    const getPointOnPath = (pathString: string, progress: number): [number, number] | null => {
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', pathString);
      
      try {
        const length = pathEl.getTotalLength();
        const point = pathEl.getPointAtLength(length * progress);
        return [point.x, point.y];
      } catch {
        return null;
      }
    };

    // Animation function for dots - continuous flow
    let animationTime = 0;
    const animate = () => {
      animationTime += 16; // ~60fps
      const baseProgress = (animationTime % ANIMATION_DURATION) / ANIMATION_DURATION;

      linkDots.each(function (d) {
        const pathString = getEdgePath(d.link);
        // Stagger dots along the path
        const dotProgress = (baseProgress + d.dotIndex * DOT_SPACING) % 1;
        const point = getPointOnPath(pathString, dotProgress);
        
        if (point) {
          d3.select(this)
            .attr('cx', point[0])
            .attr('cy', point[1]);
        }
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Function to update random text for undiscovered nodes
    const updateRandomText = () => {
      nodeLabels.each(function (d) {
        const g = d3.select(this);
        const states = automaton.getStates();
        const state = states.find(s => s.biome === d.id);
        const isDiscovered = state?.discovered ?? false;
        
        if (!isDiscovered) {
          const biomeText = g.select('.biome-text');
          const variantText = g.select('.variant-text');
          
          biomeText.text(generateRandomString());
          variantText.text(generateRandomString());
        }
      });
    };

    // Start rapid random text updates for undiscovered nodes (every 100ms)
    randomTextIntervalRef.current = window.setInterval(updateRandomText, 100);

    // Update function for simulation
    const tick = () => {
      // Update link paths
      linkElements.attr('d', (d) => getEdgePath(d));

      const states = automaton.getStates();
      const stateMap = new Map(states.map(s => [s.biome, s]));

      // Update node positions and discovered state
      nodeElements
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0)
        .attr('fill', (d) => {
          // Always use biome color, regardless of discovered state
          return getBiomeColor(d.biome);
        });

      // Update node label positions and text - centered in nodes using transform
      nodeLabels
        .attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`)
        .each(function (d) {
          const g = d3.select(this);
          const state = stateMap.get(d.biome as Biomes);
          const isDiscovered = state?.discovered ?? false;
          const wasDiscovered = d.discovered;
          d.discovered = isDiscovered;
          
          // Update text when discovery state changes
          if (isDiscovered !== wasDiscovered) {
            const biomeText = g.select('.biome-text');
            const variantText = g.select('.variant-text');
            
            if (isDiscovered) {
              biomeText.text(d.biome);
              variantText.text(d.variant);
            } else {
              biomeText.text(generateRandomString());
              variantText.text(generateRandomString());
            }
          }
        });
    };

    simulation.on('tick', tick);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (randomTextIntervalRef.current) {
        clearInterval(randomTextIntervalRef.current);
      }
      simulation.stop();
    };
  }, [nodes, links, dimensions]);

  return (
    <div className="w-full h-full overflow-hidden bg-background">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        style={{ display: 'block' }}
      />
    </div>
  );
}
