// Pure ranker: given a flat list of TaskEventRows, returns the most-frequently-
// completed (label, category) pairs, weighted by recency decay.
// No side-effects, no Date.now() — callers inject `now`.

import type { TaskEventRow } from '@/src/db';

export interface FrequentTask {
  label: string;
  category: string;
  count: number;
  lastGuessMin: number;
  lastEndedAt: number;
}

const DAY_MS = 86_400_000;

export function rankFrequentTasks(
  events: TaskEventRow[],
  opts: { now: number; minCount?: number; limit?: number; halfLifeDays?: number },
): FrequentTask[] {
  const minCount = opts.minCount ?? 3;
  const limit = opts.limit ?? 4;
  const halfLifeDays = opts.halfLifeDays ?? 14;

  const groups = new Map<string, FrequentTask>();
  for (const e of events) {
    if (e.status !== 'completed') continue;
    const label = (e.label ?? '').trim();
    if (!label) continue;
    const endedAt = e.endedAt ?? e.createdAt;
    const key = `${e.category}\x00${label}`;
    const g = groups.get(key);
    if (g === undefined) {
      groups.set(key, { label, category: e.category, count: 1, lastGuessMin: e.estimateMin, lastEndedAt: endedAt });
    } else {
      g.count += 1;
      if (endedAt > g.lastEndedAt) {
        g.lastEndedAt = endedAt;
        g.lastGuessMin = e.estimateMin;
      }
    }
  }

  const score = (t: FrequentTask): number => {
    const ageDays = Math.max(0, (opts.now - t.lastEndedAt) / DAY_MS);
    return t.count * Math.pow(0.5, ageDays / halfLifeDays);
  };

  return [...groups.values()]
    .filter((t) => t.count >= minCount)
    .sort((a, b) => score(b) - score(a) || b.lastEndedAt - a.lastEndedAt)
    .slice(0, limit);
}
