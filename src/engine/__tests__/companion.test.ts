import {
  companionStageFor,
  capabilityFor,
  keeperReached,
  driftHealthFromRecent,
  COMPANION_KEEPER_QUOTA,
  type CompanionStage,
} from '../companion';
import { TIERS } from '../constants';

describe('companionStageFor — stages 1–5 map 1:1 to maxTier, +6 for Keeper', () => {
  it('maps maxTier 0..4 to stages 1..5 (Raw→Honest)', () => {
    expect(companionStageFor({ maxTier: 0, keeper: false })).toBe(1);
    expect(companionStageFor({ maxTier: 1, keeper: false })).toBe(2);
    expect(companionStageFor({ maxTier: 2, keeper: false })).toBe(3);
    expect(companionStageFor({ maxTier: 3, keeper: false })).toBe(4);
    expect(companionStageFor({ maxTier: 4, keeper: false })).toBe(5);
  });
  it('returns stage 6 (Keeper) once keeper is set', () => {
    expect(companionStageFor({ maxTier: 4, keeper: true })).toBe(6);
    expect(companionStageFor({ maxTier: 2, keeper: true })).toBe(6);
  });
  it('clamps an out-of-range maxTier into 1..5', () => {
    expect(companionStageFor({ maxTier: -3, keeper: false })).toBe(1);
    expect(companionStageFor({ maxTier: 99, keeper: false })).toBe(5);
  });
});

describe('capabilityFor — each stage unlocks a real capability', () => {
  it('returns a stable id + the tier-aligned label for stages 1..5', () => {
    expect(capabilityFor(1).id).toBe('running-finish-time');
    expect(capabilityFor(2).id).toBe('today-done-time');
    expect(capabilityFor(3).id).toBe('start-by-anchor');
    expect(capabilityFor(4).id).toBe('honest-day-forecast');
    expect(capabilityFor(5).id).toBe('drift-recalibration');
  });
  it('Keeper (stage 6) gates nothing new', () => {
    expect(capabilityFor(6).id).toBe('keeper-standing');
    expect(capabilityFor(6).gatesNewFeature).toBe(false);
  });
  it('stage 1..5 labels align with the honey tier name', () => {
    for (let s = 1 as CompanionStage; s <= 5; s = (s + 1) as CompanionStage) {
      expect(capabilityFor(s).label.length).toBeGreaterThan(0);
      expect(capabilityFor(s).tier).toBe(TIERS[s - 1]);
    }
  });
});

describe('keeperReached — set-once prestige when the comb is (near-)fully capped', () => {
  it('false until capped-cell count reaches the quota', () => {
    expect(keeperReached({ cappedCellCount: 0, trackedCount: 3 })).toBe(false);
    expect(keeperReached({ cappedCellCount: 2, trackedCount: 3 })).toBe(false);
  });
  it('true once capped count meets quota (all tracked cells capped)', () => {
    expect(keeperReached({ cappedCellCount: 3, trackedCount: 3 })).toBe(true);
  });
  it('uses COMPANION_KEEPER_QUOTA as the floor for sparse combs', () => {
    expect(keeperReached({ cappedCellCount: 1, trackedCount: 1 })).toBe(false);
    expect(COMPANION_KEEPER_QUOTA).toBeGreaterThanOrEqual(3);
  });
});

describe('driftHealthFromRecent — Layer 3, POSITIVE-ONLY, oscillates, never guilt', () => {
  it('settled when recent ratios sit near 1', () => {
    expect(driftHealthFromRecent([1, 1.05, 0.97, 1.02, 1.01])).toBe('settled');
  });
  it('curious — not sad — when recent ratios drift away (full window)', () => {
    expect(driftHealthFromRecent([1, 2.5, 3, 2.8, 2.6])).toBe('curious');
  });
  it('empty window is settled; only ever returns settled|curious', () => {
    expect(driftHealthFromRecent([])).toBe('settled');
    expect(['settled', 'curious']).toContain(driftHealthFromRecent([5, 6, 0.2, 4, 3])); // full window
  });
  // Drift means "you WERE calibrated, then life shifted" — it needs a baseline.
  // Below the minimum window (5 ratios) there is no baseline to drift FROM, so
  // even wildly-off ratios read as settled: a first log 3× over its guess is
  // normal calibration, never drift. (Regression: drift card on first-ever log.)
  it('below the minimum window, wild ratios are still settled — no baseline yet', () => {
    expect(driftHealthFromRecent([3])).toBe('settled');
    expect(driftHealthFromRecent([3, 2.8])).toBe('settled');
    expect(driftHealthFromRecent([3, 2.8, 2.5, 2.9])).toBe('settled');
  });
  it('at exactly the minimum window (5), drift scoring turns on', () => {
    expect(driftHealthFromRecent([3, 2.8, 2.5, 2.9, 3.1])).toBe('curious');
    expect(driftHealthFromRecent([1, 1.02, 0.98, 1.05, 1.0])).toBe('settled');
  });
});
