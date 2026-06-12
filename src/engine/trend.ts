import { TREND_STABILIZING_DROP } from './constants';
import { blendWithPrior } from './multiplier';
import type { TrendSeries } from '../domain/types';

interface TrendInput {
  /** completed logs oldest → newest: clamped ratio + α used at write time */
  steps: { loggedAt: number; clampedRatio: number; alpha: number }[];
  prior: number;
}

/**
 * Rebuild the rolling M after each log by replaying the EWMA forward from 0.
 * Bounded by the recent window the repo passes in (~30 days / last N) → still O(window).
 */
export function buildTrendSeries({ steps, prior }: TrendInput): TrendSeries {
  let ewma = 0;
  let n = 0;
  const points = steps.map((s) => {
    ewma = s.alpha * Math.log(s.clampedRatio) + (1 - s.alpha) * ewma;
    n += 1;
    return { loggedAt: s.loggedAt, multiplier: blendWithPrior(n, ewma, prior) };
  });

  // Caption: a meaningful downward drift in M from first→last reads as "stabilizing".
  const first = points[0];
  const last = points[points.length - 1];
  const drop = first && last ? first.multiplier - last.multiplier : 0;
  const caption = drop > TREND_STABILIZING_DROP ? 'stabilizing' : 'steady';
  return { points, caption };
}
