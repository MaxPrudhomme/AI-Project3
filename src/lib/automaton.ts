import { Biomes, Variants } from "./world";

interface State {
    biome: Biomes;
    variant: Variants;
    transitions: Transition[];
}

interface Transition {
    from: Biomes;
    to: Biomes;
    weight: number;
}

class Automaton {
    private states: State[] = [];

    constructor(states: State[]) {
        this.states = states;
    }

    getStates(): State[] {
        return this.states;
    }

    static createRandom(): Automaton {
        const biomeArray = Object.values(Biomes);
        const states: State[] = biomeArray.map((biome) => ({
            biome,
            variant: Variants.Default,
            transitions: [],
        }));

        const getRandomConnectionCount = (): number => {
            const rand = Math.random();
            if (rand < 0.1) return 0;
            if (rand < 0.45) return 1;
            if (rand < 0.8) return 2;
            if (rand < 0.95) return 3;
            return 4;
        };

        states.forEach((state) => {
            const connectionCount = getRandomConnectionCount();
            const possibleTargets = biomeArray.filter((b) => b !== state.biome);
            
            const shuffled = [...possibleTargets].sort(() => Math.random() - 0.5);
            const selectedTargets = shuffled.slice(0, connectionCount);

            const rawWeights = selectedTargets.map(() => Math.random());
            
            const sum = rawWeights.reduce((acc, w) => acc + w, 0);
            const normalizedWeights = sum > 0 
                ? rawWeights.map((w) => w / sum)
                : rawWeights;

            state.transitions = selectedTargets.map((target, index) => ({
                from: state.biome,
                to: target,
                weight: normalizedWeights[index],
            }));
        });

        return new Automaton(states);
    }
}

export { Automaton, type State, type Transition };