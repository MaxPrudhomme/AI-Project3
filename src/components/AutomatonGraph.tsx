import { useMemo } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge } from 'reactflow';
import * as d3Force from 'd3-force';
import 'reactflow/dist/style.css';
import { Automaton } from '@/lib/automaton';
import { CustomEdge } from './CustomEdge';

interface AutomatonGraphProps {
  automaton: Automaton;
}

const edgeTypes = {
  custom: CustomEdge,
};

export function AutomatonGraph({ automaton }: AutomatonGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const states = automaton.getStates();
    
    // Create initial nodes
    const initialNodes: Node[] = states.map((state) => ({
      id: state.biome,
      position: { x: 0, y: 0 },
      data: {
        label: (
          <div className="text-center flex flex-col items-center justify-center h-full w-full">
            <div className="font-bold text-sm leading-tight">{state.biome}</div>
            <div className="text-[10px] text-muted-foreground leading-tight mt-1">{state.variant}</div>
          </div>
        ),
      },
      style: {
        background: '#ffffff',
        border: '2px solid hsl(var(--primary))',
        borderRadius: '50%',
        width: 100,
        height: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        color: 'hsl(var(--foreground))',
        fontSize: '12px',
      },
    }));
    
    // Create edges for transitions
    const edgesData: Edge[] = [];
    states.forEach((state) => {
      state.transitions.forEach((transition) => {
        const weight = transition.weight;
        // Use brighter color for better visibility
        const edgeColor = 'hsl(217, 91%, 60%)'; // Bright blue
        const strokeWidth = Math.max(2, Math.min(5, weight * 10 + 2));
        
        edgesData.push({
          id: `${state.biome}-${transition.to}`,
          source: state.biome,
          target: transition.to,
          label: `${(weight * 100).toFixed(1)}%`,
          type: 'custom',
          animated: true,
          style: {
            strokeWidth,
            stroke: edgeColor,
            opacity: 1,
          },
          labelStyle: {
            fill: '#ffffff',
            fontWeight: 700,
            fontSize: '11px',
          },
          labelBgStyle: {
            fill: edgeColor,
            fillOpacity: 1,
            stroke: '#ffffff',
            strokeWidth: 1.5,
            rx: 6,
            ry: 6,
          },
          zIndex: 10,
        });
      });
    });
    
    // Use d3-force to calculate positions
    interface SimNode {
      id: string;
      x?: number;
      y?: number;
      fx?: number | null;
      fy?: number | null;
    }
    
    // Deterministic position based on node id hash
    const hashString = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };
    
    const simNodes: SimNode[] = initialNodes.map((node) => {
      const hash = hashString(node.id);
      const angle = (hash % 360) * (Math.PI / 180);
      const radius = 200 + (hash % 200);
      return {
        id: node.id,
        x: 500 + radius * Math.cos(angle),
        y: 400 + radius * Math.sin(angle),
      };
    });
    
    // Create simulation links (copy of edges with string IDs that D3 will mutate)
    const simLinks = edgesData.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }));
    
    const simulation = d3Force.forceSimulation(simNodes)
      .force('link', d3Force.forceLink(simLinks).id((d: SimNode) => d.id).distance(250).strength(0.4))
      .force('charge', d3Force.forceManyBody().strength(-600))
      .force('center', d3Force.forceCenter(500, 400))
      .force('collision', d3Force.forceCollide().radius(120))
      .stop();
    
    // Run simulation
    for (let i = 0; i < 300; i++) {
      simulation.tick();
    }
    
    // Update node positions from simulation
    const positionedNodes: Node[] = initialNodes.map((node) => {
      const simNode = simNodes.find((n) => n.id === node.id);
      return {
        ...node,
        position: {
          x: simNode?.x ?? 0,
          y: simNode?.y ?? 0,
        },
      };
    });
    
    return { nodes: positionedNodes, edges: edgesData };
  }, [automaton]);
  
  return (
    <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

