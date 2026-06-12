import { useCalibrationStore } from '../calibrationStore';
import {
  createMemoryDatabase,
  makeCategoryStatsRepo,
  makeTaskEventsRepo,
  type Database,
  type TaskEventRow,
} from '@/src/db';
import { priorFor } from '@/src/engine';

const T0 = 1_000_000_000_000;

function freshDb(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

function seedEvent(over: Partial<TaskEventRow>): TaskEventRow {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    category: 'cleaning',
    label: null,
    estimateMin: 15,
    actualMin: 30,
    status: 'completed',
    source: 'timed',
    startedAt: null,
    endedAt: null,
    createdAt: T0,
    suggestedHonestMin: null,
    reclaimDividendMin: 0,
    ...over,
  };
}

describe('calibrationStore', () => {
  it('a completed log trains the model, persists, and caches', async () => {
    const db = freshDb();
    const res = await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 30,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });

    expect(res.counted).toBe(true);
    // multiplier sits between the cleaning prior (2.0) and the observed ratio (2.0)
    // ratio = 30/15 = 2.0, prior = 2.0 → blended stays ~2.0
    expect(res.multiplier).toBeGreaterThan(0);

    // cache patched
    const stats = useCalibrationStore.getState().statsByCategory.cleaning;
    expect(stats).toBeDefined();
    expect(stats?.n).toBe(1);

    // event row inserted
    const events = await makeTaskEventsRepo(db).listByCategory('cleaning');
    expect(events).toHaveLength(1);
    expect(events[0]?.estimateMin).toBe(15);
    expect(events[0]?.actualMin).toBe(30);

    // stat persisted
    const persisted = await makeCategoryStatsRepo(db).get('cleaning');
    expect(persisted.n).toBe(1);
  });

  it('a sustained over-run pulls the multiplier above the cleaning prior (2.0)', async () => {
    freshDb();
    const store = useCalibrationStore.getState();
    let last = 0;
    // estimate 10, actual 40 → clamped ratio capped at 6; cleaning prior 2.0.
    // A single n=1 log barely moves M (prior + k pseudo-counts dominate); a
    // streak of over-runs drives the personal multiplier above the prior.
    for (let i = 0; i < 8; i++) {
      const res = await store.applyLog({
        category: 'cleaning',
        estimateMin: 10,
        actualMin: 40,
        status: 'completed',
        source: 'timed',
        adaptSpeed: 'balanced',
        nowMs: T0 + i,
      });
      last = res.multiplier;
      expect(res.multiplier).toBeGreaterThan(0);
    }
    expect(last).toBeGreaterThan(2.0);
  });

  it('an abandoned log is stored but does not train the model', async () => {
    const db = freshDb();
    const res = await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 30,
      status: 'abandoned',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });

    expect(res.counted).toBe(false);
    expect(res.tierBefore).toBe(res.tierAfter);
    expect(res.leveledUp).toBe(false);
    expect(useCalibrationStore.getState().statsByCategory.cleaning).toBeUndefined();

    // event still stored
    const events = await makeTaskEventsRepo(db).listByCategory('cleaning');
    expect(events).toHaveLength(1);

    // persisted stat untouched (n stays 0)
    const persisted = await makeCategoryStatsRepo(db).get('cleaning');
    expect(persisted.n).toBe(0);
  });

  it('sharpness is monotonic — a bad over-run never lowers it', async () => {
    freshDb();
    const store = useCalibrationStore.getState();
    // a few accurate-ish logs to build sharpness
    for (let i = 0; i < 4; i++) {
      await store.applyLog({
        category: 'cleaning',
        estimateMin: 15,
        actualMin: 16,
        status: 'completed',
        source: 'timed',
        adaptSpeed: 'balanced',
        nowMs: T0 + i,
      });
    }
    const before = useCalibrationStore.getState().statsByCategory.cleaning?.sharpness ?? 0;
    // now a wild over-run
    await store.applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 90,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0 + 10,
    });
    const after = useCalibrationStore.getState().statsByCategory.cleaning?.sharpness ?? 0;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('persists recurring rolling stats when a recurringKey is given', async () => {
    const db = freshDb();
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 30,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      recurringKey: 'cleaning:dishes',
      nowMs: T0,
    });
    const rec = await db.getRecurringStat('cleaning:dishes');
    expect(rec).not.toBeNull();
    expect(rec?.n).toBe(1);
    expect(rec?.categoryId).toBe('cleaning');
  });
});

describe('calibrationStore — loadCategoryDetail', () => {
  it('assembles n, a non-null insight, a trend, and newest-first recent', async () => {
    const db = freshDb();

    // Stat: n≥5 and mEffective deviates ≥0.4 from 1 → the "surprising" gate.
    await db.upsertCategoryStat({
      categoryId: 'cleaning',
      n: 8,
      logEwma: 0.6,
      mEffective: 1.9,
      sharpness: 70,
      priorMult: priorFor('cleaning'),
      adaptSpeed: 'balanced',
      updatedAt: T0,
      reclaimedMinutes: 0,
    });

    // 8 completed events whose ln(ratio) variance SHRINKS over time:
    // early half scattered (ratios 60,15,90,12 over a 15 estimate), late half tight
    // (all 30/15 = 2.0) → var(last 4) < var(first 4) → "stabilizing".
    const earlyActuals = [60, 15, 90, 12];
    const lateActuals = [30, 30, 30, 30];
    const actuals = [...earlyActuals, ...lateActuals];
    for (let i = 0; i < actuals.length; i++) {
      await db.insertTaskEvent(
        seedEvent({ id: `c${i}`, estimateMin: 15, actualMin: actuals[i], createdAt: T0 + i }),
      );
    }
    // a non-completed event must be ignored by the engine replays + recent list.
    await db.insertTaskEvent(
      seedEvent({ id: 'abandoned', status: 'abandoned', actualMin: null, createdAt: T0 + 100 }),
    );

    const detail = await useCalibrationStore.getState().loadCategoryDetail('cleaning');

    expect(detail.categoryName).toBe('Cleaning');
    expect(detail.n).toBe(8);
    expect(detail.tier).toBe('Ripening'); // sharpness 70 → [64,82) band
    expect(detail.summary.honestMinutes).toBe(30); // round_to_5(15 × 1.9) = 30

    // Insight qualifies: n=8 (≥5), |1.9−1|=0.9 (≥0.4), variance shrinking.
    expect(detail.insight).not.toBeNull();
    expect(detail.insight?.headline).toContain('runs 1.9×');

    // Trend replays one point per completed log.
    expect(detail.trend.points).toHaveLength(8);

    // Recent: completed only, newest-first (createdAt descending).
    expect(detail.recent).toHaveLength(8);
    expect(detail.recent[0]?.createdAt).toBe(T0 + 7);
    expect(detail.recent[detail.recent.length - 1]?.createdAt).toBe(T0);
    // ratio is attached and clamped: 30/15 = 2.0.
    expect(detail.recent[0]?.ratio).toBeCloseTo(2.0, 5);
  });

  it('returns a null insight on the prior fallback (no logs yet)', async () => {
    freshDb();
    const detail = await useCalibrationStore.getState().loadCategoryDetail('cleaning');
    expect(detail.n).toBe(0);
    expect(detail.insight).toBeNull();
    expect(detail.recent).toHaveLength(0);
    expect(detail.trend.points).toHaveLength(0);
    // mEffective falls back to the cleaning prior (2.0).
    expect(detail.mEffective).toBeCloseTo(priorFor('cleaning'), 5);
  });
});

describe('calibrationStore — resetCategory', () => {
  it('clears events and zeroes the stat back to the prior', async () => {
    const db = freshDb();

    await db.upsertCategoryStat({
      categoryId: 'cleaning',
      n: 5,
      logEwma: 0.7,
      mEffective: 2.4,
      sharpness: 60,
      priorMult: priorFor('cleaning'),
      adaptSpeed: 'reactive',
      updatedAt: T0,
      reclaimedMinutes: 0,
    });
    await db.insertTaskEvent(seedEvent({ id: 'r1', createdAt: T0 }));
    await db.insertTaskEvent(seedEvent({ id: 'r2', createdAt: T0 + 1 }));
    // pre-populate the cache so we can assert the patch.
    useCalibrationStore.setState({
      statsByCategory: { cleaning: { mEffective: 2.4, n: 5, sharpness: 60, tier: 'Ripening' } },
    });

    await useCalibrationStore.getState().resetCategory('cleaning');

    // events gone
    expect(await db.listEventsByCategory('cleaning', 30)).toHaveLength(0);

    // stat reseeded to n=0 / prior
    const stat = await makeCategoryStatsRepo(db).get('cleaning');
    expect(stat.n).toBe(0);
    expect(stat.logEwma).toBe(0);
    expect(stat.sharpness).toBe(0);
    expect(stat.mEffective).toBeCloseTo(priorFor('cleaning'), 5);
    // tuning preference is preserved across a reset.
    expect(stat.adaptSpeed).toBe('reactive');

    // cache patched
    const cached = useCalibrationStore.getState().statsByCategory.cleaning;
    expect(cached?.n).toBe(0);
    expect(cached?.mEffective).toBeCloseTo(priorFor('cleaning'), 5);
    expect(cached?.tier).toBe('Raw');
  });
});
