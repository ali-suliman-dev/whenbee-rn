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
  const tasks = [
    task({ id: 'today', plannedDate: '2026-06-24', orderIndex: 1 }),
    task({ id: 'old', plannedDate: '2026-06-22', orderIndex: 0 }),
    task({ id: 'future', plannedDate: '2026-06-25' }),
    task({ id: 'shelf', plannedDate: null }),
  ];
  const out = tasksForSelectedDay({ tasks, selectedDate: today, today });
  expect(out.map((t) => t.id)).toEqual(['old', 'today']); // orderIndex asc
  expect(out.find((t) => t.id === 'old')?.carriedFrom).toBe('2026-06-22');
  expect(out.find((t) => t.id === 'today')?.carriedFrom).toBeNull();
});

test('future day shows only that exact day, never carryover', () => {
  const tasks = [
    task({ id: 'old', plannedDate: '2026-06-22' }),
    task({ id: 'thu', plannedDate: '2026-06-25' }),
  ];
  const out = tasksForSelectedDay({ tasks, selectedDate: '2026-06-25', today });
  expect(out.map((t) => t.id)).toEqual(['thu']);
  expect(out[0]?.carriedFrom).toBeNull();
});

test('past day shows that day + its done tasks, no carryover tagging', () => {
  const tasks = [
    task({ id: 'doneThen', plannedDate: '2026-06-22', status: 'done', completedAt: 5 }),
    task({ id: 'queuedThen', plannedDate: '2026-06-22' }),
  ];
  const out = tasksForSelectedDay({ tasks, selectedDate: '2026-06-22', today });
  expect(out.map((t) => t.id).sort()).toEqual(['doneThen', 'queuedThen']);
  expect(out.every((t) => t.carriedFrom === null)).toBe(true);
});

test('done task on today shows in today (bucketed by plannedDate==today here)', () => {
  const tasks = [task({ id: 'd', plannedDate: '2026-06-24', status: 'done', completedAt: 9 })];
  const out = tasksForSelectedDay({ tasks, selectedDate: today, today });
  expect(out.map((t) => t.id)).toEqual(['d']);
});

test('shelf task (no plannedDate) never appears on today', () => {
  const tasks = [task({ id: 'shelf', plannedDate: null })];
  const out = tasksForSelectedDay({ tasks, selectedDate: today, today });
  expect(out).toHaveLength(0);
});

test('a DONE task carried from a past day does NOT appear on today', () => {
  const tasks = [task({ id: 'doneOld', plannedDate: '2026-06-22', status: 'done', completedAt: 5 })];
  const out = tasksForSelectedDay({ tasks, selectedDate: today, today });
  expect(out.map((t) => t.id)).toEqual([]);
});
