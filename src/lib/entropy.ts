import type { Transition } from "./automaton";

const thresholds = [31, 62, 93];

export class Entropy {
    private max: number;
    private current: number;
    private transitions: Transition[];
    private state: 'Stable' | 'Shifting' | 'Chaotic';
    private baseWeights: number[];

    constructor(transitions: Transition[]) {
        this.max = 100;
        this.current = 0;
        this.transitions = transitions;
        this.state = 'Stable';
        this.baseWeights = transitions.map(t => t.weight);
    }

    public getMax(): number {
        return this.max;
    }

    public getCurrent(): number {
        return this.current;
    }

    public update(amount: number): void {
        const before = this.current;
        this.current = Math.max(0, Math.min(this.max, this.current + amount));

        // Update state based on current entropy value
        if (this.current < thresholds[0]) {
            this.state = 'Stable';
        } else if (this.current < thresholds[1]) {
            this.state = 'Shifting';
        } else {
            this.state = 'Chaotic';
        }

        // Process transitions when crossing thresholds
        if (before < thresholds[0] && this.current >= thresholds[0]) {
            this.processTransitions();
        } else if (before < thresholds[1] && this.current >= thresholds[1]) {
            this.processTransitions();
        } else if (before < thresholds[2] && this.current >= thresholds[2]) {
            this.processTransitions();
        }
    }

    public getState(): 'Stable' | 'Shifting' | 'Chaotic' {
        return this.state;
    }

    public getTransitions(): Transition[] {
        return this.transitions;
    }

    public processTransitions(): void {
        switch (this.state) {
            case 'Stable':
                this.transitions.forEach(transition => {
                    transition.weight = 0;
                });
                break;
            case 'Shifting':
                // Apply ±15% variation to each transition based on base weights
                const shiftingWeights = this.baseWeights.map(baseWeight => {
                    const variation = Math.random() < 0.5 ? -0.15 : 0.15;
                    return Math.max(0, baseWeight * (1 + variation));
                });
                // Normalize to sum to 1.0
                const shiftingSum = shiftingWeights.reduce((acc, w) => acc + w, 0);
                if (shiftingSum > 0) {
                    this.transitions.forEach((transition, index) => {
                        transition.weight = shiftingWeights[index] / shiftingSum;
                    });
                }
                break;
            case 'Chaotic':
                // Apply ±15% variation to each transition based on base weights
                const chaoticWeights = this.baseWeights.map(baseWeight => {
                    const variation = Math.random() < 0.5 ? -0.40 : 0.40;
                    return Math.max(0, baseWeight * (1 + variation));
                });
                // Normalize to sum to 1.0
                const chaoticSum = chaoticWeights.reduce((acc, w) => acc + w, 0);
                if (chaoticSum > 0) {
                    this.transitions.forEach((transition, index) => {
                        transition.weight = chaoticWeights[index] / chaoticSum;
                    });
                }
                break;
        }
    }
}