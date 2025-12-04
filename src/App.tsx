import { useState, useCallback, useRef } from 'react';
import { Automaton, type State } from '@/lib/automaton';
import { Player, type Item } from '@/lib/player';
import { Biomes } from '@/lib/world';
import { Entropy } from '@/lib/entropy';
import { generateRandomArtifact, type Artifact } from '@/lib/items';
import { AutomatonGraph } from './components/AutomatonGraph';
import { EntropyProgressBar } from './components/EntropyProgressBar';
import { Button } from '@/components/ui/button';
import { NodeDetailsDrawer } from './components/NodeDetailsDrawer';
import { InventoryDrawer } from './components/InventoryDrawer';
import { ArtifactDiscoveryModal, artifactToItem } from './components/ArtifactDiscoveryModal';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

function App() {
  const [automaton] = useState<Automaton>(() => {
    const auto = Automaton.createRandom();
    const states = auto.getStates();
    
    // Initialize player with random starting location - only from nodes with outgoing edges
    // Exclude Gateway from starting positions (it's the exit, not a starting point)
    const validStartingStates = states.filter(s => 
      s.transitions.length > 0 && s.biome !== Biomes.Gateway
    );
    if (validStartingStates.length === 0) {
      // Fallback: if somehow no states have outgoing edges, use first non-gateway state
      const firstState = states.find(s => s.biome !== Biomes.Gateway) || states[0];
      firstState.discovered = true;
      return auto;
    }
    
    const randomState = validStartingStates[Math.floor(Math.random() * validStartingStates.length)];
    randomState.discovered = true;
    
    return auto;
  });

  const [player] = useState<Player>(() => {
    const states = automaton.getStates();
    const discoveredState = states.find(s => 
      s.discovered && s.transitions.length > 0 && s.biome !== Biomes.Gateway
    );
    if (!discoveredState) {
      // Fallback: find first state with outgoing edges (excluding Gateway)
      const validState = states.find(s => s.transitions.length > 0 && s.biome !== Biomes.Gateway);
      if (validState) {
        validState.discovered = true;
        return new Player(validState);
      }
      // Last resort: use first non-gateway state (shouldn't happen due to automaton generation)
      const firstState = states.find(s => s.biome !== Biomes.Gateway) || states[0];
      firstState.discovered = true;
      return new Player(firstState);
    }
    return new Player(discoveredState);
  });

  const [currentPosition, setCurrentPosition] = useState<State>(player.getPosition());
  const [isMoving, setIsMoving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<State | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [entropyUpdateTrigger, setEntropyUpdateTrigger] = useState(0);
  const [discoveredArtifact, setDiscoveredArtifact] = useState<Artifact | null>(null);
  
  // Create global entropy instance using all transitions from the automaton
  const [entropy] = useState<Entropy>(() => {
    const states = automaton.getStates();
    // Collect all transitions from all states
    const allTransitions = states.flatMap(state => state.transitions);
    return new Entropy(allTransitions);
  });
  
  // Track discovered biomes to detect new discoveries
  const discoveredBiomesRef = useRef<Set<string>>((() => {
    const initialSet = new Set<string>();
    const states = automaton.getStates();
    states.forEach(state => {
      if (state.discovered) {
        initialSet.add(state.biome);
      }
    });
    return initialSet;
  })());

  const handleMove = useCallback(() => {
    if (isMoving) return;
    
    setIsMoving(true);
    try {
      const newPosition = player.move();
      
      // Update entropy (+2 per move)
      entropy.update(2);
      setEntropyUpdateTrigger(prev => prev + 1); // Trigger re-render
      
      // Mark the new biome as discovered
      const states = automaton.getStates();
      const newState = states.find(s => s.biome === newPosition.biome);
      if (newState) {
        const wasNewDiscovery = !discoveredBiomesRef.current.has(newState.biome);
        newState.discovered = true;
        discoveredBiomesRef.current.add(newState.biome);
        
        // Show notification if this is a newly discovered biome
        if (wasNewDiscovery) {
          toast.success(`Discovered new biome: ${newState.biome}!`, {
            description: `You've entered the ${newState.biome} biome.`,
          });
        }
      }
      
      // Check for artifact discovery (50% chance)
      const artifact = generateRandomArtifact();
      if (artifact) {
        setDiscoveredArtifact(artifact);
      }
      
      setCurrentPosition(newPosition);
      setIsMoving(false);
    } catch (error) {
      console.error('Move failed:', error);
      setIsMoving(false);
    }
  }, [player, currentPosition, isMoving, automaton, entropy]);

  const handleArtifactPickUp = useCallback((item: Item) => {
    const success = player.addItem(item);
    if (success) {
      toast.success(`Picked up ${item.name}!`, {
        description: item.description,
      });
      setCurrentPosition(player.getPosition()); // Trigger re-render
    } else {
      toast.error('Inventory is full!', {
        description: 'Make room before picking up this artifact.',
      });
    }
  }, [player]);

  const handleArtifactLeave = useCallback(() => {
    setDiscoveredArtifact(null);
  }, []);

  const inventory = player.getInventory();
  const hasInventorySpace = player.getItemCount() < inventory.length;

  return (
    <>
      <div className="relative w-screen h-screen overflow-hidden">
        <EntropyProgressBar entropy={entropy} />
        <NodeDetailsDrawer 
          isOpen={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          node={selectedNode}
        />
        <InventoryDrawer 
          isOpen={isInventoryOpen}
          onOpenChange={setIsInventoryOpen}
          player={player}
          onInventoryChange={() => {
            // Force re-render by updating a state
            setCurrentPosition(player.getPosition());
          }}
        />
        <ArtifactDiscoveryModal
          artifact={discoveredArtifact}
          isOpen={discoveredArtifact !== null}
          onClose={handleArtifactLeave}
          onPickUp={handleArtifactPickUp}
          hasInventorySpace={hasInventorySpace}
        />
        <AutomatonGraph 
          automaton={automaton} 
          player={player}
          currentPosition={currentPosition}
          onNodeClick={(node) => {
            setSelectedNode(node);
            setIsDrawerOpen(true);
          }}
        />
        
        {/* Control Bar */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
            <Button 
              onClick={handleMove}
              disabled={isMoving}
              size="lg"
            >
              {isMoving ? 'Moving...' : 'Move'}
            </Button>
            <Button 
              onClick={() => setIsInventoryOpen(true)}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <Package className="h-4 w-4" />
              Inventory
            </Button>
          </div>
        </div>
      </div>
      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
