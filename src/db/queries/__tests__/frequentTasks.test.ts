// src/db/queries/__tests__/frequentTasks.test.ts
import { rankFrequentTasks, type FrequentTask } from '@/src/db/queries/frequentTasks';
import type { TaskEventRow } from '@/src/db';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function ev(over: Partial<TaskEventRow>): TaskEventRow {
  return {
    id: `e-${Math.random()}`, category: 'admin', label: 'Emails',
    estimateMin: 30, actualMin: 45, status: 'completed', source: 'timed',
    startedAt: NOW - DAY, endedAt: NOW - DAY, createdAt: NOW - DAY,
    suggestedHonestMin: 45, reclaimDividendMin: 0, ...over,
  };
}

describe('rankFrequentTasks', () => {
  it('groups completed runs by (label, category) and counts them', () => {
    const out = rankFrequentTasks(
      [ev({}), ev({}), ev({}), ev({ label: 'Gym', category: 'health' })],
      { now: NOW },
    );
    const emails = out.find((t) => t.label === 'Emails');
    expect(emails?.count).toBe(3);
    expect(out.find((t) => t.label === 'Gym')).toBeUndefined(); // below minCount 3
  });

  it('ignores non-completed and empty-label events', () => {
    const out = rankFrequentTasks(
      [ev({}), ev({}), ev({}), ev({ status: 'abandoned' }), ev({ label: '  ' })],
      { now: NOW },
    );
    expect(out.find((t) => t.label === 'Emails')?.count).toBe(3);
  });

  it('ranks by frequency with a recency decay and tie-breaks by recency', () => {
    const stale = Array.from({ length: 6 }, () => ev({ label: 'Stale', endedAt: NOW - 60 * DAY }));
    const fresh = Array.from({ length: 4 }, () => ev({ label: 'Fresh', endedAt: NOW - 1 * DAY }));
    const out = rankFrequentTasks([...stale, ...fresh], { now: NOW, halfLifeDays: 14 });
    expect(out[0]?.label).toBe('Fresh'); // 4 recent outranks 6 stale after decay
  });

  it('caps at limit and carries lastGuessMin from the most recent run', () => {
    const rows = [
      ev({ estimateMin: 20, endedAt: NOW - 3 * DAY }),
      ev({ estimateMin: 25, endedAt: NOW - 1 * DAY }),
      ev({ estimateMin: 30, endedAt: NOW - 5 * DAY }),
    ];
    const out = rankFrequentTasks(rows, { now: NOW, limit: 4 });
    expect(out).toHaveLength(1);
    expect(out[0]?.lastGuessMin).toBe(25);
  });
});
