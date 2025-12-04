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
