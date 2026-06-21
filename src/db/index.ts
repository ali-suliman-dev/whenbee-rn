// Public barrel for the data layer. Stores/services import from here.

export type { Database } from './Database';
export type { CategoryStatRow, ContextTagRow, DiscoveryRow, RecurringStatRow, RoutineRow, RoutineStepRow, TaskEventRow } from './types';
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
export { makeRoutinesRepo } from './repositories/routinesRepo';
export type { RoutinesRepo, RoutineWithSteps } from './repositories/routinesRepo';
export { makeCompanionRepo } from './repositories/companionRepo';
export { makeContextTagRepo } from './repositories/contextTagRepo';
export { makeDiscoveriesRepo } from './repositories/discoveriesRepo';
export type { DiscoveriesRepo } from './repositories/discoveriesRepo';
