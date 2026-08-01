import { CAPABILITY_PRO_FEATURE, isCapabilityPro } from '../capabilityGating';
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
});
