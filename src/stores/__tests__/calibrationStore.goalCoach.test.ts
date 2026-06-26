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

  it('returns the target band + the worst time-of-day lever for an active goal', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8); // band 30
    useCalibrationStore.getState().setGoal('cleaning', 25); // target acc 75, not met (70 < 75)

    // Mornings miss wide (ratio 2 → acc 50); evenings are tight (ratio 1 → acc 100).
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: morning(i) }));
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 15, createdAt: evening(i) }));
    }

    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach).not.toBeNull();
    expect(coach!.targetBand).toBe(25);
    expect(coach!.worstValue).toBe('mornings');
  });

  it('returns null worstValue when no time pattern clears the gate', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    // All same accuracy → no gap → null lever, but the goal target still returns.
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: morning(i) }));
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: evening(i) }));
    }
    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach!.targetBand).toBe(25);
    expect(coach!.worstValue).toBeNull();
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
