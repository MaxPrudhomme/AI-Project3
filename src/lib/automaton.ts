import { Biomes, Variants } from "./world";

interface State {
    biome: Biomes;
    variant: Variants;
    transitions: Transition[];
    discovered: boolean;
}

interface Transition {
    from: State;
    to: State;
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
            discovered: false,
        }));

        const getRandomConnectionCount = (): number => {
            const rand = Math.random();
            if (rand < 0.1) return 0;
            if (rand < 0.45) return 1;
            if (rand < 0.8) return 2;
            if (rand < 0.95) return 3;
            return 4;
        };

        // Map biomes to their corresponding state objects
        const stateToBiome = new Map(states.map(s => [s.biome, s]));

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
                from: state,
                to: stateToBiome.get(target)!,
                weight: normalizedWeights[index],
            }));
        });

        // Ensure every node has at least one connection (either incoming or outgoing)
        states.forEach((state) => {
            const hasOutgoing = state.transitions.length > 0;
            
            // Check if this node has any incoming connections
            const hasIncoming = states.some((otherState) => 
                otherState.transitions.some((transition) => transition.to.biome === state.biome)
            );

            // If node has neither outgoing nor incoming connections, add at least one
            if (!hasOutgoing && !hasIncoming) {
                // Add an outgoing connection to a random other state
                const possibleTargets = biomeArray.filter((b) => b !== state.biome);
                const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
                const targetState = stateToBiome.get(randomTarget)!;
                
                state.transitions.push({
                    from: state,
                    to: targetState,
                    weight: 1.0,
                });
            }
        });

        // Normalize weights after ensuring connectivity
        states.forEach((state) => {
            if (state.transitions.length > 0) {
                const sum = state.transitions.reduce((acc, t) => acc + t.weight, 0);
                if (sum > 0) {
                    state.transitions.forEach((transition) => {
                        transition.weight = transition.weight / sum;
                    });
                }
            }
        });

        return new Automaton(states);
    }
}

export { Automaton, type State, type Transition };