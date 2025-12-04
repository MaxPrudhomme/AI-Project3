import type { State, Transition } from "./automaton";
import type { Automaton } from "./automaton";
import type { Entropy } from "./entropy";
import { Biomes, Variants } from "./world";

export interface ActiveEffect {
    id: string;
    name: string;
    description: string;
    icon?: string;
    duration?: number; // Number of transitions remaining, undefined = permanent until manually removed
    onExpire?: () => void; // Called when effect expires
    modifiedTransitions?: Map<string, number>; // Map of transition IDs to original weights
    stateBiome?: string; // Biome of the state whose transitions were modified
}

export interface EffectContext {
    automaton: Automaton;
    entropy: Entropy;
    currentState: State;
    playerPosition: State;
}

/**
 * Effect manager to track active effects
 */
export class EffectManager {
    private activeEffects: Map<string, ActiveEffect> = new Map();

    /**
     * Add an active effect
     */
    public addEffect(effect: ActiveEffect): void {
        this.activeEffects.set(effect.id, effect);
    }

    /**
     * Remove an active effect and revert transitions
     */
    public removeEffect(effectId: string, automaton?: Automaton): void {
        const effect = this.activeEffects.get(effectId);
        
        // Revert transition weights if effect modified them
        if (effect?.modifiedTransitions && effect.stateBiome && automaton) {
            const states = automaton.getStates();
            const state = states.find(s => s.biome === effect.stateBiome);
            if (state) {
                state.transitions.forEach(transition => {
                    const transitionId = getTransitionId(transition.from, transition.to);
                    const originalWeight = effect.modifiedTransitions!.get(transitionId);
                    if (originalWeight !== undefined) {
                        transition.weight = originalWeight;
                        (transition as any).modifiedByEffect = false;
                    }
                });
            }
        }
        
        if (effect?.onExpire) {
            effect.onExpire();
        }
        this.activeEffects.delete(effectId);
    }

    /**
     * Get all active effects
     */
    public getActiveEffects(): ActiveEffect[] {
        return Array.from(this.activeEffects.values());
    }

    /**
     * Check if an effect is active
     */
    public hasEffect(effectId: string): boolean {
        return this.activeEffects.has(effectId);
    }

    /**
     * Decrement duration of timed effects and remove expired ones
     */
    public processTransition(automaton?: Automaton): void {
        const effectsToRemove: string[] = [];
        
        this.activeEffects.forEach((effect, id) => {
            if (effect.duration !== undefined) {
                effect.duration -= 1;
                if (effect.duration <= 0) {
                    effectsToRemove.push(id);
                }
            }
        });

        effectsToRemove.forEach(id => this.removeEffect(id, automaton));
    }

    /**
     * Clear all effects
     */
    public clearAll(): void {
        this.activeEffects.forEach((effect) => {
            if (effect.onExpire) {
                effect.onExpire();
            }
        });
        this.activeEffects.clear();
    }
}

/**
 * Get a unique ID for a transition
 */
function getTransitionId(from: State, to: State): string {
    return `${from.biome}-${to.biome}`;
}

/**
 * Helper function to normalize transition weights
 */
function normalizeWeights(transitions: Transition[]): void {
    const sum = transitions.reduce((acc, t) => acc + t.weight, 0);
    if (sum > 0) {
        transitions.forEach(transition => {
            transition.weight = transition.weight / sum;
        });
    }
}

/**
 * Store original weights before modification
 */
function storeOriginalWeights(transitions: Transition[], effect: ActiveEffect, stateBiome: string): void {
    if (!effect.modifiedTransitions) {
        effect.modifiedTransitions = new Map();
    }
    effect.stateBiome = stateBiome;
    
    transitions.forEach(transition => {
        const transitionId = getTransitionId(transition.from, transition.to);
        if (!effect.modifiedTransitions!.has(transitionId)) {
            effect.modifiedTransitions!.set(transitionId, transition.weight);
        }
    });
}

/**
 * Helper function to bias transitions toward specific biomes
 */
export function biasTransitionsTowardBiomes(
    transitions: Transition[],
    targetBiomes: Biomes[],
    biasMultiplier: number = 1.5,
    effect?: ActiveEffect,
    stateBiome?: string
): void {
    if (transitions.length === 0) return;
    
    // Store original weights before modification
    if (effect && stateBiome) {
        storeOriginalWeights(transitions, effect, stateBiome);
    }
    
    transitions.forEach(transition => {
        if (targetBiomes.includes(transition.to.biome)) {
            transition.weight *= biasMultiplier;
        }
    });
    normalizeWeights(transitions);
    
    // Mark transitions as modified
    transitions.forEach(transition => {
        (transition as any).modifiedByEffect = true;
    });
}

/**
 * Helper function to bias transitions toward biomes with specific variants
 */
export function biasTransitionsTowardVariants(
    transitions: Transition[],
    targetVariants: Variants[],
    biasMultiplier: number = 1.5,
    effect?: ActiveEffect,
    stateBiome?: string
): void {
    if (transitions.length === 0) return;
    
    // Store original weights before modification
    if (effect && stateBiome) {
        storeOriginalWeights(transitions, effect, stateBiome);
    }
    
    transitions.forEach(transition => {
        if (targetVariants.includes(transition.to.variant)) {
            transition.weight *= biasMultiplier;
        }
    });
    normalizeWeights(transitions);
    
    // Mark transitions as modified
    transitions.forEach(transition => {
        (transition as any).modifiedByEffect = true;
    });
}

/**
 * Helper function to swap weights of two transitions
 */
export function swapTransitionWeights(
    transitions: Transition[],
    effect?: ActiveEffect,
    stateBiome?: string
): void {
    if (transitions.length < 2) return;
    
    // Store original weights before modification
    if (effect && stateBiome) {
        storeOriginalWeights(transitions, effect, stateBiome);
    }
    
    // Find two transitions with highest weights
    const sorted = [...transitions].sort((a, b) => b.weight - a.weight);
    const [first, second] = sorted;
    
    if (first && second) {
        const temp = first.weight;
        first.weight = second.weight;
        second.weight = temp;
    }
    
    // Mark transitions as modified
    transitions.forEach(transition => {
        (transition as any).modifiedByEffect = true;
    });
}

/**
 * Helper function to redistribute weights evenly
 */
export function equalizeTransitionWeights(
    transitions: Transition[],
    effect?: ActiveEffect,
    stateBiome?: string
): void {
    if (transitions.length === 0) return;
    
    // Store original weights before modification
    if (effect && stateBiome) {
        storeOriginalWeights(transitions, effect, stateBiome);
    }
    
    const equalWeight = 1.0 / transitions.length;
    transitions.forEach(transition => {
        transition.weight = equalWeight;
    });
    
    // Mark transitions as modified
    transitions.forEach(transition => {
        (transition as any).modifiedByEffect = true;
    });
}

/**
 * Helper function to lock transition weights (prevent entropy modification)
 */
export function lockTransitionWeights(transitions: Transition[]): void {
    // Store original weights as metadata (we'll need to extend Transition type or use a map)
    // For now, this is a placeholder - actual locking would need entropy system integration
    transitions.forEach(transition => {
        // Mark as locked (would need to extend Transition interface)
        (transition as any).locked = true;
    });
}

/**
 * Helper function to reduce entropy gain
 */
export function reduceEntropyGain(entropy: Entropy, reductionFactor: number = 0.5): void {
    // This would need to be called during entropy updates
    // For now, we'll track this via an effect flag
    (entropy as any).entropyReductionFactor = reductionFactor;
}

