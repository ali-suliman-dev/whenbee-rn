// Public barrel for the data layer. Stores/services import from here.

export type { Database } from './Database';
export type { CategoryStatRow, RecurringStatRow, TaskEventRow } from './types';
export { createMemoryDatabase } from './memoryDatabase';
export { createSqliteDatabase } from './sqliteDatabase';
export { getDatabase, runMigrations, __resetDatabaseForTests } from './client';
export { MIGRATIONS } from './migrations';
export { makeCategoryStatsRepo } from './repositories/categoryStatsRepo';
export type { CategoryStatsRepo } from './repositories/categoryStatsRepo';
export { makeTaskEventsRepo } from './repositories/taskEventsRepo';
export type { TaskEventsRepo } from './repositories/taskEventsRepo';
export { makeRecurringRepo } from './repositories/recurringRepo';
export type { RecurringRepo } from './repositories/recurringRepo';
