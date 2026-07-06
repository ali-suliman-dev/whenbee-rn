// src/stores/__tests__/dayTasksStore.startByCancel.test.ts
// Regression: removeTask must cancel any scheduled start-by reminder for the
// deleted task, otherwise the OS still fires a notification for a task that
// no longer exists (see routinesStore.removeRoutine's cancelRoutineAlerts).
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import { makeDayTasksStore } from '@/src/stores/dayTasksStore';
import { cancelStartBy } from '@/src/services/timerNotifications';

// jest.mock calls are hoisted above imports, so this still applies before
// dayTasksStore (and the timerNotifications module it imports) loads.
jest.mock('@/src/services/timerNotifications', () => ({
  cancelStartBy: jest.fn(() => Promise.resolve()),
  scheduleStartBy: jest.fn(() => Promise.resolve()),
}));

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime(); // 2026-06-24

function freshStore() {
  const repo = makeTasksRepo(createMemoryDatabase());
  const flags = new Map<string, string>();
  return {
    store: makeDayTasksStore({
      repo,
      kvGet: (k) => flags.get(k) ?? null,
      kvSet: (k, v) => {
        flags.set(k, v);
      },
    }),
  };
}

test('removeTask cancels the scheduled start-by reminder', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  const task = await store.getState().addTask({
    label: 'Write',
    category: 'deep-work',
    guessMin: 60,
    nowMs: NOW,
  });

  await store.getState().removeTask(task.id, NOW);

  expect(cancelStartBy).toHaveBeenCalledTimes(1);
});

test('removeTask still removes the task from dayTasks', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  const task = await store.getState().addTask({
    label: 'Write',
    category: 'deep-work',
    guessMin: 60,
    nowMs: NOW,
  });

  await store.getState().removeTask(task.id, NOW);

  expect(store.getState().dayTasks.find((t) => t.id === task.id)).toBeUndefined();
});

test('removeTask does NOT cancel the start-by reminder for a non-queued (completed) task', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  const task = await store.getState().addTask({
    label: 'Write',
    category: 'deep-work',
    guessMin: 60,
    nowMs: NOW,
  });

  await store.getState().completeTask(task.id, { completedAt: NOW, actualMin: 55, nowMs: NOW });

  // Isolate the assertion to removeTask's own effect, independent of
  // whatever completeTask itself may or may not call.
  (cancelStartBy as jest.Mock).mockClear();

  await store.getState().removeTask(task.id, NOW);

  expect(cancelStartBy).not.toHaveBeenCalled();
});
