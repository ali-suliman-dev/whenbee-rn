import { clampRatio } from '../ratio';
import { updateEwma, alphaFor } from '../ewma';
import { blendWithPrior, honestNumber, resolveSuggestion } from '../multiplier';
import { sharpnessFromWindow, tierFor, logsToNextTier, tierBandProgress } from '../sharpness';
import { detectInsight } from '../insight';
import { buildTrendSeries } from '../trend';
import { applyLog } from '../update';
import { emptyAffineStats, solveAffine } from '../affine';
import { priorFor, GLOBAL_PRIOR, CATEGORY_PRIORS } from '../priors';

describe('clampRatio', () => {
  it('clamps a disaster to the 6× ceiling', () => {
    expect(clampRatio(10, 600)).toBe(6); // raw 60 → 6
  });
  it('clamps a freakishly fast task to the 1/6 floor', () => {
    expect(clampRatio(60, 5)).toBeCloseTo(1 / 6, 10);
  });
  it('passes a normal 2× through', () => {
    expect(clampRatio(15, 30)).toBe(2);
  });
  it('throws when the estimate is not positive', () => {
    expect(() => clampRatio(0, 10)).toThrow(RangeError);
  });
});

describe('updateEwma + alphaFor', () => {
  it('seeds from 0 at α·ln(r) on the first balanced timed log', () => {
    const a = alphaFor('balanced', 'timed'); // 0.3
    expect(updateEwma(0, 2, a)).toBeCloseTo(0.3 * Math.log(2), 10); // ≈ 0.20794
  });
  it('halves α for retro entries', () => {
    expect(alphaFor('balanced', 'retro')).toBeCloseTo(0.15, 10);
  });
});

describe('blendWithPrior', () => {
  it('returns exactly the prior at n=0', () => {
    expect(blendWithPrior(0, 0, 2.0)).toBeCloseTo(2.0, 10);
  });
  it('lets personal data pull M toward the EWMA as n grows', () => {
    // n=8, logEwma=ln(2.5), prior=2.0, k=4
    const m = blendWithPrior(8, Math.log(2.5), 2.0);
    // exp((8·ln2.5 + 4·ln2)/12) = exp((7.3289+2.7726)/12) ≈ exp(0.8418) ≈ 2.3205
    expect(m).toBeCloseTo(2.3205, 3);
  });
});

describe('honestNumber', () => {
  it('rounds 15 × 1.9 to the nearest 5 → 30', () => {
    expect(honestNumber(15, 1.9)).toBe(30); // 28.5 → 30
  });
  it('never returns below 5', () => {
    expect(honestNumber(1, 0.2)).toBe(5);
  });
});

describe('resolveSuggestion fallback', () => {
  const flat = (b: number) => ({ a: 0, b });
  const category = { fit: flat(2.0), n: 9 };
  it('uses the category when recurring lacks 3 logs', () => {
    const s = resolveSuggestion({ guessMinutes: 15, category, recurring: { fit: flat(3.0), n: 2 } });
    expect(s.multiplier).toBeCloseTo(2.0, 6);
    expect(s.basis).toBe('personal');
    expect(s.label).toBe('based on your last 9 times');
  });
  it('uses the recurring fit once it has ≥3 logs', () => {
    const s = resolveSuggestion({ guessMinutes: 15, category, recurring: { fit: flat(3.0), n: 4 } });
    expect(s.multiplier).toBeCloseTo(3.0, 6);
    expect(s.honestMinutes).toBe(45);
  });
  it('labels a cold category as typical patterns', () => {
    const s = resolveSuggestion({ guessMinutes: 20, category: { fit: flat(2.2), n: 1 }, recurring: null });
    expect(s.basis).toBe('prior');
    expect(s.label).toBe('based on typical patterns');
  });
});

describe('sharpness + tiers', () => {
  it('scores a perfect window at 100', () => {
    expect(sharpnessFromWindow([1, 1, 1])).toBe(100);
  });
  it('returns 0 for an empty window', () => {
    expect(sharpnessFromWindow([])).toBe(0);
  });
  it('maps thresholds to the right tier labels', () => {
    expect(tierFor(0)).toBe('Raw');
    expect(tierFor(63)).toBe('Setting'); // 40 ≤ 63 < 64
    expect(tierFor(64)).toBe('Ripening');
    expect(tierFor(93)).toBe('Honest');
  });
  it('estimates logs to the next tier', () => {
    expect(logsToNextTier(78)).toBe(1); // (82-78)/4 = 1
    expect(logsToNextTier(95)).toBe(0); // already Honest
  });
  describe('tierBandProgress', () => {
    it('spans the current band in whole logs, never fully filled while inside it', () => {
      // Ripening band [64,82] → ceil(18/4) = 5 pips.
      const at67 = tierBandProgress(67);
      expect(at67.total).toBe(5);
      expect(at67.remaining).toBe(logsToNextTier(67)); // 4
      expect(at67.done).toBe(1); // total - remaining
    });
    it('starts a freshly-entered band at zero done', () => {
      const fresh = tierBandProgress(64); // just crossed into Ripening
      expect(fresh.done).toBe(0);
      expect(fresh.done + fresh.remaining).toBe(fresh.total);
    });
    it('keeps at least one log to go anywhere inside the band (goal gradient)', () => {
      const nearTop = tierBandProgress(81); // one shy of Thickening
      expect(nearTop.remaining).toBeGreaterThanOrEqual(1);
      expect(nearTop.done).toBeLessThan(nearTop.total);
    });
    it('reports an empty band once Honest (no tier ahead)', () => {
      expect(tierBandProgress(95)).toEqual({ total: 0, done: 0, remaining: 0 });
    });
  });
});

describe('applyLog monotonic sharpness', () => {
  it('never lowers sharpness even on a bad log', () => {
    // window after this log is [1×6, 6, 6] → raw accuracy 79; stored is already 90.
    const res = applyLog({
      estimateMin: 10,
      actualMin: 60,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      prior: 2.0,
      category: { stats: emptyAffineStats(), n: 8, anchor: 2.0, sharpness: 90, reclaimedMinutes: 0 },
      recurring: null,
      recentClampedRatios: [1, 1, 1, 1, 1, 1, 6],
      suggestedHonestMin: null,
    });
    expect(res.counted).toBe(true);
    expect(res.category.sharpness).toBe(90); // raw window dropped to 79, stored value held
    expect(res.category.n).toBe(9);
  });
  it('does not train the model on an abandoned log', () => {
    const res = applyLog({
      estimateMin: 10,
      actualMin: 5,
      status: 'abandoned',
      source: 'timed',
      adaptSpeed: 'balanced',
      prior: 2.0,
      category: { stats: emptyAffineStats(), n: 3, anchor: 2.0, sharpness: 50, reclaimedMinutes: 0 },
      recurring: null,
      recentClampedRatios: [1, 1, 1],
      suggestedHonestMin: null,
    });
    expect(res.counted).toBe(false);
  });
  it('advances the recurring rolling stat alongside the category', () => {
    const res = applyLog({
      estimateMin: 15,
      actualMin: 30,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      prior: 2.0,
      category: { stats: emptyAffineStats(), n: 4, anchor: 2.0, sharpness: 60, reclaimedMinutes: 0 },
      recurring: { stats: emptyAffineStats(), n: 2, anchor: 2.0 },
      recentClampedRatios: [2, 2, 2, 2],
      suggestedHonestMin: null,
    });
    expect(res.counted).toBe(true);
    expect(res.recurring).not.toBeNull();
    expect(res.recurring!.n).toBe(3);
    expect(res.category.n).toBe(5);
  });
  it('returns reclaimDeltaMin from the honest-shown number when counted', () => {
    const res = applyLog({
      estimateMin: 15, actualMin: 32, status: 'completed', source: 'timed',
      adaptSpeed: 'balanced', prior: 1.8,
      category: { stats: emptyAffineStats(), n: 0, anchor: 1.8, sharpness: 0, reclaimedMinutes: 0 },
      recurring: null, recentClampedRatios: [], suggestedHonestMin: 30,
    });
    expect(res.reclaimDeltaMin).toBe(15); // |32-15| - |32-30| = 17 - 2
  });
  it('reclaimDeltaMin is 0 for an abandoned log (not counted)', () => {
    const res = applyLog({
      estimateMin: 15, actualMin: 5, status: 'abandoned', source: 'timed',
      adaptSpeed: 'balanced', prior: 1.8,
      category: { stats: emptyAffineStats(), n: 3, anchor: 1.8, sharpness: 50, reclaimedMinutes: 0 },
      recurring: null, recentClampedRatios: [], suggestedHonestMin: 24,
    });
    expect(res.reclaimDeltaMin).toBe(0);
  });
  it('falls back to roundHonest(affineHonestExact(fit, estimate)) when no suggestedHonestMin given', () => {
    // After one retro/balanced log (estimate=15, actual=40, ratio=2.67, alphaReg=0.025):
    // The post-log fit is regularized toward anchor=1.8 but pulled toward ~2.67.
    // affineHonestExact(catFit, 15) ≈ 30; roundHonest(30) = 30.
    // dividend = |40-15| - |40-30| = 25 - 10 = 15
    const res = applyLog({
      estimateMin: 15, actualMin: 40, status: 'completed', source: 'retro',
      adaptSpeed: 'balanced', prior: 1.8,
      category: { stats: emptyAffineStats(), n: 5, anchor: 1.8, sharpness: 40, reclaimedMinutes: 0 },
      recurring: null, recentClampedRatios: [], suggestedHonestMin: null,
    });
    expect(res.reclaimDeltaMin).toBe(15);
  });
});

describe('applyLog affine adaptation', () => {
  const base = {
    status: 'completed' as const,
    source: 'live' as const,
    adaptSpeed: 'balanced' as const,
    prior: 1.8,
    recurring: null,
    recentClampedRatios: [],
    suggestedHonestMin: null,
  };

  it('moves the fit toward the observed ratio over many logs', () => {
    let stats = emptyAffineStats();
    let n = 0;
    for (let i = 0; i < 30; i++) {
      const res = applyLog({
        ...base,
        estimateMin: 15,
        actualMin: 18, // ratio 1.2, below the 1.8 prior
        category: { stats, n, anchor: 1.8, sharpness: 0, reclaimedMinutes: 0 },
      });
      stats = res.category.stats;
      n = res.category.n;
    }
    const fit = solveAffine(stats, 1.8);
    expect(fit.b).toBeLessThan(1.55); // pulled down from 1.8 toward 1.2 (ridge prior holds it back)
    expect(fit.b).toBeGreaterThan(1.15);
  });

  it('does not train on abandoned logs', () => {
    const res = applyLog({
      ...base,
      status: 'abandoned',
      estimateMin: 15,
      actualMin: 60,
      category: { stats: emptyAffineStats(), n: 0, anchor: 1.8, sharpness: 0, reclaimedMinutes: 0 },
    });
    expect(res.counted).toBe(false);
  });
});

describe('detectInsight', () => {
  it('fires when n≥5, |M-1|≥0.4 and variance shrinks', () => {
    const settling = [
      Math.log(3),
      Math.log(0.5),
      Math.log(2.4),
      Math.log(1.8),
      Math.log(1.95),
      Math.log(1.9),
      Math.log(1.92),
      Math.log(1.9),
    ];
    const insight = detectInsight({ categoryId: 'cleaning', n: 8, mEffective: 1.9, orderedLogRatios: settling });
    expect(insight).not.toBeNull();
    expect(insight!.honestForFifteen).toBe(29); // round(15·1.9)
    expect(insight!.headline).toBe('~29m vs your 15m guess · runs 1.9×');
  });
  it('returns null when M is too close to 1', () => {
    expect(
      detectInsight({ categoryId: 'calls', n: 9, mEffective: 1.1, orderedLogRatios: Array(9).fill(0.05) }),
    ).toBeNull();
  });
});

describe('buildTrendSeries', () => {
  it('captions a settling category as stabilizing', () => {
    // big early overruns that settle toward an honest pace pull rolling M down > 0.2
    const steps = [
      { loggedAt: 1, clampedRatio: 6.0, alpha: 0.45 },
      { loggedAt: 2, clampedRatio: 5.0, alpha: 0.45 },
      { loggedAt: 3, clampedRatio: 1.2, alpha: 0.45 },
      { loggedAt: 4, clampedRatio: 1.1, alpha: 0.45 },
      { loggedAt: 5, clampedRatio: 1.0, alpha: 0.45 },
      { loggedAt: 6, clampedRatio: 1.05, alpha: 0.45 },
    ];
    const series = buildTrendSeries({ steps, prior: 1.5 });
    expect(series.points).toHaveLength(6);
    // first M ≈ 1.625, last M ≈ 1.291 → drop ≈ 0.334 > 0.2
    expect(series.caption).toBe('stabilizing');
  });
});

describe('priors', () => {
  it('returns the seeded prior for a known category', () => {
    expect(priorFor('cleaning')).toBe(2.0);
    expect(priorFor('admin')).toBe(2.2);
  });
  it('falls back to the global prior for custom/unknown categories', () => {
    expect(priorFor('knitting')).toBe(GLOBAL_PRIOR);
    expect(GLOBAL_PRIOR).toBe(1.8);
  });
  it('keeps every seeded prior inside the plausible (1, 6] range', () => {
    for (const v of Object.values(CATEGORY_PRIORS)) {
      expect(v).toBeGreaterThan(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});
