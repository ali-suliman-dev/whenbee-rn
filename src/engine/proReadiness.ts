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
 *  meaningful (would show garbage earlier). Confidence-gated features use the
 *  confidence axis instead and are handled below. */
const FEATURE_MIN_LOGS: Record<ProFeatureId, number> = {
  'confidence-band': 0, // gated by confidence, not log count
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
  const pitchUnlocked = leadConfidence !== 'raw';
  const bandReady = leadConfidence !== 'raw';

  const ids = Object.keys(FEATURE_MIN_LOGS) as ProFeatureId[];
  const perFeatureReady = ids.reduce(
    (acc, id) => {
      acc[id] =
        id === 'confidence-band'
          ? bandReady
          : totalCompletedLogs >= FEATURE_MIN_LOGS[id];
      return acc;
    },
    {} as Record<ProFeatureId, boolean>,
  );

  return { pitchUnlocked, perFeatureReady };
}
