import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3-selection';
import * as d3Force from 'd3-force';
import * as d3Zoom from 'd3-zoom';
import * as d3Drag from 'd3-drag';
import { Automaton, type State } from '@/lib/automaton';
import { Player } from '@/lib/player';
import type { Biomes } from '@/lib/world';

interface AutomatonGraphProps {
  automaton: Automaton;
  player: Player; // Kept for potential future use
  currentPosition: State;
  onNodeClick?: (node: State) => void;
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

export function AutomatonGraph({ automaton, player: _player, currentPosition, onNodeClick }: AutomatonGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3Force.Simulation<NodeData, LinkData> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const randomTextIntervalRef = useRef<number | null>(null);
  const currentPositionRef = useRef<State>(currentPosition);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const nodeElementsRef = useRef<d3.Selection<SVGCircleElement, NodeData, SVGGElement, unknown> | null>(null);
  const linkElementsRef = useRef<d3.Selection<SVGPathElement, LinkData, SVGGElement, unknown> | null>(null);
  const linkDotsRef = useRef<d3.Selection<SVGCircleElement, { link: LinkData; dotIndex: number }, SVGGElement, unknown> | null>(null);
  const nodeLabelsRef = useRef<d3.Selection<SVGGElement, NodeData, SVGGElement, unknown> | null>(null);
  const edgeLabelsRef = useRef<d3.Selection<SVGGElement, LinkData, SVGGElement, unknown> | null>(null);

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
  }, [automaton]);

  // Update the ref whenever currentPosition changes
  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);

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
    
    linkElementsRef.current = linkElements;

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
    
    linkDotsRef.current = linkDots;

    // Create edge labels group AFTER dots so labels appear on top
    const edgeLabelsGroup = container.append('g').attr('class', 'edge-labels');
    
    // Create edge labels (initially hidden, shown on hover)
    const edgeLabels = edgeLabelsGroup
      .selectAll<SVGGElement, LinkData>('g.edge-label')
      .data(links)
      .enter()
      .append('g')
      .attr('class', 'edge-label')
      .style('opacity', 0)
      .style('pointer-events', 'none');
    
    // Add background rectangle for label
    edgeLabels
      .append('rect')
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))');
    
    // Add text for label
    edgeLabels
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#1f2937')
      .text('???');
    
    edgeLabelsRef.current = edgeLabels;

    // Create nodes
    const nodeSelection = nodeGroup
      .selectAll<SVGCircleElement, NodeData>('circle.node')
      .data(nodes);
    
    const nodeElements = nodeSelection
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('r', NODE_RADIUS)
      .attr('fill', (d) => getBiomeColor(d.biome))
      .attr('stroke', 'hsl(var(--primary))')
      .attr('stroke-width', 2)
      .style('cursor', 'move')
      .style('filter', 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))')
      .style('transition', 'opacity 0.3s ease, filter 0.3s ease')
      .merge(nodeSelection);
    
    // Store reference for transition animations (merged selection includes all nodes)
    nodeElementsRef.current = nodeElements;

    // Create pulsing ring indicator for current player position
    // Add outer pulsing ring
    nodeGroup
      .append('circle')
      .attr('class', 'player-indicator-ring')
      .attr('r', NODE_RADIUS + 12)
      .attr('fill', 'none')
      .attr('stroke', '#22c55e')
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.8)
      .style('filter', 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.8))')
      .style('animation', 'pulse-ring 2s infinite ease-out');

    // Add inner static ring
    nodeGroup
      .append('circle')
      .attr('class', 'player-indicator-inner-ring')
      .attr('r', NODE_RADIUS + 6)
      .attr('fill', 'none')
      .attr('stroke', '#22c55e')
      .attr('stroke-width', 1)
      .attr('opacity', 0.5)
      .style('filter', 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.5))');

    // Add player badge/icon in the top-right of the node
    const badge = nodeGroup
      .append('g')
      .attr('class', 'player-indicator-badge');
    
    badge
      .append('circle')
      .attr('r', 12)
      .attr('fill', '#22c55e')
      .attr('stroke', 'hsl(var(--background))')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))');
    
    badge
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', 'hsl(var(--background))')
      .text('P');

    // Create node labels - centered in nodes using transform for positioning
    const nodeLabels = nodeGroup
      .selectAll<SVGGElement, NodeData>('g.node-label')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-label')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .each(function (d) {
        const g = d3.select(this);
        
        // Check if this is the current position or discovered
        const isCurrentPosition = d.id === currentPositionRef.current.biome;
        const shouldShowBiome = d.discovered || isCurrentPosition;
        
        // Add biome text - first line
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('y', -6)
          .attr('font-size', '12px')
          .attr('font-weight', 'bold')
          .attr('fill', 'hsl(var(--foreground))')
          .attr('class', 'biome-text')
          .style('user-select', 'none')
          .style('pointer-events', 'none')
          .text(shouldShowBiome ? d.biome : generateRandomString());
        
        // Add variant text - second line
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('y', 10)
          .attr('font-size', '10px')
          .attr('fill', 'hsl(var(--muted-foreground))')
          .attr('class', 'variant-text')
          .style('user-select', 'none')
          .style('pointer-events', 'none')
          .text(shouldShowBiome ? d.variant : generateRandomString());
      });
    
    nodeLabelsRef.current = nodeLabels;

    // Track click timing to distinguish between click and drag
    const clickStartTime = new Map<string, number>();

    // Add drag behavior
    const drag = d3Drag.drag<SVGCircleElement, NodeData>()
      .on('start', (event, d: NodeData) => {
        clickStartTime.set(d.id, Date.now());
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
        
        // Check if this was a click (short duration and no significant movement)
        const startTime = clickStartTime.get(d.id);
        if (startTime && Date.now() - startTime < 300) {
          const states = automaton.getStates();
          const nodeState = states.find(s => s.biome === d.id);
          if (nodeState && onNodeClick) {
            onNodeClick(nodeState);
          }
        }
        
        d.fx = null;
        d.fy = null;
        clickStartTime.delete(d.id);
      });

    nodeElements.call(drag);

    // Add hover event handlers
    nodeElements
      .on('mouseenter', (_event, d: NodeData) => {
        setHoveredNodeId(d.id);
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);
      });

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

    // Function to get midpoint and angle of path for label positioning
    const getPathMidpoint = (pathString: string): { x: number; y: number; angle: number } | null => {
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', pathString);
      
      try {
        const length = pathEl.getTotalLength();
        const midpoint = pathEl.getPointAtLength(length * 0.5);
        const pointBefore = pathEl.getPointAtLength(length * 0.49);
        const pointAfter = pathEl.getPointAtLength(length * 0.51);
        const angle = Math.atan2(pointAfter.y - pointBefore.y, pointAfter.x - pointBefore.x);
        return { x: midpoint.x, y: midpoint.y, angle };
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

    // Function to update text for all nodes (handles discovered state changes)
    const updateRandomText = () => {
      if (!nodeLabelsRef.current) return;
      
      const states = automaton.getStates();
      const stateMap = new Map(states.map(s => [s.biome, s]));
      
      nodeLabelsRef.current.each(function (d) {
        const g = d3.select(this);
        const state = stateMap.get(d.biome as Biomes);
        const isDiscovered = state?.discovered ?? false;
        const isCurrentPosition = d.id === currentPositionRef.current.biome;
        const shouldShowBiome = isDiscovered || isCurrentPosition;
        
        const biomeText = g.select('.biome-text');
        const variantText = g.select('.variant-text');
        
        if (shouldShowBiome) {
          // Show real biome and variant text
          biomeText.text(d.biome);
          variantText.text(d.variant);
        } else {
          // Show random text for undiscovered nodes
          biomeText.text(generateRandomString());
          variantText.text(generateRandomString());
        }
      });
    };

    // Start random text updates for undiscovered nodes (every 300ms - slower to reduce performance impact)
    randomTextIntervalRef.current = window.setInterval(updateRandomText, 200);

    // Update function for simulation
    const tick = () => {
      // Update link paths
      linkElements.attr('d', (d) => getEdgePath(d));

      // Update edge label positions
      edgeLabels.each(function (d) {
        const pathString = getEdgePath(d);
        const midpoint = getPathMidpoint(pathString);
        if (midpoint) {
          const g = d3.select(this);
          const text = g.select('text');
          const bbox = (text.node() as SVGTextElement)?.getBBox();
          const padding = 4;
          const width = bbox ? bbox.width + padding * 2 : 40;
          const height = bbox ? bbox.height + padding * 2 : 20;
          
          // Keep label horizontal, just translate to midpoint
          g.attr('transform', `translate(${midpoint.x}, ${midpoint.y})`);
          g.select('rect')
            .attr('x', -width / 2)
            .attr('y', -height / 2)
            .attr('width', width)
            .attr('height', height);
        }
      });

      // Update node positions
      nodeElements
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0)
        .attr('fill', (d) => {
          // Always use biome color, regardless of discovered state
          return getBiomeColor(d.biome);
        })
        .style('filter', 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))');

      // Update node label positions only (text updates handled by interval)
      nodeLabels.attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    };

    simulation.on('tick', tick);
    
    // Function to update player indicator position
    const updatePlayerIndicator = () => {
      const currentNode = nodes.find(n => n.id === currentPositionRef.current.biome);
      if (currentNode && currentNode.x && currentNode.y) {
        container.select('.player-indicator-ring')
          .attr('cx', currentNode.x)
          .attr('cy', currentNode.y);
        
        container.select('.player-indicator-inner-ring')
          .attr('cx', currentNode.x)
          .attr('cy', currentNode.y);
        
        container.select('.player-indicator-badge')
          .attr('transform', `translate(${currentNode.x + NODE_RADIUS - 5}, ${currentNode.y - NODE_RADIUS + 5})`);
      }
    };
    
    // Update player indicator on each simulation tick as well
    simulation.on('tick.playerIndicator', updatePlayerIndicator);

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
  }, [nodes, links, dimensions, automaton]);

  // Update when current position changes (without rebuilding the whole graph)
  useEffect(() => {
    if (!nodeElementsRef.current || !nodeLabelsRef.current) return;

    const states = automaton.getStates();
    const stateMap = new Map(states.map(s => [s.biome, s]));

    // Update node styling for current position
    nodeElementsRef.current
      .attr('stroke-width', (d) => d.id === currentPosition.biome ? 4 : 2);

    // Update text labels for discovered/current nodes
    nodeLabelsRef.current.each(function (d) {
      const g = d3.select(this);
      const state = stateMap.get(d.biome as Biomes);
      const isDiscovered = state?.discovered ?? false;
      const isCurrentPosition = d.id === currentPosition.biome;
      const shouldShowBiome = isDiscovered || isCurrentPosition;

      const biomeText = g.select('.biome-text');
      const variantText = g.select('.variant-text');

      if (shouldShowBiome) {
        biomeText.text(d.biome);
        variantText.text(d.variant);
      } else {
        biomeText.text(generateRandomString());
        variantText.text(generateRandomString());
      }
    });
  }, [currentPosition, automaton]);

  // Update player indicator position reliably when current position changes
  useEffect(() => {
    // Store the current position in a ref so tick function can access it
    currentPositionRef.current = currentPosition;
    
    // Find the current node and update indicator position immediately
    const currentNode = nodes.find(n => n.id === currentPosition.biome);
    if (currentNode && currentNode.x && currentNode.y) {
      d3.select(svgRef.current)
        .select('.player-indicator-ring')
        .attr('cx', currentNode.x)
        .attr('cy', currentNode.y);
      
      d3.select(svgRef.current)
        .select('.player-indicator-inner-ring')
        .attr('cx', currentNode.x)
        .attr('cy', currentNode.y);
      
      d3.select(svgRef.current)
        .select('.player-indicator-badge')
        .attr('transform', `translate(${currentNode.x + NODE_RADIUS - 5}, ${currentNode.y - NODE_RADIUS + 5})`);
    }
  }, [currentPosition, nodes]);

  // Update hover state when hoveredNodeId changes
  useEffect(() => {
    if (!nodeElementsRef.current || !linkElementsRef.current || !linkDotsRef.current || !nodeLabelsRef.current || !edgeLabelsRef.current) return;

    const states = automaton.getStates();
    const stateMap = new Map(states.map(s => [s.biome, s]));

    const getConnectedNodeIds = (nodeId: string): Set<string> => {
      const connected = new Set<string>();
      links.forEach((link) => {
        if (link.source.id === nodeId) {
          connected.add(link.target.id);
        }
        if (link.target.id === nodeId) {
          connected.add(link.source.id);
        }
      });
      return connected;
    };

    if (!hoveredNodeId) {
      // Reset all to full opacity
      nodeElementsRef.current.style('opacity', 1);
      linkElementsRef.current.style('opacity', 1);
      linkDotsRef.current.style('opacity', 1);
      nodeLabelsRef.current.style('opacity', 1);
      edgeLabelsRef.current.style('opacity', 0);
      return;
    }

    const connectedIds = getConnectedNodeIds(hoveredNodeId);
    connectedIds.add(hoveredNodeId); // Include the hovered node itself

    // Update nodes
    nodeElementsRef.current.style('opacity', (d) => {
      if (d.id === hoveredNodeId) return 1; // Hovered node: full opacity
      if (connectedIds.has(d.id)) return 0.7; // Connected nodes: slightly lower
      return 0.2; // Other nodes: much lower
    });

    // Update links and dots
    linkElementsRef.current.style('opacity', (d) => {
      const sourceConnected = connectedIds.has(d.source.id);
      const targetConnected = connectedIds.has(d.target.id);
      if (sourceConnected && targetConnected) return 1; // Edge between connected nodes
      return 0.2; // Other edges
    });

    linkDotsRef.current.style('opacity', (d) => {
      const sourceConnected = connectedIds.has(d.link.source.id);
      const targetConnected = connectedIds.has(d.link.target.id);
      if (sourceConnected && targetConnected) return 1; // Dots on connected edges
      return 0.2; // Dots on other edges
    });

    // Update labels
    nodeLabelsRef.current.style('opacity', (d) => {
      if (d.id === hoveredNodeId) return 1; // Hovered node label: full opacity
      if (connectedIds.has(d.id)) return 0.7; // Connected node labels: slightly lower
      return 0.2; // Other node labels: much lower
    });

    // Update edge labels - show probabilities for outgoing edges from hovered node
    edgeLabelsRef.current.each(function (d) {
      const g = d3.select(this);
      const text = g.select('text');
      const rect = g.select('rect');
      const isOutgoingEdge = d.source.id === hoveredNodeId;
      
      if (isOutgoingEdge) {
        // Check if both source and target are discovered
        const sourceState = stateMap.get(d.source.id as Biomes);
        const targetState = stateMap.get(d.target.id as Biomes);
        const sourceDiscovered = sourceState?.discovered ?? false;
        const targetDiscovered = targetState?.discovered ?? false;
        
        if (sourceDiscovered && targetDiscovered) {
          // Show probability as percentage
          const percentage = (d.weight * 100).toFixed(1);
          text.text(`${percentage}%`);
        } else {
          // Show unknown
          text.text('???');
        }
        
        // Update rectangle size based on text content
        const bbox = (text.node() as SVGTextElement)?.getBBox();
        const padding = 4;
        const width = bbox ? bbox.width + padding * 2 : 40;
        const height = bbox ? bbox.height + padding * 2 : 20;
        rect
          .attr('x', -width / 2)
          .attr('y', -height / 2)
          .attr('width', width)
          .attr('height', height);
        
        g.style('opacity', 1);
      } else {
        g.style('opacity', 0);
      }
    });
  }, [hoveredNodeId, links, automaton, currentPosition]);

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
