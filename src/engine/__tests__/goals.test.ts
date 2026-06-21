import {
  accuracyToErrorBand, errorBandToAccuracy, goalProgress, isGoalMet,
  reconcileGoal, canSetGoal, presetsForAccuracy, recommendedPreset,
} from '../goals';
import type { CategoryGoal } from '../../domain/types';

const goal = (over: Partial<CategoryGoal> = {}): CategoryGoal => ({
  categoryId: 'admin', targetAccuracy: 80, bestAccuracy: 60, baselineAccuracy: 60,
  setAt: 0, met: false, ...over,
});

describe('accuracyToErrorBand / errorBandToAccuracy', () => {
  it('inverts accuracy to error band', () => {
    expect(accuracyToErrorBand(75)).toBe(25);
    expect(accuracyToErrorBand(100)).toBe(0);
  });
  it('clamps out-of-range', () => {
    expect(accuracyToErrorBand(120)).toBe(0);
    expect(accuracyToErrorBand(-10)).toBe(100);
  });
  it('round-trips', () => {
    expect(errorBandToAccuracy(25)).toBe(75);
    expect(errorBandToAccuracy(accuracyToErrorBand(82))).toBe(82);
  });
});

describe('goalProgress', () => {
  it('is the fraction from baseline to target by best', () => {
    expect(goalProgress(goal({ baselineAccuracy: 60, targetAccuracy: 80, bestAccuracy: 70 }))).toBeCloseTo(0.5);
  });
  it('clamps to [0,1]', () => {
    expect(goalProgress(goal({ baselineAccuracy: 60, targetAccuracy: 80, bestAccuracy: 90 }))).toBe(1);
    expect(goalProgress(goal({ baselineAccuracy: 60, targetAccuracy: 80, bestAccuracy: 60 }))).toBe(0);
  });
  it('returns 1 when target <= baseline', () => {
    expect(goalProgress(goal({ baselineAccuracy: 80, targetAccuracy: 75, bestAccuracy: 80 }))).toBe(1);
  });
});

describe('reconcileGoal (loss-proof)', () => {
  it('raises best when current is higher', () => {
    expect(reconcileGoal(goal({ bestAccuracy: 60 }), 72).bestAccuracy).toBe(72);
  });
  it('never lowers best on a dip', () => {
    expect(reconcileGoal(goal({ bestAccuracy: 72 }), 55).bestAccuracy).toBe(72);
  });
  it('latches met once best >= target and never clears it', () => {
    const met = reconcileGoal(goal({ targetAccuracy: 70, bestAccuracy: 60 }), 75);
    expect(met.met).toBe(true);
    expect(reconcileGoal(met, 40).met).toBe(true);
  });
});

describe('isGoalMet / canSetGoal', () => {
  it('isGoalMet exactly when best >= target', () => {
    expect(isGoalMet(goal({ targetAccuracy: 70, bestAccuracy: 70 }))).toBe(true);
    expect(isGoalMet(goal({ targetAccuracy: 70, bestAccuracy: 69 }))).toBe(false);
  });
  it('canSetGoal gates on GOAL_MIN_LOGS (5)', () => {
    expect(canSetGoal(4)).toBe(false);
    expect(canSetGoal(5)).toBe(true);
  });
});

describe('presetsForAccuracy / recommendedPreset', () => {
  it('offers only bands tighter than current', () => {
    expect(presetsForAccuracy(70)).toEqual([25, 15, 10]); // band 30 → tighter only
  });
  it('falls back to the tightest single preset when already very tight', () => {
    expect(presetsForAccuracy(95)).toEqual([10]); // band 5
  });
  it('never returns empty (band 0)', () => {
    expect(presetsForAccuracy(100).length).toBeGreaterThanOrEqual(1);
  });
  it('recommends the easiest band at least GOAL_RECOMMEND_STEP tighter', () => {
    // current 70 → band 30; 25 is only 5 tighter; 15 is 15 tighter → recommend 15
    expect(recommendedPreset(70)).toBe(15);
  });
  it('recommended falls back to loosest option when none qualify', () => {
    expect(recommendedPreset(95)).toBe(10);
  });
});
