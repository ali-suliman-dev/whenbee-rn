// src/stores/__tests__/dayTasksStore.datesWithTasks.test.ts
// TDD: datesWithTasks reflects the set of planned dates with queued tasks.

import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import { makeDayTasksStore } from '@/src/stores/dayTasksStore';

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime();

function freshStore() {
  const repo = makeTasksRepo(createMemoryDatabase());
  const flags = new Map<string, string>();
  return makeDayTasksStore({
    repo,
    kvGet: (k) => flags.get(k) ?? null,
    kvSet: (k, v) => { flags.set(k, v); },
  });
}

test('datesWithTasks is empty after init with no tasks', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  expect(store.getState().datesWithTasks).toEqual([]);
});

test('datesWithTasks includes the planned date after addTask', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({
    label: 'Write report',
    category: 'deep-work',
    guessMin: 60,
    date: '2026-06-26',
    nowMs: NOW,
  });
  expect(store.getState().datesWithTasks).toContain('2026-06-26');
});

test('datesWithTasks has today after adding a task to today', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({
    label: 'Quick admin',
    category: 'admin',
    guessMin: 15,
    nowMs: NOW,
  });
  expect(store.getState().datesWithTasks).toContain('2026-06-24');
});

test('datesWithTasks has multiple distinct dates', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'A', category: 'admin', guessMin: 10, date: '2026-06-24', nowMs: NOW });
  await store.getState().addTask({ label: 'B', category: 'admin', guessMin: 10, date: '2026-06-25', nowMs: NOW });
  await store.getState().addTask({ label: 'C', category: 'admin', guessMin: 10, date: '2026-06-24', nowMs: NOW }); // dup date
  const dates = store.getState().datesWithTasks;
  expect(dates).toContain('2026-06-24');
  expect(dates).toContain('2026-06-25');
  // No duplicate entries
  expect(dates.filter((d) => d === '2026-06-24')).toHaveLength(1);
});

test('datesWithTasks updates after removeTask', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'X', category: 'admin', guessMin: 10, date: '2026-06-28', nowMs: NOW });
  expect(store.getState().datesWithTasks).toContain('2026-06-28');
  const id = store.getState().dayTasks.find((t) => t.label === 'X')?.id
    ?? (await store.getState().selectDate('2026-06-28'), store.getState().dayTasks[0]?.id);
  if (id !== undefined) {
    await store.getState().removeTask(id, NOW);
  }
  // After remove (and possible selectDate shift), re-check via reload
  await store.getState().reload(NOW);
  // The date should no longer be in datesWithTasks if the only queued task was removed
  // (Note: after selectDate it may still be '2026-06-28' — just verify dot list no longer contains it)
  expect(store.getState().datesWithTasks).not.toContain('2026-06-28');
});
