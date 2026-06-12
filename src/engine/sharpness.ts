import { SHARPNESS_WINDOW, SHARPNESS_PER_LOG, TIERS, TIER_THRESHOLDS } from './constants';
import type { Tier } from '../domain/types';

/**
 * accuracy = 100 · (1 − mean(|1 − estimate/actual|) clamped 0..1).
 * We already store clamped ratio r = actual/estimate, so estimate/actual = 1/r.
 * Uses only the last SHARPNESS_WINDOW ratios. Returns 0 for an empty window.
 */
export function sharpnessFromWindow(clampedRatios: number[]): number {
  if (clampedRatios.length === 0) return 0;
  const recent = clampedRatios.slice(-SHARPNESS_WINDOW);
  const errors = recent.map((r) => Math.min(1, Math.abs(1 - 1 / r)));
  const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
  return Math.round(100 * (1 - meanError));
}

/** Highest tier whose threshold the sharpness has reached. */
export function tierFor(sharpness: number): Tier {
  let idx = 0;
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    const threshold = TIER_THRESHOLDS[i];
    if (threshold !== undefined && sharpness >= threshold) idx = i;
  }
  return TIERS[idx] ?? 'Raw';
}

/** Rough "N more logs" estimate to the next tier; 0 once Honest. */
export function logsToNextTier(sharpness: number): number {
  const tier = tierFor(sharpness);
  const idx = TIERS.indexOf(tier);
  if (idx >= TIERS.length - 1) return 0;
  const nextThreshold = TIER_THRESHOLDS[idx + 1];
  if (nextThreshold === undefined) return 0;
  const need = nextThreshold - sharpness;
  return Math.max(1, Math.ceil(need / SHARPNESS_PER_LOG));
}
