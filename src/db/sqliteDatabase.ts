// Real expo-sqlite Database adapter. Opens the DB, runs migrations, then maps
// each port method onto parameterized SQL. snake_case columns are mapped to/from
// camelCase DTOs here so nothing above the port sees SQL shapes.
//
// Testability note: this module imports the native `expo-sqlite`, which is NOT
// mocked in jest. It is therefore NEVER imported by the test suite — all data-
// layer tests run against `createMemoryDatabase()`. The row-mapping helpers are
// pure and could be unit-tested in isolation if ever needed.

import * as SQLite from 'expo-sqlite';
import { runMigrations } from './client';
import type { Database } from './Database';
import type { AdaptSpeed, LogSource, LogStatus } from '@/src/domain/types';
import type { CategoryStatRow, CompanionRow, ContextEventRow, ContextTagRow, DiscoveryRow, ReasonEventRow, RecurringStatRow, RoutineRow, RoutineStepRow, TaskEventRow } from './types';

interface TaskEventDbRow {
  id: string;
  category: string;
  label: string | null;
  estimate_min: number;
  actual_min: number | null;
  status: string;
  source: string;
  started_at: number | null;
  ended_at: number | null;
  created_at: number;
  suggested_honest_min: number | null;
  reclaim_dividend_min: number;
}

interface CategoryStatDbRow {
  category_id: string;
  ewma_logr: number;
  n: number;
  m_effective: number;
  sharpness: number;
  prior_mult: number;
  adapt_speed: string;
  updated_at: number;
  reclaimed_minutes: number;
  first_honest_low: number | null;
  first_honest_high: number | null;
  sw: number;
  swx: number;
  swy: number;
  swxx: number;
  swxy: number;
}

interface CompanionDbRow {
  reclaimed_minutes_lifetime: number;
  lifetime_data_points: number;
  max_tier: number;
  keeper: number;
  seed: number;
  drift_health: string;
  discovery_count: number;
  name: string | null;
}

interface DiscoveryDbRow {
  id: string;
  category_id: string;
  multiplier: number;
  honest_for_fifteen: number;
  headline: string;
  discovered_at: number;
}

interface RecurringStatDbRow {
  key: string;
  category_id: string;
  ewma_logr: number;
  n: number;
  m_effective: number;
  updated_at: number;
}

function mapTaskEvent(r: TaskEventDbRow): TaskEventRow {
  return {
    id: r.id,
    category: r.category,
    label: r.label,
    estimateMin: r.estimate_min,
    actualMin: r.actual_min,
    status: r.status as LogStatus,
    source: r.source as LogSource,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    createdAt: r.created_at,
    suggestedHonestMin: r.suggested_honest_min,
    reclaimDividendMin: r.reclaim_dividend_min,
  };
}

function mapCategoryStat(r: CategoryStatDbRow): CategoryStatRow {
  return {
    categoryId: r.category_id,
    n: r.n,
    logEwma: r.ewma_logr,
    mEffective: r.m_effective,
    sharpness: r.sharpness,
    priorMult: r.prior_mult,
    adaptSpeed: r.adapt_speed as AdaptSpeed,
    updatedAt: r.updated_at,
    reclaimedMinutes: r.reclaimed_minutes,
    firstHonestRange:
      r.first_honest_low !== null && r.first_honest_high !== null
        ? { lowMinutes: r.first_honest_low, highMinutes: r.first_honest_high }
        : null,
    sw: r.sw,
    swx: r.swx,
    swy: r.swy,
    swxx: r.swxx,
    swxy: r.swxy,
  };
}

function mapDiscovery(r: DiscoveryDbRow): DiscoveryRow {
  return {
    id: r.id,
    categoryId: r.category_id,
    multiplier: r.multiplier,
    honestForFifteen: r.honest_for_fifteen,
    headline: r.headline,
    discoveredAt: r.discovered_at,
  };
}

function mapRecurringStat(r: RecurringStatDbRow): RecurringStatRow {
  return {
    key: r.key,
    categoryId: r.category_id,
    n: r.n,
    logEwma: r.ewma_logr,
    mEffective: r.m_effective,
    updatedAt: r.updated_at,
  };
}

interface RoutineDbRow {
  id: string;
  name: string;
  done_by_minute_of_day: number | null;
  transition_factor: number;
  run_count: number;
  created_at: number;
  updated_at: number;
}

interface RoutineStepDbRow {
  id: string;
  routine_id: string;
  position: number;
  label: string;
  category: string;
  guess_min: number;
}

function mapRoutine(r: RoutineDbRow): RoutineRow {
  return {
    id: r.id,
    name: r.name,
    doneByMinuteOfDay: r.done_by_minute_of_day,
    transitionFactor: r.transition_factor,
    runCount: r.run_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapRoutineStep(r: RoutineStepDbRow): RoutineStepRow {
  return {
    id: r.id,
    routineId: r.routine_id,
    position: r.position,
    label: r.label,
    category: r.category,
    guessMin: r.guess_min,
  };
}

export async function createSqliteDatabase(name = 'whenbee.db'): Promise<Database> {
  const db = await SQLite.openDatabaseAsync(name);
  await runMigrations(db);

  return {
    async getCategoryStat(categoryId: string): Promise<CategoryStatRow | null> {
      const row = await db.getFirstAsync<CategoryStatDbRow>(
        'SELECT * FROM category_stats WHERE category_id = ?',
        categoryId
      );
      return row ? mapCategoryStat(row) : null;
    },

    async upsertCategoryStat(row: CategoryStatRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO category_stats
           (category_id, ewma_logr, n, m_effective, sharpness, prior_mult, adapt_speed, updated_at, reclaimed_minutes, first_honest_low, first_honest_high, sw, swx, swy, swxx, swxy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(category_id) DO UPDATE SET
           ewma_logr = excluded.ewma_logr,
           n = excluded.n,
           m_effective = excluded.m_effective,
           sharpness = excluded.sharpness,
           prior_mult = excluded.prior_mult,
           adapt_speed = excluded.adapt_speed,
           updated_at = excluded.updated_at,
           reclaimed_minutes = excluded.reclaimed_minutes,
           first_honest_low = excluded.first_honest_low,
           first_honest_high = excluded.first_honest_high,
           sw = excluded.sw,
           swx = excluded.swx,
           swy = excluded.swy,
           swxx = excluded.swxx,
           swxy = excluded.swxy`,
        row.categoryId,
        row.logEwma,
        row.n,
        row.mEffective,
        row.sharpness,
        row.priorMult,
        row.adaptSpeed,
        row.updatedAt,
        row.reclaimedMinutes,
        row.firstHonestRange?.lowMinutes ?? null,
        row.firstHonestRange?.highMinutes ?? null,
        row.sw,
        row.swx,
        row.swy,
        row.swxx,
        row.swxy
      );
    },

    async insertTaskEvent(row: TaskEventRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO task_events
           (id, category, label, estimate_min, actual_min, status, source,
            started_at, ended_at, created_at, suggested_honest_min, reclaim_dividend_min)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.category,
        row.label,
        row.estimateMin,
        row.actualMin,
        row.status,
        row.source,
        row.startedAt,
        row.endedAt,
        row.createdAt,
        row.suggestedHonestMin,
        row.reclaimDividendMin
      );
    },

    async listEventsByCategory(categoryId: string, limit: number): Promise<TaskEventRow[]> {
      const rows = await db.getAllAsync<TaskEventDbRow>(
        'SELECT * FROM task_events WHERE category = ? ORDER BY created_at DESC LIMIT ?',
        categoryId,
        limit
      );
      return rows.map(mapTaskEvent);
    },

    async deleteEventsByCategory(categoryId: string): Promise<void> {
      await db.runAsync('DELETE FROM task_events WHERE category = ?', categoryId);
    },

    async listRecentEvents(limit: number): Promise<TaskEventRow[]> {
      const rows = await db.getAllAsync<TaskEventDbRow>(
        'SELECT * FROM task_events ORDER BY created_at DESC LIMIT ?',
        limit
      );
      return rows.map(mapTaskEvent);
    },

    async getRecurringStat(key: string): Promise<RecurringStatRow | null> {
      const row = await db.getFirstAsync<RecurringStatDbRow>(
        'SELECT * FROM recurring_stats WHERE key = ?',
        key
      );
      return row ? mapRecurringStat(row) : null;
    },

    async upsertRecurringStat(row: RecurringStatRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO recurring_stats
           (key, category_id, ewma_logr, n, m_effective, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           category_id = excluded.category_id,
           ewma_logr = excluded.ewma_logr,
           n = excluded.n,
           m_effective = excluded.m_effective,
           updated_at = excluded.updated_at`,
        row.key,
        row.categoryId,
        row.logEwma,
        row.n,
        row.mEffective,
        row.updatedAt
      );
    },

    async listRoutines(): Promise<RoutineRow[]> {
      const rows = await db.getAllAsync<RoutineDbRow>(
        'SELECT * FROM routines ORDER BY updated_at DESC'
      );
      return rows.map(mapRoutine);
    },

    async getRoutine(id: string): Promise<RoutineRow | null> {
      const row = await db.getFirstAsync<RoutineDbRow>(
        'SELECT * FROM routines WHERE id = ?',
        id
      );
      return row ? mapRoutine(row) : null;
    },

    async listRoutineSteps(routineId: string): Promise<RoutineStepRow[]> {
      const rows = await db.getAllAsync<RoutineStepDbRow>(
        'SELECT * FROM routine_steps WHERE routine_id = ? ORDER BY position ASC',
        routineId
      );
      return rows.map(mapRoutineStep);
    },

    async saveRoutine(routine: RoutineRow, steps: RoutineStepRow[]): Promise<void> {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO routines
             (id, name, done_by_minute_of_day, transition_factor, run_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             done_by_minute_of_day = excluded.done_by_minute_of_day,
             transition_factor = excluded.transition_factor,
             run_count = excluded.run_count,
             updated_at = excluded.updated_at`,
          routine.id,
          routine.name,
          routine.doneByMinuteOfDay,
          routine.transitionFactor,
          routine.runCount,
          routine.createdAt,
          routine.updatedAt
        );
        // Replace this routine's steps wholesale so edits/reorders are atomic.
        await db.runAsync('DELETE FROM routine_steps WHERE routine_id = ?', routine.id);
        for (const step of steps) {
          await db.runAsync(
            `INSERT INTO routine_steps (id, routine_id, position, label, category, guess_min)
             VALUES (?, ?, ?, ?, ?, ?)`,
            step.id,
            step.routineId,
            step.position,
            step.label,
            step.category,
            step.guessMin
          );
        }
      });
    },

    async deleteRoutine(id: string): Promise<void> {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM routine_steps WHERE routine_id = ?', id);
        await db.runAsync('DELETE FROM routines WHERE id = ?', id);
      });
    },

    async setRoutineTransitionFactor(id: string, factor: number, updatedAt: number): Promise<void> {
      await db.runAsync(
        'UPDATE routines SET transition_factor = ?, updated_at = ? WHERE id = ?',
        factor,
        updatedAt,
        id
      );
    },

    async incrementRoutineRunCount(id: string, updatedAt: number): Promise<void> {
      await db.runAsync(
        'UPDATE routines SET run_count = run_count + 1, updated_at = ? WHERE id = ?',
        updatedAt,
        id
      );
    },

    async getCompanion(): Promise<CompanionRow> {
      const row = await db.getFirstAsync<CompanionDbRow>(
        `SELECT reclaimed_minutes_lifetime, lifetime_data_points, max_tier, keeper, seed, drift_health, discovery_count, name
         FROM companion WHERE id = 1`
      );
      return {
        reclaimedMinutesLifetime: row?.reclaimed_minutes_lifetime ?? 0,
        lifetimeDataPoints: row?.lifetime_data_points ?? 0,
        maxTier: row?.max_tier ?? 0,
        keeper: row?.keeper === 1,
        seed: row?.seed ?? 0,
        driftHealth: row?.drift_health === 'curious' ? 'curious' : 'settled',
        discoveryCount: row?.discovery_count ?? 0,
        name: row?.name ?? null,
      };
    },

    async addReclaim(deltaMin: number): Promise<void> {
      await db.runAsync(
        'UPDATE companion SET reclaimed_minutes_lifetime = reclaimed_minutes_lifetime + ? WHERE id = 1',
        deltaMin
      );
    },

    async bumpLifetimeNectar(): Promise<void> {
      await db.runAsync(
        'UPDATE companion SET lifetime_data_points = lifetime_data_points + 1 WHERE id = 1'
      );
    },

    async raiseMaxTier(next: number): Promise<void> {
      await db.runAsync(
        'UPDATE companion SET max_tier = MAX(max_tier, ?) WHERE id = 1',
        Math.trunc(next)
      );
    },

    async setKeeper(): Promise<void> {
      await db.runAsync('UPDATE companion SET keeper = 1 WHERE id = 1');
    },

    async setDriftHealth(value: 'settled' | 'curious'): Promise<void> {
      await db.runAsync('UPDATE companion SET drift_health = ? WHERE id = 1', value);
    },

    async setCompanionName(name: string | null): Promise<void> {
      const trimmed = name?.trim();
      await db.runAsync('UPDATE companion SET name = ? WHERE id = 1', trimmed ? trimmed : null);
    },

    async setSeed(seed: number): Promise<void> {
      await db.runAsync(
        'UPDATE companion SET seed = ? WHERE id = 1 AND seed = 0',
        Math.trunc(seed)
      );
    },

    async addCategoryReclaim(categoryId: string, deltaMin: number): Promise<void> {
      await db.runAsync(
        'UPDATE category_stats SET reclaimed_minutes = reclaimed_minutes + ? WHERE category_id = ?',
        deltaMin,
        categoryId
      );
    },

    async insertContextTag(row: ContextTagRow): Promise<void> {
      await db.runAsync(
        `INSERT OR REPLACE INTO log_tags (event_id, key, value, source, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        row.eventId,
        row.key,
        row.value,
        row.source,
        row.createdAt
      );
    },
    async getContextTag(eventId: string, key: string): Promise<ContextTagRow | null> {
      const row = await db.getFirstAsync<{
        event_id: string;
        key: string;
        value: string;
        source: string;
        created_at: number;
      }>(
        `SELECT event_id, key, value, source, created_at FROM log_tags
         WHERE event_id = ? AND key = ?`,
        eventId,
        key
      );
      if (!row) return null;
      return {
        eventId: row.event_id,
        key: row.key,
        value: row.value,
        source: row.source,
        createdAt: row.created_at,
      };
    },
    async listReasonEvents(limit: number): Promise<ReasonEventRow[]> {
      const rows = await db.getAllAsync<{
        event_id: string;
        category: string;
        reason: string;
        estimate_min: number;
        actual_min: number | null;
        created_at: number;
      }>(
        `SELECT t.event_id AS event_id, e.category AS category, t.value AS reason,
                e.estimate_min AS estimate_min, e.actual_min AS actual_min, e.created_at AS created_at
         FROM log_tags t
         JOIN task_events e ON e.id = t.event_id
         WHERE t.key = 'reason'
         ORDER BY e.created_at DESC
         LIMIT ?`,
        limit
      );
      return rows.map((r) => ({
        eventId: r.event_id,
        category: r.category,
        reason: r.reason,
        estimateMin: r.estimate_min,
        actualMin: r.actual_min,
        createdAt: r.created_at,
      }));
    },

    async listContextEvents(key: string, limit: number): Promise<ContextEventRow[]> {
      const rows = await db.getAllAsync<{
        event_id: string;
        category: string;
        value: string;
        estimate_min: number;
        actual_min: number | null;
        created_at: number;
      }>(
        `SELECT t.event_id AS event_id, e.category AS category, t.value AS value,
                e.estimate_min AS estimate_min, e.actual_min AS actual_min, e.created_at AS created_at
         FROM log_tags t
         JOIN task_events e ON e.id = t.event_id
         WHERE t.key = ?
         ORDER BY e.created_at DESC
         LIMIT ?`,
        key,
        limit
      );
      return rows.map((r) => ({
        eventId: r.event_id,
        category: r.category,
        value: r.value,
        estimateMin: r.estimate_min,
        actualMin: r.actual_min,
        createdAt: r.created_at,
      }));
    },

    async insertDiscovery(row: DiscoveryRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO discoveries
           (id, category_id, multiplier, honest_for_fifteen, headline, discovered_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        row.id,
        row.categoryId,
        row.multiplier,
        row.honestForFifteen,
        row.headline,
        row.discoveredAt
      );
    },
    async listDiscoveries(limit: number): Promise<DiscoveryRow[]> {
      const rows = await db.getAllAsync<DiscoveryDbRow>(
        'SELECT * FROM discoveries ORDER BY discovered_at DESC LIMIT ?',
        limit
      );
      return rows.map(mapDiscovery);
    },
    async getLastDiscoveryForCategory(categoryId: string): Promise<DiscoveryRow | null> {
      const row = await db.getFirstAsync<DiscoveryDbRow>(
        'SELECT * FROM discoveries WHERE category_id = ? ORDER BY discovered_at DESC LIMIT 1',
        categoryId
      );
      return row ? mapDiscovery(row) : null;
    },
    async incrementDiscoveryCount(): Promise<void> {
      await db.runAsync(
        'UPDATE companion SET discovery_count = discovery_count + 1 WHERE id = 1'
      );
    },

    async wipeAll(): Promise<void> {
      await db.withTransactionAsync(async () => {
        await db.execAsync(
          `DELETE FROM task_events;
           DELETE FROM category_stats;
           DELETE FROM recurring_stats;
           DELETE FROM log_tags;
           DELETE FROM discoveries;
           DELETE FROM routines;
           DELETE FROM routine_steps;
           UPDATE companion SET
             reclaimed_minutes_lifetime = 0,
             lifetime_data_points = 0,
             max_tier = 0,
             keeper = 0,
             seed = 0,
             drift_health = 'settled',
             discovery_count = 0,
             name = NULL
           WHERE id = 1;`
        );
      });
    },
  };
}
