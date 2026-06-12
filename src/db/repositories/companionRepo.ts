import type { Database } from '../Database';

export function makeCompanionRepo(db: Database) {
  return {
    get: () => db.getCompanion(),
    deposit: (deltaMin: number) => db.addReclaim(deltaMin),
    depositToCategory: (categoryId: string, deltaMin: number) =>
      db.addCategoryReclaim(categoryId, deltaMin),
  };
}
