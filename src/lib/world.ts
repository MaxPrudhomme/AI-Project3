export const Biomes = {
    Ocean: 'Ocean',
    Plains: 'Plains',
    Forest: 'Forest',
    Mountain: 'Mountain',
    Desert: 'Desert',
    Swamp: 'Swamp',
    Taiga: 'Taiga',
    Snowy: 'Snowy',
    Beach: 'Beach',
    River: 'River',
    Lake: 'Lake',
    Gateway: 'Gateway',
} as const;

export const Variants = {
    Default: 'Default',
    Burning: 'Burning',
    Dead: 'Dead',
    Growing: 'Growing',
    Shrouded: 'Shrouded',
    Weeping: 'Weeping',
    Wet: 'Wet',
    Frozen: 'Frozen',
    Blooming: 'Blooming',
    Barren: 'Barren',
    Lush: 'Lush',
    Toxic: 'Toxic',
    Volcanic: 'Volcanic',
    Crystalline: 'Crystalline',
    Ancient: 'Ancient',
} as const;

export type Biomes = typeof Biomes[keyof typeof Biomes];
export type Variants = typeof Variants[keyof typeof Variants];