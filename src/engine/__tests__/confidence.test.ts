import { confidenceFor, honestRangeFor, quantile, reservePriceVisible } from '../confidence';
import { RANGE_MAX_HALF_WIDTH, RANGE_MIN_HALF_WIDTH } from '../constants';

const PRIOR = 1.8;

const floor5 = (m: number) => Math.max(5, Math.floor(m / 5) * 5);
const ceil5 = (m: number) => Math.max(5, Math.ceil(m / 5) * 5);

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

describe('quantile (type-7 linear interpolation)', () => {
  it('matches R quantile() type-7 outputs on a small sorted set', () => {
    const sorted = [1, 2, 3, 4];
    expect(quantile(sorted, 0.25)).toBeCloseTo(1.75, 6);
    expect(quantile(sorted, 0.5)).toBeCloseTo(2.5, 6);
    expect(quantile(sorted, 0.75)).toBeCloseTo(3.25, 6);
  });
  it('returns the endpoints at q=0 and q=1', () => {
    const sorted = [5, 10, 20, 40];
    expect(quantile(sorted, 0)).toBe(5);
    expect(quantile(sorted, 1)).toBe(40);
  });
  it('returns the single value for a one-element set', () => {
    expect(quantile([7], 0.25)).toBe(7);
    expect(quantile([7], 0.75)).toBe(7);
  });
});

describe('honestRangeFor — P25–P75', () => {
  it('brackets honest on the 5-grid for honest 5..120, tight and noisy', () => {
    const tight = [1.9, 2.0, 2.0, 2.1];
    const noisy = [1.0, 3.0, 1.1, 2.9];
    for (let honest = 5; honest <= 120; honest += 1) {
      const guess = Math.max(1, Math.round(honest / 2));
      for (const ratios of [tight, noisy]) {
        const r = honestRangeFor({
          honestMinutes: honest,
          guessMinutes: guess,
          clampedRatios: ratios,
          prior: PRIOR,
        });
        expect(r.lowMinutes % 5).toBe(0);
        expect(r.highMinutes % 5).toBe(0);
        expect(r.lowMinutes).toBeGreaterThanOrEqual(5);
        expect(r.lowMinutes).toBeLessThanOrEqual(honest);
        expect(honest).toBeLessThanOrEqual(r.highMinutes);
        expect(r.lowMinutes).toBeLessThanOrEqual(r.highMinutes);
      }
    }
  });

  it('is a direct percentile of the ratios times the guess', () => {
    // R = [1,1,1,2,2,2,3,3] (n=8 ≥ QUANTILE_MIN_N) → pure empirical band.
    const ratios = [1, 1, 1, 2, 2, 2, 3, 3];
    const guess = 10;
    const logs = ratios.map(Math.log).sort((a, b) => a - b);
    const p25 = quantile(logs, 0.25);
    const p75 = quantile(logs, 0.75);
    const honest = 20;
    const r = honestRangeFor({ honestMinutes: honest, guessMinutes: guess, clampedRatios: ratios, prior: PRIOR });
    const expectedLow = Math.min(floor5(honest), floor5(guess * Math.exp(p25)));
    const expectedHigh = Math.max(ceil5(honest), ceil5(guess * Math.exp(p75)));
    expect(r.lowMinutes).toBe(expectedLow);
    expect(r.highMinutes).toBe(expectedHigh);
  });

  it('a noisy category yields a wider band than a settled one', () => {
    const tight = honestRangeFor({ honestMinutes: 80, guessMinutes: 40, clampedRatios: [1.9, 2.0, 2.1, 2.0], prior: PRIOR });
    const noisy = honestRangeFor({ honestMinutes: 80, guessMinutes: 40, clampedRatios: [1.0, 3.0, 1.1, 2.9], prior: PRIOR });
    expect(noisy.highMinutes - noisy.lowMinutes).toBeGreaterThan(tight.highMinutes - tight.lowMinutes);
  });

  it('narrows as the data settles (the core promise)', () => {
    const noisy = honestRangeFor({ honestMinutes: 60, guessMinutes: 30, clampedRatios: [1, 3, 1, 3, 1, 3], prior: PRIOR });
    const settled = honestRangeFor({ honestMinutes: 60, guessMinutes: 30, clampedRatios: [2, 2, 2, 2, 2, 2], prior: PRIOR });
    expect(settled.highMinutes - settled.lowMinutes).toBeLessThan(noisy.highMinutes - noisy.lowMinutes);
  });

  it('n=0 returns the prior band, bracketing the honest number on the 5-grid', () => {
    const honest = 30;
    const r = honestRangeFor({ honestMinutes: honest, guessMinutes: 20, clampedRatios: [], prior: PRIOR });
    expect(r.lowMinutes % 5).toBe(0);
    expect(r.highMinutes % 5).toBe(0);
    expect(r.lowMinutes).toBeLessThan(honest);
    expect(r.highMinutes).toBeGreaterThan(honest);
  });

  it('n=1..3 stays blended — never a falsely tight band off two lucky logs', () => {
    const guess = 15;
    const r = honestRangeFor({ honestMinutes: 30, guessMinutes: guess, clampedRatios: [2.0, 2.01], prior: PRIOR });
    expect(r.highMinutes).toBeGreaterThan(r.lowMinutes);
    // The blended half-width is well above zero, so the band has real width.
    const minWidth = guess * (Math.exp(RANGE_MIN_HALF_WIDTH) - Math.exp(-RANGE_MIN_HALF_WIDTH));
    expect(r.highMinutes - r.lowMinutes).toBeGreaterThanOrEqual(floor5(minWidth) - 5);
  });

  it('honors the half-width floor for a single distinct ratio', () => {
    const r = honestRangeFor({ honestMinutes: 60, guessMinutes: 30, clampedRatios: [2, 2, 2, 2, 2, 2], prior: PRIOR });
    expect(r.highMinutes).toBeGreaterThan(r.lowMinutes); // never a 60–60 band
  });

  it('honors the half-width ceiling for an extreme spread', () => {
    const guess = 30;
    const r = honestRangeFor({
      honestMinutes: 60,
      guessMinutes: guess,
      clampedRatios: [1 / 6, 6, 1 / 6, 6, 1 / 6, 6],
      prior: PRIOR,
    });
    const maxHigh = ceil5(guess * Math.exp(RANGE_MAX_HALF_WIDTH));
    expect(r.highMinutes).toBeLessThanOrEqual(Math.max(ceil5(60), maxHigh));
  });
});

describe('reservePriceVisible', () => {
  it('offers the founder reserve only before any category is honest', () => {
    expect(reservePriceVisible('raw')).toBe(true);
    expect(reservePriceVisible('setting')).toBe(true);
    expect(reservePriceVisible('honest')).toBe(false);
  });
});
