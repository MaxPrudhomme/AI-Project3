import { useState, useCallback, useRef } from 'react';
import { Automaton, type State } from '@/lib/automaton';
import { Player, type Item } from '@/lib/player';
import { Biomes } from '@/lib/world';
import { Entropy } from '@/lib/entropy';
import { generateRandomArtifact, type Artifact } from '@/lib/items';
import { EffectManager, type ActiveEffect, type EffectContext } from '@/lib/effects';
import { AutomatonGraph } from './components/AutomatonGraph';
import { EntropyProgressBar } from './components/EntropyProgressBar';
import { Button } from '@/components/ui/button';
import { NodeDetailsDrawer } from './components/NodeDetailsDrawer';
import { InventoryDrawer } from './components/InventoryDrawer';
import { ArtifactDiscoveryModal } from './components/ArtifactDiscoveryModal';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Package, Sparkles, BookOpen } from 'lucide-react';
import { JournalDrawer } from './components/JournalDrawer';
import { journalManager } from '@/lib/journal';
import { LLMControls } from './components/LLMControls';
import { buildGameContext, llmController, type LLMDecision } from '@/lib/llm';

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
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [, setEntropyUpdateTrigger] = useState(0);
  const [effectUpdateTrigger, setEffectUpdateTrigger] = useState(0);
  const [discoveredArtifact, setDiscoveredArtifact] = useState<Artifact | null>(null);
  
  // Create global entropy instance using all transitions from the automaton
  const [entropy] = useState<Entropy>(() => {
    const states = automaton.getStates();
    // Collect all transitions from all states
    const allTransitions = states.flatMap(state => state.transitions);
    return new Entropy(allTransitions);
  });

  // Effect manager to track active effects
  const [effectManager] = useState<EffectManager>(() => new EffectManager());
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  
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

  // LLM integration: build game context for LLM decisions
  const getGameContext = useCallback(() => {
    return buildGameContext(
      currentPosition,
      player.getInventory(),
      entropy,
      Array.from(discoveredBiomesRef.current)
    );
  }, [currentPosition, player, entropy]);

  // LLM integration: handle LLM decisions and log to journal
  const handleLLMDecision = useCallback((decision: LLMDecision) => {
    const inventory = player.getInventory();
    let itemName: string | undefined;
    
    if (decision.action === 'use_item' && decision.itemIndex !== undefined) {
      const item = inventory[decision.itemIndex];
      itemName = item?.name;
    }

    journalManager.addEntry({
      type: 'llm_decision',
      action: decision.action,
      reasoning: decision.reasoning,
      modelId: llmController.getModel(),
      itemName,
    });
  }, [player]);

  const handleMove = useCallback(() => {
    if (isMoving) return;
    
    setIsMoving(true);
    try {
      const newPosition = player.move();
      
      // Check if we left a biome with Path Anchor effect (expire it)
      const previousState = currentPosition;
      let effectsChanged = false;
      if (previousState.biome !== newPosition.biome) {
        const pathAnchorEffect = activeEffects.find(e => e.id === 'path-anchor');
        if (pathAnchorEffect) {
          effectManager.removeEffect('path-anchor', automaton);
          effectsChanged = true;
        }
      }
      
      // Process effect transitions (decrement duration, remove expired)
      const effectsBefore = effectManager.getActiveEffects().length;
      effectManager.processTransition(automaton);
      const effectsAfter = effectManager.getActiveEffects().length;
      if (effectsBefore !== effectsAfter) {
        effectsChanged = true;
      }
      setActiveEffects(effectManager.getActiveEffects());
      
      // Only trigger graph update if effects actually changed
      if (effectsChanged) {
        setEffectUpdateTrigger(prev => prev + 1);
      }
      
      // Update entropy (+2 per move, with potential reduction from effects)
      const reductionFactor = (entropy as any).entropyReductionFactor || 1.0;
      const entropyGain = 2 * reductionFactor;
      entropy.update(entropyGain);
      // Clear reduction factor after use
      if ((entropy as any).entropyReductionFactor !== undefined) {
        (entropy as any).entropyReductionFactor = undefined;
      }
      setEntropyUpdateTrigger(prev => prev + 1); // Trigger entropy bar re-render only
      
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
      
      // Track node change in journal
      if (previousState.biome !== newPosition.biome) {
        // Find the transition that was used
        const usedTransition = previousState.transitions.find(t => t.to.biome === newPosition.biome);
        if (usedTransition) {
          const isModified = (usedTransition as any).modifiedByEffect === true;
          journalManager.addEntry({
            type: 'node_change',
            fromBiome: previousState.biome,
            toBiome: newPosition.biome,
            odds: usedTransition.weight * 100,
            modifiedByItem: isModified,
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

  // LLM integration: execute the action decided by LLM
  const executeLLMAction = useCallback(async (decision: LLMDecision) => {
    if (decision.action === 'use_item' && decision.itemIndex !== undefined) {
      // Use an item from inventory
      const inventory = player.getInventory();
      const item = inventory[decision.itemIndex];
      
      if (item && item.type === 'artifact') {
        const { findArtifactByName } = await import('@/lib/items');
        const artifact = findArtifactByName(item.name);
        
        if (artifact && artifact.effect) {
          const context: EffectContext = {
            automaton,
            entropy,
            currentState: currentPosition,
            playerPosition: currentPosition,
          };
          
          const activeEffect = artifact.effect(context);
          if (activeEffect) {
            player.removeItem(decision.itemIndex, item.quantity);
            effectManager.addEffect(activeEffect);
            setActiveEffects(effectManager.getActiveEffects());
            setEffectUpdateTrigger(prev => prev + 1);
            
            // Track item used in journal
            journalManager.addEntry({
              type: 'item_used',
              itemName: item.name,
              itemDescription: item.description,
            });
            
            toast.success(`AI used ${item.name}`, {
              description: activeEffect.description,
            });
          }
        }
      }
      
      // After using item, also move
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay
    }
    
    // Always perform a move after any action
    handleMove();
  }, [player, automaton, entropy, currentPosition, effectManager, handleMove]);

  const handleArtifactPickUp = useCallback((item: Item) => {
    const success = player.addItem(item);
    if (success) {
      // Track item found in journal
      journalManager.addEntry({
        type: 'item_found',
        itemName: item.name,
        itemDescription: item.description,
        itemRarity: item.rarity,
      });
      
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
          onEffectActivated={(effect) => {
            effectManager.addEffect(effect);
            setActiveEffects(effectManager.getActiveEffects());
            // Trigger graph update to show modified transitions
            setEffectUpdateTrigger(prev => prev + 1);
          }}
          onItemUsed={(item) => {
            // Track item used in journal
            journalManager.addEntry({
              type: 'item_used',
              itemName: item.name,
              itemDescription: item.description,
            });
          }}
          effectContext={{
            automaton,
            entropy,
            currentState: currentPosition,
            playerPosition: currentPosition,
          }}
        />
        <JournalDrawer 
          isOpen={isJournalOpen}
          onOpenChange={setIsJournalOpen}
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
          updateTrigger={effectUpdateTrigger}
          onNodeClick={(node) => {
            setSelectedNode(node);
            setIsDrawerOpen(true);
          }}
        />
        
        {/* Active Effects Display - Top Left */}
        {activeEffects.length > 0 && (
          <div className="fixed top-4 left-4 z-50 flex flex-col gap-2">
            {activeEffects.map((effect) => (
              <div
                key={effect.id}
                className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 min-w-[200px]"
                title={effect.description}
              >
                <Sparkles className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{effect.name}</div>
                  {effect.duration !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      {effect.duration} transition{effect.duration !== 1 ? 's' : ''} left
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LLM Auto-Play Controls - Top Right */}
        <div className="fixed top-4 right-4 z-50 w-80">
          <LLMControls
            getGameContext={getGameContext}
            executeAction={executeLLMAction}
            onDecision={handleLLMDecision}
          />
        </div>

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
            <Button 
              onClick={() => setIsJournalOpen(true)}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Journal
            </Button>
          </div>
        </div>
      </div>
      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
