// PDF report (Pro) — PURE projections over the user's completed logs. No React,
// RN, Expo, or clock: callers pass events carrying their own `endedAt`, so the
// same input always maps to the same output. This reads calibration data only; it
// never trains the model. NOTE: there is no "time saved / reclaim" projection —
// reclaim was removed from the product and is off-thesis. The report leads with
// calibration: accuracy, per-category bias, biggest surprises, sharpest window.
import { REPORT_CATEGORY_MIN_LOGS } from './constants';
import { clampRatio } from './ratio';
import { sharpnessFromWindow } from './sharpness';

/** One completed-or-raw log handed to the report projections. */
export interface ReportEventInput {
  category: string;
  label: string | null;
  estimateMin: number;
  /** null until the task is completed; non-completed events are ignored. */
  actualMin: number | null;
  /** When the task ended (ms). Used only to order events; never read as a clock. */
  endedAt: number | null;
}

/** A single "this took much longer/shorter than you guessed" row. */
export interface ReportSurprise {
  category: string;
  label: string | null;
  estimateMin: number;
  actualMin: number;
}

/** True for an analyzable (completed) event: it has a real actual duration. */
function isCompleted(e: ReportEventInput): e is ReportEventInput & { actualMin: number } {
  return e.actualMin !== null && e.actualMin > 0;
}

/** Completed events ordered oldest → newest by endedAt (stable, deterministic). */
function orderedCompleted(events: ReportEventInput[]): (ReportEventInput & { actualMin: number })[] {
  return events
    .filter(isCompleted)
    .slice()
    .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));
}

/**
 * Accuracy 0–100. Delegates to the shipped `sharpnessFromWindow` so the report
 * figure and the in-app sharpness always agree. Caller passes clamped ratios.
 */
export function reportAccuracy(clampedRatios: number[]): number {
  return sharpnessFromWindow(clampedRatios);
}

/**
 * A short accuracy sparkline: completed events are split into `buckets`
 * time-ordered groups; each non-empty bucket reports the accuracy of its own
 * clamped ratios. An empty bucket carries the previous real value forward (never
 * invents a dip); leading empties read 0 until the first sample lands.
 */
export function reportAccuracySpark(events: ReportEventInput[], buckets: number): number[] {
  const ordered = orderedCompleted(events);
  const out: number[] = [];
  let lastReal = 0;
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor((i * ordered.length) / buckets);
    const end = Math.floor(((i + 1) * ordered.length) / buckets);
    const slice = ordered.slice(start, end);
    if (slice.length === 0) {
      out.push(lastReal);
      continue;
    }
    const value = reportAccuracy(slice.map((e) => clampRatio(e.estimateMin, e.actualMin)));
    lastReal = value;
    out.push(value);
  }
  return out;
}

/**
 * The `k` biggest surprises by |actual − estimate|. Ties resolve to the larger
 * actual, then the later `endedAt`. Non-completed events are ignored.
 */
export function topSurprises(events: ReportEventInput[], k: number): ReportSurprise[] {
  return events
    .filter(isCompleted)
    .slice()
    .sort((a, b) => {
      const gapA = Math.abs(a.actualMin - a.estimateMin);
      const gapB = Math.abs(b.actualMin - b.estimateMin);
      if (gapB !== gapA) return gapB - gapA;
      if (b.actualMin !== a.actualMin) return b.actualMin - a.actualMin;
      return (b.endedAt ?? 0) - (a.endedAt ?? 0);
    })
    .slice(0, k)
    .map((e) => ({
      category: e.category,
      label: e.label,
      estimateMin: e.estimateMin,
      actualMin: e.actualMin,
    }));
}

/** Sample standard deviation / mean of a set of ratios (0 for < 2 values). */
function coefficientOfVariation(ratios: number[]): number {
  if (ratios.length < 2) return 0;
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  if (mean === 0) return 0;
  const variance = ratios.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratios.length;
  return Math.sqrt(variance) / mean;
}

/**
 * The category whose clamped ratios are the most consistent (lowest coefficient
 * of variation), among categories that clear `REPORT_CATEGORY_MIN_LOGS`. Returns
 * null when no category has enough data. Caller passes already-clamped ratios.
 */
export function steadiestCategory(byCategory: Record<string, number[]>): string | null {
  let best: { category: string; cv: number } | null = null;
  // Ascending key order → deterministic tie-breaks.
  for (const category of Object.keys(byCategory).sort()) {
    const ratios = byCategory[category] ?? [];
    if (ratios.length < REPORT_CATEGORY_MIN_LOGS) continue;
    const cv = coefficientOfVariation(ratios);
    if (best === null || cv < best.cv) best = { category, cv };
  }
  return best?.category ?? null;
}
