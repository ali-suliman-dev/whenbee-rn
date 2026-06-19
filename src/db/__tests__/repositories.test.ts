import { createMemoryDatabase } from '../memoryDatabase';
import { makeCategoryStatsRepo } from '../repositories/categoryStatsRepo';
import { makeTaskEventsRepo } from '../repositories/taskEventsRepo';
import { makeRecurringRepo } from '../repositories/recurringRepo';
import type { CategoryStatRow, TaskEventRow } from '../types';

describe('categoryStatsRepo', () => {
  it('seeds a cold-start row (n=0, prior mEffective) and never returns null', async () => {
    const db = createMemoryDatabase();
    const repo = makeCategoryStatsRepo(db);
    const row = await repo.get('cleaning');
    expect(row).not.toBeNull();
    expect(row.categoryId).toBe('cleaning');
    expect(row.n).toBe(0);
    expect(row.mEffective).toBe(2.0); // cleaning prior
    expect(row.priorMult).toBe(2.0);
    expect(row.sharpness).toBe(0);
    expect(row.logEwma).toBe(0);
    expect(row.adaptSpeed).toBe('balanced');
    expect(row.updatedAt).toBe(0);
  });

  it('returns the upserted row after upsert (with real affine sums)', async () => {
    const db = createMemoryDatabase();
    const repo = makeCategoryStatsRepo(db);
    // Use a row with real affine sums so withAffineSeed does not trigger.
    // (Legacy rows with n>0 and sw===0 get lazily seeded; this row has sw>0.)
    const row: CategoryStatRow = {
      categoryId: 'cleaning',
      n: 5,
      logEwma: 0.6,
      mEffective: 1.8,
      sharpness: 70,
      priorMult: 2.0,
      adaptSpeed: 'reactive',
      updatedAt: 5000,
      reclaimedMinutes: 0,
      sw: 3,
      swx: 45,
      swy: 81,
      swxx: 675,
      swxy: 1215,
    };
    await repo.upsert(row);
    expect(await repo.get('cleaning')).toEqual(row);
  });

  it('seeds the global prior for unknown categories', async () => {
    const db = createMemoryDatabase();
    const repo = makeCategoryStatsRepo(db);
    const row = await repo.get('made-up-category');
    expect(row.n).toBe(0);
    expect(row.mEffective).toBe(row.priorMult);
    expect(row.mEffective).toBeGreaterThan(0);
  });

  it('reads exactly one row on get (O(1) shape)', async () => {
    const db = createMemoryDatabase();
    const spy = jest.spyOn(db, 'getCategoryStat');
    const repo = makeCategoryStatsRepo(db);
    await repo.get('cleaning');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('writes exactly one row on upsert (O(1) shape)', async () => {
    const db = createMemoryDatabase();
    const spy = jest.spyOn(db, 'upsertCategoryStat');
    const repo = makeCategoryStatsRepo(db);
    await repo.upsert({
      categoryId: 'cleaning',
      n: 1,
      logEwma: 0,
      mEffective: 2,
      sharpness: 0,
      priorMult: 2,
      adaptSpeed: 'balanced',
      updatedAt: 1,
      reclaimedMinutes: 0,
      sw: 0,
      swx: 0,
      swy: 0,
      swxx: 0,
      swxy: 0,
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('taskEventsRepo', () => {
  function ev(overrides: Partial<TaskEventRow> = {}): TaskEventRow {
    return {
      id: 'x',
      category: 'cleaning',
      label: null,
      estimateMin: 15,
      actualMin: 30,
      status: 'completed',
      source: 'timed',
      startedAt: null,
      endedAt: null,
      createdAt: 1,
      suggestedHonestMin: null,
      reclaimDividendMin: 0,
      ...overrides,
    };
  }

  it('insert → listByCategory round-trips', async () => {
    const db = createMemoryDatabase();
    const repo = makeTaskEventsRepo(db);
    const a = ev({ id: 'a', createdAt: 1 });
    const b = ev({ id: 'b', createdAt: 2 });
    await repo.insert(a);
    await repo.insert(b);
    const rows = await repo.listByCategory('cleaning');
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('listByCategory defaults to a limit of 30', async () => {
    const db = createMemoryDatabase();
    const spy = jest.spyOn(db, 'listEventsByCategory');
    const repo = makeTaskEventsRepo(db);
    await repo.listByCategory('cleaning');
    expect(spy).toHaveBeenCalledWith('cleaning', 30);
  });

  it('listRecent defaults to a limit of 50', async () => {
    const db = createMemoryDatabase();
    const spy = jest.spyOn(db, 'listRecentEvents');
    const repo = makeTaskEventsRepo(db);
    await repo.listRecent();
    expect(spy).toHaveBeenCalledWith(50);
  });
});

describe('recurringRepo', () => {
  it('get returns null when absent and the row after upsert', async () => {
    const db = createMemoryDatabase();
    const repo = makeRecurringRepo(db);
    expect(await repo.get('cleaning:dishes')).toBeNull();
    const row = {
      key: 'cleaning:dishes',
      categoryId: 'cleaning',
      n: 1,
      logEwma: 0.1,
      mEffective: 1.9,
      updatedAt: 10,
    };
    await repo.upsert(row);
    expect(await repo.get('cleaning:dishes')).toEqual(row);
  });
});
