import { LLMService, type LLMConfig } from './llm-service';
import { GameAPI } from './game-api';
import type { Automaton } from './automaton';
import type { Player } from './player';
import type { Entropy } from './entropy';
import type { EffectManager } from './effects';

/**
 * LLM Player Manager - Orchestrates LLM playing the game
 */

export interface LLMActivity {
  id: string;
  timestamp: number;
  type: 'thinking' | 'action' | 'result' | 'error';
  content: string;
  reasoning?: string;
}

export type LLMPlayerState = 'idle' | 'running' | 'paused' | 'error';

export interface LLMPlayerCallbacks {
  onActivityUpdate: (activity: LLMActivity) => void;
  onStateChange: (state: LLMPlayerState) => void;
  onMove: (result: MoveResult) => void;
  onUseItem: (index: number) => void;
}

export interface MoveResult {
  success: boolean;
  fromBiome: string;
  toBiome: string;
  artifact?: {
    name: string;
    description: string;
    class: string;
  };
}

export class LLMPlayer {
  private llmService: LLMService;
  private gameAPI: GameAPI;
  private callbacks: LLMPlayerCallbacks;
  private state: LLMPlayerState = 'idle';
  private activities: LLMActivity[] = [];
  private loopInterval?: number;
  private delayBetweenActions: number = 3000; // 3 seconds between actions

  constructor(
    config: LLMConfig,
    automaton: Automaton,
    player: Player,
    entropy: Entropy,
    effectManager: EffectManager,
    callbacks: LLMPlayerCallbacks
  ) {
    this.llmService = new LLMService(config);
    this.gameAPI = new GameAPI(automaton, player, entropy, effectManager);
    this.callbacks = callbacks;
  }

  /**
   * Start the LLM player
   */
  async start(): Promise<void> {
    if (this.state === 'running') {
      return;
    }

    try {
      this.setState('running');
      this.addActivity('thinking', 'Initializing LLM player...');

      // Initialize LLM with game description
      await this.llmService.initialize(this.gameAPI.getGameDescription());

      this.addActivity('result', 'LLM player initialized. Starting game loop...');

      // Start the game loop
      this.gameLoop();
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Pause the LLM player
   */
  pause(): void {
    if (this.state === 'running') {
      this.setState('paused');
      if (this.loopInterval) {
        clearTimeout(this.loopInterval);
        this.loopInterval = undefined;
      }
      this.addActivity('result', 'LLM player paused');
    }
  }

  /**
   * Resume the LLM player
   */
  resume(): void {
    if (this.state === 'paused') {
      this.setState('running');
      this.addActivity('result', 'LLM player resumed');
      this.gameLoop();
    }
  }

  /**
   * Stop the LLM player
   */
  stop(): void {
    this.setState('idle');
    if (this.loopInterval) {
      clearTimeout(this.loopInterval);
      this.loopInterval = undefined;
    }
    this.llmService.reset();
    this.addActivity('result', 'LLM player stopped');
  }

  /**
   * Main game loop
   */
  private async gameLoop(): Promise<void> {
    if (this.state !== 'running') {
      return;
    }

    try {
      // Get current game state
      const statePrompt = this.gameAPI.formatStateForLLM();

      // Get LLM decision
      this.addActivity('thinking', 'LLM is analyzing the game state...');
      const decision = await this.llmService.getDecision(statePrompt);

      this.addActivity('thinking', decision.reasoning, decision.reasoning);
      this.addActivity('action', `Action: ${decision.action}`);

      // Execute the action
      await this.executeAction(decision.action);

      // Schedule next iteration
      if (this.state === 'running') {
        this.loopInterval = window.setTimeout(
          () => this.gameLoop(),
          this.delayBetweenActions
        );
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Execute an action from the LLM
   */
  private async executeAction(action: string): Promise<void> {
    const actionLower = action.toLowerCase().trim();

    if (actionLower === 'move') {
      await this.executeMove();
    } else if (actionLower.startsWith('use_item') || actionLower.startsWith('use item')) {
      const indexMatch = action.match(/(\d+)/);
      if (indexMatch) {
        const index = parseInt(indexMatch[1]);
        this.executeUseItem(index);
      } else {
        this.addActivity('error', 'Invalid use_item command: no index specified');
      }
    } else {
      this.addActivity('error', `Unknown action: ${action}`);
      this.llmService.addFeedback(`Error: Unknown action "${action}". Please use "move" or "use_item [index]".`);
    }
  }

  /**
   * Execute move action
   */
  private async executeMove(): Promise<void> {
    try {
      const state = this.gameAPI.getGameState();
      const fromBiome = `${state.currentLocation.biome} (${state.currentLocation.variant})`;

      // Trigger the actual move in the game
      // This will be handled by the callback which App.tsx will implement
      this.callbacks.onMove({ success: true, fromBiome, toBiome: '' });

      // The result will be updated by App.tsx after the move completes
      this.addActivity('result', 'Move executed');
    } catch (error) {
      this.addActivity('error', `Move failed: ${error}`);
      this.llmService.addFeedback(`Move failed: ${error}`);
    }
  }

  /**
   * Execute use item action
   */
  private executeUseItem(index: number): void {
    try {
      const inventoryItems = this.gameAPI.getInventoryItems();
      const slot = inventoryItems[index];

      if (!slot || !slot.item) {
        this.addActivity('error', `No item at inventory slot ${index}`);
        this.llmService.addFeedback(`Error: No item at slot ${index}`);
        return;
      }

      this.addActivity('result', `Using item: ${slot.item.name}`);
      this.callbacks.onUseItem(index);
      this.llmService.addFeedback(`Successfully used ${slot.item.name}`);
    } catch (error) {
      this.addActivity('error', `Use item failed: ${error}`);
      this.llmService.addFeedback(`Use item failed: ${error}`);
    }
  }

  /**
   * Update move result (called after move completes)
   */
  updateMoveResult(result: MoveResult): void {
    const toBiome = result.toBiome;
    this.addActivity('result', `Moved to ${toBiome}`);

    let feedback = `You moved to ${toBiome}.`;
    if (result.artifact) {
      feedback += ` You found an artifact: ${result.artifact.name} - ${result.artifact.description}`;
    }

    this.llmService.addFeedback(feedback);
  }

  /**
   * Add an activity log entry
   */
  private addActivity(
    type: LLMActivity['type'],
    content: string,
    reasoning?: string
  ): void {
    const activity: LLMActivity = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      type,
      content,
      reasoning,
    };

    this.activities.push(activity);

    // Keep only last 50 activities
    if (this.activities.length > 50) {
      this.activities = this.activities.slice(-50);
    }

    this.callbacks.onActivityUpdate(activity);
  }

  /**
   * Handle errors
   */
  private handleError(error: unknown): void {
    console.error('LLM Player error:', error);
    this.setState('error');
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.addActivity('error', `Error: ${errorMessage}`);

    // Stop on error
    if (this.loopInterval) {
      clearTimeout(this.loopInterval);
      this.loopInterval = undefined;
    }
  }

  /**
   * Set state and notify
   */
  private setState(state: LLMPlayerState): void {
    this.state = state;
    this.callbacks.onStateChange(state);
  }

  /**
   * Get current state
   */
  getState(): LLMPlayerState {
    return this.state;
  }

  /**
   * Get all activities
   */
  getActivities(): LLMActivity[] {
    return [...this.activities];
  }

  /**
   * Update LLM config
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.llmService.updateConfig(config);
  }

  /**
   * Set delay between actions
   */
  setDelay(ms: number): void {
    this.delayBetweenActions = ms;
  }
}
