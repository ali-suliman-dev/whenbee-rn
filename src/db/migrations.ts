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

  // 0003 — companion 3-layer fuel + procedural seed (additive, monotonic).
  `
  ALTER TABLE companion ADD COLUMN lifetime_data_points INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE companion ADD COLUMN max_tier INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE companion ADD COLUMN keeper INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE companion ADD COLUMN seed INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE companion ADD COLUMN drift_health TEXT NOT NULL DEFAULT 'settled';
  `,

  // 0004 — Discoveries gallery (append-only) + monotonic discoveryCount.
  `
  CREATE TABLE IF NOT EXISTS discoveries (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    multiplier REAL NOT NULL,
    honest_for_fifteen REAL NOT NULL,
    headline TEXT NOT NULL,
    discovered_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_discoveries_discovered_at ON discoveries (discovered_at);
  CREATE INDEX IF NOT EXISTS idx_discoveries_category ON discoveries (category_id, discovered_at);
  ALTER TABLE companion ADD COLUMN discovery_count INTEGER NOT NULL DEFAULT 0;
  `,

  // 0005 — companion display name (optional, user-set; NULL = unnamed).
  `
  ALTER TABLE companion ADD COLUMN name TEXT;
  `,

  // 0006 — first honest range per category (the "tightened from" anchor; additive,
  // captured once and frozen, NULL until the first meaningful band).
  `
  ALTER TABLE category_stats ADD COLUMN first_honest_low REAL;
  ALTER TABLE category_stats ADD COLUMN first_honest_high REAL;
  `,

  // 0007 — affine calibration sufficient statistics (additive). Legacy rows are
  // lazily seeded from m_effective in the repository (see categoryStatsRepo).
  `
  ALTER TABLE category_stats ADD COLUMN sw REAL NOT NULL DEFAULT 0;
  ALTER TABLE category_stats ADD COLUMN swx REAL NOT NULL DEFAULT 0;
  ALTER TABLE category_stats ADD COLUMN swy REAL NOT NULL DEFAULT 0;
  ALTER TABLE category_stats ADD COLUMN swxx REAL NOT NULL DEFAULT 0;
  ALTER TABLE category_stats ADD COLUMN swxy REAL NOT NULL DEFAULT 0;
  `,

  // 0008 — Routines (Pro): saved multi-step sequences + ordered steps. Per-step
  // learning reuses recurring_stats (no schema change there); the chain total is
  // derived at read time from a learned transition_factor stored on the routine.
  `
  CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    done_by_minute_of_day INTEGER,
    transition_factor REAL NOT NULL DEFAULT 1.15,
    run_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS routine_steps (
    id TEXT PRIMARY KEY,
    routine_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    guess_min REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_routine_steps_routine
    ON routine_steps (routine_id, position);
  `,
];
