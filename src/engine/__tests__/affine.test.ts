import {
  emptyAffineStats,
  updateAffineStats,
  solveAffine,
  affineHonestExact,
  seedAffineFromMultiplier,
} from '../affine';

const ALPHA = 0.05; // representative regression forgetting factor (~20-log memory)

describe('solveAffine cold start', () => {
  it('returns a=0, b=anchor with empty stats for many anchors', () => {
    for (const anchor of [1.3, 1.8, 2.2, 2.4]) {
      const fit = solveAffine(emptyAffineStats(), anchor);
      expect(fit.a).toBeCloseTo(0, 9);
      expect(fit.b).toBeCloseTo(anchor, 9);
    }
  });

  it('cold-start honest equals guess × anchor', () => {
    const fit = solveAffine(emptyAffineStats(), 2.2);
    for (const g of [5, 10, 15, 30, 45, 90]) {
      expect(affineHonestExact(fit, g)).toBeCloseTo(g * 2.2, 6);
    }
  });
});

describe('seedAffineFromMultiplier', () => {
  it('round-trips to a=0, b=multiplier for several (m, anchor) pairs', () => {
    for (const [m, anchor] of [[1.4, 2.2], [1.2, 1.3], [2.0, 1.8], [2.4, 2.4]] as const) {
      for (const w of [1, 3, 7]) {
        const fit = solveAffine(seedAffineFromMultiplier(m, w, anchor), anchor);
        expect(fit.a).toBeCloseTo(0, 6);
        expect(fit.b).toBeCloseTo(m, 6);
      }
    }
  });
});

describe('solveAffine feel', () => {
  const train = (logs: Array<[number, number]>, alpha = ALPHA) => {
    let s = emptyAffineStats();
    for (const [g, a] of logs) s = updateAffineStats(s, g, a, alpha);
    return s;
  };

  it('is conservative after a single surprising log (does not jump to 3x)', () => {
    const s = train([[15, 45]]); // ratio 3.0 vs anchor 1.8
    const fit = solveAffine(s, 1.8);
    expect(fit.b).toBeGreaterThan(1.8);
    expect(fit.b).toBeLessThan(2.4);
    const honest = affineHonestExact(fit, 15);
    expect(honest).toBeGreaterThan(27);
    expect(honest).toBeLessThan(38);
  });

  it('personalizes toward the observed pace with volume (no-spread)', () => {
    const logs = Array.from({ length: 40 }, () => [15, 18] as [number, number]); // ratio 1.2
    const fit = solveAffine(train(logs), 1.8);
    const honest = affineHonestExact(fit, 15);
    expect(honest).toBeGreaterThan(16);
    expect(honest).toBeLessThan(22); // close to true 18, not stuck at 27
  });

  it('recovers a real fixed cost + slope from varied data', () => {
    const xs = [5, 10, 15, 20, 30, 45, 60, 90];
    const logs = Array.from({ length: 240 }, (_, i) => {
      const x = xs[i % xs.length] as number;
      return [x, 10 + 1.3 * x] as [number, number];
    });
    const fit = solveAffine(train(logs), 1.8);
    expect(fit.a).toBeGreaterThan(4);
    expect(fit.b).toBeGreaterThan(1.0);
    expect(fit.b).toBeLessThan(1.6);
  });

  it('tracks a regime change (recency)', () => {
    const slow = Array.from({ length: 20 }, () => [15, 18] as [number, number]); // 1.2
    const fast = Array.from({ length: 20 }, () => [15, 37.5] as [number, number]); // 2.5
    const fit = solveAffine(train([...slow, ...fast]), 1.8);
    const honest = affineHonestExact(fit, 15);
    expect(honest).toBeGreaterThan(31); // moved toward the recent 2.5×
  });
});
