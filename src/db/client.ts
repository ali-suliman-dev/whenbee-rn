// Runtime migration runner + lazily-created singleton Database.
// `runMigrations` is idempotent: PRAGMA user_version records how many MIGRATIONS
// entries have been applied, so each run applies only the un-applied tail in
// order. `getDatabase` builds the sqlite adapter exactly once and caches it.

import type * as SQLite from 'expo-sqlite';
import type { Database } from './Database';
import { MIGRATIONS } from './migrations';
import { createSqliteDatabase } from './sqliteDatabase';

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = result?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version];
    if (sql === undefined) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    // user_version takes a literal, not a bind param; version+1 is an integer we control.
    await db.execAsync(`PRAGMA user_version = ${version + 1}`);
  }
}

let cached: Promise<Database> | null = null;

export async function getDatabase(): Promise<Database> {
  if (cached === null) {
    cached = createSqliteDatabase();
  }
  return cached;
}

/** Test-only: clears the cached singleton so each test starts cold. */
export function __resetDatabaseForTests(): void {
  cached = null;
}
