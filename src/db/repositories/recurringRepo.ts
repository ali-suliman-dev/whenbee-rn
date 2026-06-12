// Thin semantic wrapper over the Database port for recurring-task stats.

import type { Database } from '../Database';
import type { RecurringStatRow } from '../types';

export interface RecurringRepo {
  get(key: string): Promise<RecurringStatRow | null>;
  upsert(row: RecurringStatRow): Promise<void>;
}

export function makeRecurringRepo(db: Database): RecurringRepo {
  return {
    async get(key: string): Promise<RecurringStatRow | null> {
      return db.getRecurringStat(key);
    },
    async upsert(row: RecurringStatRow): Promise<void> {
      await db.upsertRecurringStat(row);
    },
  };
}
