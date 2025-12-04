interface Artifact {
    name: string;
    description: string;
    class: 'minor' | 'major';
    effect: null | (() => void);
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

// Minor Artifacts (10) - Mix of biome-specific biases and generic mechanical effects
export const minorArtifacts: Artifact[] = [
    // Biome-specific bias items (5)
    {
        name: 'Whispering Compass',
        description: 'Points toward water. Biases transitions toward Ocean, River, Lake, Beach, and Swamp biomes.',
        class: 'minor',
        effect: null,
    },
    {
        name: 'Petrified Seed',
        description: 'A dormant seed that pulses with life. Favors transitions to Forest, Taiga, Plains, and biomes with Growing, Blooming, or Lush variants.',
        class: 'minor',
        effect: null,
    },
    {
        name: 'Sandglass of Stillness',
        description: 'Time moves slower around this artifact. Increases probability of Desert, Plains, and Barren variant biomes.',
        class: 'minor',
        effect: null,
    },
    {
        name: 'Frost Shard',
        description: 'A crystal of eternal winter. Biases toward Snowy, Taiga, Mountain, and Frozen variant biomes.',
        class: 'minor',
        effect: null,
    },
    {
        name: 'Ember Core',
        description: 'A warm, glowing stone that never cools. Biases toward Desert, Mountain, and Volcanic or Burning variant biomes.',
        class: 'minor',
        effect: null,
    },
    // Generic mechanical items (5)
    {
        name: 'Probability Mirror',
        description: 'Temporarily swaps the transition probabilities of the two most likely outgoing edges from the current biome. Lasts for one transition.',
        class: 'minor',
        effect: null,
    },
    {
        name: 'Reverse Current',
        description: 'Creates a temporary reverse edge, allowing travel back along the last transition taken. The reversed edge disappears after one use.',
        class: 'minor',
        effect: null,
    },
    {
        name: 'Weight Shifter',
        description: 'Redistributes transition weights evenly among all outgoing edges from the current biome for the next transition, making all paths equally likely.',
        class: 'minor',
        effect: null,
    },
    {
        name: 'Path Anchor',
        description: 'Locks the transition probabilities of the current biome\'s outgoing edges, preventing entropy from modifying them until you leave this biome.',
        class: 'minor',
        effect: null,
    },
    {
        name: 'Entropy Buffer',
        description: 'Absorbs entropy from the next transition, reducing entropy gain by half. Consumed after one use.',
        class: 'minor',
        effect: null,
    },
];

// Major Artifacts (5) - Can transform or stabilize biomes
export const majorArtifacts: Artifact[] = [
    {
        name: 'Crystal Obelisk',
        description: 'A towering structure of pure dream-stuff. When anchored, permanently transforms any biome into a Crystalline variant, creating a stable Anchor point immune to entropy.',
        class: 'major',
        effect: null,
    },
    {
        name: 'Heart of the Dream',
        description: 'The core of stability itself. Sacrificing this creates an Anchor that stabilizes the entire region, dramatically reducing entropy at great cost. The biome becomes permanently fixed.',
        class: 'major',
        effect: null,
    },
    {
        name: 'The Weaver\'s Loom',
        description: 'Rewrites the fabric of reality around it. Can permanently merge two neighboring biomes into a hybrid variant or seal a biome entirely, removing it from the graph.',
        class: 'major',
        effect: null,
    },
    {
        name: 'Anchor of Memory',
        description: 'Preserves a moment in time forever. When placed, locks a biome in its current state and variant, making it immune to entropy mutations, fractures, and merges.',
        class: 'major',
        effect: null,
    },
    {
        name: 'Threshold Key',
        description: 'A key that unlocks paths to the waking world. Carrying this increases the chance of discovering Gateway biomes (Lucid Gates) and reveals hidden paths to them.',
        class: 'major',
        effect: null,
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
