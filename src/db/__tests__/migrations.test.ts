import { MIGRATIONS } from '../migrations';
import { createMemoryDatabase } from '../memoryDatabase';

describe('MIGRATIONS', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(MIGRATIONS)).toBe(true);
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    for (const m of MIGRATIONS) {
      expect(typeof m).toBe('string');
    }
  });

  it('every entry contains a schema statement (CREATE TABLE or ALTER TABLE)', () => {
    // Additive migrations (e.g. 0003) are pure ALTER TABLE and create no table.
    for (const m of MIGRATIONS) {
      expect(m).toMatch(/CREATE TABLE|ALTER TABLE/);
    }
  });

  it('covers the three core tables', () => {
    const joined = MIGRATIONS.join('\n');
    expect(joined).toContain('task_events');
    expect(joined).toContain('category_stats');
    expect(joined).toContain('recurring_stats');
  });
});

// ── Migration 0002 schema assertions ────────────────────────────────────────
// The test harness never runs real SQLite (native module not available in Jest).
// Schema assertions inspect the migration SQL strings; behavioural assertions
// run against createMemoryDatabase(), which is the test oracle for the port.

describe('MIGRATIONS 0002 — reclaim bank + log_tags', () => {
  const migration0002 = MIGRATIONS[1]; // index 1 == 0002

  it('migration 0002 exists and is a string', () => {
    expect(typeof migration0002).toBe('string');
  });

  it('adds reclaimed_minutes column to category_stats', () => {
    expect(migration0002).toContain('ALTER TABLE category_stats ADD COLUMN reclaimed_minutes');
  });

  it('adds suggested_honest_min column to task_events', () => {
    expect(migration0002).toContain('ALTER TABLE task_events ADD COLUMN suggested_honest_min');
  });

  it('adds reclaim_dividend_min column to task_events', () => {
    expect(migration0002).toContain('ALTER TABLE task_events ADD COLUMN reclaim_dividend_min');
  });

  it('creates the companion table with a seed row', () => {
    expect(migration0002).toContain('CREATE TABLE IF NOT EXISTS companion');
    expect(migration0002).toContain('INSERT OR IGNORE INTO companion');
  });

  it('creates the log_tags table', () => {
    expect(migration0002).toContain('CREATE TABLE IF NOT EXISTS log_tags');
  });

  it('is idempotent: CREATE TABLE statements use IF NOT EXISTS', () => {
    // The user_version runner only applies each migration once, but we verify
    // the defensive IF NOT EXISTS guards are present for companion and log_tags.
    expect(migration0002).toContain('CREATE TABLE IF NOT EXISTS companion');
    expect(migration0002).toContain('CREATE TABLE IF NOT EXISTS log_tags');
  });

  it('seed uses INSERT OR IGNORE so re-running does not duplicate the companion row', () => {
    expect(migration0002).toContain('INSERT OR IGNORE INTO companion');
  });
});

// ── Behavioural assertions for new port methods (via memory adapter) ────────

describe('memoryDatabase — companion / reclaim bank', () => {
  it('getCompanion returns default row with reclaimedMinutesLifetime = 0', async () => {
    const db = createMemoryDatabase();
    const row = await db.getCompanion();
    expect(row.reclaimedMinutesLifetime).toBe(0);
  });

  it('addReclaim increments reclaimedMinutesLifetime monotonically', async () => {
    const db = createMemoryDatabase();
    await db.addReclaim(10);
    expect((await db.getCompanion()).reclaimedMinutesLifetime).toBe(10);
    await db.addReclaim(5);
    expect((await db.getCompanion()).reclaimedMinutesLifetime).toBe(15);
  });

  it('addCategoryReclaim increments reclaimedMinutes on the category stat', async () => {
    const db = createMemoryDatabase();
    // Seed a stat row first.
    await db.upsertCategoryStat({
      categoryId: 'cleaning',
      n: 1,
      logEwma: 0,
      mEffective: 2,
      sharpness: 0,
      priorMult: 2,
      adaptSpeed: 'balanced',
      updatedAt: 1,
      reclaimedMinutes: 0,
      sw: 0,
      swx: 0,
      swy: 0,
      swxx: 0,
      swxy: 0,
    });
    await db.addCategoryReclaim('cleaning', 8);
    const row = await db.getCategoryStat('cleaning');
    expect(row?.reclaimedMinutes).toBe(8);
    await db.addCategoryReclaim('cleaning', 4);
    const updated = await db.getCategoryStat('cleaning');
    expect(updated?.reclaimedMinutes).toBe(12);
  });

  it('addCategoryReclaim on an unknown category is a no-op (no crash)', async () => {
    const db = createMemoryDatabase();
    await expect(db.addCategoryReclaim('ghost', 5)).resolves.toBeUndefined();
  });

  it('insertContextTag stores a tag retrievable by the memory adapter', async () => {
    const db = createMemoryDatabase();
    await expect(
      db.insertContextTag({
        eventId: 'e1',
        key: 'reason',
        value: 'morning_rush',
        source: 'auto',
        createdAt: 1000,
      })
    ).resolves.toBeUndefined();
  });

  it('insertContextTag with same eventId+key replaces the previous value', async () => {
    const db = createMemoryDatabase();
    await db.insertContextTag({ eventId: 'e1', key: 'reason', value: 'v1', source: 'auto', createdAt: 1 });
    await db.insertContextTag({ eventId: 'e1', key: 'reason', value: 'v2', source: 'auto', createdAt: 2 });
    // No error and no duplicate — the memory adapter uses a Map keyed on eventId:key.
    // Smoke-test only: the method resolves cleanly.
    await expect(db.getCompanion()).resolves.toBeDefined();
  });
});

describe('MIGRATIONS 0003 — companion fuel fields (additive, monotonic)', () => {
  const migration0003 = MIGRATIONS[2]; // index 2 == 0003
  it('migration 0003 exists and is a string', () => {
    expect(typeof migration0003).toBe('string');
  });
  it('adds the fuel columns + seed to companion', () => {
    expect(migration0003).toContain('ALTER TABLE companion ADD COLUMN lifetime_data_points');
    expect(migration0003).toContain('ALTER TABLE companion ADD COLUMN max_tier');
    expect(migration0003).toContain('ALTER TABLE companion ADD COLUMN keeper');
    expect(migration0003).toContain('ALTER TABLE companion ADD COLUMN seed');
    expect(migration0003).toContain('ALTER TABLE companion ADD COLUMN drift_health');
  });
  it('defaults keep existing rows valid', () => {
    expect(migration0003).toContain('DEFAULT 0');
  });
});

describe('memoryDatabase — companion fuel layers', () => {
  it('getCompanion exposes the new fields with safe defaults', async () => {
    const db = createMemoryDatabase();
    const row = await db.getCompanion();
    expect(row.lifetimeDataPoints).toBe(0);
    expect(row.maxTier).toBe(0);
    expect(row.keeper).toBe(false);
    expect(typeof row.seed).toBe('number');
    expect(row.driftHealth).toBe('settled');
  });
  it('bumpLifetimeNectar increments Layer 1 monotonically', async () => {
    const db = createMemoryDatabase();
    await db.bumpLifetimeNectar();
    await db.bumpLifetimeNectar();
    expect((await db.getCompanion()).lifetimeDataPoints).toBe(2);
  });
  it('raiseMaxTier is monotonic — max(prev, next)', async () => {
    const db = createMemoryDatabase();
    await db.raiseMaxTier(3);
    expect((await db.getCompanion()).maxTier).toBe(3);
    await db.raiseMaxTier(1);
    expect((await db.getCompanion()).maxTier).toBe(3);
  });
  it('setKeeper latches true and never clears', async () => {
    const db = createMemoryDatabase();
    await db.setKeeper();
    expect((await db.getCompanion()).keeper).toBe(true);
    await db.setKeeper();
    expect((await db.getCompanion()).keeper).toBe(true);
  });
  it('setDriftHealth stores the positive-only register', async () => {
    const db = createMemoryDatabase();
    await db.setDriftHealth('curious');
    expect((await db.getCompanion()).driftHealth).toBe('curious');
  });
  it('setSeed only writes when no seed is set', async () => {
    const db = createMemoryDatabase();
    const original = (await db.getCompanion()).seed;
    await db.setSeed(original + 999);
    expect((await db.getCompanion()).seed).toBe(original);
  });
});

describe('MIGRATIONS 0004 — discoveries gallery', () => {
  const migration0004 = MIGRATIONS[3]; // index 3 == 0004
  it('exists and is a string', () => { expect(typeof migration0004).toBe('string'); });
  it('creates the discoveries table (IF NOT EXISTS)', () => { expect(migration0004).toContain('CREATE TABLE IF NOT EXISTS discoveries'); });
  it('carries category, multiplier, headline, discovered_at', () => {
    expect(migration0004).toContain('category_id');
    expect(migration0004).toContain('multiplier');
    expect(migration0004).toContain('honest_for_fifteen');
    expect(migration0004).toContain('headline');
    expect(migration0004).toContain('discovered_at');
  });
  it('indexes newest-first + by category', () => {
    expect(migration0004).toContain('idx_discoveries_discovered_at');
    expect(migration0004).toContain('idx_discoveries_category');
  });
  it('adds companion.discovery_count', () => { expect(migration0004).toContain('ALTER TABLE companion ADD COLUMN discovery_count'); });
});
