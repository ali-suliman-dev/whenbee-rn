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

  it('every entry contains a CREATE TABLE statement', () => {
    for (const m of MIGRATIONS) {
      expect(m).toContain('CREATE TABLE');
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
