import { useCalibrationStore } from '../calibrationStore';
import { createMemoryDatabase, makeCompanionRepo, makeCategoryStatsRepo, type Database } from '@/src/db';

/** Fresh memory db + reset store cache, wired through the same injection the store
 *  uses elsewhere (`setDatabase` / `resolveDb`). Returns the db for assertions. */
function freshStore(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

describe('applyLog — fuel Layer 1 (lifetime nectar)', () => {
  it('bumps lifetime nectar on every COUNTED log', async () => {
    const db = freshStore();
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 10,
      actualMin: 12,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: 1000,
    });
    expect((await makeCompanionRepo(db).get()).lifetimeDataPoints).toBe(1);
  });

  it('does NOT bump nectar for an uncounted (abandoned) log', async () => {
    const db = freshStore();
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 10,
      // abandoned never trains nor counts; actualMin value is irrelevant to the assertion.
      actualMin: 10,
      status: 'abandoned',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: 1000,
    });
    expect((await makeCompanionRepo(db).get()).lifetimeDataPoints).toBe(0);
  });
});

describe('applyLog — fuel Layer 2 (maxTier) is monotonic', () => {
  it('raises maxTier on a tier-up, never regresses', async () => {
    const db = freshStore();
    await makeCategoryStatsRepo(db).upsert({
      categoryId: 'cleaning',
      n: 8,
      logEwma: 0,
      mEffective: 1.0,
      sharpness: 90,
      priorMult: 2.0,
      adaptSpeed: 'balanced',
      updatedAt: 1,
      reclaimedMinutes: 0,
    });
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 10,
      actualMin: 10,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: 2000,
    });
    expect((await makeCompanionRepo(db).get()).maxTier).toBeGreaterThanOrEqual(3);
  });
});

describe('loadReclaimSummary — companion presence block', () => {
  it('populates the companion block from the fuel row (cold install → stage 1, settled)', async () => {
    freshStore();
    const summary = await useCalibrationStore.getState().loadReclaimSummary();
    expect(summary.companion.stage).toBe(1);
    expect(summary.companion.capability.tier).toBe('Raw');
    expect(summary.companion.keeper).toBe(false);
    expect(summary.companion.lifetimeNectar).toBe(0);
    expect(summary.companion.driftHealth).toBe('settled');
    expect(typeof summary.companion.seed).toBe('number');
  });

  it('reflects climbing presence after counted logs (stage advances, nectar banks)', async () => {
    const db = freshStore();
    await makeCategoryStatsRepo(db).upsert({
      categoryId: 'cleaning',
      n: 8,
      logEwma: 0,
      mEffective: 1.0,
      sharpness: 90,
      priorMult: 2.0,
      adaptSpeed: 'balanced',
      updatedAt: 1,
      reclaimedMinutes: 0,
    });
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 10,
      actualMin: 10,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: 2000,
    });
    const summary = await useCalibrationStore.getState().loadReclaimSummary();
    expect(summary.companion.stage).toBeGreaterThan(1);
    expect(summary.companion.lifetimeNectar).toBe(1);
    expect(summary.companion.capability.label.length).toBeGreaterThan(0);
  });
});

describe('applyLog — fuel Layer 3 is positive-only', () => {
  it('records a drift-health register on a counted log', async () => {
    const db = freshStore();
    await useCalibrationStore.getState().applyLog({
      category: 'cleaning',
      estimateMin: 10,
      actualMin: 11,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: 3000,
    });
    expect(['settled', 'curious']).toContain((await makeCompanionRepo(db).get()).driftHealth);
  });
});
