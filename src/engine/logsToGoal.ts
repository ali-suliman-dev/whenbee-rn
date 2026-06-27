// Goal-coach mechanic 3 — ETA projection. PURE TS: no React/RN, no clock.
// Estimates how many more logs until accuracy reaches the target, from the recent
// improvement rate. Returns null when there isn't enough data or the trend isn't
// improving — the UI then says "keep logging" (no number, never a deadline).
import { buildAccuracySeries } from './accuracyTrend';

export interface LogsToGoalInput {
  /** Recent clamped ratios, oldest → newest (same window as the accuracy trend). */
  ratios: number[];
  /** Current accuracy 0..100 (engine sharpness scale). */
  currentAccuracy: number;
  /** Target accuracy 0..100. */
  targetAccuracy: number;
}

/**
 * Logs-to-target from the recent per-log accuracy gain. 0 when already there;
 * null when below the trend minimum or not improving. Encouragement, not a clock.
 */
export function logsToGoal({ ratios, currentAccuracy, targetAccuracy }: LogsToGoalInput): number | null {
  if (currentAccuracy >= targetAccuracy) return 0;

  const series = buildAccuracySeries(ratios);
  if (series === null) return null; // < ACCURACY_TREND_MIN_LOGS

  const gainPerLog = series.deltaPts / ratios.length;
  if (gainPerLog <= 0) return null; // flat or declining → no projection

  const remaining = targetAccuracy - currentAccuracy;
  return Math.max(1, Math.ceil(remaining / gainPerLog));
}
