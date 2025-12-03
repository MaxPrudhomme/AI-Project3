import type { State } from "./automaton";

export interface Item {
    id: string;
    name: string;
    description: string;
    type: 'resource' | 'tool' | 'artifact' | 'consumable';
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    quantity: number;
}

export class Player {
    private position: State;
    private inventory: (Item | null)[];
    private readonly inventorySize = 9; // 3x3 grid
    
    constructor(position: State) {
        this.position = position;
        this.inventory = new Array(this.inventorySize).fill(null);
    }

    public getPosition(): State {
        return this.position;
    }

    public getInventory(): (Item | null)[] {
        return [...this.inventory];
    }

    public addItem(item: Item, slotIndex?: number): boolean {
        if (slotIndex !== undefined) {
            // Try to add to specific slot
            if (slotIndex >= 0 && slotIndex < this.inventorySize) {
                const existingItem = this.inventory[slotIndex];
                if (existingItem === null) {
                    this.inventory[slotIndex] = { ...item };
                    return true;
                } else if (existingItem.id === item.id) {
                    // Stack same items
                    this.inventory[slotIndex] = {
                        ...existingItem,
                        quantity: existingItem.quantity + item.quantity,
                    };
                    return true;
                }
            }
            return false;
        }

        // Try to stack with existing items first
        for (let i = 0; i < this.inventorySize; i++) {
            const existingItem = this.inventory[i];
            if (existingItem && existingItem.id === item.id) {
                this.inventory[i] = {
                    ...existingItem,
                    quantity: existingItem.quantity + item.quantity,
                };
                return true;
            }
        }

        // Find first empty slot
        for (let i = 0; i < this.inventorySize; i++) {
            if (this.inventory[i] === null) {
                this.inventory[i] = { ...item };
                return true;
            }
        }

        return false; // Inventory full
    }

    public removeItem(slotIndex: number, quantity: number = 1): Item | null {
        if (slotIndex < 0 || slotIndex >= this.inventorySize) {
            return null;
        }

        const item = this.inventory[slotIndex];
        if (!item) {
            return null;
        }

        if (item.quantity <= quantity) {
            // Remove entire item
            this.inventory[slotIndex] = null;
            return item;
        } else {
            // Reduce quantity
            const removedItem = { ...item, quantity };
            this.inventory[slotIndex] = {
                ...item,
                quantity: item.quantity - quantity,
            };
            return removedItem;
        }
    }

    public moveItem(fromSlot: number, toSlot: number): boolean {
        if (fromSlot < 0 || fromSlot >= this.inventorySize || 
            toSlot < 0 || toSlot >= this.inventorySize) {
            return false;
        }

        const fromItem = this.inventory[fromSlot];
        const toItem = this.inventory[toSlot];

        if (!fromItem) {
            return false;
        }

        // Swap items
        this.inventory[fromSlot] = toItem;
        this.inventory[toSlot] = fromItem;
        return true;
    }

    public getItemCount(): number {
        return this.inventory.filter(item => item !== null).length;
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