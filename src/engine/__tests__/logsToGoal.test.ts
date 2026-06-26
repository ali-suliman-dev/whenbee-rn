import { logsToGoal } from '../logsToGoal';

// buildAccuracySeries needs >= ACCURACY_TREND_MIN_LOGS (12) ratios. A run of
// improving ratios (worse → better, i.e. 2 → 1) yields a positive slope.
const improving = (n: number): number[] => {
  // first half ~50% accuracy (ratio 2), second half ~100% (ratio 1)
  return Array.from({ length: n }, (_, i) => (i < n / 2 ? 2 : 1));
};
const flat = (n: number): number[] => Array.from({ length: n }, () => 1.5);

describe('logsToGoal', () => {
  it('returns 0 when already at or past target', () => {
    expect(logsToGoal({ ratios: improving(12), currentAccuracy: 85, targetAccuracy: 85 })).toBe(0);
    expect(logsToGoal({ ratios: improving(12), currentAccuracy: 90, targetAccuracy: 85 })).toBe(0);
  });

  it('returns null with too few logs', () => {
    expect(logsToGoal({ ratios: improving(6), currentAccuracy: 70, targetAccuracy: 85 })).toBeNull();
  });

  it('returns null when not improving (flat or declining)', () => {
    expect(logsToGoal({ ratios: flat(12), currentAccuracy: 70, targetAccuracy: 85 })).toBeNull();
  });

  it('projects a positive whole number of logs when improving', () => {
    const eta = logsToGoal({ ratios: improving(12), currentAccuracy: 70, targetAccuracy: 85 });
    expect(eta).not.toBeNull();
    expect(Number.isInteger(eta)).toBe(true);
    expect(eta!).toBeGreaterThanOrEqual(1);
  });
});
