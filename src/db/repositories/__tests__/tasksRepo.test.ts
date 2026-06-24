// src/db/repositories/__tests__/tasksRepo.test.ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { makeTasksRepo } from '@/src/db/repositories/tasksRepo';
import type { Task } from '@/src/domain/types';

function task(over: Partial<Task>): Task {
  return {
    id: 't1', label: 'Write', category: 'deep-work', guessMin: 60,
    plannedDate: '2026-06-24', status: 'queued', orderIndex: 0, doneByMin: null,
    createdAt: 1000, completedAt: null, actualMin: null, fromRoutineId: null,
    calendarEventId: null, ...over,
  };
}

test('add + listByDate round-trips a domain Task', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(task({ id: 'a' }));
  const list = await repo.listByDate('2026-06-24');
  expect(list).toHaveLength(1);
  expect(list[0]?.label).toBe('Write');
});

test('move retargets plannedDate (and to shelf with null)', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(task({ id: 'a' }));
  await repo.move('a', '2026-06-26');
  expect(await repo.listByDate('2026-06-24')).toHaveLength(0);
  expect((await repo.listByDate('2026-06-26'))[0]?.id).toBe('a');
  await repo.move('a', null);
  expect(await repo.listShelf()).toHaveLength(1);
});

test('complete flips status + stamps completedAt/actualMin', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(task({ id: 'a' }));
  await repo.complete('a', { completedAt: 5000, actualMin: 75 });
  const got = await repo.get('a');
  expect(got?.status).toBe('done');
  expect(got?.completedAt).toBe(5000);
  expect(got?.actualMin).toBe(75);
});

test('listCarryover returns queued tasks on or before today', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.add(task({ id: 'old', plannedDate: '2026-06-22' }));
  await repo.add(task({ id: 'future', plannedDate: '2026-06-30' }));
  const list = await repo.listCarryover('2026-06-24');
  expect(list.map((t) => t.id)).toEqual(['old']);
});

test('listDoneForDay buckets by completedAt local day', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  const at = new Date(2026, 5, 24, 10, 0, 0).getTime();
  await repo.add(task({ id: 'a' }));
  await repo.complete('a', { completedAt: at });
  const list = await repo.listDoneForDay('2026-06-24');
  expect(list.map((t) => t.id)).toEqual(['a']);
});

test('setDoneBy + getDayMeta', async () => {
  const repo = makeTasksRepo(createMemoryDatabase());
  await repo.setDoneBy('2026-06-24', 1020);
  expect((await repo.getDayMeta('2026-06-24'))?.doneByMin).toBe(1020);
});
