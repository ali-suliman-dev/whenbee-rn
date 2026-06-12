// Thin semantic wrapper over the Database port for per-category stats.
// Invariant: `get` NEVER returns null. When the port has no row yet (cold start)
// it seeds a valid n=0 row whose multiplier is the population prior, so the very
// first suggestion is already smart and downstream code never branches on null.

import { priorFor } from '@/src/engine/priors';
import type { Database } from '../Database';
import type { CategoryStatRow } from '../types';

export interface CategoryStatsRepo {
  get(categoryId: string): Promise<CategoryStatRow>;
  upsert(row: CategoryStatRow): Promise<void>;
}

function seedRow(categoryId: string): CategoryStatRow {
  const prior = priorFor(categoryId);
  return {
    categoryId,
    n: 0,
    logEwma: 0,
    mEffective: prior,
    sharpness: 0,
    priorMult: prior,
    adaptSpeed: 'balanced',
    updatedAt: 0,
    reclaimedMinutes: 0,
  };
}

export function makeCategoryStatsRepo(db: Database): CategoryStatsRepo {
  return {
    async get(categoryId: string): Promise<CategoryStatRow> {
      const row = await db.getCategoryStat(categoryId);
      return row ?? seedRow(categoryId);
    },
    async upsert(row: CategoryStatRow): Promise<void> {
      await db.upsertCategoryStat(row);
    },
  };
}
