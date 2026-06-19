import {
  emptyAffineStats,
  updateAffineStats,
  solveAffine,
  affineHonestExact,
  seedAffineFromMultiplier,
} from '../affine';

describe('solveAffine cold start', () => {
  it('returns a=0, b=anchor with empty stats', () => {
    const fit = solveAffine(emptyAffineStats(), 2.2);
    expect(fit.a).toBeCloseTo(0, 10);
    expect(fit.b).toBeCloseTo(2.2, 10);
  });

  it('cold-start honest equals guess × prior for many guesses/priors', () => {
    for (const prior of [1.3, 1.8, 2.2, 2.4]) {
      const fit = solveAffine(emptyAffineStats(), prior);
      for (const g of [5, 10, 15, 30, 45, 90]) {
        expect(affineHonestExact(fit, g)).toBeCloseTo(g * prior, 6);
      }
    }
  });
});

describe('solveAffine learning', () => {
  it('recovers a real fixed cost + slope from varied data', () => {
    // y = 10 + 1.3x, guesses spread 5..90, recency off (alpha small)
    let s = emptyAffineStats();
    const alpha = 0.2;
    for (let i = 0; i < 200; i++) {
      const x = [5, 10, 15, 20, 30, 45, 60, 90][i % 8] as number;
      s = updateAffineStats(s, x, 10 + 1.3 * x, alpha);
    }
    const fit = solveAffine(s, 1.8);
    expect(fit.a).toBeGreaterThan(6);
    expect(fit.b).toBeCloseTo(1.3, 1);
  });

  it('with no spread (all same guess) stays ~pure multiplier (a≈0)', () => {
    let s = emptyAffineStats();
    for (let i = 0; i < 100; i++) s = updateAffineStats(s, 15, 27, 0.2); // ratio 1.8
    const fit = solveAffine(s, 1.8);
    expect(Math.abs(fit.a)).toBeLessThan(2);
    expect(affineHonestExact(fit, 15)).toBeCloseTo(27, 0);
  });

  it('stays sane on two noisy nearby points that break raw OLS', () => {
    let s = emptyAffineStats();
    s = updateAffineStats(s, 10, 20, 0.3);
    s = updateAffineStats(s, 11, 18, 0.3);
    const fit = solveAffine(s, 1.8);
    expect(fit.b).toBeGreaterThan(0); // raw OLS would give b=-2
    expect(affineHonestExact(fit, 30)).toBeGreaterThan(0);
  });
});

describe('seedAffineFromMultiplier', () => {
  it('seeds stats that solve back to a=0, b=multiplier for any weight', () => {
    for (const m of [1.2, 1.8, 2.4]) {
      for (const w of [1, 3, 8]) {
        const fit = solveAffine(seedAffineFromMultiplier(m, w), 1.8);
        expect(fit.a).toBeCloseTo(0, 6);
        expect(fit.b).toBeCloseTo(m, 6);
      }
    }
  });
});
