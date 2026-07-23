import type { CompanionStage, DriftHealth } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// hubGates — pure visibility gates for the hub's gentle cards (drift re-check,
// blind spot). Kept free of React/stores so the "when may this card appear"
// rules are unit-testable on their own.
//
// Both gates exist for the same reason: these cards talk about an ESTABLISHED
// calibration ("life shifted", "this area lags the others") and are meaningless
// — and noisy — on a brand-new user's first logs.
// ──────────────────────────────────────────────────────────────────────────────

/** A tracked category surfaced as the gentle next calibration opportunity. */
export interface BlindSpot {
  categoryId: string;
  name: string;
  sharpness: number;
}

/** Drift re-check is the companion's stage-5 capability ('drift-recalibration',
 *  see engine/companion.ts CAPABILITIES) — the card never renders before the
 *  companion has actually unlocked it. */
export const DRIFT_RECHECK_MIN_STAGE: CompanionStage = 5;

export function driftRecheckVisible(input: {
  driftHealth: DriftHealth;
  stage: CompanionStage;
  dismissed: boolean;
}): boolean {
  return (
    input.driftHealth === 'curious' &&
    !input.dismissed &&
    input.stage >= DRIFT_RECHECK_MIN_STAGE
  );
}

/** A blind spot needs contrast: this many tracked areas with at least one log… */
export const BLIND_SPOT_MIN_TRACKED_WITH_LOGS = 2;
/** …and at least one area established enough (n ≥ this) that "the weakest lags
 *  behind" is a real observation rather than day-one noise. */
export const BLIND_SPOT_MIN_ESTABLISHED_N = 5;

export function blindSpotFor(
  categories: readonly { id: string }[],
  stats: Readonly<Record<string, { n: number; sharpness: number } | undefined>>,
  nameOf: (id: string) => string,
): BlindSpot | null {
  let withLogs = 0;
  let maxN = 0;
  let lowest: BlindSpot | null = null;
  for (const c of categories) {
    const stat = stats[c.id];
    if (!stat || stat.n < 1) continue;
    withLogs += 1;
    if (stat.n > maxN) maxN = stat.n;
    if (lowest === null || stat.sharpness < lowest.sharpness) {
      lowest = { categoryId: c.id, name: nameOf(c.id), sharpness: stat.sharpness };
    }
  }
  if (withLogs < BLIND_SPOT_MIN_TRACKED_WITH_LOGS) return null;
  if (maxN < BLIND_SPOT_MIN_ESTABLISHED_N) return null;
  return lowest;
}
