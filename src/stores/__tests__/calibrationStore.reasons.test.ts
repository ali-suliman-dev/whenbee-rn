import { useCalibrationStore } from '../calibrationStore';
import {
  createMemoryDatabase,
  makeTaskEventsRepo,
  type Database,
  type TaskEventRow,
} from '@/src/db';

/** Fresh memory db + reset store cache, wired through the store's own injection
 *  (`setDatabase` / `resolveDb`). Returns the db for direct seeding. */
function freshStore(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {}, graduatedCategories: new Set() });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

// A fixed weekday afternoon instant — both hour (≥16) and weekday are stable so the
// store-derived time/weekday skews are deterministic. 2021-09-09 is a Thursday.
const AFTERNOON_THU = new Date('2021-09-09T17:00:00').getTime();

/** Seed one completed task event + its reason context tag, going through the
 *  store's real `setReason` side-channel (which writes the 'reason' key). */
async function seedReasonEvent(
  db: Database,
  over: Partial<TaskEventRow>,
  reason: string,
): Promise<void> {
  const id = `e-${Math.random().toString(36).slice(2)}`;
  const event: TaskEventRow = {
    id,
    category: 'cleaning',
    label: null,
    estimateMin: 15,
    actualMin: 30, // over-run by default (actual > estimate)
    status: 'completed',
    source: 'timed',
    startedAt: null,
    endedAt: null,
    createdAt: AFTERNOON_THU,
    suggestedHonestMin: null,
    reclaimDividendMin: 0,
    startLocalMinute: null,
    ...over,
  };
  await makeTaskEventsRepo(db).insert(event);
  await useCalibrationStore.getState().setReason(id, reason, 'reward');
}

describe('calibrationStore — loadReasonInsights (read-only reason correlations)', () => {
  it('returns no insight below the over-sample gate', async () => {
    const db = freshStore();
    // Only 2 reason-tagged over-runs — under REASON_MIN_OVER_SAMPLES (4).
    await seedReasonEvent(db, {}, 'interrupted');
    await seedReasonEvent(db, {}, 'interrupted');

    const insights = await useCalibrationStore.getState().loadReasonInsights();
    expect(insights).toEqual([]);
  });

  it('surfaces the dominant reason with the resolved categoryName + time skew', async () => {
    const db = freshStore();
    // 5 over-runs, 4 of them 'interrupted' (strict majority > 0.5), all afternoon Thursday.
    await seedReasonEvent(db, {}, 'interrupted');
    await seedReasonEvent(db, {}, 'interrupted');
    await seedReasonEvent(db, {}, 'interrupted');
    await seedReasonEvent(db, {}, 'interrupted');
    await seedReasonEvent(db, {}, 'context_switch');

    const insights = await useCalibrationStore.getState().loadReasonInsights();
    expect(insights).toHaveLength(1);
    const top = insights[0];
    expect(top?.categoryId).toBe('cleaning');
    expect(top?.reason).toBe('interrupted');
    expect(top?.categoryName).toBe('Cleaning');
    expect(top?.sampleCount).toBe(4);
    expect(top?.totalOver).toBe(5);
    expect(top?.timeSkew).toBe('afternoon');
    expect(top?.weekdaySkew).toBe(4); // Thursday (0 = Sunday)
  });

  it('ignores under-runs — only over-runs train the read', async () => {
    const db = freshStore();
    // 4 over-runs (qualifying) tagged 'interrupted' + several under-runs tagged 'overestimated'.
    for (let i = 0; i < 4; i += 1) {
      await seedReasonEvent(db, { estimateMin: 20, actualMin: 40 }, 'interrupted');
    }
    for (let i = 0; i < 6; i += 1) {
      await seedReasonEvent(db, { estimateMin: 40, actualMin: 20 }, 'overestimated');
    }

    const insights = await useCalibrationStore.getState().loadReasonInsights();
    expect(insights).toHaveLength(1);
    expect(insights[0]?.reason).toBe('interrupted');
    expect(insights[0]?.totalOver).toBe(4);
  });

  it('skips rows with no/zero actual or zero estimate', async () => {
    const db = freshStore();
    // 3 valid over-runs + invalid rows that must be filtered before correlation.
    await seedReasonEvent(db, {}, 'interrupted');
    await seedReasonEvent(db, {}, 'interrupted');
    await seedReasonEvent(db, {}, 'interrupted');
    await seedReasonEvent(db, { actualMin: null }, 'interrupted'); // abandoned
    await seedReasonEvent(db, { estimateMin: 0 }, 'interrupted'); // bad estimate

    // Only 3 valid over-runs → under the gate of 4 → no insight.
    const insights = await useCalibrationStore.getState().loadReasonInsights();
    expect(insights).toEqual([]);
  });
});
