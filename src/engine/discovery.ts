// Banked-discovery gating. PURE TS — no RN/Expo/clock.
import { INSIGHT_MIN_GAP } from './constants';

interface ShouldBankInput {
  candidateMultiplier: number;
  lastBankedMultiplier: number | null;
}

// Multiplier deltas are subtraction of fractional floats (e.g. 2.3 - 1.9),
// which carries IEEE-754 error at the boundary. A move that should equal the
// gap can compute to 0.3999999999999999, so we admit a tiny tolerance.
const GAP_EPSILON = 1e-9;

/**
 * Whether a fresh aha is distinct enough to bank as a new Discovery card.
 * First-ever discovery always banks; afterwards the multiplier must have moved
 * by at least the insight re-fire gap so identical/near-identical ahas dedup.
 */
export function shouldBankDiscovery({ candidateMultiplier, lastBankedMultiplier }: ShouldBankInput): boolean {
  if (lastBankedMultiplier === null) return true;
  return Math.abs(candidateMultiplier - lastBankedMultiplier) >= INSIGHT_MIN_GAP - GAP_EPSILON;
}
