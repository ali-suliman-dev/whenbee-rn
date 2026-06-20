// src/db/repositories/__tests__/taskEventsRepo.frequent.test.ts
import { createMemoryDatabase } from '@/src/db';
import { makeTaskEventsRepo } from '@/src/db/repositories/taskEventsRepo';

it('listFrequentTasks returns only >=3x completed tasks, capped', async () => {
  const db = createMemoryDatabase();
  const repo = makeTaskEventsRepo(db);
  for (let i = 0; i < 3; i++) {
    await db.insertTaskEvent({ id: `e${i}`, category: 'admin', label: 'Emails', estimateMin: 30,
      actualMin: 40, status: 'completed', source: 'timed', startedAt: 1, endedAt: 1 + i, createdAt: 1,
      suggestedHonestMin: 40, reclaimDividendMin: 0 });
  }
  const out = await repo.listFrequentTasks();
  expect(out.map((t) => t.label)).toEqual(['Emails']);
});
