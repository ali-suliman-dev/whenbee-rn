import { confidenceFor, honestRangeFor, reservePriceVisible } from '../confidence';

describe('confidenceFor', () => {
  it('is raw below the Setting log floor', () => {
    expect(confidenceFor({ n: 0, clampedRatios: [] })).toBe('raw');
    expect(confidenceFor({ n: 2, clampedRatios: [1.5, 1.6] })).toBe('raw');
  });
  it('is setting once at the personal floor but not yet settled', () => {
    expect(confidenceFor({ n: 4, clampedRatios: [1.2, 2.0, 1.1, 2.4] })).toBe('setting');
  });
  it('needs both enough logs AND a tight spread to be honest', () => {
    expect(confidenceFor({ n: 6, clampedRatios: [1.9, 2.0, 2.0, 2.1, 1.95, 2.05] })).toBe('honest');
    expect(confidenceFor({ n: 6, clampedRatios: [1.0, 3.0, 1.2, 2.8, 1.1, 3.0] })).toBe('setting');
  });
  it('never reports honest below the honest log floor', () => {
    expect(confidenceFor({ n: 5, clampedRatios: [2, 2, 2, 2, 2] })).toBe('setting');
  });
});
describe('honestRangeFor', () => {
  it('brackets the honest number and rounds to 5', () => {
    const r = honestRangeFor({ honestMinutes: 30, clampedRatios: [1.5, 2.5, 1.2, 2.8] });
    expect(r.lowMinutes % 5).toBe(0); expect(r.highMinutes % 5).toBe(0);
    expect(r.lowMinutes).toBeLessThan(30); expect(r.highMinutes).toBeGreaterThan(30);
  });
  it('low bound is never below 5 nor above the honest number', () => {
    const r = honestRangeFor({ honestMinutes: 5, clampedRatios: [1.1, 1.2, 1.0] });
    expect(r.lowMinutes).toBeGreaterThanOrEqual(5);
    expect(r.lowMinutes).toBeLessThanOrEqual(r.highMinutes);
  });
  it('a noisy category yields a wider band than a settled one', () => {
    const tight = honestRangeFor({ honestMinutes: 40, clampedRatios: [1.9, 2.0, 2.1, 2.0] });
    const noisy = honestRangeFor({ honestMinutes: 40, clampedRatios: [1.0, 3.0, 1.1, 2.9] });
    expect(noisy.highMinutes - noisy.lowMinutes).toBeGreaterThan(tight.highMinutes - tight.lowMinutes);
  });
});
describe('reservePriceVisible', () => {
  it('offers the founder reserve only before any category is honest', () => {
    expect(reservePriceVisible('raw')).toBe(true);
    expect(reservePriceVisible('setting')).toBe(true);
    expect(reservePriceVisible('honest')).toBe(false);
  });
});
