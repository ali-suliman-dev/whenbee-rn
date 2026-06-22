import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import type { Database } from '@/src/db/Database';
import type { TaskEventRow } from '@/src/db/types';

function event(id: string, category: string, createdAt: number): TaskEventRow {
  return {
    id,
    category,
    label: null,
    estimateMin: 10,
    actualMin: 20,
    status: 'completed',
    source: 'timed',
    startedAt: null,
    endedAt: null,
    createdAt,
    suggestedHonestMin: null,
    reclaimDividendMin: 0,
    startLocalMinute: null,
  };
}

describe('listReasonEvents (memory adapter)', () => {
  let db: Database;
  beforeEach(() => {
    db = createMemoryDatabase();
  });

  it('joins reason tags to events, newest first, excludes non-reason keys', async () => {
    await db.insertTaskEvent(event('e1', 'cleaning', 100));
    await db.insertTaskEvent(event('e2', 'cooking', 200));
    await db.insertContextTag({ eventId: 'e1', key: 'reason', value: 'context_switch', source: 'manual', createdAt: 110 });
    await db.insertContextTag({ eventId: 'e2', key: 'reason', value: 'interrupted', source: 'manual', createdAt: 210 });
    await db.insertContextTag({ eventId: 'e2', key: 'note', value: 'ignored', source: 'manual', createdAt: 211 });
    const rows = await db.listReasonEvents(50);
    expect(rows.map((r) => r.eventId)).toEqual(['e2', 'e1']);
    expect(rows[0]?.reason).toBe('interrupted');
    expect(rows.some((r) => r.reason === 'ignored')).toBe(false);
  });

  it('drops orphan tags whose event was wiped', async () => {
    await db.insertTaskEvent(event('e1', 'cleaning', 100));
    await db.insertContextTag({ eventId: 'e1', key: 'reason', value: 'context_switch', source: 'manual', createdAt: 110 });
    await db.deleteEventsByCategory('cleaning');
    expect(await db.listReasonEvents(50)).toEqual([]);
  });

  it('honors the limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      await db.insertTaskEvent(event(`e${i}`, 'cleaning', i));
      await db.insertContextTag({ eventId: `e${i}`, key: 'reason', value: 'interrupted', source: 'manual', createdAt: i });
    }
    expect(await db.listReasonEvents(2)).toHaveLength(2);
  });
});
