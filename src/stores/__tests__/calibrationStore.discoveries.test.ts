import { useCalibrationStore } from '../calibrationStore';
import {
  createMemoryDatabase,
  makeCompanionRepo,
  makeDiscoveriesRepo,
  type Database,
} from '@/src/db';
import { kv } from '@/src/lib/kv';
import { analytics } from '@/src/services/analytics';

// Spy on the module-level analytics sink so discovery-event call sites can be
// asserted (and so the fire-and-forget try never reaches the real no-op sink).
jest.spyOn(analytics, 'capture').mockImplementation(() => {});
const captureMock = analytics.capture as jest.Mock;

const T0 = 1_000_000_000_000;

/** Fresh memory db + reset store cache, wired through the same injection the
 *  store uses elsewhere (`setDatabase` / `resolveDb`). Returns the db. */
function freshStore(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

/** Drop the per-category aha latch so each test starts clean (the kv mock keeps
 *  its Map across tests in a file). The aha latch only gates analytics, not the
 *  bank write, but clearing it keeps each test independent. */
function clearAhaFlags(categories: string[] = ['cleaning']): void {
  for (const c of categories) kv.delete(`whenbee.ahaFired.${c}`);
}

/** Drive a sequence of est=15 completed logs for one category. */
async function feed(actuals: number[], category = 'cleaning'): Promise<void> {
  const store = useCalibrationStore.getState();
  for (let i = 0; i < actuals.length; i++) {
    await store.applyLog({
      category,
      estimateMin: 15,
      actualMin: actuals[i]!,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
      nowMs: T0 + i,
    });
  }
}

// A scattered early window then a tight tail at 2.0× (30/15) makes detectInsight
// fire (n≥5, |M−1|≥0.4, variance shrinking). M settles ≈1.86 at the 8th log.
const STABILIZING_TO_2X = [90, 6, 75, 9, 30, 30, 30, 30];

describe('applyLog — banking distinct discoveries', () => {
  beforeEach(() => {
    captureMock.mockClear();
    clearAhaFlags();
  });

  it('banks exactly one discovery the first time an insight qualifies', async () => {
    const db = freshStore();
    await feed(STABILIZING_TO_2X);

    const discoveries = await makeDiscoveriesRepo(db).list();
    expect(discoveries).toHaveLength(1);
    expect(discoveries[0]?.categoryId).toBe('cleaning');
    expect((await makeCompanionRepo(db).get()).discoveryCount).toBe(1);
    expect(captureMock.mock.calls.filter((c) => c[0] === 'discovery_unlocked')).toHaveLength(1);
  });

  it('does NOT re-bank on further logs at the ~same multiplier (dedup)', async () => {
    const db = freshStore();
    // Reach the first bank, then two more 2.0× logs (M drifts <0.4 → dedup).
    await feed([...STABILIZING_TO_2X, 30, 30]);

    expect(await makeDiscoveriesRepo(db).list()).toHaveLength(1);
    expect((await makeCompanionRepo(db).get()).discoveryCount).toBe(1);
  });

  it('re-banks when the multiplier moves at least 0.4 (a new distinct truth)', async () => {
    const db = freshStore();
    // First bank ≈2.32×; a run of 6.0× (90/15) logs pulls M past 3.0 → second bank.
    await feed([...STABILIZING_TO_2X, 90, 90]);

    const discoveries = await makeDiscoveriesRepo(db).list();
    expect(discoveries).toHaveLength(2);
    expect((await makeCompanionRepo(db).get()).discoveryCount).toBe(2);
    // Distinct truths: the two banked multipliers differ by at least the gap.
    const ms = discoveries.map((d) => d.multiplier);
    expect(Math.abs((ms[0] ?? 0) - (ms[1] ?? 0))).toBeGreaterThanOrEqual(0.4);
  });

  it('loadDiscoveries returns the cards newest-first with the live count', async () => {
    freshStore();
    await feed([...STABILIZING_TO_2X, 90, 90]);

    const { discoveries, discoveryCount } = await useCalibrationStore.getState().loadDiscoveries();
    expect(discoveryCount).toBe(2);
    expect(discoveries).toHaveLength(2);
    // Newest-first: the later discovery (higher discoveredAt) leads.
    expect((discoveries[0]?.discoveredAt ?? 0)).toBeGreaterThan(discoveries[1]?.discoveredAt ?? 0);
  });

  it('exposes discoveryCount on the reclaim summary', async () => {
    freshStore();
    await feed(STABILIZING_TO_2X);

    const summary = await useCalibrationStore.getState().loadReclaimSummary();
    expect(summary.discoveryCount).toBe(1);
  });
});
