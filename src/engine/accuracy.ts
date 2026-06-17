// S3 — accuracy correlations ("when are you sharpest"). PURE TS: no React/RN and
// no clock. Callers pass already-bucketed local hour/weekday + the clamped ratio
// on each sample, so the same input always maps to the same output. This reads
// accuracy only — it never trains the calibration model.
import { ACCURACY_MIN_BUCKET, ACCURACY_MIN_GAP, ACCURACY_MIDDAY_HOUR } from './constants';

export interface AccuracySample {
  /** Local hour 0–23 of the log. */
  hour: number;
  /** Local weekday 0 (Sun) – 6 (Sat). */
  weekday: number;
  /** Clamped actual/estimate ratio for the log. */
  ratio: number;
}

export interface AccuracyCorrelation {
  dimension: 'time' | 'weekday';
  /** Bucket where estimates land closest (highest accuracy). */
  betterLabel: string;
  /** Bucket where estimates drift most (lowest accuracy). */
  worseLabel: string;
  betterAccuracy: number; // 0–100
  worseAccuracy: number; // 0–100
  /** betterAccuracy − worseAccuracy, in accuracy points. */
  gap: number;
  /** Total logs across both compared buckets. */
  sampleCount: number;
}

const WEEKDAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Accuracy 0–100 from clamped ratios — same shape as the calibration sharpness. */
function accuracyOf(ratios: number[]): number {
  if (ratios.length === 0) return 0;
  const err = ratios.reduce((sum, r) => sum + Math.min(1, Math.abs(1 - 1 / r)), 0) / ratios.length;
  return Math.round((1 - err) * 100);
}

function timeCorrelation(samples: AccuracySample[]): AccuracyCorrelation | null {
  const morning = samples.filter((s) => s.hour < ACCURACY_MIDDAY_HOUR).map((s) => s.ratio);
  const afternoon = samples.filter((s) => s.hour >= ACCURACY_MIDDAY_HOUR).map((s) => s.ratio);
  if (morning.length < ACCURACY_MIN_BUCKET || afternoon.length < ACCURACY_MIN_BUCKET) return null;

  const mAcc = accuracyOf(morning);
  const aAcc = accuracyOf(afternoon);
  const gap = Math.abs(mAcc - aAcc);
  if (gap < ACCURACY_MIN_GAP) return null;

  const morningBetter = mAcc >= aAcc;
  return {
    dimension: 'time',
    betterLabel: morningBetter ? 'mornings' : 'afternoons',
    worseLabel: morningBetter ? 'afternoons' : 'mornings',
    betterAccuracy: morningBetter ? mAcc : aAcc,
    worseAccuracy: morningBetter ? aAcc : mAcc,
    gap,
    sampleCount: morning.length + afternoon.length,
  };
}

function weekdayCorrelation(samples: AccuracySample[]): AccuracyCorrelation | null {
  const byDay = new Map<number, number[]>();
  for (const s of samples) {
    const bucket = byDay.get(s.weekday);
    if (bucket) bucket.push(s.ratio);
    else byDay.set(s.weekday, [s.ratio]);
  }

  let best: { day: number; acc: number; n: number } | null = null;
  let worst: { day: number; acc: number; n: number } | null = null;
  // Ascending day order → deterministic tie-breaks.
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    const ratios = byDay.get(day) ?? [];
    if (ratios.length < ACCURACY_MIN_BUCKET) continue;
    const acc = accuracyOf(ratios);
    if (best === null || acc > best.acc) best = { day, acc, n: ratios.length };
    if (worst === null || acc < worst.acc) worst = { day, acc, n: ratios.length };
  }
  if (best === null || worst === null || best.day === worst.day) return null;

  const gap = best.acc - worst.acc;
  if (gap < ACCURACY_MIN_GAP) return null;

  return {
    dimension: 'weekday',
    betterLabel: WEEKDAY_LABEL[best.day] ?? `day ${best.day}`,
    worseLabel: WEEKDAY_LABEL[worst.day] ?? `day ${worst.day}`,
    betterAccuracy: best.acc,
    worseAccuracy: worst.acc,
    gap,
    sampleCount: best.n + worst.n,
  };
}

/** Returns the time and/or weekday accuracy correlations that clear the gates,
 *  strongest gap first. Empty when neither dimension has a meaningful pattern. */
export function correlateAccuracy(samples: AccuracySample[]): AccuracyCorrelation[] {
  const out: AccuracyCorrelation[] = [];
  const time = timeCorrelation(samples);
  if (time) out.push(time);
  const weekday = weekdayCorrelation(samples);
  if (weekday) out.push(weekday);
  return out.sort((a, b) => b.gap - a.gap || a.dimension.localeCompare(b.dimension));
}
