// Thin semantic wrapper over the Database port for raw task-event logs.

import type { Database } from '../Database';
import type { TaskEventRow } from '../types';

export interface TaskEventsRepo {
  insert(row: TaskEventRow): Promise<void>;
  listByCategory(categoryId: string, limit?: number): Promise<TaskEventRow[]>;
  listRecent(limit?: number): Promise<TaskEventRow[]>;
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
  };
}
