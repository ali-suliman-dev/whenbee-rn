import {
  CAPABILITY_PRO_FEATURE,
  isCapabilityPro,
  CAPABILITY_STAGE_GATED,
  isCapabilityStageGated,
} from '../capabilityGating';
import { PRO_FEATURES } from '@/src/features/paywall/proFeatures';
import { capabilityFor } from '@/src/engine';
import type { CompanionStage } from '@/src/engine';

// The unlock ladder tells a free user what their logs buy. If this map drifts
// from the real gating code, the app either promises a paywalled feature as a
// logging reward or slaps a Pro badge on something that is free. Both are lies,
// so pin the exact split.

describe('capabilityGating', () => {
  it('marks exactly the two paywalled capabilities as Pro', () => {
    expect(isCapabilityPro('running-finish-time')).toBe(false);
    expect(isCapabilityPro('today-done-time')).toBe(false);
    expect(isCapabilityPro('start-by-anchor')).toBe(true);
    expect(isCapabilityPro('honest-day-forecast')).toBe(true);
    expect(isCapabilityPro('drift-recalibration')).toBe(false);
    expect(isCapabilityPro('keeper-standing')).toBe(false);
  });

  it('covers every capability the engine can hand the ladder', () => {
    const stages: CompanionStage[] = [1, 2, 3, 4, 5, 6];
    for (const stage of stages) {
      expect(CAPABILITY_PRO_FEATURE).toHaveProperty(capabilityFor(stage).id);
    }
  });

  it('names a real paywall bundle key for each Pro rung', () => {
    const known = new Set(PRO_FEATURES.map((f) => f.key));
    for (const key of Object.values(CAPABILITY_PRO_FEATURE)) {
      if (key !== null) expect(known.has(key)).toBe(true);
    }
  });

  // F1 (2026-08-02): the ladder claimed logs "unlock" all six capabilities, but
  // tracing the real gating code found only ONE actually reads companion stage
  // as a gate. Pin the exact split so a future capability can't silently
  // default to the wrong copy shape ("sharpens" vs "unlocks").
  it('marks exactly one capability (drift-recalibration) as genuinely stage-gated', () => {
    expect(isCapabilityStageGated('running-finish-time')).toBe(false);
    expect(isCapabilityStageGated('today-done-time')).toBe(false);
    expect(isCapabilityStageGated('start-by-anchor')).toBe(false);
    expect(isCapabilityStageGated('honest-day-forecast')).toBe(false);
    expect(isCapabilityStageGated('drift-recalibration')).toBe(true);
    expect(isCapabilityStageGated('keeper-standing')).toBe(false);
  });

  it('covers every capability the engine can hand the ladder (stage-gated record)', () => {
    const stages: CompanionStage[] = [1, 2, 3, 4, 5, 6];
    for (const stage of stages) {
      expect(CAPABILITY_STAGE_GATED).toHaveProperty(capabilityFor(stage).id);
    }
  });

  it('the one stage-gated capability is never also Pro-gated (justUnlockedPro would be dead code otherwise)', () => {
    for (const [id, gated] of Object.entries(CAPABILITY_STAGE_GATED)) {
      if (gated) expect(isCapabilityPro(id as Parameters<typeof isCapabilityPro>[0])).toBe(false);
    }
  });
});
