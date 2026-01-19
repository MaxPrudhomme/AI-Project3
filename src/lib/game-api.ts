import type { Automaton } from './automaton';
import type { Player, Item } from './player';
import type { Entropy } from './entropy';
import type { EffectManager } from './effects';

/**
 * Game API - Provides minimal context interface for LLM to discover and understand the game
 */

export interface GameStateResponse {
  currentLocation: {
    biome: string;
    variant: string;
    discovered: boolean;
  };
  connectedLocations: Array<{
    biome: string;
    variant: string;
    probability: number;
    discovered: boolean;
  }>;
  entropy: {
    current: number;
    max: number;
    state: string;
  };
  inventory: Array<{
    name: string;
    description: string;
    type: string;
  } | null>;
  activeEffects: Array<{
    name: string;
    description: string;
    duration: number | 'permanent';
  }>;
  stats: {
    movesCount: number;
    itemsFound: number;
    itemsUsed: number;
  };
}

export interface ActionResult {
  success: boolean;
  message: string;
  newState?: GameStateResponse;
}

export class GameAPI {
  private player: Player;
  private entropy: Entropy;
  private effectManager: EffectManager;

  constructor(
    _automaton: Automaton,
    player: Player,
    entropy: Entropy,
    effectManager: EffectManager
  ) {
    // automaton parameter kept for API consistency but not stored
    this.player = player;
    this.entropy = entropy;
    this.effectManager = effectManager;
  }

  /**
   * Get current game state - minimal context for LLM to discover the game
   */
  getGameState(): GameStateResponse {
    const currentState = this.player.getPosition();
    const connections = currentState.transitions;

    // Calculate transition probabilities (effects are already applied to transition weights)
    const totalWeight = connections.reduce((sum, conn) => sum + conn.weight, 0);

    return {
      currentLocation: {
        biome: currentState.biome,
        variant: currentState.variant,
        discovered: true,
      },
      connectedLocations: connections.map((conn) => ({
        biome: conn.to.biome,
        variant: conn.to.variant,
        probability: Math.round((conn.weight / totalWeight) * 100),
        discovered: conn.to.discovered,
      })),
      entropy: {
        current: this.entropy.getCurrent(),
        max: this.entropy.getMax(),
        state: this.entropy.getState(),
      },
      inventory: this.player.getInventory().map((item) =>
        item
          ? {
              name: item.name,
              description: item.description,
              type: item.type,
            }
          : null
      ),
      activeEffects: this.effectManager.getActiveEffects().map((effect) => ({
        name: effect.name,
        description: effect.description,
        duration: effect.duration === -1 || effect.duration === undefined ? 'permanent' : effect.duration,
      })),
      stats: {
        movesCount: this.entropy.getCurrent(), // Use current entropy as move approximation
        itemsFound: this.player.getInventory().filter((item) => item !== null).length,
        itemsUsed: 0, // We'll track this separately if needed
      },
    };
  }

  /**
   * Get available actions that LLM can take
   */
  getAvailableActions(): string[] {
    const actions = ['move'];

    // Check if any items in inventory
    const hasItems = this.player.getInventory().some((item) => item !== null);
    if (hasItems) {
      actions.push('use_item');
    }

    return actions;
  }

  /**
   * Get inventory items with their indices
   */
  getInventoryItems(): Array<{ index: number; item: Item | null }> {
    return this.player.getInventory().map((item, index) => ({ index, item }));
  }

  /**
   * Describe the game to the LLM (minimal initial context)
   */
  getGameDescription(): string {
    return `You are exploring a mysterious graph-based world. You can move between connected locations (biomes), each with different variants. Your goal is to discover and explore this world.

Available information:
- Current location: Shows your current biome and variant
- Connected locations: Shows where you can potentially move, with probabilities
- Entropy: A measure of chaos in the world (affects movement probabilities)
- Inventory: You may find artifacts that can help you
- Active effects: Effects from used artifacts

Actions you can take:
- move: Attempt to move to a connected location (movement is probabilistic based on weights)
- use_item [index]: Use an item from your inventory by its index (0-8)

Discover the mechanics by playing!`;
  }

  /**
   * Format the game state as a text prompt for the LLM
   */
  formatStateForLLM(): string {
    const state = this.getGameState();

    let prompt = `=== Current Game State ===\n\n`;
    prompt += `Location: ${state.currentLocation.biome} (${state.currentLocation.variant})\n\n`;

    prompt += `Connected Locations:\n`;
    state.connectedLocations.forEach((loc, idx) => {
      const discovered = loc.discovered ? '' : '[UNDISCOVERED]';
      prompt += `  ${idx + 1}. ${loc.biome} (${loc.variant}) - ${loc.probability}% chance ${discovered}\n`;
    });

    prompt += `\nEntropy: ${state.entropy.current}/${state.entropy.max} (${state.entropy.state})\n`;

    if (state.activeEffects.length > 0) {
      prompt += `\nActive Effects:\n`;
      state.activeEffects.forEach((effect) => {
        const duration = effect.duration === 'permanent' ? 'permanent' : `${effect.duration} moves left`;
        prompt += `  - ${effect.name}: ${effect.description} (${duration})\n`;
      });
    }

    prompt += `\nInventory:\n`;
    state.inventory.forEach((item, idx) => {
      if (item) {
        prompt += `  [${idx}] ${item.name} (${item.type}): ${item.description}\n`;
      } else {
        prompt += `  [${idx}] Empty\n`;
      }
    });

    prompt += `\nStats: ${state.stats.movesCount} moves made\n`;

    prompt += `\nWhat action do you want to take? (move / use_item [index])`;

    return prompt;
  }
}
