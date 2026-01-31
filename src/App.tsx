import { useState, useCallback, useRef, useMemo } from 'react';
import { Automaton, type State } from '@/lib/automaton';
import { Player, type Item } from '@/lib/player';
import { Biomes } from '@/lib/world';
import { Entropy } from '@/lib/entropy';
import { generateRandomArtifact, findArtifactByName, type Artifact } from '@/lib/items';
import { EffectManager, type ActiveEffect, type EffectContext } from '@/lib/effects';
import { AutomatonGraph } from './components/AutomatonGraph';
import { EntropyProgressBar } from './components/EntropyProgressBar';
import { Button } from '@/components/ui/button';
import { NodeDetailsDrawer } from './components/NodeDetailsDrawer';
import { InventoryDrawer } from './components/InventoryDrawer';
import { ArtifactDiscoveryModal, artifactToItem } from './components/ArtifactDiscoveryModal';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Package, Sparkles, BookOpen } from 'lucide-react';
import { JournalDrawer } from './components/JournalDrawer';
import { journalManager } from '@/lib/journal';
import { LLMControls, buildGameState } from './components/LLMControls';
import type { LLMAction } from '@/lib/llmController';
import { VictoryScreen } from './components/VictoryScreen';
import { DefeatScreen } from './components/DefeatScreen';
import { boostGatewayVisibility, checkGatewayBoostConditions } from '@/lib/gatewayLogic';

function App() {
  // Victory and stats tracking
  const [hasWon, setHasWon] = useState(false);
  const [hasLost, setHasLost] = useState(false);
  const [lossReason, setLossReason] = useState<'max_entropy' | 'dead_end' | 'no_moves'>('max_entropy');
  const [totalMoves, setTotalMoves] = useState(0);
  const [itemsUsedCount, setItemsUsedCount] = useState(0);
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
  const [entropyUpdateTrigger, setEntropyUpdateTrigger] = useState(0);
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

  // Track previous values for Gateway boost threshold detection
  const previousDiscoveredCountRef = useRef(1); // Start with 1 (initial biome)
  const previousEntropyRef = useRef(0);

  const handleMove = useCallback(() => {
    if (isMoving || hasWon || hasLost) return;

    setIsMoving(true);
    try {
      const newPosition = player.move();
      setTotalMoves(prev => prev + 1);
      
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

      // Check for max entropy loss condition
      if (entropy.getCurrent() >= entropy.getMax()) {
        setHasLost(true);
        setLossReason('max_entropy');
        toast.error('Entropy Overload!', {
          description: 'The dream has collapsed into pure chaos.',
          duration: 5000,
        });
        setIsMoving(false);
        return;
      }
      
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

      // Check and apply Gateway visibility boost
      const currentDiscoveredCount = discoveredBiomesRef.current.size;
      const currentEntropyValue = entropy.getCurrent();
      const boostCheck = checkGatewayBoostConditions(
        currentDiscoveredCount,
        currentEntropyValue,
        previousDiscoveredCountRef.current,
        previousEntropyRef.current
      );

      if (boostCheck.shouldBoost) {
        boostGatewayVisibility(automaton, currentDiscoveredCount, currentEntropyValue);
        if (boostCheck.reason) {
          toast.info('Gateway Revealed', {
            description: boostCheck.reason,
            duration: 4000,
          });
        }
      } else {
        // Always apply current boost multiplier (even if not newly triggered)
        boostGatewayVisibility(automaton, currentDiscoveredCount, currentEntropyValue);
      }

      // Update previous values for next threshold check
      previousDiscoveredCountRef.current = currentDiscoveredCount;
      previousEntropyRef.current = currentEntropyValue;
      
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

      // Check for victory condition
      if (newPosition.biome === Biomes.Gateway) {
        setHasWon(true);
        toast.success('Gateway Reached!', {
          description: 'You have escaped the dream world!',
          duration: 5000,
        });
        setIsMoving(false);
        return;
      }

      // Check for dead end loss condition (no outgoing transitions)
      if (newPosition.transitions.length === 0) {
        setHasLost(true);
        setLossReason('dead_end');
        toast.error('Dead End!', {
          description: 'You\'re trapped in a biome with no escape routes.',
          duration: 5000,
        });
        setIsMoving(false);
        return;
      }

      // Check if all transitions have zero weight (no valid moves)
      const hasValidMoves = newPosition.transitions.some(t => t.weight > 0);
      if (!hasValidMoves) {
        setHasLost(true);
        setLossReason('no_moves');
        toast.error('No Path Forward!', {
          description: 'All transitions have been sealed off.',
          duration: 5000,
        });
        setIsMoving(false);
        return;
      }

      setIsMoving(false);
    } catch (error) {
      console.error('Move failed:', error);
      setIsMoving(false);
    }
  }, [player, currentPosition, isMoving, automaton, entropy, hasWon, hasLost]);

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

  // Handle using an item from inventory (extracted for LLM use)
  const handleUseItem = useCallback((slotIndex: number) => {
    if (hasWon || hasLost) return;

    const inv = player.getInventory();
    const item = inv[slotIndex];
    if (!item) {
      toast.error('No item in that slot');
      return;
    }

    setItemsUsedCount(prev => prev + 1);

    const context: EffectContext = {
      automaton,
      entropy,
      currentState: currentPosition,
      playerPosition: currentPosition,
    };

    if (item.type === 'artifact') {
      const artifact = findArtifactByName(item.name);
      if (artifact && artifact.effect) {
        try {
          const activeEffect = artifact.effect(context);
          if (activeEffect) {
            player.removeItem(slotIndex, item.quantity);
            effectManager.addEffect(activeEffect);
            setActiveEffects(effectManager.getActiveEffects());
            setEffectUpdateTrigger(prev => prev + 1);
            journalManager.addEntry({
              type: 'item_used',
              itemName: item.name,
              itemDescription: item.description,
            });
            toast.success(`Activated ${item.name}`, {
              description: activeEffect.description,
            });
            setCurrentPosition(player.getPosition());
            return;
          }
        } catch (error) {
          console.error('Error activating artifact effect:', error);
          toast.error('Failed to activate artifact');
          return;
        }
      }
    }

    // Fallback: just remove the item
    player.removeItem(slotIndex, item.quantity);
    journalManager.addEntry({
      type: 'item_used',
      itemName: item.name,
      itemDescription: item.description,
    });
    toast.success(`Used ${item.name}`);
    setCurrentPosition(player.getPosition());
  }, [player, automaton, entropy, currentPosition, effectManager, hasWon, hasLost]);

  // Handle dropping an item
  const handleDropItem = useCallback((slotIndex: number) => {
    if (hasWon || hasLost) return;

    const inv = player.getInventory();
    const item = inv[slotIndex];
    if (!item) {
      toast.error('No item in that slot');
      return;
    }
    player.removeItem(slotIndex, item.quantity);
    toast.success(`Dropped ${item.name}`);
    setCurrentPosition(player.getPosition());
  }, [player, hasWon, hasLost]);

  // Handle restart
  const handleRestart = useCallback(() => {
    window.location.reload();
  }, []);

  // LLM action handler
  const handleLLMAction = useCallback((action: LLMAction) => {
    switch (action.type) {
      case 'move':
        handleMove();
        break;
      case 'useItem':
        handleUseItem(action.slot);
        break;
      case 'pickUpItem':
        if (discoveredArtifact) {
          const item = artifactToItem(discoveredArtifact);
          handleArtifactPickUp(item);
          setDiscoveredArtifact(null);
        }
        break;
      case 'leaveItem':
        handleArtifactLeave();
        break;
      case 'dropItem':
        handleDropItem(action.slot);
        break;
      case 'wait':
        toast.info('LLM chose to wait');
        break;
    }
  }, [handleMove, handleUseItem, handleDropItem, handleArtifactPickUp, handleArtifactLeave, discoveredArtifact]);

  const inventory = player.getInventory();
  const hasInventorySpace = player.getItemCount() < inventory.length;

  // Build game state for LLM
  const gameState = useMemo(() => buildGameState(
    currentPosition,
    entropy,
    inventory,
    activeEffects,
    discoveredArtifact,
    hasInventorySpace
  ), [currentPosition, entropy, inventory, activeEffects, discoveredArtifact, hasInventorySpace]);

  return (
    <>
      <div className="relative w-screen h-screen overflow-hidden">
        <EntropyProgressBar entropy={entropy} />
        <LLMControls
          gameState={gameState}
          onAction={handleLLMAction}
          hasWon={hasWon}
          hasLost={hasLost}
        />
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

        {/* Control Bar */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
            <Button
              onClick={handleMove}
              disabled={isMoving || hasWon || hasLost}
              size="lg"
              variant={hasLost ? 'destructive' : 'default'}
            >
              {hasLost ? 'Defeated' : hasWon ? 'Victory!' : isMoving ? 'Moving...' : 'Move'}
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

      {/* Victory Screen */}
      <VictoryScreen
        isOpen={hasWon}
        stats={{
          totalMoves,
          biomesDiscovered: discoveredBiomesRef.current.size,
          itemsUsed: itemsUsedCount,
          finalEntropy: entropy.getCurrent(),
        }}
        onRestart={handleRestart}
      />

      {/* Defeat Screen */}
      <DefeatScreen
        isOpen={hasLost}
        reason={lossReason}
        stats={{
          totalMoves,
          biomesDiscovered: discoveredBiomesRef.current.size,
          itemsUsed: itemsUsedCount,
          finalEntropy: entropy.getCurrent(),
        }}
        onRestart={handleRestart}
      />

      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
