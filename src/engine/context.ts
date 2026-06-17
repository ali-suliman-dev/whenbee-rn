// S4 — context correlations ("does energy/sleep/meds move your accuracy"). PURE
// TS: no React/RN, no clock. Dimension-agnostic: callers pass a `key` (e.g.
// 'energy') and samples already reduced to { value, clamped ratio }. Read-only —
// optional context tags NEVER train the calibration model.
import { ACCURACY_MIN_BUCKET, ACCURACY_MIN_GAP } from './constants';

export interface ContextSample {
  /** The tag value for this log (e.g. 'low' | 'ok' | 'high'). */
  value: string;
  /** Clamped actual/estimate ratio. */
  ratio: number;
}

export interface ContextCorrelation {
  /** The dimension queried (passed through for the caller to phrase). */
  key: string;
  bestValue: string;
  worstValue: string;
  bestAccuracy: number; // 0–100
  worstAccuracy: number; // 0–100
  gap: number; // bestAccuracy − worstAccuracy
  sampleCount: number; // logs across the two compared buckets
}

/** Accuracy 0–100 from clamped ratios — matches calibration sharpness shape. */
function accuracyOf(ratios: number[]): number {
  if (ratios.length === 0) return 0;
  const err = ratios.reduce((sum, r) => sum + Math.min(1, Math.abs(1 - 1 / r)), 0) / ratios.length;
  return Math.round((1 - err) * 100);
}

/** The best vs worst tag value by accuracy, gated on bucket size + gap. Null when
 *  no two values clear the bar — we never sell a pattern that isn't really there. */
export function correlateContext(key: string, samples: ContextSample[]): ContextCorrelation | null {
  const byValue = new Map<string, number[]>();
  for (const s of samples) {
    const bucket = byValue.get(s.value);
    if (bucket) bucket.push(s.ratio);
    else byValue.set(s.value, [s.ratio]);
  }

  let best: { value: string; acc: number; n: number } | null = null;
  let worst: { value: string; acc: number; n: number } | null = null;
  // Lexical value order → deterministic tie-breaks.
  for (const value of [...byValue.keys()].sort()) {
    const ratios = byValue.get(value) ?? [];
    if (ratios.length < ACCURACY_MIN_BUCKET) continue;
    const acc = accuracyOf(ratios);
    if (best === null || acc > best.acc) best = { value, acc, n: ratios.length };
    if (worst === null || acc < worst.acc) worst = { value, acc, n: ratios.length };
  }
  if (best === null || worst === null || best.value === worst.value) return null;

  const gap = best.acc - worst.acc;
  if (gap < ACCURACY_MIN_GAP) return null;

  return {
    key,
    bestValue: best.value,
    worstValue: worst.value,
    bestAccuracy: best.acc,
    worstAccuracy: worst.acc,
    gap,
    sampleCount: best.n + worst.n,
  };
}
