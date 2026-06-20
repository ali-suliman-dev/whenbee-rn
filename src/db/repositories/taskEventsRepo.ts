// Thin semantic wrapper over the Database port for raw task-event logs.

import type { Database } from '../Database';
import type { TaskEventRow } from '../types';
import { rankFrequentTasks, type FrequentTask } from '../queries/frequentTasks';

export type { FrequentTask };

export interface TaskEventsRepo {
  insert(row: TaskEventRow): Promise<void>;
  listByCategory(categoryId: string, limit?: number): Promise<TaskEventRow[]>;
  listRecent(limit?: number): Promise<TaskEventRow[]>;
  deleteByCategory(categoryId: string): Promise<void>;
  listFrequentTasks(limit?: number): Promise<FrequentTask[]>;
}

export function makeTaskEventsRepo(db: Database): TaskEventsRepo {
  return {
    async insert(row: TaskEventRow): Promise<void> {
      await db.insertTaskEvent(row);
    },
    async listByCategory(categoryId: string, limit = 30): Promise<TaskEventRow[]> {
      return db.listEventsByCategory(categoryId, limit);
    },
    async listRecent(limit = 50): Promise<TaskEventRow[]> {
      return db.listRecentEvents(limit);
    },
    async deleteByCategory(categoryId: string): Promise<void> {
      await db.deleteEventsByCategory(categoryId);
    },
    async listFrequentTasks(limit = 4): Promise<FrequentTask[]> {
      const rows = await db.listRecentEvents(500);
      return rankFrequentTasks(rows, { now: Date.now(), limit });
    },
  };
}
