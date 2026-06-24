// ProgressChart series — "you, then vs now". PURE TS: no React/RN, no clock.
// Caller passes already-ordered clamped ratios (oldest → newest). Buckets them
// into <= ACCURACY_TREND_BUCKETS contiguous windows and reports each window's
// accuracy (same shape as engine sharpness: 100·(1 − mean(min(1,|1 − 1/r|)))).
import { ACCURACY_TREND_MIN_LOGS, ACCURACY_TREND_BUCKETS } from './constants';

export interface AccuracyTrend {
  /** Bucket accuracies 0–100, oldest → newest (length 2..ACCURACY_TREND_BUCKETS). */
  points: number[];
  /** last − first, in accuracy points. May be negative; never framed as loss. */
  deltaPts: number;
}

function accuracyOf(ratios: number[]): number {
  if (ratios.length === 0) return 0;
  const err = ratios.reduce((sum, r) => sum + Math.min(1, Math.abs(1 - 1 / r)), 0) / ratios.length;
  return Math.round((1 - err) * 100);
}

export function buildAccuracySeries(ratios: number[]): AccuracyTrend | null {
  if (ratios.length < ACCURACY_TREND_MIN_LOGS) return null;

  const buckets = Math.min(ACCURACY_TREND_BUCKETS, ratios.length);
  const size = ratios.length / buckets;
  const points: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * size);
    const end = Math.floor((i + 1) * size);
    points.push(accuracyOf(ratios.slice(start, end)));
  }

  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  return { points, deltaPts: last - first };
}
