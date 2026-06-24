import type { CalibrationConfidence } from '../domain/types';

export type ProFeatureId =
  | 'confidence-band'
  | 'day-capacity'
  | 'honest-week'
  | 'honest-month'
  | 'steals-your-time'
  | 'accuracy-correlations'
  | 'context-correlations';

/** Log-count thresholds at which each data-dependent Pro feature becomes
 *  meaningful (would show garbage earlier). 'confidence-band' is excluded: it is
 *  gated by confidence (pitchUnlocked), not by log count, so no threshold applies. */
const FEATURE_MIN_LOGS: Record<Exclude<ProFeatureId, 'confidence-band'>, number> = {
  'day-capacity': 8,
  'honest-week': 7,
  'honest-month': 20,
  'steals-your-time': 4,
  'accuracy-correlations': 8,
  'context-correlations': 8,
};

/**
 * Pure Pro-readiness selector. `pitchUnlocked` is true once the lead category's
 * confidence has reached at least 'setting' (the band has first narrowed — the
 * aha beat). Per-feature readiness combines that with each feature's data need.
 * NOTE: monotonic latching of `pitchUnlocked` is the caller's responsibility
 * (confidence can fall); this function is a pure snapshot.
 */
export function proReadiness(input: {
  leadConfidence: CalibrationConfidence;
  totalCompletedLogs: number;
}): { pitchUnlocked: boolean; perFeatureReady: Record<ProFeatureId, boolean> } {
  const { leadConfidence, totalCompletedLogs } = input;
  // pitchUnlocked and bandReady are the same signal — both true once confidence
  // has moved past 'raw' (the band has first narrowed — the aha beat).
  const pitchUnlocked = leadConfidence !== 'raw';

  const logGatedIds = Object.keys(FEATURE_MIN_LOGS) as Exclude<ProFeatureId, 'confidence-band'>[];
  const perFeatureReady: Record<ProFeatureId, boolean> = {
    'confidence-band': pitchUnlocked,
    ...logGatedIds.reduce(
      (acc, id) => {
        acc[id] = totalCompletedLogs >= FEATURE_MIN_LOGS[id];
        return acc;
      },
      {} as Record<Exclude<ProFeatureId, 'confidence-band'>, boolean>,
    ),
  };

  return { pitchUnlocked, perFeatureReady };
}
