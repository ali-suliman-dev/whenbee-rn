import { useCalibrationStore } from '../calibrationStore';
import { createMemoryDatabase, type Database } from '@/src/db';

const T0 = 1_000_000_000_000;

function freshDb(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

/** Read mEffective through the store's real read API (loadCategoryDetail),
 *  not a tautological re-derivation of applyLog's own result. */
async function mEffectiveFor(category: string): Promise<number> {
  const detail = await useCalibrationStore.getState().loadCategoryDetail(category);
  return detail.mEffective;
}

describe('applyLog train-guard for forgotten stops', () => {
  it('a partial retro log leaves the multiplier unchanged (never trains)', async () => {
    freshDb();
    const apply = useCalibrationStore.getState().applyLog;

    // Seed one completed log first so the category has a real (non-cold) mEffective
    // to protect, then confirm a subsequent partial log doesn't move it.
    await apply({
      category: 'Workout',
      estimateMin: 30,
      actualMin: 30,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0,
    });
    const before = await mEffectiveFor('Workout');

    const res = await apply({
      category: 'Workout',
      estimateMin: 30,
      actualMin: 90, // huge overrun — but partial, so it must not count
      status: 'partial',
      source: 'retro',
      adaptSpeed: 'balanced',
      startedAt: null,
      nowMs: T0 + 1000,
    });

    expect(res.counted).toBe(false);
    const after = await mEffectiveFor('Workout');
    expect(after).toBeCloseTo(before, 6);
  });

  it('a completed retro log DOES move the multiplier (confirmed recovery)', async () => {
    freshDb();
    const apply = useCalibrationStore.getState().applyLog;
    const before = await mEffectiveFor('Reading');

    // A big honest overrun, confirmed by the user → should move the model
    // (at half alpha because source is retro).
    const res = await apply({
      category: 'Reading',
      estimateMin: 20,
      actualMin: 40,
      status: 'completed',
      source: 'retro',
      adaptSpeed: 'balanced',
      startedAt: null,
      nowMs: T0,
    });

    expect(res.counted).toBe(true);
    const after = await mEffectiveFor('Reading');
    expect(after).not.toBeCloseTo(before, 6);
  });
});
