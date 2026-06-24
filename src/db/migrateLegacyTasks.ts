// src/db/migrateLegacyTasks.ts
// One-time import of the old kv 'today-tasks' list into the tasks table. The caller
// passes an `add` inserter (repo.add or equivalent), the legacy task list, the
// migration guard flag, and `nowMs`. Idempotent — no-op when alreadyMigrated or empty.
//
// I1: accepts an `add` inserter rather than a raw Database so the store can pass its
//     repo directly without needing the underlying db object.
// I2: orderIndex = t.createdAt (same scheme as addTask in the store), not i++.

import type { Task } from '@/src/domain/types';
import { toLocalDayKey } from '@/src/lib/day';

export interface LegacyTodayTask {
  id: string;
  label: string;
  category: string;
  guessMin: number;
  createdAt: number;
  status: 'queued' | 'done';
  completedAt: number | null;
  actualMin: number | null;
}

export interface MigrateInput {
  /** Insert one Task into the backing store. Called once per legacy task. */
  add: (task: Task) => Promise<void>;
  legacy: readonly LegacyTodayTask[];
  nowMs: number;
  alreadyMigrated: boolean;
}

export async function migrateLegacyTasks({ add, legacy, nowMs, alreadyMigrated }: MigrateInput): Promise<{ migrated: number }> {
  if (alreadyMigrated || legacy.length === 0) return { migrated: 0 };
  const today = toLocalDayKey(nowMs);
  for (const t of legacy) {
    await add({
      id: t.id,
      label: t.label,
      category: t.category,
      guessMin: t.guessMin,
      plannedDate: today,
      status: t.status,
      orderIndex: t.createdAt, // I2: same scheme as addTask (epoch ms)
      doneByMin: null,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      actualMin: t.actualMin,
      fromRoutineId: null,
      calendarEventId: null,
    });
  }
  return { migrated: legacy.length };
}
