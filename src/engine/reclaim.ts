// src/engine/reclaim.ts — pure, O(1), no clock, no I/O.
// The ONLY new math in the Reclaim layer. Touches none of the calibration moat.

/**
 * Minutes of prediction error the honest number spared the user on this task.
 *   guessError  = |actual − estimate|   (how wrong the naïve guess was)
 *   honestError = |actual − honestShown| (how wrong Whenbee's number was)
 *   dividend    = max(0, round(guessError − honestError))
 * Non-negative by construction → the bank can only rise (no loss state).
 * Rewards the under-estimator AND the over-reserver: it measures closeness to
 * reality, not "slowness".
 */
export function reclaimDividendMinutes(
  estimateMin: number,
  actualMin: number,
  honestShownMin: number,
): number {
  const guessError = Math.abs(actualMin - estimateMin);
  const honestError = Math.abs(actualMin - honestShownMin);
  return Math.max(0, Math.round(guessError - honestError));
}

/** 860 → "14h 20m"; 35 → "35m"; 0 → caller skips display entirely. */
export function formatReclaim(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
