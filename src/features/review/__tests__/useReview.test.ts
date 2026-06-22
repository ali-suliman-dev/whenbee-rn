import { buildReviewFromData, REVIEW_LAST_SEEN_KEY } from '../useReview';
import { resolveWeekPeriod } from '@/src/engine';
import { kv } from '@/src/lib/kv';
import type { PatternsData, PatternLog, PatternCategoryStat } from '@/src/stores/calibrationStore';

// Pure-builder tests (no hook render): given a snapshot + a resolved period, the
// builder composes the recap, counting only logs INSIDE the window and reusing the
// Patterns derivations. Plus the kv freshness contract.

const DAY = 24 * 60 * 60 * 1000;
// A Wednesday so the resolved week is the prior Mon–Sun (a closed window).
const NOW = new Date(2026, 5, 17, 14, 0, 0).getTime();
const PERIOD = resolveWeekPeriod(NOW); // Mon Jun 8 – Sun Jun 14 2026
const INSIDE = PERIOD.startMs + 2 * DAY; // a day within the window
const BEFORE = PERIOD.startMs - 3 * DAY; // before the window

function log(p: Partial<PatternLog> = {}): PatternLog {
  return {
    category: 'admin',
    estimateMin: 15,
    actualMin: 30,
    status: 'completed',
    source: 'timed',
    createdAt: INSIDE,
    ...p,
  };
}

function stat(p: Partial<PatternCategoryStat> = {}): PatternCategoryStat {
  return { categoryId: 'admin', n: 6, mEffective: 2.0, sharpness: 60, ...p };
}

function makeData(p: Partial<PatternsData> = {}): PatternsData {
  return { categories: [], logs: [], nameOf: (id) => id, ...p };
}

describe('buildReviewFromData', () => {
  it('counts only completed logs inside the window', () => {
    const data = makeData({
      logs: [
        log({ actualMin: 20, createdAt: INSIDE }),
        log({ actualMin: 40, createdAt: INSIDE }),
        log({ actualMin: 99, createdAt: BEFORE }), // outside window — excluded
        log({ status: 'abandoned', actualMin: null, createdAt: INSIDE }), // not completed
      ],
    });
    const s = buildReviewFromData(data, PERIOD);
    expect(s.loggedCount).toBe(2);
    expect(s.loggedMinutes).toBe(60); // 20 + 40
  });

  it('returns a calm empty state for a window with no logs', () => {
    const s = buildReviewFromData(makeData(), PERIOD);
    expect(s.loggedCount).toBe(0);
    expect(s.loggedMinutes).toBe(0);
    expect(s.biggestSurprise).toBeNull();
    expect(s.tightened).toEqual([]);
    expect(s.accuracyLine).toBeNull();
    expect(s.reflection.length).toBeGreaterThan(0);
  });

  it('surfaces the biggest surprise from inside the window', () => {
    const data = makeData({
      logs: [
        log({ category: 'admin', estimateMin: 10, actualMin: 12, createdAt: INSIDE }),
        log({ category: 'email', estimateMin: 10, actualMin: 60, createdAt: INSIDE }),
      ],
      nameOf: (id) => (id === 'email' ? 'Email' : 'Admin'),
    });
    const s = buildReviewFromData(data, PERIOD);
    expect(s.biggestSurprise?.categoryId).toBe('email');
  });

  it('attaches the period it was built for', () => {
    const s = buildReviewFromData(makeData(), PERIOD);
    expect(s.period.id).toBe(PERIOD.id);
  });

  it('reads a tightening when a category dropped toward 1.0 across the window', () => {
    const mk = (actual: number, day: number, cat = 'admin') =>
      log({ category: cat, estimateMin: 10, actualMin: actual, createdAt: PERIOD.startMs + day * DAY });
    const data = makeData({
      categories: [stat({ categoryId: 'admin' })],
      logs: [
        // early: ~3× (actual 30 / est 10)
        mk(30, 0), mk(30, 1),
        // recent: ~1.1× (actual 11 / est 10)
        mk(11, 4), mk(11, 5),
      ],
      nameOf: () => 'Admin',
    });
    const s = buildReviewFromData(data, PERIOD);
    expect(s.tightened).toHaveLength(1);
    expect(s.tightened[0]?.categoryId).toBe('admin');
  });
});

describe('review freshness (kv)', () => {
  afterEach(() => kv.delete(REVIEW_LAST_SEEN_KEY));

  it('uses the documented kv key', () => {
    expect(REVIEW_LAST_SEEN_KEY).toBe('whenbee.review.lastSeenPeriodId');
  });

  it('round-trips a seen period id', () => {
    expect(kv.getString(REVIEW_LAST_SEEN_KEY)).toBeNull();
    kv.set(REVIEW_LAST_SEEN_KEY, PERIOD.id);
    expect(kv.getString(REVIEW_LAST_SEEN_KEY)).toBe(PERIOD.id);
  });
});
