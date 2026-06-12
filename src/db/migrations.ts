// Ordered, append-only SQL migrations. Each array index maps to a
// PRAGMA user_version step (see client.ts). NEVER reorder or edit an applied
// entry — only append new ones. Statements use IF NOT EXISTS so re-running a
// migration on an already-migrated DB is a no-op.

export const MIGRATIONS: string[] = [
  // 0001 — core schema.
  `
  CREATE TABLE IF NOT EXISTS task_events (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    label TEXT,
    estimate_min REAL NOT NULL,
    actual_min REAL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    started_at INTEGER,
    ended_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_task_events_category_created
    ON task_events (category, created_at);

  CREATE TABLE IF NOT EXISTS category_stats (
    category_id TEXT PRIMARY KEY,
    ewma_logr REAL NOT NULL DEFAULT 0,
    n INTEGER NOT NULL DEFAULT 0,
    m_effective REAL NOT NULL,
    sharpness REAL NOT NULL DEFAULT 0,
    prior_mult REAL NOT NULL,
    adapt_speed TEXT NOT NULL DEFAULT 'balanced',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recurring_stats (
    key TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    ewma_logr REAL NOT NULL DEFAULT 0,
    n INTEGER NOT NULL DEFAULT 0,
    m_effective REAL NOT NULL,
    updated_at INTEGER NOT NULL
  );
  `,

  // 0002 — Reclaim bank + reason capture (additive, monotonic).
  `
  ALTER TABLE category_stats ADD COLUMN reclaimed_minutes REAL NOT NULL DEFAULT 0;
  ALTER TABLE task_events ADD COLUMN suggested_honest_min REAL;
  ALTER TABLE task_events ADD COLUMN reclaim_dividend_min REAL NOT NULL DEFAULT 0;

  CREATE TABLE IF NOT EXISTS companion (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    reclaimed_minutes_lifetime REAL NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO companion (id, reclaimed_minutes_lifetime) VALUES (1, 0);

  CREATE TABLE IF NOT EXISTS log_tags (
    event_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (event_id, key)
  );
  `,
];
