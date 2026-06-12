// The Database PORT. Repositories and stores depend on this interface, never on
// a concrete adapter. Two adapters implement it: an in-memory Map-backed one
// (tests + fallback) and the real expo-sqlite one (device runtime).

import type { CategoryStatRow, RecurringStatRow, TaskEventRow } from './types';

export interface Database {
  getCategoryStat(categoryId: string): Promise<CategoryStatRow | null>;
  upsertCategoryStat(row: CategoryStatRow): Promise<void>;

  insertTaskEvent(row: TaskEventRow): Promise<void>;
  /** Newest first. */
  listEventsByCategory(categoryId: string, limit: number): Promise<TaskEventRow[]>;
  /** Wipe every event for a category — the "reset this category's learning" path. */
  deleteEventsByCategory(categoryId: string): Promise<void>;
  /** Newest first, across all categories. */
  listRecentEvents(limit: number): Promise<TaskEventRow[]>;

  getRecurringStat(key: string): Promise<RecurringStatRow | null>;
  upsertRecurringStat(row: RecurringStatRow): Promise<void>;
}
