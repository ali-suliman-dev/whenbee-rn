// src/db/__tests__/migrateLegacyTasks.test.ts
// I1: tests use a collected array via the `add` inserter, not a raw Database.
// I2: orderIndex is t.createdAt (epoch ms), not i++.
import { migrateLegacyTasks, type LegacyTodayTask } from '@/src/db/migrateLegacyTasks';
import type { Task } from '@/src/domain/types';

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime();

function legacy(over: Partial<LegacyTodayTask>): LegacyTodayTask {
  return { id: 'l1', label: 'Old', category: 'admin', guessMin: 20, createdAt: 1, status: 'queued', completedAt: null, actualMin: null, ...over };
}

test('imports legacy tasks onto today, preserving fields; orderIndex = createdAt', async () => {
  const collected: Task[] = [];
  const legacyList = [
    legacy({ id: 'a', createdAt: 100 }),
    legacy({ id: 'b', createdAt: 200, status: 'done', completedAt: 50, actualMin: 30 }),
  ];
  const res = await migrateLegacyTasks({
    add: async (t) => { collected.push(t); },
    legacy: legacyList,
    nowMs: NOW,
    alreadyMigrated: false,
  });
  expect(res.migrated).toBe(2);
  expect(collected.map((t) => t.id)).toEqual(['a', 'b']);
  const a = collected.find((t) => t.id === 'a')!;
  expect(a.plannedDate).toBe('2026-06-24');
  expect(a.orderIndex).toBe(100); // I2: createdAt, not 0
  const b = collected.find((t) => t.id === 'b')!;
  expect(b.status).toBe('done');
  expect(b.completedAt).toBe(50);
  expect(b.actualMin).toBe(30);
  expect(b.orderIndex).toBe(200); // I2: createdAt, not 1
});

test('is a no-op when already migrated', async () => {
  const collected: Task[] = [];
  const res = await migrateLegacyTasks({
    add: async (t) => { collected.push(t); },
    legacy: [legacy({})],
    nowMs: NOW,
    alreadyMigrated: true,
  });
  expect(res.migrated).toBe(0);
  expect(collected).toHaveLength(0);
});
