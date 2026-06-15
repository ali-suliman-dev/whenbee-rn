// The Database PORT. Repositories and stores depend on this interface, never on
// a concrete adapter. Two adapters implement it: an in-memory Map-backed one
// (tests + fallback) and the real expo-sqlite one (device runtime).

import type { CategoryStatRow, CompanionRow, ContextTagRow, DiscoveryRow, ReasonEventRow, RecurringStatRow, TaskEventRow } from './types';

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

  /** Append-only — banks one discovery card; rows are never updated or deleted. */
  insertDiscovery(row: DiscoveryRow): Promise<void>;
  /** Banked discoveries, newest first, capped at `limit`. */
  listDiscoveries(limit: number): Promise<DiscoveryRow[]>;
  /** The newest banked discovery for a category, or null if none. */
  getLastDiscoveryForCategory(categoryId: string): Promise<DiscoveryRow | null>;
  /** Monotonic increment — bumps companion.discoveryCount by one; never decrements. */
  incrementDiscoveryCount(): Promise<void>;
}
