import type { Database } from '../Database';

export function makeCompanionRepo(db: Database) {
  return {
    get: () => db.getCompanion(),
    deposit: (deltaMin: number) => db.addReclaim(deltaMin),
    depositToCategory: (categoryId: string, deltaMin: number) =>
      db.addCategoryReclaim(categoryId, deltaMin),
    bumpNectar: () => db.bumpLifetimeNectar(),
    raiseTier: (next: number) => db.raiseMaxTier(next),
    setKeeper: () => db.setKeeper(),
    setDrift: (value: 'settled' | 'curious') => db.setDriftHealth(value),
    ensureSeed: (generate: () => number) => db.setSeed(generate()),
    incrementDiscoveryCount: () => db.incrementDiscoveryCount(),
  };
}
