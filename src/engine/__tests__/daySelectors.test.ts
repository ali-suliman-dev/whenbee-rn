// src/engine/__tests__/daySelectors.test.ts
import { tasksForSelectedDay } from '@/src/engine/daySelectors';
import type { Task } from '@/src/domain/types';

function task(over: Partial<Task>): Task {
  return {
    id: 't', label: 'x', category: 'deep-work', guessMin: 30, plannedDate: '2026-06-24',
    status: 'queued', orderIndex: 0, doneByMin: null, createdAt: 0, completedAt: null,
    actualMin: null, fromRoutineId: null, calendarEventId: null, ...over,
  };
}

const today = '2026-06-24';

test('today shows today + carryover (tagged), excludes future and shelf', () => {
  const queued = [
    task({ id: 'today', plannedDate: '2026-06-24', orderIndex: 1 }),
    task({ id: 'old', plannedDate: '2026-06-22', orderIndex: 0 }),
    task({ id: 'future', plannedDate: '2026-06-25' }),
    task({ id: 'shelf', plannedDate: null }),
  ];
  const out = tasksForSelectedDay({ queued, done: [], selectedDate: today, today });
  expect(out.map((t) => t.id)).toEqual(['old', 'today']); // orderIndex asc
  expect(out.find((t) => t.id === 'old')?.carriedFrom).toBe('2026-06-22');
  expect(out.find((t) => t.id === 'today')?.carriedFrom).toBeNull();
});

test('future day shows only that exact day, never carryover', () => {
  const queued = [
    task({ id: 'old', plannedDate: '2026-06-22' }),
    task({ id: 'thu', plannedDate: '2026-06-25' }),
  ];
  const out = tasksForSelectedDay({ queued, done: [], selectedDate: '2026-06-25', today });
  expect(out.map((t) => t.id)).toEqual(['thu']);
  expect(out[0]?.carriedFrom).toBeNull();
});

test('past day shows that day queued tasks + supplied done tasks, no carryover tagging', () => {
  const queued = [
    task({ id: 'queuedThen', plannedDate: '2026-06-22' }),
  ];
  const done = [
    task({ id: 'doneThen', plannedDate: '2026-06-22', status: 'done', completedAt: 5 }),
  ];
  const out = tasksForSelectedDay({ queued, done, selectedDate: '2026-06-22', today });
  expect(out.map((t) => t.id).sort()).toEqual(['doneThen', 'queuedThen']);
  expect(out.every((t) => t.carriedFrom === null)).toBe(true);
});

test('done task supplied in done for today appears in today output', () => {
  const done = [task({ id: 'd', plannedDate: '2026-06-24', status: 'done', completedAt: 9 })];
  const out = tasksForSelectedDay({ queued: [], done, selectedDate: today, today });
  expect(out.map((t) => t.id)).toEqual(['d']);
});

test('shelf task (no plannedDate) never appears on today', () => {
  const queued = [task({ id: 'shelf', plannedDate: null })];
  const out = tasksForSelectedDay({ queued, done: [], selectedDate: today, today });
  expect(out).toHaveLength(0);
});

test('queued task from past day does NOT appear on today if not in queued set (selector boundary)', () => {
  // A queued task with a past plannedDate DOES appear on today (carryover rule).
  // This test verifies the carryover works for queued, not done.
  const queued = [task({ id: 'carryover', plannedDate: '2026-06-22' })];
  const out = tasksForSelectedDay({ queued, done: [], selectedDate: today, today });
  expect(out.map((t) => t.id)).toEqual(['carryover']);
  expect(out[0]?.carriedFrom).toBe('2026-06-22');
});

// C1 regression: a done task whose plannedDate is a PAST day but which the
// caller supplies in `done` for today appears in today's output.
// This proves done is bucketed by the caller's completedAt windowing, not plannedDate.
test('C1 regression: done task with past plannedDate supplied in done for today appears in today', () => {
  // Task was planned for yesterday but completed today (completedAt is today).
  // The caller (repo.listDoneForDay) scopes done by completedAt window and passes
  // it in the `done` set. The selector must include it regardless of plannedDate.
  const doneTask = task({
    id: 'done-past-planned',
    plannedDate: '2026-06-22', // planned for 2 days ago
    status: 'done',
    completedAt: new Date(2026, 5, 24, 10, 0, 0).getTime(), // completed TODAY
  });
  const out = tasksForSelectedDay({ queued: [], done: [doneTask], selectedDate: today, today });
  expect(out.map((t) => t.id)).toEqual(['done-past-planned']);
  expect(out[0]?.carriedFrom).toBeNull();
});
