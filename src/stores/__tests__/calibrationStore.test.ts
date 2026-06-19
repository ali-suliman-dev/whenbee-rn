import { useCalibrationStore } from '../calibrationStore';
import { useCategoriesStore } from '../categoriesStore';
import {
  createMemoryDatabase,
  makeCategoryStatsRepo,
  makeTaskEventsRepo,
  type Database,
  type TaskEventRow,
} from '@/src/db';
import { priorFor } from '@/src/engine';
import { kv } from '@/src/lib/kv';
import { analytics } from '@/src/services/analytics';
import type { LogStatus, LogSource, AdaptSpeed } from '@/src/domain/types';

// Spy on the module-level analytics sink so funnel-event call sites can be
// asserted. The store imports the singleton `analytics`, so spying on its
// `capture` intercepts every fire without touching the real (no-op) sink.
jest.spyOn(analytics, 'capture').mockImplementation(() => {});
const captureMock = analytics.capture as jest.Mock;

/** Drop the kv flags that gate fire-once funnel events between tests (the kv
 *  mock persists its Map across tests in a file). */
function clearFunnelFlags(categories: string[] = ['cleaning']): void {
  kv.delete('whenbee.firstLogFired');
  for (const c of categories) kv.delete(`whenbee.ahaFired.${c}`);
}

/** Props of the most recent capture call for `event`, or undefined if none. */
function lastCapture(event: string): Record<string, unknown> | undefined {
  const calls = captureMock.mock.calls.filter((c) => c[0] === event);
  return calls.length > 0 ? (calls[calls.length - 1]?.[1] as Record<string, unknown>) : undefined;
}

function captureCount(event: string): number {
  return captureMock.mock.calls.filter((c) => c[0] === event).length;
}

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
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
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
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
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

describe('calibrationStore — reclaim deposit (Task A.4)', () => {
  it('a counted log with suggestedHonestMin returns correct reclaimDeltaMin and banks lifetime + category', async () => {
    const db = freshDb();
    const res = await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 32,
      suggestedHonestMin: 30,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });

    // delta = max(0, |actual - estimate| - |actual - honest|)
    // = max(0, |32-15| - |32-30|) = max(0, 17 - 2) = 15
    expect(res.reclaimDeltaMin).toBe(15);
    // Companion lifetime total AFTER this deposit (0 + 15).
    expect(res.reclaimLifetimeMin).toBe(15);

    // lifetime banked
    const companion = await db.getCompanion();
    expect(companion.reclaimedMinutesLifetime).toBe(15);

    // category reclaimedMinutes incremented (starts at 0, +15 = 15)
    const stat = await makeCategoryStatsRepo(db).get('cleaning');
    expect(stat.reclaimedMinutes).toBe(15);
  });

  it('an abandoned log returns reclaimDeltaMin: 0 and does not change the lifetime', async () => {
    const db = freshDb();
    const res = await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 32,
      suggestedHonestMin: 30,
      status: 'abandoned',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });

    expect(res.reclaimDeltaMin).toBe(0);
    // Not counted → lifetime total is the unchanged current value (0).
    expect(res.reclaimLifetimeMin).toBe(0);
    const companion = await db.getCompanion();
    expect(companion.reclaimedMinutesLifetime).toBe(0);
  });

  it('a log whose reclaimDeltaMin computes to 0 does not change the lifetime total', async () => {
    const db = freshDb();
    // estimate === suggestedHonestMin → delta is 0 (no improvement over naive)
    const res = await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 30,
      suggestedHonestMin: 15, // same as estimate → no reclaim
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });

    expect(res.reclaimDeltaMin).toBe(0);
    // Counted but zero deposit → lifetime total unchanged (still 0).
    expect(res.reclaimLifetimeMin).toBe(0);
    const companion = await db.getCompanion();
    expect(companion.reclaimedMinutesLifetime).toBe(0);
  });

  it('lifetime is non-decreasing at every step across a mixed sequence', async () => {
    const db = freshDb();
    const store = useCalibrationStore.getState();

    interface Step {
      estimateMin: number;
      actualMin: number;
      suggestedHonestMin: number;
      status: LogStatus;
      source: LogSource;
      adaptSpeed: AdaptSpeed;
    }

    const steps: Step[] = [
      { estimateMin: 15, actualMin: 32, suggestedHonestMin: 30, status: 'completed', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 20, actualMin: 25, suggestedHonestMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 10, actualMin: 40, suggestedHonestMin: 20, status: 'abandoned', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 30, actualMin: 60, suggestedHonestMin: 55, status: 'completed', source: 'retro', adaptSpeed: 'reactive' },
      { estimateMin: 5,  actualMin: 10, suggestedHonestMin: 9,  status: 'completed', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 45, actualMin: 50, suggestedHonestMin: 48, status: 'completed', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 60, actualMin: 60, suggestedHonestMin: 60, status: 'completed', source: 'retro', adaptSpeed: 'steady' },
      { estimateMin: 15, actualMin: 18, suggestedHonestMin: 16, status: 'abandoned', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 20, actualMin: 45, suggestedHonestMin: 40, status: 'completed', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 10, actualMin: 11, suggestedHonestMin: 10, status: 'completed', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 25, actualMin: 35, suggestedHonestMin: 30, status: 'completed', source: 'timed', adaptSpeed: 'reactive' },
      { estimateMin: 15, actualMin: 50, suggestedHonestMin: 45, status: 'completed', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 30, actualMin: 30, suggestedHonestMin: 30, status: 'completed', source: 'retro', adaptSpeed: 'balanced' },
      { estimateMin: 10, actualMin: 20, suggestedHonestMin: 18, status: 'abandoned', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 60, actualMin: 90, suggestedHonestMin: 85, status: 'completed', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 5,  actualMin: 8,  suggestedHonestMin: 7,  status: 'completed', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 20, actualMin: 22, suggestedHonestMin: 20, status: 'completed', source: 'retro', adaptSpeed: 'balanced' },
      { estimateMin: 45, actualMin: 90, suggestedHonestMin: 80, status: 'completed', source: 'timed', adaptSpeed: 'reactive' },
      { estimateMin: 30, actualMin: 35, suggestedHonestMin: 32, status: 'abandoned', source: 'timed', adaptSpeed: 'balanced' },
      { estimateMin: 15, actualMin: 28, suggestedHonestMin: 25, status: 'completed', source: 'timed', adaptSpeed: 'balanced' },
    ];

    let prevLifetime = 0;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      await store.applyLog({ category: 'cleaning', ...step, nowMs: T0 + i });
      const companion = await db.getCompanion();
      expect(companion.reclaimedMinutesLifetime).toBeGreaterThanOrEqual(prevLifetime);
      prevLifetime = companion.reclaimedMinutesLifetime;
    }
  });

  it('lifetime equals the sum of reclaimDividendMin across all task_events after a sequence', async () => {
    const db = freshDb();
    const store = useCalibrationStore.getState();

    const inputs = [
      { estimateMin: 15, actualMin: 32, suggestedHonestMin: 30, status: 'completed' as LogStatus, source: 'timed' as LogSource, adaptSpeed: 'balanced' as AdaptSpeed },
      { estimateMin: 20, actualMin: 25, suggestedHonestMin: 22, status: 'completed' as LogStatus, source: 'timed' as LogSource, adaptSpeed: 'balanced' as AdaptSpeed },
      { estimateMin: 10, actualMin: 40, suggestedHonestMin: 20, status: 'abandoned' as LogStatus, source: 'timed' as LogSource, adaptSpeed: 'balanced' as AdaptSpeed },
      { estimateMin: 30, actualMin: 60, suggestedHonestMin: 55, status: 'completed' as LogStatus, source: 'retro' as LogSource, adaptSpeed: 'reactive' as AdaptSpeed },
      { estimateMin: 5,  actualMin: 10, suggestedHonestMin: 9,  status: 'completed' as LogStatus, source: 'timed' as LogSource, adaptSpeed: 'balanced' as AdaptSpeed },
    ];

    for (let i = 0; i < inputs.length; i++) {
      await store.applyLog({ category: 'cleaning', ...inputs[i]!, nowMs: T0 + i });
    }

    const companion = await db.getCompanion();
    const events = await makeTaskEventsRepo(db).listByCategory('cleaning', 50);
    const sumDividends = events.reduce((acc, e) => acc + e.reclaimDividendMin, 0);

    expect(companion.reclaimedMinutesLifetime).toBe(sumDividends);
  });

  it('retro log with suggestedHonestMin:null falls back to honestNumber(guess, M_before) and still deposits reclaim', async () => {
    // cleaning prior = 2.0 → honestNumber(15, 2.0) = round5(30) = 30.
    // actual=40: reclaimDividend(guess=15, actual=40, honestFallback=30)
    //   = max(0, |40-15| - |40-30|) = max(0, 25 - 10) = 15.
    // So even with no suggested honest (retro path), deposit > 0 via fallback.
    const db = freshDb();
    const res = await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 40,
      suggestedHonestMin: null,
      status: 'completed',
      source: 'retro',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });

    expect(res.counted).toBe(true);
    // Engine fell back to honestNumber(15, 2.0)=30 → deposit = max(0, 25-10) = 15.
    expect(res.reclaimDeltaMin).toBe(15);

    const companion = await db.getCompanion();
    expect(companion.reclaimedMinutesLifetime).toBe(15);
  });
});

describe('calibrationStore — loadReclaimSummary', () => {
  function trackCategories(ids: string[]): void {
    useCategoriesStore.setState({
      categories: ids.map((id) => ({ id, name: id, adaptSpeed: 'balanced' as AdaptSpeed })),
    });
  }

  it('returns lifetime, byCategory (desc), biggestArea, and honestLogCount', async () => {
    const db = freshDb();
    trackCategories(['cleaning', 'admin', 'errands']);

    // cleaning: 2 deposits (10 + 20 = 30), 3 trained logs
    await db.upsertCategoryStat({
      categoryId: 'cleaning',
      n: 3,
      logEwma: 0.4,
      mEffective: 1.6,
      sharpness: 40,
      priorMult: priorFor('cleaning'),
      adaptSpeed: 'balanced',
      updatedAt: T0,
      reclaimedMinutes: 30,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });
    // admin: bigger reclaim (50), 5 trained logs → biggest area
    await db.upsertCategoryStat({
      categoryId: 'admin',
      n: 5,
      logEwma: 0.3,
      mEffective: 1.4,
      sharpness: 70,
      priorMult: priorFor('admin'),
      adaptSpeed: 'balanced',
      updatedAt: T0,
      reclaimedMinutes: 50,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });
    // errands: no reclaim, no logs
    await db.upsertCategoryStat({
      categoryId: 'errands',
      n: 0,
      logEwma: 0,
      mEffective: priorFor('errands'),
      sharpness: 0,
      priorMult: priorFor('errands'),
      adaptSpeed: 'balanced',
      updatedAt: T0,
      reclaimedMinutes: 0,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });
    // lifetime companion total banked independently of per-category.
    await db.addReclaim(80);

    const summary = await useCalibrationStore.getState().loadReclaimSummary();

    expect(summary.lifetimeMin).toBe(80);

    // sorted desc by reclaimedMinutes: admin (50) → cleaning (30) → errands (0)
    expect(summary.byCategory.map((c) => c.categoryId)).toEqual(['admin', 'cleaning', 'errands']);
    expect(summary.byCategory[0]?.reclaimedMinutes).toBe(50);

    // biggest area = the max-reclaim category.
    expect(summary.biggestArea?.categoryId).toBe('admin');
    expect(summary.biggestArea?.reclaimedMinutes).toBe(50);

    // honestLogCount = sum of trained logs (n) across tracked categories.
    expect(summary.honestLogCount).toBe(8);
  });

  it('biggestArea is null when every category has zero reclaim', async () => {
    freshDb();
    trackCategories(['cleaning', 'admin']);
    // No deposits, cold stats (repo seeds n=0, reclaimedMinutes=0).

    const summary = await useCalibrationStore.getState().loadReclaimSummary();

    expect(summary.lifetimeMin).toBe(0);
    expect(summary.biggestArea).toBeNull();
    expect(summary.honestLogCount).toBe(0);
    expect(summary.byCategory.every((c) => c.reclaimedMinutes === 0)).toBe(true);
  });
});

describe('calibrationStore — setReason is capture-only (Task B.5 invariant)', () => {
  it('tagging a reason never changes mEffective or sharpness', async () => {
    const db = freshDb();

    // Apply a counted log so there's a real stat + a real event to tag.
    const res = await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 40,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });

    const before = useCalibrationStore.getState().statsByCategory.cleaning;
    const persistedBefore = await makeCategoryStatsRepo(db).get('cleaning');
    expect(before).toBeDefined();

    // Capture a reason against the just-logged event.
    await useCalibrationStore.getState().setReason(res.eventId, 'interrupted', 'manual');

    const after = useCalibrationStore.getState().statsByCategory.cleaning;
    const persistedAfter = await makeCategoryStatsRepo(db).get('cleaning');

    // The model is byte-for-byte unchanged — the reason is a pure side channel.
    expect(after?.mEffective).toBe(before?.mEffective);
    expect(after?.sharpness).toBe(before?.sharpness);
    expect(after?.n).toBe(before?.n);
    expect(persistedAfter.mEffective).toBe(persistedBefore.mEffective);
    expect(persistedAfter.sharpness).toBe(persistedBefore.sharpness);

    // The reason actually landed in the capture-only store.
    const tag = await db.getContextTag(res.eventId, 'reason');
    expect(tag?.value).toBe('interrupted');
  });
});

describe('calibrationStore — funnel analytics (Task C.1)', () => {
  beforeEach(() => {
    captureMock.mockClear();
    clearFunnelFlags(['cleaning', 'admin']);
  });

  it('fires first_log exactly once across two counted logs', async () => {
    freshDb();
    const store = useCalibrationStore.getState();

    await store.applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 30,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });
    expect(captureCount('first_log')).toBe(1);

    await store.applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 25,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0 + 1,
    });
    // The second counted log must NOT re-fire first_log.
    expect(captureCount('first_log')).toBe(1);
  });

  it('does not fire first_log for an uncounted (abandoned) log', async () => {
    freshDb();
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 0,
      status: 'abandoned',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });
    expect(captureCount('first_log')).toBe(0);
  });

  it('fires honey_ripened on every counted log with a before/after/delta', async () => {
    freshDb();
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 30,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });
    const props = lastCapture('honey_ripened');
    expect(props).toBeDefined();
    expect(props).toHaveProperty('sharpness_before');
    expect(props).toHaveProperty('sharpness_after');
    expect(props?.delta).toBe(
      (props?.sharpness_after as number) - (props?.sharpness_before as number),
    );
  });

  it('fires aha_shown once when an insight first surfaces on the write path', async () => {
    freshDb();
    const store = useCalibrationStore.getState();

    // Build toward a qualifying insight: n≥5, |M−1|≥0.4, variance shrinking.
    // Early scattered actuals then a tight tail (all 2.0×) → stabilizing.
    const actuals = [90, 6, 75, 9, 30, 30, 30, 30];
    for (let i = 0; i < actuals.length; i++) {
      await store.applyLog({
        category: 'cleaning',
        estimateMin: 15,
        actualMin: actuals[i]!,
        status: 'completed',
        source: 'timed',
        adaptSpeed: 'balanced',
        nowMs: T0 + i,
      });
    }

    // The discovery surfaced exactly once, carrying category + multiplier + n.
    expect(captureCount('aha_shown')).toBe(1);
    const props = lastCapture('aha_shown');
    expect(props?.category).toBe('cleaning');
    expect(typeof props?.multiplier).toBe('number');
    expect(typeof props?.n).toBe('number');

    // A further qualifying log must NOT re-fire it (latched per category).
    await store.applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 30,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0 + 100,
    });
    expect(captureCount('aha_shown')).toBe(1);
  });

  it('fires task_logged with the typed funnel props', async () => {
    freshDb();
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 15,
      actualMin: 30,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });
    const props = lastCapture('task_logged');
    expect(props?.category).toBe('cleaning');
    expect(props?.guess_min).toBe(15);
    expect(props?.actual_min).toBe(30);
    expect(props?.entry_type).toBe('timed');
    expect(props).toHaveProperty('ratio');
    expect(props).toHaveProperty('sharpness_after');
    expect(props).toHaveProperty('tier_after');
  });
});
