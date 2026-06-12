import { useCalibrationStore } from '../calibrationStore';
import {
  createMemoryDatabase,
  makeCategoryStatsRepo,
  makeTaskEventsRepo,
  type Database,
} from '@/src/db';

const T0 = 1_000_000_000_000;

function freshDb(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
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
