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
import type { CategoryStatRow, RecurringStatRow, TaskEventRow } from './types';

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
           (category_id, ewma_logr, n, m_effective, sharpness, prior_mult, adapt_speed, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(category_id) DO UPDATE SET
           ewma_logr = excluded.ewma_logr,
           n = excluded.n,
           m_effective = excluded.m_effective,
           sharpness = excluded.sharpness,
           prior_mult = excluded.prior_mult,
           adapt_speed = excluded.adapt_speed,
           updated_at = excluded.updated_at`,
        row.categoryId,
        row.logEwma,
        row.n,
        row.mEffective,
        row.sharpness,
        row.priorMult,
        row.adaptSpeed,
        row.updatedAt
      );
    },

    async insertTaskEvent(row: TaskEventRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO task_events
           (id, category, label, estimate_min, actual_min, status, source, started_at, ended_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.category,
        row.label,
        row.estimateMin,
        row.actualMin,
        row.status,
        row.source,
        row.startedAt,
        row.endedAt,
        row.createdAt
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
  };
}
