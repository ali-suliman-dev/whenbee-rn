// src/db/__tests__/migrateLegacyTasks.test.ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { migrateLegacyTasks, type LegacyTodayTask } from '@/src/db/migrateLegacyTasks';

const NOW = new Date(2026, 5, 24, 9, 0, 0).getTime();

function legacy(over: Partial<LegacyTodayTask>): LegacyTodayTask {
  return { id: 'l1', label: 'Old', category: 'admin', guessMin: 20, createdAt: 1, status: 'queued', completedAt: null, actualMin: null, ...over };
}

test('imports legacy tasks onto today, preserving fields + order', async () => {
  const db = createMemoryDatabase();
  const legacyList = [legacy({ id: 'a' }), legacy({ id: 'b', status: 'done', completedAt: 50, actualMin: 30 })];
  const res = await migrateLegacyTasks({ db, legacy: legacyList, nowMs: NOW, alreadyMigrated: false });
  expect(res.migrated).toBe(2);
  const onToday = await db.listTasksByDate('2026-06-24');
  expect(onToday.map((t) => t.id)).toEqual(['a']); // queued shows by date
  const a = await db.getTask('a');
  expect(a?.plannedDate).toBe('2026-06-24');
  expect(a?.orderIndex).toBe(0);
  const b = await db.getTask('b');
  expect(b?.status).toBe('done');
  expect(b?.completedAt).toBe(50);
  expect(b?.actualMin).toBe(30);
});

test('is a no-op when already migrated', async () => {
  const db = createMemoryDatabase();
  const res = await migrateLegacyTasks({ db, legacy: [legacy({})], nowMs: NOW, alreadyMigrated: true });
  expect(res.migrated).toBe(0);
  expect(await db.getTask('l1')).toBeNull();
});
