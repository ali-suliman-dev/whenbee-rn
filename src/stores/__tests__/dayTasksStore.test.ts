// src/stores/__tests__/dayTasksStore.test.ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import { makeDayTasksStore } from '@/src/stores/dayTasksStore';

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime(); // 2026-06-24

function freshStore(initialKv: Record<string, string> = {}) {
  const repo = makeTasksRepo(createMemoryDatabase());
  const flags = new Map<string, string>(Object.entries(initialKv));
  return {
    store: makeDayTasksStore({
      repo,
      kvGet: (k) => flags.get(k) ?? null,
      kvSet: (k, v) => {
        flags.set(k, v);
      },
    }),
    repo,
    flags,
  };
}

test('init loads today and addTask defaults to selectedDate', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  expect(store.getState().selectedDate).toBe('2026-06-24');
  await store.getState().addTask({ label: 'Write', category: 'deep-work', guessMin: 60, nowMs: NOW });
  expect(store.getState().dayTasks.map((t) => t.label)).toEqual(['Write']);
});

test('addTask to a future date does not appear on today', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Later', category: 'admin', guessMin: 20, date: '2026-06-26', nowMs: NOW });
  expect(store.getState().dayTasks).toHaveLength(0);
  await store.getState().selectDate('2026-06-26');
  expect(store.getState().dayTasks.map((t) => t.label)).toEqual(['Later']);
});

test('carryover: a queued task from yesterday shows on today tagged', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Slipped', category: 'admin', guessMin: 15, date: '2026-06-23', nowMs: NOW });
  await store.getState().goToToday(NOW);
  const t = store.getState().dayTasks.find((x) => x.label === 'Slipped');
  expect(t?.carriedFrom).toBe('2026-06-23');
});

test('completeTask flips status and it leaves the queued list', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'X', category: 'admin', guessMin: 10, nowMs: NOW });
  const id = store.getState().dayTasks[0]!.id;
  await store.getState().completeTask(id, { completedAt: NOW + 1000, actualMin: 12 });
  const done = store.getState().dayTasks.find((t) => t.id === id);
  expect(done?.status).toBe('done');
});

// C1 regression: task with plannedDate yesterday, completed today → appears on today,
// does NOT appear when selecting yesterday as a queued task.
test('C1 regression: task planned yesterday, completed today → in today, not on yesterday as queued', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  // Add a task planned for yesterday
  await store.getState().addTask({ label: 'YesterdayTask', category: 'admin', guessMin: 15, date: '2026-06-23', nowMs: NOW });
  const id = store.getState().dayTasks.find((t) => t.label === 'YesterdayTask')!.id;
  // Complete it with completedAt = today
  await store.getState().completeTask(id, { completedAt: NOW + 500 });
  // Go to today: should see it as done (completedAt window puts it in today)
  await store.getState().goToToday(NOW);
  const onToday = store.getState().dayTasks.find((t) => t.id === id);
  expect(onToday?.status).toBe('done');
  // Select yesterday: should NOT show it as queued (it's done, no longer in queued set)
  await store.getState().selectDate('2026-06-23');
  const onYesterday = store.getState().dayTasks.find((t) => t.id === id);
  // It may appear in yesterday's done set (completedAt is today, so NOT in yesterday's window)
  expect(onYesterday).toBeUndefined();
});

test('addTask returns the created task', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  const task = await store.getState().addTask({ label: 'Write', category: 'deep-work', guessMin: 60, nowMs: NOW });
  expect(task.id).toBeTruthy();
  expect(task.label).toBe('Write');
  expect(task.plannedDate).toBe('2026-06-24');
});

test('selectFocusTask returns the first queued task', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'First', category: 'admin', guessMin: 10, nowMs: NOW });
  await store.getState().addTask({ label: 'Second', category: 'admin', guessMin: 10, nowMs: NOW + 1 });
  expect(store.getState().selectFocusTask()?.label).toBe('First');
});

test('reload re-reads the current day', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'X', category: 'admin', guessMin: 10, nowMs: NOW });
  const id = store.getState().dayTasks[0]!.id;
  await store.getState().completeTask(id, { completedAt: NOW + 5, actualMin: 11, nowMs: NOW });
  await store.getState().reload(NOW);
  expect(store.getState().selectFocusTask()).toBeNull(); // the only task is done
});

test('goToToday after a day boundary moves the selected day to the new today', async () => {
  const { store } = freshStore();
  const day1 = new Date(2026, 5, 24, 23, 0, 0).getTime();
  const day2 = new Date(2026, 5, 25, 8, 0, 0).getTime();
  await store.getState().init(day1);
  expect(store.getState().selectedDate).toBe('2026-06-24');
  await store.getState().goToToday(day2);
  expect(store.getState().selectedDate).toBe('2026-06-25');
});

test('promoteToFocus makes the target task the selectFocusTask', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'First', category: 'admin', guessMin: 10, nowMs: NOW });
  await store.getState().addTask({ label: 'Second', category: 'admin', guessMin: 10, nowMs: NOW + 1 });
  // Second is currently not focus (First is)
  const secondId = store.getState().dayTasks.find((t) => t.label === 'Second')!.id;
  await store.getState().promoteToFocus(secondId, NOW + 2);
  expect(store.getState().selectFocusTask()?.label).toBe('Second');
});

test('moveToTomorrow: task leaves today and appears when selecting tomorrow', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Move me', category: 'admin', guessMin: 30, nowMs: NOW });
  const id = store.getState().dayTasks[0]!.id;

  // Move it to tomorrow — today's list should be empty afterward.
  await (store.getState() as any).moveToTomorrow(id, NOW);
  expect(store.getState().dayTasks.map((t) => t.label)).not.toContain('Move me');

  // Selecting tomorrow should surface it.
  await store.getState().selectDate('2026-06-25');
  expect(store.getState().dayTasks.map((t) => t.label)).toContain('Move me');
});

// I1 regression: seeding a legacy kv blob triggers import via migrateLegacyTasks.
test('I1 regression: legacy today-tasks kv blob seeds tasks onto today on init', async () => {
  const legacyBlob = JSON.stringify({
    state: {
      tasks: [
        { id: 'leg1', label: 'OldTask', category: 'admin', guessMin: 20, createdAt: 100, status: 'queued', completedAt: null, actualMin: null },
      ],
    },
  });
  const { store } = freshStore({ 'today-tasks': legacyBlob });
  await store.getState().init(NOW);
  const tasks = store.getState().dayTasks;
  expect(tasks.map((t) => t.id)).toContain('leg1');
  expect(tasks.find((t) => t.id === 'leg1')?.label).toBe('OldTask');
  // I2: orderIndex should equal createdAt (100), not positional index (0)
  expect(tasks.find((t) => t.id === 'leg1')?.orderIndex).toBe(100);
});

// ── E2: shelf (no-day tasks) ─────────────────────────────────────────────────

test('loadShelf populates shelfTasks after adding a task with date: null', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Someday task', category: 'admin', guessMin: 20, date: null, nowMs: NOW });
  await store.getState().loadShelf();
  expect(store.getState().shelfTasks.map((t) => t.label)).toContain('Someday task');
});

test('shelfTasks is empty when no unscheduled tasks exist', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Has a date', category: 'admin', guessMin: 10, nowMs: NOW });
  await store.getState().loadShelf();
  expect(store.getState().shelfTasks).toHaveLength(0);
});

test('FIX2: addTask with date:null auto-refreshes shelfTasks immediately (no extra loadShelf call)', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Shelf auto', category: 'admin', guessMin: 15, date: null, nowMs: NOW });
  // shelfTasks should be populated WITHOUT a manual loadShelf call
  expect(store.getState().shelfTasks.map((t) => t.label)).toContain('Shelf auto');
});

test('FIX2: removeTask auto-refreshes shelfTasks', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'To remove', category: 'admin', guessMin: 15, date: null, nowMs: NOW });
  const id = store.getState().shelfTasks[0]!.id;
  await store.getState().removeTask(id, NOW);
  // shelfTasks should be empty immediately
  expect(store.getState().shelfTasks).toHaveLength(0);
});

test('FIX2: moveTask auto-refreshes shelfTasks', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'To move', category: 'admin', guessMin: 15, date: null, nowMs: NOW });
  const id = store.getState().shelfTasks[0]!.id;
  await store.getState().moveTask(id, '2026-06-25', NOW);
  // shelfTasks should be empty immediately (task now has a date)
  expect(store.getState().shelfTasks).toHaveLength(0);
});

test('moving a shelf task to a day removes it from shelfTasks on reload', async () => {
  const { store } = freshStore();
  await store.getState().init(NOW);
  await store.getState().addTask({ label: 'Floating', category: 'admin', guessMin: 15, date: null, nowMs: NOW });
  await store.getState().loadShelf();
  const id = store.getState().shelfTasks[0]!.id;
  await store.getState().moveTask(id, '2026-06-25', NOW);
  await store.getState().loadShelf();
  expect(store.getState().shelfTasks).toHaveLength(0);
});

// FIX3: init() seeds shelfTasks — a consumer reading shelfTasks before Today mounts sees data.
test('FIX3: init seeds shelfTasks from pre-existing unscheduled tasks', async () => {
  const { store, repo } = freshStore();
  // Seed a shelf task directly into the repo before init is called.
  const preexisting = {
    id: 'shelf-pre-1',
    label: 'Pre-seeded shelf task',
    category: 'admin',
    guessMin: 25,
    plannedDate: null,
    status: 'queued' as const,
    orderIndex: NOW - 1000,
    doneByMin: null,
    createdAt: NOW - 1000,
    completedAt: null,
    actualMin: null,
    fromRoutineId: null,
    calendarEventId: null,
  };
  await repo.add(preexisting);

  // init() should populate shelfTasks without a manual loadShelf() call.
  await store.getState().init(NOW);
  const shelf = store.getState().shelfTasks;
  expect(shelf.map((t) => t.id)).toContain('shelf-pre-1');
  expect(shelf.find((t) => t.id === 'shelf-pre-1')?.label).toBe('Pre-seeded shelf task');
});
