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

/**
 * Find all nodes that are at least minDistance movements away from the starting node using BFS
 */
function findNodesAtDistance(
    states: State[],
    startState: State,
    minDistance: number
): State[] {
    const stateMap = new Map<string, State>();
    states.forEach(s => stateMap.set(s.biome, s));

    const distances = new Map<string, number>();
    const queue: { state: State; distance: number }[] = [{ state: startState, distance: 0 }];
    distances.set(startState.biome, 0);

    while (queue.length > 0) {
        const { state, distance } = queue.shift()!;

        // Explore all neighbors
        state.transitions.forEach(transition => {
            const neighborBiome = transition.to.biome;
            if (!distances.has(neighborBiome)) {
                const newDistance = distance + 1;
                distances.set(neighborBiome, newDistance);
                const neighborState = stateMap.get(neighborBiome);
                if (neighborState) {
                    queue.push({ state: neighborState, distance: newDistance });
                }
            }
        });
    }

    // Return all nodes at distance >= minDistance
    return states.filter(state => {
        const distance = distances.get(state.biome) ?? Infinity;
        return distance >= minDistance;
    });
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
        // Exclude Gateway from initial biome array - it will be added later
        const biomeArray = Object.values(Biomes).filter(b => b !== Biomes.Gateway);
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

        // Find candidate starting position (states with outgoing edges are valid starting points)
        // Since App.tsx will select from these, we use one as a reference for gateway placement
        const validStartingStates = states.filter(s => s.transitions.length > 0);
        const candidateStartingState = validStartingStates.length > 0 
            ? validStartingStates[Math.floor(Math.random() * validStartingStates.length)]
            : states[0];
        
        // Find nodes that are at least 3 movements away from candidate starting position
        const candidateNodes = findNodesAtDistance(states, candidateStartingState, 3);
        
        // Create gateway node
        const gatewayState: State = {
            biome: Biomes.Gateway,
            variant: Variants.Default,
            transitions: [], // Gateway has no outgoing transitions (it's the exit)
            discovered: false,
        };
        states.push(gatewayState);
        stateToBiome.set(Biomes.Gateway, gatewayState);

        // Connect gateway with incoming edges (mostly 1, sometimes 2)
        const incomingConnectionCount = Math.random() < 0.8 ? 1 : 2;
        
        // Select nodes to connect to gateway
        // CRITICAL: Gateway cannot be connected to a node that only has it as the connection
        // So we must only use nodes that already have at least one existing transition
        
        // First, try to find nodes from candidate nodes (at least 3 movements away)
        let availableNodes = candidateNodes.filter(s => s.transitions.length > 0);
        
        // If no candidate nodes with transitions exist, search all nodes (except gateway)
        if (availableNodes.length === 0) {
            availableNodes = states.filter(s => 
                s.biome !== Biomes.Gateway && s.transitions.length > 0
            );
        }
        
        // If still no nodes found (shouldn't happen due to connectivity checks), 
        // we can't safely add gateway connections
        if (availableNodes.length === 0) {
            console.warn('No nodes with existing transitions found for gateway connection');
        }
        
        // Shuffle and select nodes to connect to gateway
        const shuffledNodes = [...availableNodes].sort(() => Math.random() - 0.5);
        const nodesToConnect = shuffledNodes.slice(0, Math.min(incomingConnectionCount, availableNodes.length));

        // Add transitions TO the gateway with very low weights (5% or lower, randomized)
        nodesToConnect.forEach((sourceState) => {
            // Create a very low weight (base rate) for entering gateway
            // Randomize between 0.5% and 5% to avoid people seeing it easily
            const gatewayWeight = 0.005 + Math.random() * 0.045; // 0.005 to 0.05 (0.5% to 5%)
            
            // Add transition from source to gateway
            sourceState.transitions.push({
                from: sourceState,
                to: gatewayState,
                weight: gatewayWeight,
            });
        });

        // Re-normalize weights for all states that now have gateway transitions
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