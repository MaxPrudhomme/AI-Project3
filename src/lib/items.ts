import type { EffectContext, ActiveEffect } from './effects';
import { Biomes, Variants } from './world';
import { biasTransitionsTowardBiomes, biasTransitionsTowardVariants, swapTransitionWeights, equalizeTransitionWeights, reduceEntropyGain } from './effects';

interface Artifact {
    name: string;
    description: string;
    class: 'minor' | 'major';
    effect: null | ((context: EffectContext) => ActiveEffect | null);
}

interface Fragment {
    name: string;
    description: string;
    set: string;
    effect: null | (() => void);
}

interface Motif {
    name: string;
    description: string;
    tag: string;
}

// Effect functions for minor artifacts
function createWhisperingCompassEffect(context: EffectContext): ActiveEffect {
    const transitions = context.currentState.transitions;
    const effect: ActiveEffect = {
        id: 'whispering-compass',
        name: 'Whispering Compass',
        description: 'Biasing transitions toward water biomes',
        duration: 1,
    };
    
    biasTransitionsTowardBiomes(transitions, [
        Biomes.Ocean,
        Biomes.River,
        Biomes.Lake,
        Biomes.Beach,
        Biomes.Swamp,
    ], 1.5, effect, context.currentState.biome);

    return effect;
}

function createPetrifiedSeedEffect(context: EffectContext): ActiveEffect {
    const transitions = context.currentState.transitions;
    const effect: ActiveEffect = {
        id: 'petrified-seed',
        name: 'Petrified Seed',
        description: 'Favoring forest and growing biomes',
        duration: 1,
    };
    
    biasTransitionsTowardBiomes(transitions, [
        Biomes.Forest,
        Biomes.Taiga,
        Biomes.Plains,
    ], 1.5, effect, context.currentState.biome);
    biasTransitionsTowardVariants(transitions, [
        Variants.Growing,
        Variants.Blooming,
        Variants.Lush,
    ], 1.3, effect, context.currentState.biome);

    return effect;
}

function createSandglassEffect(context: EffectContext): ActiveEffect {
    const transitions = context.currentState.transitions;
    const effect: ActiveEffect = {
        id: 'sandglass-stillness',
        name: 'Sandglass of Stillness',
        description: 'Increasing probability of desert and barren biomes',
        duration: 1,
    };
    
    biasTransitionsTowardBiomes(transitions, [
        Biomes.Desert,
        Biomes.Plains,
    ], 1.5, effect, context.currentState.biome);
    biasTransitionsTowardVariants(transitions, [
        Variants.Barren,
    ], 1.3, effect, context.currentState.biome);

    return effect;
}

function createFrostShardEffect(context: EffectContext): ActiveEffect {
    const transitions = context.currentState.transitions;
    const effect: ActiveEffect = {
        id: 'frost-shard',
        name: 'Frost Shard',
        description: 'Biasing toward snowy and frozen biomes',
        duration: 1,
    };
    
    biasTransitionsTowardBiomes(transitions, [
        Biomes.Snowy,
        Biomes.Taiga,
        Biomes.Mountain,
    ], 1.5, effect, context.currentState.biome);
    biasTransitionsTowardVariants(transitions, [
        Variants.Frozen,
    ], 1.3, effect, context.currentState.biome);

    return effect;
}

function createEmberCoreEffect(context: EffectContext): ActiveEffect {
    const transitions = context.currentState.transitions;
    const effect: ActiveEffect = {
        id: 'ember-core',
        name: 'Ember Core',
        description: 'Favoring desert, mountain, and volcanic biomes',
        duration: 1,
    };
    
    biasTransitionsTowardBiomes(transitions, [
        Biomes.Desert,
        Biomes.Mountain,
    ], 1.5, effect, context.currentState.biome);
    biasTransitionsTowardVariants(transitions, [
        Variants.Volcanic,
        Variants.Burning,
    ], 1.3, effect, context.currentState.biome);

    return effect;
}

function createProbabilityMirrorEffect(context: EffectContext): ActiveEffect {
    const transitions = context.currentState.transitions;
    const effect: ActiveEffect = {
        id: 'probability-mirror',
        name: 'Probability Mirror',
        description: 'Swapped transition probabilities',
        duration: 1,
    };
    
    swapTransitionWeights(transitions, effect, context.currentState.biome);

    return effect;
}

function createReverseCurrentEffect(_context: EffectContext): ActiveEffect {
    // TODO: Implement reverse edge creation
    // This would require tracking the last transition and creating a reverse edge
    // For now, we'll just mark it as active
    return {
        id: 'reverse-current',
        name: 'Reverse Current',
        description: 'Reverse edge available for next transition',
        duration: 1,
    };
}

function createWeightShifterEffect(context: EffectContext): ActiveEffect {
    const transitions = context.currentState.transitions;
    const effect: ActiveEffect = {
        id: 'weight-shifter',
        name: 'Weight Shifter',
        description: 'All paths equally likely',
        duration: 1,
    };
    
    equalizeTransitionWeights(transitions, effect, context.currentState.biome);

    return effect;
}

function createPathAnchorEffect(context: EffectContext): ActiveEffect {
    // Mark transitions as locked (prevent entropy modification)
    const transitions = context.currentState.transitions;
    transitions.forEach(transition => {
        (transition as any).locked = true;
    });

    return {
        id: 'path-anchor',
        name: 'Path Anchor',
        description: 'Transition probabilities locked',
        duration: undefined, // Lasts until leaving biome
        onExpire: () => {
            transitions.forEach(transition => {
                (transition as any).locked = false;
            });
        },
    };
}

function createEntropyBufferEffect(context: EffectContext): ActiveEffect {
    reduceEntropyGain(context.entropy, 0.5);

    return {
        id: 'entropy-buffer',
        name: 'Entropy Buffer',
        description: 'Next entropy gain reduced by 50%',
        duration: 1,
        onExpire: () => {
            (context.entropy as any).entropyReductionFactor = undefined;
        },
    };
}

// Minor Artifacts (10) - Mix of biome-specific biases and generic mechanical effects
export const minorArtifacts: Artifact[] = [
    // Biome-specific bias items (5)
    {
        name: 'Whispering Compass',
        description: 'Points toward water. Biases transitions toward Ocean, River, Lake, Beach, and Swamp biomes.',
        class: 'minor',
        effect: createWhisperingCompassEffect,
    },
    {
        name: 'Petrified Seed',
        description: 'A dormant seed that pulses with life. Favors transitions to Forest, Taiga, Plains, and biomes with Growing, Blooming, or Lush variants.',
        class: 'minor',
        effect: createPetrifiedSeedEffect,
    },
    {
        name: 'Sandglass of Stillness',
        description: 'Time moves slower around this artifact. Increases probability of Desert, Plains, and Barren variant biomes.',
        class: 'minor',
        effect: createSandglassEffect,
    },
    {
        name: 'Frost Shard',
        description: 'A crystal of eternal winter. Biases toward Snowy, Taiga, Mountain, and Frozen variant biomes.',
        class: 'minor',
        effect: createFrostShardEffect,
    },
    {
        name: 'Ember Core',
        description: 'A warm, glowing stone that never cools. Biases toward Desert, Mountain, and Volcanic or Burning variant biomes.',
        class: 'minor',
        effect: createEmberCoreEffect,
    },
    // Generic mechanical items (5)
    {
        name: 'Probability Mirror',
        description: 'Temporarily swaps the transition probabilities of the two most likely outgoing edges from the current biome. Lasts for one transition.',
        class: 'minor',
        effect: createProbabilityMirrorEffect,
    },
    {
        name: 'Reverse Current',
        description: 'Creates a temporary reverse edge, allowing travel back along the last transition taken. The reversed edge disappears after one use.',
        class: 'minor',
        effect: createReverseCurrentEffect,
    },
    {
        name: 'Weight Shifter',
        description: 'Redistributes transition weights evenly among all outgoing edges from the current biome for the next transition, making all paths equally likely.',
        class: 'minor',
        effect: createWeightShifterEffect,
    },
    {
        name: 'Path Anchor',
        description: 'Locks the transition probabilities of the current biome\'s outgoing edges, preventing entropy from modifying them until you leave this biome.',
        class: 'minor',
        effect: createPathAnchorEffect,
    },
    {
        name: 'Entropy Buffer',
        description: 'Absorbs entropy from the next transition, reducing entropy gain by half. Consumed after one use.',
        class: 'minor',
        effect: createEntropyBufferEffect,
    },
];

// Effect functions for major artifacts
function createCrystalObeliskEffect(_context: EffectContext): ActiveEffect {
    // TODO: Implement biome transformation to Crystalline variant
    // This would require modifying the state's variant
    return {
        id: 'crystal-obelisk',
        name: 'Crystal Obelisk',
        description: 'Transforming biome to Crystalline variant',
        duration: undefined, // Permanent until manually removed
    };
}

function createHeartOfDreamEffect(_context: EffectContext): ActiveEffect {
    // TODO: Implement anchor creation and entropy reduction
    return {
        id: 'heart-of-dream',
        name: 'Heart of the Dream',
        description: 'Creating anchor and stabilizing region',
        duration: undefined, // Permanent
    };
}

function createWeaversLoomEffect(_context: EffectContext): ActiveEffect {
    // TODO: Implement biome merging/sealing
    return {
        id: 'weavers-loom',
        name: 'The Weaver\'s Loom',
        description: 'Reality rewriting active',
        duration: undefined, // Permanent until used
    };
}

function createAnchorOfMemoryEffect(context: EffectContext): ActiveEffect {
    // Lock biome state and variant
    const state = context.currentState;
    (state as any).locked = true;
    (state as any).immuneToEntropy = true;

    return {
        id: 'anchor-of-memory',
        name: 'Anchor of Memory',
        description: 'Biome locked and immune to entropy',
        duration: undefined, // Permanent
        onExpire: () => {
            (state as any).locked = false;
            (state as any).immuneToEntropy = false;
        },
    };
}

function createThresholdKeyEffect(context: EffectContext): ActiveEffect {
    // Increase Gateway biome discovery chance
    const transitions = context.currentState.transitions;
    const effect: ActiveEffect = {
        id: 'threshold-key',
        name: 'Threshold Key',
        description: 'Increased chance of discovering Gateway biomes',
        duration: undefined, // Active while carried
    };
    
    biasTransitionsTowardBiomes(transitions, [Biomes.Gateway], 2.0, effect, context.currentState.biome);

    return effect;
}

// Major Artifacts (5) - Can transform or stabilize biomes
export const majorArtifacts: Artifact[] = [
    {
        name: 'Crystal Obelisk',
        description: 'A towering structure of pure dream-stuff. When anchored, permanently transforms any biome into a Crystalline variant, creating a stable Anchor point immune to entropy.',
        class: 'major',
        effect: createCrystalObeliskEffect,
    },
    {
        name: 'Heart of the Dream',
        description: 'The core of stability itself. Sacrificing this creates an Anchor that stabilizes the entire region, dramatically reducing entropy at great cost. The biome becomes permanently fixed.',
        class: 'major',
        effect: createHeartOfDreamEffect,
    },
    {
        name: 'The Weaver\'s Loom',
        description: 'Rewrites the fabric of reality around it. Can permanently merge two neighboring biomes into a hybrid variant or seal a biome entirely, removing it from the graph.',
        class: 'major',
        effect: createWeaversLoomEffect,
    },
    {
        name: 'Anchor of Memory',
        description: 'Preserves a moment in time forever. When placed, locks a biome in its current state and variant, making it immune to entropy mutations, fractures, and merges.',
        class: 'major',
        effect: createAnchorOfMemoryEffect,
    },
    {
        name: 'Threshold Key',
        description: 'A key that unlocks paths to the waking world. Carrying this increases the chance of discovering Gateway biomes (Lucid Gates) and reveals hidden paths to them.',
        class: 'major',
        effect: createThresholdKeyEffect,
    },
];

// Motifs (5) - Thematic tags that spread and combine with biomes
export const motifs: Motif[] = [
    {
        name: 'Burning',
        description: 'Fire and heat permeate the dream. Spreads to create Burning variants and favors transitions to Desert, Mountain, and Volcanic biomes.',
        tag: 'burning',
    },
    {
        name: 'Frozen',
        description: 'Winter\'s touch lingers. Transforms biomes into Frozen variants and spreads through transitions, favoring Snowy, Taiga, and Mountain biomes.',
        tag: 'frozen',
    },
    {
        name: 'Shrouded',
        description: 'Mist and mystery obscure the dream. Creates Shrouded variants and spreads to Swamp, Forest, and Weeping biomes, increasing uncertainty.',
        tag: 'shrouded',
    },
    {
        name: 'Toxic',
        description: 'Corruption and decay spread through the dream. High entropy creates this motif, which spreads chaos and creates Toxic variants.',
        tag: 'toxic',
    },
    {
        name: 'Crystalline',
        description: 'Clarity and structure emerge. Rare motif that appears near Anchors or when entropy is low, creating Crystalline variants and stabilizing transitions.',
        tag: 'crystalline',
    },
];

// Export types
export type { Artifact, Fragment, Motif };

// Artifact generation functions
export function generateRandomArtifact(): Artifact | null {
    // 50% chance to find an artifact
    if (Math.random() > 0.5) {
        return null;
    }
    
    // 10% chance for major, 90% chance for minor
    const isMajor = Math.random() < 0.1;
    const artifactPool = isMajor ? majorArtifacts : minorArtifacts;
    
    if (artifactPool.length === 0) {
        return null;
    }
    
    const randomIndex = Math.floor(Math.random() * artifactPool.length);
    return artifactPool[randomIndex];
}

/**
 * Find an artifact by name (used to look up effects from items)
 */
export function findArtifactByName(name: string): Artifact | null {
    const allArtifacts = [...minorArtifacts, ...majorArtifacts];
    return allArtifacts.find(a => a.name === name) || null;
}
