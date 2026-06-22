import { useCalibrationStore } from '../calibrationStore';
import { createMemoryDatabase, makeTaskEventsRepo, type Database, type TaskEventRow } from '@/src/db';

function freshStore(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {}, graduatedCategories: new Set() });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

const NOON = new Date('2021-09-09T12:00:00').getTime();

/** Seed a completed event with a given est/act, then tag it with an energy value
 *  through the store's real `setContext` side channel. */
async function seedEnergyEvent(
  db: Database,
  estimateMin: number,
  actualMin: number,
  energy: string,
): Promise<void> {
  const id = `e-${Math.random().toString(36).slice(2)}`;
  const event: TaskEventRow = {
    id,
    category: 'cleaning',
    label: null,
    estimateMin,
    actualMin,
    status: 'completed',
    source: 'timed',
    startedAt: null,
    endedAt: null,
    createdAt: NOON,
    suggestedHonestMin: null,
    reclaimDividendMin: 0,
    startLocalMinute: null,
  };
  await makeTaskEventsRepo(db).insert(event);
  await useCalibrationStore.getState().setContext(id, 'energy', energy, 'manual');
}

describe('calibrationStore — context tags (S4)', () => {
  it('returns no insight below the per-value sample gate', async () => {
    const db = freshStore();
    await seedEnergyEvent(db, 15, 15, 'high');
    await seedEnergyEvent(db, 15, 40, 'low');

    expect(await useCalibrationStore.getState().loadContextInsights()).toEqual([]);
  });

  it('surfaces the best vs worst energy value once both clear the gate', async () => {
    const db = freshStore();
    // 5 accurate high-energy sessions, 5 way-off low-energy ones.
    for (let i = 0; i < 5; i++) await seedEnergyEvent(db, 20, 20, 'high');
    for (let i = 0; i < 5; i++) await seedEnergyEvent(db, 20, 50, 'low');

    const insights = await useCalibrationStore.getState().loadContextInsights();
    expect(insights).toHaveLength(1);
    expect(insights[0]?.key).toBe('energy');
    expect(insights[0]?.bestValue).toBe('high');
    expect(insights[0]?.worstValue).toBe('low');
  });

  it('context tags never train the model (logs count unchanged by setContext)', async () => {
    const db = freshStore();
    const before = useCalibrationStore.getState().logs;
    await seedEnergyEvent(db, 15, 30, 'low');
    // setContext writes a side-channel tag only; it must not bump the trained-log count.
    expect(useCalibrationStore.getState().logs).toBe(before);
  });
});
