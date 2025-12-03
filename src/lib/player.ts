import type { State } from "./automaton";

export class Player {
    private position: State;
    
    constructor(position: State) {
        this.position = position;
    }

    public getPosition(): State {
        return this.position;
    }

    public move(): State {
        const transitions = this.position.transitions;
        
        if (transitions.length === 0) {
            throw new Error(`No transitions available from state ${this.position.biome}`);
        }
        
        const random = Math.random();
        let cumulativeWeight = 0;
        
        for (const transition of transitions) {
            cumulativeWeight += transition.weight;
            if (random <= cumulativeWeight) {
                this.position = transition.to;
                return this.position;
            }
        }
        
        this.position = transitions[transitions.length - 1].to;
        return this.position;
    }
}