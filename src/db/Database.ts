// The Database PORT. Repositories and stores depend on this interface, never on
// a concrete adapter. Two adapters implement it: an in-memory Map-backed one
// (tests + fallback) and the real expo-sqlite one (device runtime).

import type { CategoryStatRow, CompanionRow, ContextEventRow, ContextTagRow, DayMetaRow, DiscoveryRow, ReasonEventRow, RecurringStatRow, RoutineRow, RoutineStepRow, TaskEventRow, TaskRow } from './types';

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

  // ── Routines (Pro) — saved sequences + their ordered steps ──────────────────
  /** All routines, newest-updated first. */
  listRoutines(): Promise<RoutineRow[]>;
  /** A single routine by id, or null if absent. */
  getRoutine(id: string): Promise<RoutineRow | null>;
  /** A routine's steps, ordered by position ascending. */
  listRoutineSteps(routineId: string): Promise<RoutineStepRow[]>;
  /** Insert or replace a routine plus its full ordered step set atomically — the
   *  steps are replaced wholesale (old rows for this routine are removed first). */
  saveRoutine(routine: RoutineRow, steps: RoutineStepRow[]): Promise<void>;
  /** Delete a routine and all of its step rows. */
  deleteRoutine(id: string): Promise<void>;
  /** Persist a routine's learned transition factor (clamped by the caller). */
  setRoutineTransitionFactor(id: string, factor: number, updatedAt: number): Promise<void>;
  /** Monotonic — bumps a routine's completed-full-run count by one. */
  incrementRoutineRunCount(id: string, updatedAt: number): Promise<void>;

  getCompanion(): Promise<CompanionRow>;
  /** Monotonic increment — adds deltaMin to reclaimedMinutesLifetime; never decrements. */
  addReclaim(deltaMin: number): Promise<void>;
  /** Layer 1 fuel — bumps lifetimeDataPoints by one; only ever goes up. */
  bumpLifetimeNectar(): Promise<void>;
  /** Layer 2 fuel — raises maxTier to max(prev, next); never lowers it. */
  raiseMaxTier(next: number): Promise<void>;
  /** Layer 3 fuel — latches keeper to true; never clears it. */
  setKeeper(): Promise<void>;
  /** Stores the positive-only drift register (never a guilt signal). */
  setDriftHealth(value: 'settled' | 'curious'): Promise<void>;
  /** Sets the procedural appearance seed once; ignored if a seed is already set. */
  setSeed(seed: number): Promise<void>;
  /** Sets the optional companion display name; empty/blank clears it back to unnamed. */
  setCompanionName(name: string | null): Promise<void>;
  /** Monotonic increment — adds deltaMin to category_stats.reclaimedMinutes for the given category. */
  addCategoryReclaim(categoryId: string, deltaMin: number): Promise<void>;
  /** Capture-only; never read by the calibration model. */
  insertContextTag(row: ContextTagRow): Promise<void>;
  /** Read a single capture-only tag (e.g. for the future "what steals time" read).
   *  NEVER consulted on the calibration path. */
  getContextTag(eventId: string, key: string): Promise<ContextTagRow | null>;
  /** All reason tags joined to their events, newest first, capped at `limit`.
   *  READ-ONLY: powers the Pro reason-correlation read; never the model. */
  listReasonEvents(limit: number): Promise<ReasonEventRow[]>;
  /** Context tags of one `key` (e.g. 'energy') joined to their events, newest
   *  first, capped at `limit`. READ-ONLY: powers the Pro S4 read; never the model. */
  listContextEvents(key: string, limit: number): Promise<ContextEventRow[]>;

  /** Append-only — banks one discovery card; rows are never updated or deleted. */
  insertDiscovery(row: DiscoveryRow): Promise<void>;
  /** Banked discoveries, newest first, capped at `limit`. */
  listDiscoveries(limit: number): Promise<DiscoveryRow[]>;
  /** The newest banked discovery for a category, or null if none. */
  getLastDiscoveryForCategory(categoryId: string): Promise<DiscoveryRow | null>;
  /** Monotonic increment — bumps companion.discoveryCount by one; never decrements. */
  incrementDiscoveryCount(): Promise<void>;

  /** Factory reset: clears every table and returns the companion singleton to its
   *  default row (seed 0 so the next hydrate re-seeds a fresh appearance, name null). */
  wipeAll(): Promise<void>;

  // ── Day-planned tasks + day meta (planning expansion) ───────────────────────
  insertTask(row: TaskRow): Promise<void>;
  /** Partial update by id; only provided fields change. */
  updateTask(id: string, patch: Partial<TaskRow>): Promise<void>;
  deleteTask(id: string): Promise<void>;
  getTask(id: string): Promise<TaskRow | null>;
  /** Queued tasks planned for a day, order_index ascending. */
  listTasksByDate(date: string): Promise<TaskRow[]>;
  /** Queued tasks whose plannedDate <= date (the carryover query), order_index asc. */
  listQueuedOnOrBefore(date: string): Promise<TaskRow[]>;
  /** Done tasks whose completedAt is in [startMs, endMs). For a day's recap bucket. */
  listDoneCompletedBetween(startMs: number, endMs: number): Promise<TaskRow[]>;
  /** Queued tasks with no plannedDate (the "No day yet" shelf). */
  listShelfTasks(): Promise<TaskRow[]>;
  getDayMeta(date: string): Promise<DayMetaRow | null>;
  upsertDayMeta(row: DayMetaRow): Promise<void>;
  /** Distinct plannedDates of all queued (non-shelf) tasks. Used for calendar dot hints. */
  listDatesWithTasks(): Promise<string[]>;
  /** All tasks that currently have a non-null calendarEventId. Used to bulk-clear
   *  export links when the user disables the calendar export feature. */
  listTasksWithCalendarEventId(): Promise<TaskRow[]>;
}
