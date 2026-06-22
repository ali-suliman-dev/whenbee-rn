import { createMemoryDatabase } from '@/src/db/memoryDatabase';

test('persists startLocalMinute on a task event round-trip', async () => {
  const db = createMemoryDatabase();
  await db.insertTaskEvent({
    id: 'e1', category: 'admin', label: null, estimateMin: 30, actualMin: 25,
    status: 'completed', source: 'timed', startedAt: 1, endedAt: 2, createdAt: 3,
    suggestedHonestMin: null, reclaimDividendMin: 0, startLocalMinute: 615, // 10:15
  });
  const rows = await db.listRecentEvents(10);
  expect(rows[0]!.startLocalMinute).toBe(615);
});
