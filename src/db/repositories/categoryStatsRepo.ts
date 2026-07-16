// Thin semantic wrapper over the Database port for per-category stats.
// Invariant: `get` NEVER returns null. When the port has no row yet (cold start)
// it seeds a valid n=0 row whose multiplier is the population prior, so the very
// first suggestion is already smart and downstream code never branches on null.

import { seededPriorFor } from '@/src/engine/priors';
import { emptyAffineStats, seedAffineFromMultiplier } from '@/src/engine';
import type { Database } from '../Database';
import type { CategoryStatRow } from '../types';
import type { ArchetypeSeed } from '@/src/domain/types';

export interface CategoryStatsRepo {
  /** @param seed - the quiz archetype seed, or undefined when no quiz was
   *  taken (falls back to the plain population prior for a cold row). */
  get(categoryId: string, seed: ArchetypeSeed | undefined): Promise<CategoryStatRow>;
  upsert(row: CategoryStatRow): Promise<void>;
  deleteStat(categoryId: string): Promise<void>;
}

function seedRow(categoryId: string, seed: ArchetypeSeed | undefined): CategoryStatRow {
  const prior = seededPriorFor(categoryId, seed);
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
    firstHonestRange: null,
    ...emptyAffineStats(),
  };
}

/**
 * Legacy rows (n>0) predate the affine columns — their sums are zero.
 * Seed them from the stored scalar so the honest number is identical
 * right after migration. The anchor MUST match the value used when solving
 * (priorMult), per the seedAffineFromMultiplier contract.
 */
function withAffineSeed(row: CategoryStatRow): CategoryStatRow {
  if (row.n > 0 && row.sw === 0 && row.swxx === 0) {
    return {
      ...row,
      ...seedAffineFromMultiplier(row.mEffective, Math.min(row.n, 8), row.priorMult),
    };
  }
  return row;
}

export function makeCategoryStatsRepo(db: Database): CategoryStatsRepo {
  return {
    async get(categoryId: string, seed: ArchetypeSeed | undefined): Promise<CategoryStatRow> {
      const row = await db.getCategoryStat(categoryId);
      return row ? withAffineSeed(row) : seedRow(categoryId, seed);
    },
    async upsert(row: CategoryStatRow): Promise<void> {
      await db.upsertCategoryStat(row);
    },
    async deleteStat(categoryId: string): Promise<void> {
      await db.deleteCategoryStat(categoryId);
    },
  };
}
