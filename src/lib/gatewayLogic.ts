import type { Automaton } from './automaton';
import { Biomes } from './world';

/**
 * Boost Gateway visibility based on game progress
 * - Discovered 5+ biomes: 2x multiplier
 * - Entropy above 50: 1.5x multiplier
 * - Discovered 8+ biomes: 3x multiplier
 *
 * This makes the Gateway progressively easier to find as the player explores
 */
export function boostGatewayVisibility(
  automaton: Automaton,
  discoveredBiomeCount: number,
  currentEntropy: number
): void {
  const states = automaton.getStates();
  const gatewayState = states.find(s => s.biome === Biomes.Gateway);

  if (!gatewayState) return;

  // Calculate boost multiplier based on progress
  let boostMultiplier = 1.0;

  if (discoveredBiomeCount >= 8) {
    boostMultiplier = 3.0; // Major boost for extensive exploration
  } else if (discoveredBiomeCount >= 5) {
    boostMultiplier = 2.0; // Moderate boost
  }

  // Additional boost from high entropy (chaotic state makes Gateway more accessible)
  if (currentEntropy >= 50) {
    boostMultiplier *= 1.5;
  }

  // Only apply if there's actually a boost
  if (boostMultiplier <= 1.0) return;

  // Find all transitions leading to Gateway and boost their weights
  states.forEach(state => {
    const gatewayTransition = state.transitions.find(t => t.to.biome === Biomes.Gateway);

    if (gatewayTransition) {
      // Store original weight if not already stored
      if (!(gatewayTransition as any).originalWeight) {
        (gatewayTransition as any).originalWeight = gatewayTransition.weight;
      }

      // Apply boost multiplier to original weight
      const originalWeight = (gatewayTransition as any).originalWeight;
      const boostedWeight = originalWeight * boostMultiplier;

      // Temporarily set higher weight (will be normalized)
      gatewayTransition.weight = boostedWeight;

      // Re-normalize all transition weights for this state
      const totalWeight = state.transitions.reduce((sum, t) => sum + t.weight, 0);
      if (totalWeight > 0) {
        state.transitions.forEach(t => {
          t.weight = t.weight / totalWeight;
        });
      }
    }
  });
}

/**
 * Check if Gateway boost should be applied and display notification
 */
export function checkGatewayBoostConditions(
  discoveredBiomeCount: number,
  currentEntropy: number,
  previousDiscoveredCount: number,
  previousEntropy: number
): { shouldBoost: boolean; reason?: string } {
  // Check if we just crossed a threshold
  const justDiscovered5 = previousDiscoveredCount < 5 && discoveredBiomeCount >= 5;
  const justDiscovered8 = previousDiscoveredCount < 8 && discoveredBiomeCount >= 8;
  const justCrossedEntropy50 = previousEntropy < 50 && currentEntropy >= 50;

  if (justDiscovered8) {
    return { shouldBoost: true, reason: 'Your extensive exploration has revealed clearer paths to the Gateway!' };
  }

  if (justDiscovered5) {
    return { shouldBoost: true, reason: 'The Gateway becomes more visible as you explore the dream...' };
  }

  if (justCrossedEntropy50) {
    return { shouldBoost: true, reason: 'Rising chaos makes the Gateway easier to find!' };
  }

  return { shouldBoost: false };
}
