// Database row DTOs (camelCase) — the boundary between the persistence layer
// and the rest of the app. SQL columns are snake_case and mapped in the
// sqlite adapter; everything above the port speaks these shapes.

import type { AdaptSpeed, LogSource, LogStatus } from '@/src/domain/types';

/** Denormalized per-category rolling stats row. */
export interface CategoryStatRow {
  categoryId: string;
  n: number;
  logEwma: number;
  mEffective: number;
  sharpness: number;
  priorMult: number;
  adaptSpeed: AdaptSpeed;
  updatedAt: number;
  reclaimedMinutes: number;
}

/** A single raw log row (system of record). */
export interface TaskEventRow {
  id: string;
  category: string;
  label: string | null;
  estimateMin: number;
  actualMin: number | null;
  status: LogStatus;
  source: LogSource;
  startedAt: number | null;
  endedAt: number | null;
  createdAt: number;
  suggestedHonestMin: number | null;
  reclaimDividendMin: number;
}

/** Per recurring-task rolling stats (keyed by `${categoryId}:${normalizedLabel}`). */
export interface RecurringStatRow {
  key: string;
  categoryId: string;
  n: number;
  logEwma: number;
  mEffective: number;
  updatedAt: number;
}

/** Single-row companion aggregate (the Reclaim bank). */
export interface CompanionRow {
  reclaimedMinutesLifetime: number;
  lifetimeDataPoints: number;
  maxTier: number;
  keeper: boolean;
  seed: number;
  driftHealth: 'settled' | 'curious';
  discoveryCount: number;
  name: string | null;
}

/** A banked aha — one append-only discovery card row. */
export interface DiscoveryRow {
  id: string;
  categoryId: string;
  multiplier: number;
  honestForFifteen: number;
  headline: string;
  discoveredAt: number;
}

/** A context tag attached to a task event (capture-only; never read by the model). */
export interface ContextTagRow {
  eventId: string;
  key: string;
  value: string;
  source: string;
  createdAt: number;
}

/** A reason tag joined to its task event (read-only; powers the Pro reason-correlation read). */
export interface ReasonEventRow {
  eventId: string;
  category: string;
  reason: string;
  estimateMin: number;
  actualMin: number | null;
  createdAt: number;
}

/** A context tag (e.g. energy) joined to its task event (read-only; powers the
 *  Pro S4 context-correlation read). `value` is the tag value for the queried key. */
export interface ContextEventRow {
  eventId: string;
  category: string;
  value: string;
  estimateMin: number;
  actualMin: number | null;
  createdAt: number;
}
