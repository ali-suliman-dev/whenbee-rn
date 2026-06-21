import {
  deriveArchetype,
  derivePlanExperiment,
  deriveYouVsPast,
  deriveBiggestSurprise,
  derivePrediction,
  deriveDriftAlert,
  deriveCalibrationMap,
  derivePatterns,
} from '../usePatterns';
import type { PatternsData, PatternLog, PatternCategoryStat } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// Pure-derivation tests. Each card: qualifying fixture → data; thin fixture → null.
// ──────────────────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function log(p: Partial<PatternLog> = {}): PatternLog {
  return {
    category: 'admin',
    estimateMin: 15,
    actualMin: 30,
    status: 'completed',
    source: 'timed',
    createdAt: NOW - DAY,
    ...p,
  };
}

function stat(p: Partial<PatternCategoryStat> = {}): PatternCategoryStat {
  return { categoryId: 'admin', n: 6, mEffective: 2.0, sharpness: 60, ...p };
}

function makeData(p: Partial<PatternsData> = {}): PatternsData {
  return {
    categories: [],
    logs: [],
    nameOf: (id) => id,
    ...p,
  };
}

describe('deriveArchetype', () => {
  it('returns null below the cross-category / log minimums', () => {
    const data = makeData({ categories: [stat({ n: 4 })] });
    expect(deriveArchetype(data)).toBeNull();
  });

  it('names a personality from the average multiplier when enough history exists', () => {
    const data = makeData({
      categories: [
        stat({ categoryId: 'admin', n: 7, mEffective: 2.2 }),
        stat({ categoryId: 'email', n: 6, mEffective: 2.0 }),
      ],
    });
    const card = deriveArchetype(data);
    expect(card).not.toBeNull();
    expect(card!.title).toBe('The Sprint Optimist');
    expect(card!.averageMultiplier).toBeCloseTo(2.1, 5);
  });

  it('excludes categories under the personal minimum from the spread', () => {
    const data = makeData({
      categories: [
        stat({ categoryId: 'admin', n: 12, mEffective: 2.0 }),
        stat({ categoryId: 'email', n: 2, mEffective: 5.0 }), // ignored (n<3)
      ],
    });
    // Only one qualifying category → below ARCHETYPE_MIN_CATEGORIES → null.
    expect(deriveArchetype(data)).toBeNull();
  });
});

describe('derivePlanExperiment', () => {
  it('returns null until both arms clear the per-arm minimum', () => {
    const data = makeData({
      logs: [log({ source: 'timed' }), log({ source: 'timed' }), log({ source: 'retro' })],
    });
    expect(derivePlanExperiment(data)).toBeNull();
  });

  it('says winging it wins when retro logs are sharper', () => {
    const data = makeData({
      logs: [
        // timed: way off (actual 3× estimate)
        log({ source: 'timed', estimateMin: 10, actualMin: 30 }),
        log({ source: 'timed', estimateMin: 10, actualMin: 30 }),
        log({ source: 'timed', estimateMin: 10, actualMin: 30 }),
        // retro: spot on
        log({ source: 'retro', estimateMin: 10, actualMin: 10 }),
        log({ source: 'retro', estimateMin: 10, actualMin: 10 }),
        log({ source: 'retro', estimateMin: 10, actualMin: 10 }),
      ],
    });
    const card = derivePlanExperiment(data)!;
    expect(card.planWins).toBe(false);
    expect(card.retroError).toBeLessThan(card.timedError);
    expect(card.timedCount).toBe(3);
    expect(card.retroCount).toBe(3);
  });

  it('says the plan wins when timed logs are sharper', () => {
    const data = makeData({
      logs: [
        log({ source: 'timed', estimateMin: 10, actualMin: 10 }),
        log({ source: 'timed', estimateMin: 10, actualMin: 10 }),
        log({ source: 'timed', estimateMin: 10, actualMin: 10 }),
        log({ source: 'retro', estimateMin: 10, actualMin: 30 }),
        log({ source: 'retro', estimateMin: 10, actualMin: 30 }),
        log({ source: 'retro', estimateMin: 10, actualMin: 30 }),
      ],
    });
    expect(derivePlanExperiment(data)!.planWins).toBe(true);
  });
});

describe('deriveYouVsPast', () => {
  it('returns null below the compare minimum', () => {
    const data = makeData({ logs: [log(), log(), log()] });
    expect(deriveYouVsPast(data)).toBeNull();
  });

  it('reports recent vs early accuracy from the split halves', () => {
    const data = makeData({
      logs: [
        // early half: badly off
        log({ estimateMin: 10, actualMin: 40, createdAt: NOW - 6 * DAY }),
        log({ estimateMin: 10, actualMin: 40, createdAt: NOW - 5 * DAY }),
        log({ estimateMin: 10, actualMin: 40, createdAt: NOW - 4 * DAY }),
        // recent half: spot on
        log({ estimateMin: 10, actualMin: 10, createdAt: NOW - 3 * DAY }),
        log({ estimateMin: 10, actualMin: 10, createdAt: NOW - 2 * DAY }),
        log({ estimateMin: 10, actualMin: 10, createdAt: NOW - 1 * DAY }),
      ],
    });
    const card = deriveYouVsPast(data)!;
    expect(card.recentAccuracy).toBeGreaterThan(card.earlyAccuracy);
    expect(card.delta).toBe(card.recentAccuracy - card.earlyAccuracy);
  });
});

describe('deriveBiggestSurprise', () => {
  it('returns null when nothing completed in the window', () => {
    const data = makeData({ logs: [log({ createdAt: NOW - 30 * DAY })] });
    expect(deriveBiggestSurprise(data, NOW)).toBeNull();
  });

  it('picks the log with the largest |ratio − 1| this week', () => {
    const data = makeData({
      logs: [
        log({ category: 'admin', estimateMin: 10, actualMin: 12, createdAt: NOW - 2 * DAY }),
        log({ category: 'email', estimateMin: 10, actualMin: 50, createdAt: NOW - 1 * DAY }),
      ],
    });
    const card = deriveBiggestSurprise(data, NOW)!;
    expect(card.categoryId).toBe('email');
    expect(card.actualMin).toBe(50);
  });
});

describe('derivePrediction', () => {
  it('returns null without a personal-strength category', () => {
    const data = makeData({ categories: [stat({ n: 2 })] });
    expect(derivePrediction(data)).toBeNull();
  });

  it('predicts the honest number for the most-logged category', () => {
    const data = makeData({
      categories: [
        stat({ categoryId: 'admin', n: 4, mEffective: 1.5 }),
        stat({ categoryId: 'email', n: 9, mEffective: 2.0 }),
      ],
    });
    const card = derivePrediction(data)!;
    expect(card.categoryId).toBe('email');
    expect(card.honestForFifteen).toBe(30); // round5(15 × 2.0)
    expect(card.sampleSize).toBe(9);
  });
});

describe('deriveDriftAlert', () => {
  it('returns null when no category moved past the threshold', () => {
    const data = makeData({
      categories: [stat({ categoryId: 'admin' })],
      logs: Array.from({ length: 6 }, (_, i) =>
        log({ category: 'admin', estimateMin: 10, actualMin: 20, createdAt: NOW - (6 - i) * DAY }),
      ),
    });
    expect(deriveDriftAlert(data)).toBeNull();
  });

  it('flags a category whose multiplier shifted recently', () => {
    const data = makeData({
      categories: [stat({ categoryId: 'admin' })],
      logs: [
        // early: ~1.0×
        log({ category: 'admin', estimateMin: 10, actualMin: 10, createdAt: NOW - 6 * DAY }),
        log({ category: 'admin', estimateMin: 10, actualMin: 10, createdAt: NOW - 5 * DAY }),
        log({ category: 'admin', estimateMin: 10, actualMin: 10, createdAt: NOW - 4 * DAY }),
        // recent: ~3.0×
        log({ category: 'admin', estimateMin: 10, actualMin: 30, createdAt: NOW - 3 * DAY }),
        log({ category: 'admin', estimateMin: 10, actualMin: 30, createdAt: NOW - 2 * DAY }),
        log({ category: 'admin', estimateMin: 10, actualMin: 30, createdAt: NOW - 1 * DAY }),
      ],
    });
    const card = deriveDriftAlert(data)!;
    expect(card.categoryId).toBe('admin');
    expect(card.slowerLately).toBe(true);
    expect(card.recentMultiplier).toBeGreaterThan(card.earlyMultiplier);
  });
});

describe('deriveCalibrationMap', () => {
  it('skips categories with no completed logs', () => {
    const data = makeData({ categories: [stat({ categoryId: 'admin', n: 0 })] });
    expect(deriveCalibrationMap(data)).toEqual([]);
  });

  it('returns an honest-vs-guess row per logged category, busiest first', () => {
    const data = makeData({
      categories: [
        stat({ categoryId: 'admin', n: 3, mEffective: 2.0 }),
        stat({ categoryId: 'email', n: 9, mEffective: 1.5 }),
      ],
    });
    const rows = deriveCalibrationMap(data);
    expect(rows.map((r) => r.categoryId)).toEqual(['email', 'admin']);
    expect(rows[0]!.honestMin).toBe(25); // round5(15 × 1.5 = 22.5)
    expect(rows[1]!.honestMin).toBe(30); // round5(15 × 2.0)
  });

  it('reads raw for a thin category (one log, no spread to settle)', () => {
    const data = makeData({
      categories: [stat({ categoryId: 'admin', n: 1 })],
      logs: [log({ category: 'admin', estimateMin: 10, actualMin: 20 })],
    });
    expect(deriveCalibrationMap(data)[0]!.confidence).toBe('raw');
  });

  it('reads honest for a settled cluster (≥6 tight logs)', () => {
    const data = makeData({
      categories: [stat({ categoryId: 'admin', n: 6 })],
      // Tight cluster around 2× → low CV → honest.
      logs: Array.from({ length: 6 }, () => log({ category: 'admin', estimateMin: 10, actualMin: 20 })),
    });
    expect(deriveCalibrationMap(data)[0]!.confidence).toBe('honest');
  });

  it('derives confidence from THIS category\'s clamped ratios, not the aggregate', () => {
    // admin: enough logs but a wide spread → setting (not honest), even at n≥6.
    const data = makeData({
      categories: [stat({ categoryId: 'admin', n: 6 })],
      logs: [
        log({ category: 'admin', estimateMin: 10, actualMin: 10 }),
        log({ category: 'admin', estimateMin: 10, actualMin: 40 }),
        log({ category: 'admin', estimateMin: 10, actualMin: 12 }),
        log({ category: 'admin', estimateMin: 10, actualMin: 38 }),
        log({ category: 'admin', estimateMin: 10, actualMin: 11 }),
        log({ category: 'admin', estimateMin: 10, actualMin: 40 }),
      ],
    });
    expect(deriveCalibrationMap(data)[0]!.confidence).toBe('setting');
  });

  it('ignores logs without an actual when computing confidence', () => {
    const data = makeData({
      categories: [stat({ categoryId: 'admin', n: 1 })],
      logs: [
        log({ category: 'admin', estimateMin: 10, actualMin: 20 }),
        log({ category: 'admin', status: 'abandoned', actualMin: null }),
      ],
    });
    // Only one usable ratio → below the setting minimum → raw.
    expect(deriveCalibrationMap(data)[0]!.confidence).toBe('raw');
  });
});

describe('provisional archetype', () => {
  it('returns a provisional archetype from the quiz seed when data is thin', () => {
    const data = makeData({ logs: [log({ category: 'admin' })] }); // 1 completed log, below gate
    const view = derivePatterns(data, Date.now(), { m0: 1.5 });
    expect(view.archetype).not.toBeNull();
    expect(view.archetype!.provisional).toBe(true);
  });

  it('returns null archetype with no seed and thin data', () => {
    const data = makeData({ logs: [log({ category: 'admin' })] });
    const view = derivePatterns(data, Date.now());
    expect(view.archetype).toBeNull();
  });
});

describe('derivePatterns', () => {
  it('marks the whole view empty when nothing completed exists', () => {
    const view = derivePatterns(makeData(), NOW);
    expect(view.empty).toBe(true);
    expect(view.archetype).toBeNull();
    expect(view.calibrationMap).toEqual([]);
  });

  it('is not empty once a single completed log exists', () => {
    const view = derivePatterns(makeData({ logs: [log()] }), NOW);
    expect(view.empty).toBe(false);
  });

  it('ignores abandoned logs when deciding emptiness', () => {
    const view = derivePatterns(
      makeData({ logs: [log({ status: 'abandoned', actualMin: null })] }),
      NOW,
    );
    expect(view.empty).toBe(true);
  });

  it('exposes an accuracy trend once enough completed logs exist', () => {
    const data = makeData({
      logs: Array.from({ length: 12 }, (_, i) => log({ createdAt: NOW - (12 - i) * DAY })),
    });
    const view = derivePatterns(data, NOW);
    expect(view.accuracyTrend).not.toBeNull();
    expect(view.accuracyTrend!.points.length).toBeGreaterThanOrEqual(2);
  });

  it('leaves accuracy trend null for a thin history', () => {
    const data = makeData({
      logs: Array.from({ length: 3 }, (_, i) => log({ createdAt: NOW - (3 - i) * DAY })),
    });
    const view = derivePatterns(data, NOW);
    expect(view.accuracyTrend).toBeNull();
  });
});
