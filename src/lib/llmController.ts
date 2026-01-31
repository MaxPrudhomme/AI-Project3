import type { State } from './automaton';
import type { Item } from './player';
import type { ActiveEffect } from './effects';
import type { Artifact } from './items';

// Game state sent to LLM
export interface GameState {
  currentBiome: string;
  currentVariant: string;
  specialElement: string | null;
  entropy: { current: number; max: number; state: string };
  transitions: { toBiome: string; weight: number }[];
  inventory: { slot: number; name: string; description: string }[];
  activeEffects: { name: string; description: string; duration?: number }[];
  pendingArtifact: { name: string; description: string } | null;
  hasInventorySpace: boolean;
  warnings: string[];
}

// Actions LLM can take
export type LLMAction =
  | { type: 'move' }
  | { type: 'useItem'; slot: number }
  | { type: 'pickUpItem' }
  | { type: 'leaveItem' }
  | { type: 'dropItem'; slot: number }
  | { type: 'wait' };

export interface LLMResponse {
  thinking?: string;
  action: LLMAction;
}

const SYSTEM_PROMPT = `You are playing a dream world exploration game. You navigate a probabilistic graph of biomes, trying to find the Gateway (exit) while managing entropy.

RULES:
- Each move takes you to a connected biome based on weighted probabilities
- Entropy increases with each move (+2 per move normally)
- You can find and use artifacts to manipulate probabilities
- Goal: Find and reach the Gateway biome to win

⚠️ LOSS CONDITIONS (avoid these!):
- Entropy reaches 100 (max) = GAME OVER
- Entering a biome with NO exits (dead end) = STUCK FOREVER
- All transitions blocked (0% weight) = NO MOVES AVAILABLE

STRATEGY:
- Monitor entropy carefully - use Entropy Buffer items when it gets high (70+)
- Avoid dead ends - check transition counts before moving
- Use path manipulation items to increase Gateway probability
- Gateway becomes more visible after discovering 5+ biomes

ACTIONS (respond with exactly one):
- {"type":"move"} - Move to next biome (weighted random)
- {"type":"useItem","slot":N} - Use item in slot N (0-8)
- {"type":"pickUpItem"} - Pick up discovered artifact (only if pending)
- {"type":"leaveItem"} - Leave discovered artifact (only if pending)
- {"type":"dropItem","slot":N} - Drop item from slot N
- {"type":"wait"} - Do nothing this turn

RESPONSE FORMAT:
First share your brief thinking (1-2 sentences), then respond with a JSON action.
Example:
Thinking: Entropy is high, I should use my Entropy Buffer to reduce the next gain.
Action: {"type":"useItem","slot":2}`;

function buildGameStatePrompt(state: GameState): string {
  let prompt = `CURRENT STATE:
- Location: ${state.currentBiome} (${state.currentVariant})${state.specialElement ? ` [${state.specialElement}]` : ''}
- Entropy: ${state.entropy.current}/${state.entropy.max} (${state.entropy.state})

TRANSITIONS FROM HERE:
${state.transitions.map(t => `  → ${t.toBiome}: ${(t.weight * 100).toFixed(1)}%`).join('\n')}
${state.transitions.length === 0 ? '  (DEAD END - NO EXITS!)' : ''}

INVENTORY:
${state.inventory.length > 0
    ? state.inventory.map(i => `  [${i.slot}] ${i.name} - ${i.description}`).join('\n')
    : '  (empty)'}

ACTIVE EFFECTS:
${state.activeEffects.length > 0
    ? state.activeEffects.map(e => `  - ${e.name}: ${e.description}${e.duration ? ` (${e.duration} turns)` : ''}`).join('\n')
    : '  (none)'}`;

  if (state.warnings.length > 0) {
    prompt += `\n\n⚠️ WARNINGS:
${state.warnings.map(w => `  - ${w}`).join('\n')}`;
  }

  if (state.pendingArtifact) {
    prompt += `\n\nARTIFACT DISCOVERED:
  ${state.pendingArtifact.name} - ${state.pendingArtifact.description}
  ${state.hasInventorySpace ? 'You have space to pick it up.' : 'Inventory full!'}`;
  }

  prompt += '\n\nWhat is your action?';
  return prompt;
}

export function buildGameState(
  currentPosition: State,
  entropy: { getCurrent: () => number; getMax: () => number; getState: () => string },
  inventory: (Item | null)[],
  activeEffects: ActiveEffect[],
  pendingArtifact: Artifact | null,
  hasInventorySpace: boolean
): GameState {
  const warnings: string[] = [];
  const currentEntropy = entropy.getCurrent();
  const maxEntropy = entropy.getMax();

  // Entropy warnings
  if (currentEntropy >= 90) {
    warnings.push('CRITICAL: Entropy at 90+! Game over at 100!');
  } else if (currentEntropy >= 70) {
    warnings.push('HIGH ENTROPY: Use Entropy Buffer items to reduce gain');
  } else if (currentEntropy >= 50) {
    warnings.push('Entropy rising - consider using reduction items');
  }

  // Dead end warning
  if (currentPosition.transitions.length === 0) {
    warnings.push('DEAD END: No exits from this biome - YOU ARE STUCK!');
  }

  // No valid moves warning
  const hasValidMoves = currentPosition.transitions.some(t => t.weight > 0);
  if (currentPosition.transitions.length > 0 && !hasValidMoves) {
    warnings.push('NO VALID MOVES: All transitions blocked!');
  }

  // Low probability warning (all transitions below 10%)
  const maxTransitionProb = Math.max(...currentPosition.transitions.map(t => t.weight), 0);
  if (maxTransitionProb < 0.1 && currentPosition.transitions.length > 0) {
    warnings.push('All paths have low probability - consider using path manipulation items');
  }

  return {
    currentBiome: currentPosition.biome,
    currentVariant: currentPosition.variant || 'Default',
    specialElement: currentPosition.specialElement || null,
    entropy: {
      current: currentEntropy,
      max: maxEntropy,
      state: entropy.getState(),
    },
    transitions: currentPosition.transitions.map(t => ({
      toBiome: t.to.biome,
      weight: t.weight,
    })),
    inventory: inventory
      .map((item, idx) => (item ? { slot: idx, name: item.name, description: item.description } : null))
      .filter((i): i is { slot: number; name: string; description: string } => i !== null),
    activeEffects: activeEffects.map(e => ({
      name: e.name,
      description: e.description,
      duration: e.duration,
    })),
    pendingArtifact: pendingArtifact ? { name: pendingArtifact.name, description: pendingArtifact.description } : null,
    hasInventorySpace,
    warnings,
  };
}

export async function queryLLM(
  baseUrl: string,
  model: string,
  gameState: GameState,
  thinkingBudget: number = 500
): Promise<LLMResponse> {
  const userPrompt = buildGameStatePrompt(gameState);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: thinkingBudget + 100,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return parseResponse(content);
}

function parseResponse(content: string): LLMResponse {
  // Extract thinking (everything before "Action:")
  const thinkingMatch = content.match(/(?:thinking:?\s*)?(.+?)(?=action:|{)/is);
  const thinking = thinkingMatch?.[1]?.trim();

  // Extract JSON action
  const jsonMatch = content.match(/\{[^}]+\}/);
  if (!jsonMatch) {
    // Default to move if no valid action found
    return { thinking, action: { type: 'move' } };
  }

  try {
    const action = JSON.parse(jsonMatch[0]) as LLMAction;
    // Validate action type
    if (!['move', 'useItem', 'pickUpItem', 'leaveItem', 'dropItem', 'wait'].includes(action.type)) {
      return { thinking, action: { type: 'move' } };
    }
    return { thinking, action };
  } catch {
    return { thinking, action: { type: 'move' } };
  }
}

export async function fetchAvailableModels(baseUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/models`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.data?.map((m: { id: string }) => m.id) || [];
  } catch {
    return [];
  }
}
