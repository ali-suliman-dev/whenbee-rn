import { createMemoryDatabase } from '../memoryDatabase';
import type { CategoryStatRow, RecurringStatRow, TaskEventRow } from '../types';

function makeEvent(overrides: Partial<TaskEventRow> = {}): TaskEventRow {
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
    createdAt: 1000,
    suggestedHonestMin: null,
    reclaimDividendMin: 0,
    ...overrides,
  };
}

describe('memoryDatabase — task events', () => {
  it('inserts and reads back via listByCategory', async () => {
    const db = createMemoryDatabase();
    const ev = makeEvent({ id: 'a', category: 'cleaning', createdAt: 5 });
    await db.insertTaskEvent(ev);
    const rows = await db.listEventsByCategory('cleaning', 30);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(ev);
  });

  it('listEventsByCategory only returns matching category, newest first, respects limit', async () => {
    const db = createMemoryDatabase();
    await db.insertTaskEvent(makeEvent({ id: 'a', category: 'cleaning', createdAt: 1 }));
    await db.insertTaskEvent(makeEvent({ id: 'b', category: 'cleaning', createdAt: 3 }));
    await db.insertTaskEvent(makeEvent({ id: 'c', category: 'cleaning', createdAt: 2 }));
    await db.insertTaskEvent(makeEvent({ id: 'd', category: 'admin', createdAt: 99 }));

    const all = await db.listEventsByCategory('cleaning', 30);
    expect(all.map((r) => r.id)).toEqual(['b', 'c', 'a']);

    const limited = await db.listEventsByCategory('cleaning', 2);
    expect(limited.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('deleteEventsByCategory removes only the target category, leaving others intact', async () => {
    const db = createMemoryDatabase();
    await db.insertTaskEvent(makeEvent({ id: 'a', category: 'cleaning', createdAt: 1 }));
    await db.insertTaskEvent(makeEvent({ id: 'b', category: 'cleaning', createdAt: 2 }));
    await db.insertTaskEvent(makeEvent({ id: 'c', category: 'admin', createdAt: 3 }));

    await db.deleteEventsByCategory('cleaning');

    expect(await db.listEventsByCategory('cleaning', 30)).toHaveLength(0);
    const admin = await db.listEventsByCategory('admin', 30);
    expect(admin.map((r) => r.id)).toEqual(['c']);
  });

  it('deleteEventsByCategory on an empty/unknown category is a no-op', async () => {
    const db = createMemoryDatabase();
    await db.insertTaskEvent(makeEvent({ id: 'a', category: 'cleaning', createdAt: 1 }));
    await db.deleteEventsByCategory('errands');
    expect(await db.listEventsByCategory('cleaning', 30)).toHaveLength(1);
  });

  it('listRecentEvents returns all categories newest first, respects limit', async () => {
    const db = createMemoryDatabase();
    await db.insertTaskEvent(makeEvent({ id: 'a', category: 'cleaning', createdAt: 1 }));
    await db.insertTaskEvent(makeEvent({ id: 'b', category: 'admin', createdAt: 5 }));
    await db.insertTaskEvent(makeEvent({ id: 'c', category: 'email', createdAt: 3 }));

    const recent = await db.listRecentEvents(50);
    expect(recent.map((r) => r.id)).toEqual(['b', 'c', 'a']);

    const limited = await db.listRecentEvents(1);
    expect(limited.map((r) => r.id)).toEqual(['b']);
  });
});

describe('memoryDatabase — category stats', () => {
  it('round-trips a category stat and returns null when absent', async () => {
    const db = createMemoryDatabase();
    expect(await db.getCategoryStat('cleaning')).toBeNull();

    const row: CategoryStatRow = {
      categoryId: 'cleaning',
      n: 3,
      logEwma: 0.42,
      mEffective: 1.9,
      sharpness: 55,
      priorMult: 2.0,
      adaptSpeed: 'reactive',
      updatedAt: 12345,
      reclaimedMinutes: 0,
    };
    await db.upsertCategoryStat(row);
    expect(await db.getCategoryStat('cleaning')).toEqual(row);

    const updated: CategoryStatRow = { ...row, n: 4, logEwma: 0.5 };
    await db.upsertCategoryStat(updated);
    expect(await db.getCategoryStat('cleaning')).toEqual(updated);
  });
});

describe('memoryDatabase — recurring stats', () => {
  it('round-trips a recurring stat and returns null when absent', async () => {
    const db = createMemoryDatabase();
    expect(await db.getRecurringStat('cleaning:dishes')).toBeNull();

    const row: RecurringStatRow = {
      key: 'cleaning:dishes',
      categoryId: 'cleaning',
      n: 2,
      logEwma: 0.3,
      mEffective: 1.7,
      updatedAt: 999,
    };
    await db.upsertRecurringStat(row);
    expect(await db.getRecurringStat('cleaning:dishes')).toEqual(row);
  });
});
