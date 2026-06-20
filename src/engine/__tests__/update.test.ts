import { applyLog } from '../update';
import type { ApplyLogInput } from '../update';
import { emptyAffineStats } from '../affine';

function baseInput(overrides: Partial<ApplyLogInput> = {}): ApplyLogInput {
  return {
    estimateMin: 20,
    actualMin: 20,
    status: 'completed',
    source: 'timed',
    adaptSpeed: 'balanced',
    prior: 1.8,
    category: {
      stats: emptyAffineStats(),
      n: 0,
      anchor: 1.8,
      sharpness: 0,
      reclaimedMinutes: 0,
    },
    recurring: null,
    recentClampedRatios: [],
    suggestedHonestMin: null,
    ...overrides,
  };
}

describe('applyLog honey-maturity', () => {
  it('first perfect log does NOT seal', () => {
    const r = applyLog(baseInput({ estimateMin: 20, actualMin: 20 }));
    expect(r.category.sharpness).toBeGreaterThan(0);
    expect(r.category.sharpness).toBeLessThan(93);
  });
  it('first wildly-early log is NOT 0 (showing up moves it)', () => {
    const r = applyLog(baseInput({ estimateMin: 20, actualMin: 8 }));
    expect(r.category.sharpness).toBeGreaterThan(0);
  });
  it('honey never drops below the previous value', () => {
    const r = applyLog(
      baseInput({ estimateMin: 20, actualMin: 8, category: { ...baseInput().category, n: 5, sharpness: 70 } }),
    );
    expect(r.category.sharpness).toBeGreaterThanOrEqual(70);
  });
});
