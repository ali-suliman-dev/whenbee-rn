// src/db/__tests__/memoryDatabase.tasks.test.ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import type { TaskRow } from '@/src/db/types';

function row(over: Partial<TaskRow>): TaskRow {
  return {
    id: 't1', label: 'Write', category: 'deep-work', guessMin: 60,
    plannedDate: '2026-06-24', status: 'queued', orderIndex: 0, doneByMin: null,
    createdAt: 1000, completedAt: null, actualMin: null, fromRoutineId: null,
    calendarEventId: null, ...over,
  };
}

test('insert + listTasksByDate returns order_index ascending', async () => {
  const db = createMemoryDatabase();
  await db.insertTask(row({ id: 'b', orderIndex: 1 }));
  await db.insertTask(row({ id: 'a', orderIndex: 0 }));
  const list = await db.listTasksByDate('2026-06-24');
  expect(list.map((t) => t.id)).toEqual(['a', 'b']);
});

test('listQueuedOnOrBefore includes carryover, excludes future + done + shelf', async () => {
  const db = createMemoryDatabase();
  await db.insertTask(row({ id: 'yesterday', plannedDate: '2026-06-23' }));
  await db.insertTask(row({ id: 'today', plannedDate: '2026-06-24' }));
  await db.insertTask(row({ id: 'tomorrow', plannedDate: '2026-06-25' }));
  await db.insertTask(row({ id: 'doneOne', plannedDate: '2026-06-23', status: 'done', completedAt: 5 }));
  await db.insertTask(row({ id: 'shelf', plannedDate: null }));
  const list = await db.listQueuedOnOrBefore('2026-06-24');
  expect(list.map((t) => t.id).sort()).toEqual(['today', 'yesterday']);
});

test('updateTask patches only given fields', async () => {
  const db = createMemoryDatabase();
  await db.insertTask(row({ id: 't' }));
  await db.updateTask('t', { status: 'done', completedAt: 99, actualMin: 42 });
  const got = await db.getTask('t');
  expect(got?.status).toBe('done');
  expect(got?.completedAt).toBe(99);
  expect(got?.label).toBe('Write'); // untouched
});

test('listDoneCompletedBetween buckets by completedAt window', async () => {
  const db = createMemoryDatabase();
  await db.insertTask(row({ id: 'in', status: 'done', completedAt: 150 }));
  await db.insertTask(row({ id: 'before', status: 'done', completedAt: 50 }));
  await db.insertTask(row({ id: 'queued', status: 'queued', completedAt: null }));
  const list = await db.listDoneCompletedBetween(100, 200);
  expect(list.map((t) => t.id)).toEqual(['in']);
});

test('day meta upsert + get', async () => {
  const db = createMemoryDatabase();
  expect(await db.getDayMeta('2026-06-24')).toBeNull();
  await db.upsertDayMeta({ date: '2026-06-24', doneByMin: 1020, planComputedAt: null });
  expect((await db.getDayMeta('2026-06-24'))?.doneByMin).toBe(1020);
});

test('wipeAll clears tasks + day meta', async () => {
  const db = createMemoryDatabase();
  await db.insertTask(row({ id: 't' }));
  await db.upsertDayMeta({ date: '2026-06-24', doneByMin: 1, planComputedAt: null });
  await db.wipeAll();
  expect(await db.listTasksByDate('2026-06-24')).toEqual([]);
  expect(await db.getDayMeta('2026-06-24')).toBeNull();
});
