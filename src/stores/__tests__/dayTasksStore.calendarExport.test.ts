// src/stores/__tests__/dayTasksStore.calendarExport.test.ts
//
// TDD tests for Phase 7 Task B2 — wiring calendar export into dayTasksStore.
//
// Tests:
//  1. syncExportForSelectedDay — export enabled + Pro → calls syncDayPlanToCalendar
//     with the day's timed tasks and persists returned links onto tasks.
//  2. syncExportForSelectedDay — export disabled → no-op (syncDayPlanToCalendar not called).
//  3. removeTask — task has a calendarEventId + export enabled → deleteWhenbeeEvent called.
//  4. removeTask — task has no calendarEventId → deleteWhenbeeEvent NOT called.
//  5. clearAllCalendarLinks — nulls calendarEventId on all linked tasks.
//
// All calendar and entitlement calls are mocked; no native modules load.

import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import { makeDayTasksStore } from '@/src/stores/dayTasksStore';
import type { Task } from '@/src/domain/types';

// ── Mock calendarExport service ───────────────────────────────────────────────
const mockSyncDayPlanToCalendar = jest.fn();
jest.mock('@/src/services/calendarExport', () => ({
  syncDayPlanToCalendar: (...args: unknown[]) => mockSyncDayPlanToCalendar(...args),
}));

// ── Mock calendar service (for deleteWhenbeeEvent in removeTask) ──────────────
const mockDeleteWhenbeeEvent = jest.fn();
jest.mock('@/src/services/calendar', () => ({
  getCalendar: () => ({
    deleteWhenbeeEvent: mockDeleteWhenbeeEvent,
  }),
}));

// ── Mock settingsStore ────────────────────────────────────────────────────────
let mockExportEnabled = false;
let mockWhenbeeCalendarId: string | null = null;

jest.mock('@/src/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      calendar: {
        exportEnabled: mockExportEnabled,
        whenbeeCalendarId: mockWhenbeeCalendarId,
      },
    }),
  },
}));

// ── Mock entitlement store ────────────────────────────────────────────────────
let mockIsPro = false;

jest.mock('@/src/features/paywall/useEntitlement', () => ({
  useEntitlement: {
    getState: () => ({ isPro: mockIsPro }),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime(); // 2026-06-24
const WHENBEE_CAL_ID = 'whenbee-cal-abc';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    label: 'Test task',
    category: 'deep-work',
    guessMin: 30,
    plannedDate: '2026-06-24',
    status: 'queued',
    orderIndex: NOW,
    doneByMin: null,
    createdAt: NOW,
    completedAt: null,
    actualMin: null,
    fromRoutineId: null,
    calendarEventId: null,
    ...overrides,
  };
}

function freshStore() {
  const db = createMemoryDatabase();
  const repo = makeTasksRepo(db);
  const flags = new Map<string, string>();
  const store = makeDayTasksStore({
    repo,
    kvGet: (k) => flags.get(k) ?? null,
    kvSet: (k, v) => { flags.set(k, v); },
  });
  return { store, repo, db };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExportEnabled = false;
  mockWhenbeeCalendarId = null;
  mockIsPro = false;
  // Default: syncDayPlanToCalendar returns empty result
  mockSyncDayPlanToCalendar.mockResolvedValue({
    created: 0,
    updated: 0,
    deleted: 0,
    links: [],
  });
});

// ── Test 1: syncExportForSelectedDay with export on + Pro syncs and persists links ──

test('B2: syncExportForSelectedDay with export on + Pro calls syncDayPlanToCalendar and persists links', async () => {
  mockExportEnabled = true;
  mockIsPro = true;
  mockWhenbeeCalendarId = WHENBEE_CAL_ID;

  const { store, repo } = freshStore();
  await store.getState().init(NOW);

  // Add a task for today
  const t = makeTask({ id: 'task-1', label: 'Deep focus' });
  await repo.add(t);
  await store.getState().reload(NOW);

  // Mock sync returns a link for task-1
  const returnedEventId = 'whenbee-event-99';
  mockSyncDayPlanToCalendar.mockResolvedValue({
    created: 1,
    updated: 0,
    deleted: 0,
    links: [{ taskId: 'task-1', eventId: returnedEventId }],
  });

  // Build timed tasks (simulate what the plan engine produces)
  const plannedTasks = [
    {
      id: 'task-1',
      label: 'Deep focus',
      startMs: NOW + 60_000,
      endMs: NOW + 90 * 60_000,
      calendarEventId: null,
    },
  ];

  await store.getState().syncExportForSelectedDay(plannedTasks, NOW);

  // syncDayPlanToCalendar must have been called with the right args
  expect(mockSyncDayPlanToCalendar).toHaveBeenCalledTimes(1);
  const callArg = mockSyncDayPlanToCalendar.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(callArg).toBeDefined();
  expect(callArg['date']).toBe('2026-06-24');
  expect(callArg['calendarId']).toBe(WHENBEE_CAL_ID);
  expect(callArg['plannedTasks']).toEqual(plannedTasks);

  // The returned link must be persisted on the task
  const updated = await repo.get('task-1');
  expect(updated?.calendarEventId).toBe(returnedEventId);
});

// ── Test 2: syncExportForSelectedDay is a no-op when export is disabled ──────

test('B2: syncExportForSelectedDay is a no-op when exportEnabled is false', async () => {
  mockExportEnabled = false;
  mockIsPro = true;
  mockWhenbeeCalendarId = WHENBEE_CAL_ID;

  const { store, repo } = freshStore();
  await store.getState().init(NOW);

  const t = makeTask({ id: 'task-2', label: 'Admin' });
  await repo.add(t);
  await store.getState().reload(NOW);

  const plannedTasks = [
    { id: 'task-2', label: 'Admin', startMs: NOW, endMs: NOW + 30 * 60_000, calendarEventId: null },
  ];

  await store.getState().syncExportForSelectedDay(plannedTasks, NOW);

  expect(mockSyncDayPlanToCalendar).not.toHaveBeenCalled();
});

// ── Test 3: syncExportForSelectedDay is a no-op when not Pro ─────────────────

test('B2: syncExportForSelectedDay is a no-op when not Pro', async () => {
  mockExportEnabled = true;
  mockIsPro = false;
  mockWhenbeeCalendarId = WHENBEE_CAL_ID;

  const { store, repo } = freshStore();
  await store.getState().init(NOW);

  const t = makeTask({ id: 'task-3', label: 'Design' });
  await repo.add(t);
  await store.getState().reload(NOW);

  const plannedTasks = [
    { id: 'task-3', label: 'Design', startMs: NOW, endMs: NOW + 30 * 60_000, calendarEventId: null },
  ];

  await store.getState().syncExportForSelectedDay(plannedTasks, NOW);

  expect(mockSyncDayPlanToCalendar).not.toHaveBeenCalled();
});

// ── Test 4: syncExportForSelectedDay is a no-op when whenbeeCalendarId is null ─

test('B2: syncExportForSelectedDay is a no-op when whenbeeCalendarId is null', async () => {
  mockExportEnabled = true;
  mockIsPro = true;
  mockWhenbeeCalendarId = null;

  const { store, repo } = freshStore();
  await store.getState().init(NOW);

  const t = makeTask({ id: 'task-4', label: 'Review' });
  await repo.add(t);
  await store.getState().reload(NOW);

  const plannedTasks = [
    { id: 'task-4', label: 'Review', startMs: NOW, endMs: NOW + 30 * 60_000, calendarEventId: null },
  ];

  await store.getState().syncExportForSelectedDay(plannedTasks, NOW);

  expect(mockSyncDayPlanToCalendar).not.toHaveBeenCalled();
});

// ── Test 5: removeTask with a linked task + export on deletes the calendar event ─

test('B2: removeTask with calendarEventId + export on → deleteWhenbeeEvent called', async () => {
  mockExportEnabled = true;
  mockIsPro = true;
  mockWhenbeeCalendarId = WHENBEE_CAL_ID;

  const { store, repo } = freshStore();
  await store.getState().init(NOW);

  const linkedTask = makeTask({ id: 'task-linked', calendarEventId: 'whenbee-event-linked-42' });
  await repo.add(linkedTask);
  await store.getState().reload(NOW);

  await store.getState().removeTask('task-linked', NOW);

  expect(mockDeleteWhenbeeEvent).toHaveBeenCalledTimes(1);
  expect(mockDeleteWhenbeeEvent).toHaveBeenCalledWith('whenbee-event-linked-42');
});

// ── Test 6: removeTask with no calendarEventId → deleteWhenbeeEvent NOT called ─

test('B2: removeTask without calendarEventId → deleteWhenbeeEvent not called', async () => {
  mockExportEnabled = true;
  mockIsPro = true;
  mockWhenbeeCalendarId = WHENBEE_CAL_ID;

  const { store, repo } = freshStore();
  await store.getState().init(NOW);

  const unlinkedTask = makeTask({ id: 'task-unlinked', calendarEventId: null });
  await repo.add(unlinkedTask);
  await store.getState().reload(NOW);

  await store.getState().removeTask('task-unlinked', NOW);

  expect(mockDeleteWhenbeeEvent).not.toHaveBeenCalled();
});

// ── Test 7: removeTask with export disabled → deleteWhenbeeEvent NOT called ───

test('B2: removeTask with export disabled → deleteWhenbeeEvent not called even with linked task', async () => {
  mockExportEnabled = false;
  mockWhenbeeCalendarId = WHENBEE_CAL_ID;

  const { store, repo } = freshStore();
  await store.getState().init(NOW);

  const linkedTask = makeTask({ id: 'task-export-off', calendarEventId: 'whenbee-event-off-42' });
  await repo.add(linkedTask);
  await store.getState().reload(NOW);

  await store.getState().removeTask('task-export-off', NOW);

  expect(mockDeleteWhenbeeEvent).not.toHaveBeenCalled();
});

// ── Test 8: clearAllCalendarLinks nulls calendarEventId on all linked tasks ───

test('B2: clearAllCalendarLinks sets calendarEventId=null on all tasks that have one', async () => {
  const { store, repo } = freshStore();
  await store.getState().init(NOW);

  const linked1 = makeTask({ id: 'linked-a', calendarEventId: 'evt-a' });
  const linked2 = makeTask({ id: 'linked-b', calendarEventId: 'evt-b' });
  const unlinked = makeTask({ id: 'unlinked-c', calendarEventId: null });
  await repo.add(linked1);
  await repo.add(linked2);
  await repo.add(unlinked);

  await store.getState().clearAllCalendarLinks();

  const a = await repo.get('linked-a');
  const b = await repo.get('linked-b');
  const c = await repo.get('unlinked-c');
  expect(a?.calendarEventId).toBeNull();
  expect(b?.calendarEventId).toBeNull();
  // unlinked stays null (no change, but still correct)
  expect(c?.calendarEventId).toBeNull();
});

// ── Test 9: syncExportForSelectedDay passes prior links from already-exported tasks ─

test('B2: syncExportForSelectedDay includes existing calendarEventId as priorLinks', async () => {
  mockExportEnabled = true;
  mockIsPro = true;
  mockWhenbeeCalendarId = WHENBEE_CAL_ID;

  const { store, repo } = freshStore();
  await store.getState().init(NOW);

  // Task that was previously exported (has a calendarEventId)
  const prevExported = makeTask({
    id: 'task-prev',
    label: 'Prev exported',
    calendarEventId: 'whenbee-event-prev',
  });
  await repo.add(prevExported);
  await store.getState().reload(NOW);

  mockSyncDayPlanToCalendar.mockResolvedValue({
    created: 0,
    updated: 1,
    deleted: 0,
    links: [{ taskId: 'task-prev', eventId: 'whenbee-event-prev' }],
  });

  const plannedTasks = [
    {
      id: 'task-prev',
      label: 'Prev exported',
      startMs: NOW + 60_000,
      endMs: NOW + 90 * 60_000,
      calendarEventId: 'whenbee-event-prev',
    },
  ];

  await store.getState().syncExportForSelectedDay(plannedTasks, NOW);

  const callArg = mockSyncDayPlanToCalendar.mock.calls[0]?.[0] as Record<string, unknown>;
  // The priorLinks must contain the task's existing event link
  const priorLinks = callArg['priorLinks'] as { taskId: string; eventId: string }[];
  expect(priorLinks).toContainEqual({ taskId: 'task-prev', eventId: 'whenbee-event-prev' });
});
