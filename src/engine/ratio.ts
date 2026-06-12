import { RATIO_FLOOR, RATIO_CEIL } from './constants';

/** clamp(actual/estimate, 1/6, 6). Estimate must be > 0 (UI guarantees it). */
export function clampRatio(estimateMin: number, actualMin: number): number {
  if (estimateMin <= 0) throw new RangeError('estimate must be positive');
  const raw = actualMin / estimateMin;
  return Math.min(RATIO_CEIL, Math.max(RATIO_FLOOR, raw));
}
