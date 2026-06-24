// src/db/migrateLegacyTasks.ts
// One-time import of the old kv 'today-tasks' list into the tasks table. The caller
// reads the kv list + the migrated flag, runs this, then sets the flag. Idempotent.

import type { Database } from './Database';
import type { TaskRow } from './types';
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
  db: Database;
  legacy: readonly LegacyTodayTask[];
  nowMs: number;
  alreadyMigrated: boolean;
}

export async function migrateLegacyTasks({ db, legacy, nowMs, alreadyMigrated }: MigrateInput): Promise<{ migrated: number }> {
  if (alreadyMigrated || legacy.length === 0) return { migrated: 0 };
  const today = toLocalDayKey(nowMs);
  let i = 0;
  for (const t of legacy) {
    const row: TaskRow = {
      id: t.id,
      label: t.label,
      category: t.category,
      guessMin: t.guessMin,
      plannedDate: today,
      status: t.status,
      orderIndex: i++,
      doneByMin: null,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      actualMin: t.actualMin,
      fromRoutineId: null,
      calendarEventId: null,
    };
    await db.insertTask(row);
  }
  return { migrated: legacy.length };
}
