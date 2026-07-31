import { useCalibrationStore } from '../calibrationStore';
import { createMemoryDatabase, type Database, type TaskEventRow } from '@/src/db';
import { kv } from '@/src/lib/kv';
import { analytics } from '@/src/services/analytics';

// loadGoalCoach / loadGoalLogFeedback — the two bounded reads that feed the
// add-screen assist and the reward post-log line. The pure verdicts are unit-
// tested in the engine; here we cover the store glue (gating on an active goal,
// time-of-day bucketing, newest-vs-recent comparison).

jest.spyOn(analytics, 'capture').mockImplementation(() => {});

function freshDb(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

function seedStat(categoryId: string, sharpness: number, n: number): void {
  useCalibrationStore.setState({
    statsByCategory: {
      [categoryId]: { mEffective: 1, n, sharpness, tier: 'Ripening', fit: { a: 0, b: 1 } },
    },
  });
}

let counter = 0;
function event(over: Partial<TaskEventRow>): TaskEventRow {
  counter += 1;
  return {
    id: `e-${counter}`,
    category: 'cleaning',
    label: null,
    estimateMin: 15,
    actualMin: 30,
    status: 'completed',
    source: 'timed',
    startedAt: null,
    endedAt: null,
    createdAt: 1_000_000 + counter,
    suggestedHonestMin: null,
    reclaimDividendMin: 0,
    startLocalMinute: null,
    ...over,
  };
}

// Local-time constructors so the time-of-day bucket is deterministic regardless
// of the machine timezone (month 8 = September).
const morning = (i: number) => new Date(2001, 8, 9, 9, 0, i).getTime(); // 'mornings'
const evening = (i: number) => new Date(2001, 8, 9, 19, 0, i).getTime(); // 'evenings'

beforeEach(() => {
  kv.delete('goal.cleaning');
});

describe('loadGoalCoach', () => {
  it('returns null when the category has no goal', async () => {
    freshDb();
    seedStat('cleaning', 70, 8);
    expect(await useCalibrationStore.getState().loadGoalCoach('cleaning')).toBeNull();
  });

  it('returns null once live sharpness meets the target (reconciled met)', async () => {
    freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25); // target accuracy 75
    seedStat('cleaning', 80, 9); // live sharpness now beats 75 → loadGoal latches met
    expect(await useCalibrationStore.getState().loadGoalCoach('cleaning')).toBeNull();
  });

  it('maps goal fields: bands from accuracy, forward-only progress', async () => {
    freshDb();
    seedStat('cleaning', 70, 8); // baseline accuracy 70
    useCalibrationStore.getState().setGoal('cleaning', 25); // target accuracy 75
    seedStat('cleaning', 72, 9); // best reconciles to 72 → progress (72−70)/(75−70) = 0.4

    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach).not.toBeNull();
    expect(coach!.targetBand).toBe(25);
    expect(coach!.bestBand).toBe(28); // 100 − 72
    expect(coach!.progress).toBeCloseTo(0.4);
  });

  it('counts inside-band logs over the newest ≤7 completed logs', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25); // inside ⇔ error ≤ 25%

    // 4 wide (ratio 2 → error 50%, outside), older; then 4 tight (ratio 1 → 0%, inside), newer.
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: 2_000_000 + i }));
    }
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 15, createdAt: 3_000_000 + i }));
    }

    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    // Window = newest 7 = 4 tight + 3 wide.
    expect(coach!.windowCount).toBe(7);
    expect(coach!.insideCount).toBe(4);
  });

  it('window shrinks to the available completed logs', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    await db.insertTaskEvent(event({ estimateMin: 20, actualMin: 21, createdAt: 2_000_000 })); // ~5% in
    await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: 2_000_001 })); // 50% out
    await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 15, createdAt: 2_000_002 })); // 0% in

    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach!.windowCount).toBe(3);
    expect(coach!.insideCount).toBe(2);
  });

  it('windowCount 0 with a goal but no completed logs', async () => {
    freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach!.windowCount).toBe(0);
    expect(coach!.insideCount).toBe(0);
    expect(coach!.lever).toBeNull();
  });

  it('maps the lever to best/worst values with bands on the goal scale', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    // Mornings ratio 2 → accuracy 50; evenings ratio 1 → accuracy 100. Gap 50 ≥ 12, buckets 4 ≥ 4.
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: morning(i) }));
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 15, createdAt: evening(i) }));
    }

    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach!.lever).toEqual({
      bestValue: 'evenings',
      worstValue: 'mornings',
      bestBand: 0, // 100 − 100
      worstBand: 50, // 100 − 50
    });
  });

  it('lever is null when no time pattern clears the gate', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: morning(i) }));
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: evening(i) }));
    }
    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach!.lever).toBeNull();
  });

  it('is deterministic for a fixed category — guess churn cannot exist in the API', async () => {
    // The spec's §4 invariant: the coach depends only on categoryId. The API has no
    // guess parameter (type-level guarantee); this documents value-determinism too.
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 15, createdAt: 2_000_000 }));
    const a = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    const b = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(b).toEqual(a);
  });
});

describe('loadGoalLogFeedback', () => {
  it('returns null without an active goal', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    await db.insertTaskEvent(event({ estimateMin: 20, actualMin: 21 }));
    expect(await useCalibrationStore.getState().loadGoalLogFeedback('cleaning')).toBeNull();
  });

  it('flags the newest log as tightest this week when it beats the recent window', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    // Older logs are wide (ratio 2 → error 0.5); the newest is tight (ratio ~1.05).
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: 2_000_000 + i }));
    }
    await db.insertTaskEvent(event({ estimateMin: 20, actualMin: 21, createdAt: 3_000_000 }));

    const fb = await useCalibrationStore.getState().loadGoalLogFeedback('cleaning');
    expect(fb).not.toBeNull();
    expect(fb!.quality).toBe('tightest_week');
    expect(fb!.targetBand).toBe(25);
    expect(fb!.thisBand).toBeLessThan(10); // ratio 1.05 → ~5% error
  });
});
