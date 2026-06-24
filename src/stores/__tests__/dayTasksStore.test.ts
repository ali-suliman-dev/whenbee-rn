// src/stores/__tests__/dayTasksStore.test.ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import { makeDayTasksStore } from '@/src/stores/dayTasksStore';

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime(); // 2026-06-24

function freshStore() {
  const repo = makeTasksRepo(createMemoryDatabase());
  const flags = new Map<string, string>();
  return makeDayTasksStore({
    repo,
    kvGet: (k) => flags.get(k) ?? null,
    kvSet: (k, v) => {
      flags.set(k, v);
    },
  });
}

test('init loads today and addTask defaults to selectedDate', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  expect(store.getState().selectedDate).toBe('2026-06-24');
  await store.getState().addTask({ label: 'Write', category: 'deep-work', guessMin: 60, nowMs: NOW });
  expect(store.getState().dayTasks.map((t) => t.label)).toEqual(['Write']);
});

test('addTask to a future date does not appear on today', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Later', category: 'admin', guessMin: 20, date: '2026-06-26', nowMs: NOW });
  expect(store.getState().dayTasks).toHaveLength(0);
  await store.getState().selectDate('2026-06-26');
  expect(store.getState().dayTasks.map((t) => t.label)).toEqual(['Later']);
});

test('carryover: a queued task from yesterday shows on today tagged', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Slipped', category: 'admin', guessMin: 15, date: '2026-06-23', nowMs: NOW });
  await store.getState().goToToday(NOW);
  const t = store.getState().dayTasks.find((x) => x.label === 'Slipped');
  expect(t?.carriedFrom).toBe('2026-06-23');
});

test('completeTask flips status and it leaves the queued list', async () => {
  const store = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'X', category: 'admin', guessMin: 10, nowMs: NOW });
  const id = store.getState().dayTasks[0]!.id;
  await store.getState().completeTask(id, { completedAt: NOW + 1000, actualMin: 12 });
  const done = store.getState().dayTasks.find((t) => t.id === id);
  expect(done?.status).toBe('done');
});
