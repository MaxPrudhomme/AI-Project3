import type { State, Transition } from './automaton';
import type { Item } from './player';
import type { Entropy } from './entropy';

export interface LLMModel {
  id: string;
  name: string;
}

export interface GameContext {
  currentBiome: string;
  transitions: { targetBiome: string; weight: number }[];
  inventory: (Item | null)[];
  entropyLevel: number;
  entropyMax: number;
  discoveredBiomes: string[];
  goal: string;
}

export interface LLMDecision {
  action: 'move' | 'use_item';
  itemIndex?: number;
  reasoning: string;
}

export interface LLMResponse {
  decision: LLMDecision;
  rawResponse: string;
}

// LM Studio default API endpoint (OpenAI compatible)
const LM_STUDIO_BASE_URL = 'http://localhost:1234/v1';

/**
 * Fetch available models from LM Studio
 */
export async function fetchAvailableModels(): Promise<LLMModel[]> {
  try {
    const response = await fetch(`${LM_STUDIO_BASE_URL}/models`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data.map((model: { id: string }) => ({
      id: model.id,
      name: model.id,
    }));
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

/**
 * Build a minimal context prompt for the LLM
 */
function buildContextPrompt(context: GameContext): string {
  const transitionsList = context.transitions
    .map((t, i) => `  ${i + 1}. ${t.targetBiome} (${(t.weight * 100).toFixed(1)}% chance)`)
    .join('\n');

  const inventoryList = context.inventory
    .map((item, i) => item ? `  ${i + 1}. ${item.name}: ${item.description}` : null)
    .filter(Boolean)
    .join('\n') || '  (empty)';

  return `You are playing a dream exploration game. Navigate the biome graph to reach the Gateway.

CURRENT STATE:
- Location: ${context.currentBiome}
- Entropy: ${context.entropyLevel}/${context.entropyMax} (high entropy = bad)
- Goal: ${context.goal}

AVAILABLE TRANSITIONS (from current node):
${transitionsList}

INVENTORY (usable items that modify transition odds):
${inventoryList}

INSTRUCTIONS:
Decide your next action. You can either:
1. MOVE - Take a probabilistic step to one of the connected biomes
2. USE_ITEM <index> - Use an inventory item to modify transition probabilities before moving

Respond in this exact JSON format:
{
  "action": "move" or "use_item",
  "itemIndex": <number if using item, omit otherwise>,
  "reasoning": "<brief 1-2 sentence explanation>"
}`;
}

/**
 * Parse LLM response to extract decision
 */
function parseDecision(response: string): LLMDecision {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    // Default to move if can't parse
    return {
      action: 'move',
      reasoning: 'Could not parse response, defaulting to move.',
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      action: parsed.action === 'use_item' ? 'use_item' : 'move',
      itemIndex: parsed.itemIndex,
      reasoning: parsed.reasoning || 'No reasoning provided.',
    };
  } catch {
    return {
      action: 'move',
      reasoning: 'JSON parse error, defaulting to move.',
    };
  }
}

/**
 * Query the LLM for a game decision
 */
export async function queryLLM(
  modelId: string,
  context: GameContext
): Promise<LLMResponse> {
  const prompt = buildContextPrompt(context);

  try {
    const response = await fetch(`${LM_STUDIO_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: 'You are a strategic game-playing AI. Respond only with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const rawResponse = data.choices[0]?.message?.content || '';
    const decision = parseDecision(rawResponse);

    return {
      decision,
      rawResponse,
    };
  } catch (error) {
    console.error('Error querying LLM:', error);
    return {
      decision: {
        action: 'move',
        reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      rawResponse: '',
    };
  }
}

/**
 * Build game context from current game state
 */
export function buildGameContext(
  currentState: State,
  inventory: (Item | null)[],
  entropy: Entropy,
  discoveredBiomes: string[]
): GameContext {
  return {
    currentBiome: currentState.biome,
    transitions: currentState.transitions.map((t: Transition) => ({
      targetBiome: t.to.biome,
      weight: t.weight,
    })),
    inventory,
    entropyLevel: entropy.getCurrent(),
    entropyMax: entropy.getMax(),
    discoveredBiomes,
    goal: 'Reach the Gateway biome to escape the dream.',
  };
}

/**
 * LLM Auto-play controller class
 */
export class LLMController {
  private isPlaying: boolean = false;
  private modelId: string = '';
  private intervalId: ReturnType<typeof setTimeout> | null = null;
  private onDecision: ((decision: LLMDecision) => void) | null = null;
  private onStatusChange: ((status: LLMStatus) => void) | null = null;
  private currentStatus: LLMStatus = { isPlaying: false, isThinking: false };

  setModel(modelId: string) {
    this.modelId = modelId;
  }

  getModel(): string {
    return this.modelId;
  }

  isAutoPlaying(): boolean {
    return this.isPlaying;
  }

  setOnDecision(callback: (decision: LLMDecision) => void) {
    this.onDecision = callback;
  }

  setOnStatusChange(callback: (status: LLMStatus) => void) {
    this.onStatusChange = callback;
  }

  private updateStatus(status: Partial<LLMStatus>) {
    this.currentStatus = { ...this.currentStatus, ...status };
    this.onStatusChange?.(this.currentStatus);
  }

  async start(
    getContext: () => GameContext,
    executeAction: (decision: LLMDecision) => Promise<void>
  ) {
    if (!this.modelId) {
      console.error('No model selected');
      return;
    }

    this.isPlaying = true;
    this.updateStatus({ isPlaying: true });

    const tick = async () => {
      if (!this.isPlaying) return;

      this.updateStatus({ isThinking: true, lastThought: 'Analyzing game state...' });

      const context = getContext();
      
      // Check if at Gateway (game over)
      if (context.currentBiome === 'Gateway') {
        this.updateStatus({ 
          isThinking: false, 
          lastThought: 'Reached the Gateway! Game complete.' 
        });
        this.stop();
        return;
      }

      // Check if no transitions available
      if (context.transitions.length === 0) {
        this.updateStatus({ 
          isThinking: false, 
          lastThought: 'No available transitions. Stuck!' 
        });
        this.stop();
        return;
      }

      try {
        const response = await queryLLM(this.modelId, context);
        
        if (!this.isPlaying) return; // Check if stopped during API call
        
        this.updateStatus({ 
          isThinking: false, 
          lastThought: response.decision.reasoning 
        });

        this.onDecision?.(response.decision);
        
        await executeAction(response.decision);

        // Schedule next tick with delay
        if (this.isPlaying) {
          this.intervalId = setTimeout(tick, 2000); // 2 second delay between moves
        }
      } catch (error) {
        console.error('Error in LLM tick:', error);
        this.updateStatus({ 
          isThinking: false, 
          lastThought: `Error: ${error instanceof Error ? error.message : 'Unknown'}` 
        });
        // Continue playing even on error
        if (this.isPlaying) {
          this.intervalId = setTimeout(tick, 3000);
        }
      }
    };

    // Start the first tick
    tick();
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.updateStatus({ isPlaying: false, isThinking: false });
  }
}

export interface LLMStatus {
  isPlaying: boolean;
  isThinking: boolean;
  lastThought?: string;
}

// Singleton instance
export const llmController = new LLMController();
