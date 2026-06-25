// src/db/repositories/__tests__/tasksRepo.dates.test.ts
// TDD: repo.dates() returns distinct planned dates of queued tasks.

import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import type { Task } from '@/src/domain/types';

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime();

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    label: 'Test',
    category: 'admin',
    guessMin: 10,
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

test('dates() returns empty array when no tasks', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  const dates = await repo.dates();
  expect(dates).toEqual([]);
});

test('dates() returns distinct planned dates sorted ascending', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(makeTask({ id: 't1', plannedDate: '2026-06-26' }));
  await repo.add(makeTask({ id: 't2', plannedDate: '2026-06-24' }));
  await repo.add(makeTask({ id: 't3', plannedDate: '2026-06-24' })); // duplicate date
  const dates = await repo.dates();
  expect(dates).toEqual(['2026-06-24', '2026-06-26']);
});

test('dates() excludes shelf tasks (plannedDate null)', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(makeTask({ id: 't1', plannedDate: null }));
  await repo.add(makeTask({ id: 't2', plannedDate: '2026-06-25' }));
  const dates = await repo.dates();
  expect(dates).toEqual(['2026-06-25']);
});

test('dates() excludes done tasks', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(makeTask({ id: 't1', plannedDate: '2026-06-24', status: 'done' }));
  await repo.add(makeTask({ id: 't2', plannedDate: '2026-06-25' }));
  const dates = await repo.dates();
  expect(dates).toEqual(['2026-06-25']);
});
