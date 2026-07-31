import { createMemoryDatabase } from '@/src/db';
import { priorFor } from '@/src/engine';

function seedStat(categoryId: string) {
  return {
    categoryId, n: 4, logEwma: 0.5, mEffective: 2.1, sharpness: 40,
    priorMult: priorFor(categoryId), adaptSpeed: 'balanced' as const, updatedAt: 1,
    reclaimedMinutes: 0, firstHonestRange: null,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
  };
}

describe('Database.deleteCategoryStat', () => {
  it('removes the row so getCategoryStat returns null', async () => {
    const db = createMemoryDatabase();
    await db.upsertCategoryStat(seedStat('cleaning'));
    expect(await db.getCategoryStat('cleaning')).not.toBeNull();

    await db.deleteCategoryStat('cleaning');

    expect(await db.getCategoryStat('cleaning')).toBeNull();
  });

  it('is a no-op when the row is absent', async () => {
    const db = createMemoryDatabase();
    await expect(db.deleteCategoryStat('ghost')).resolves.toBeUndefined();
  });
});
