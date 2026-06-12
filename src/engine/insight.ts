import { INSIGHT_MIN_LOGS, INSIGHT_MIN_GAP, INSIGHT_VARIANCE_HALF } from './constants';
import type { Insight } from '../domain/types';

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
}

/** True when the recent half of the log-ratios is less scattered than the early half. */
function isStabilizing(orderedLogRatios: number[]): boolean {
  const h = INSIGHT_VARIANCE_HALF;
  if (orderedLogRatios.length < h * 2) return false;
  const first = orderedLogRatios.slice(0, h);
  const last = orderedLogRatios.slice(-h);
  return variance(last) < variance(first);
}

interface InsightInput {
  categoryId: string;
  n: number;
  mEffective: number;
  /** ln(clampedRatio) per completed log, oldest → newest. */
  orderedLogRatios: number[];
}

/**
 * Surface a discovery only when ALL hold (pure thresholds, no LLM):
 *   n ≥ 5, |M − 1| ≥ 0.4, and recent variance has shrunk.
 * Otherwise return null.
 */
export function detectInsight({ categoryId, n, mEffective, orderedLogRatios }: InsightInput): Insight | null {
  const surprising = Math.abs(mEffective - 1) >= INSIGHT_MIN_GAP;
  if (n < INSIGHT_MIN_LOGS || !surprising || !isStabilizing(orderedLogRatios)) return null;

  const honestForFifteen = Math.round(15 * mEffective);
  const mLabel = mEffective.toFixed(1);
  return {
    categoryId,
    multiplier: mEffective,
    honestForFifteen,
    headline: `~${honestForFifteen}m vs your 15m guess · runs ${mLabel}×`,
  };
}
