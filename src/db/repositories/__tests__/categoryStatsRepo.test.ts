import { createMemoryDatabase } from '../../memoryDatabase';
import { makeCategoryStatsRepo } from '../categoryStatsRepo';
import { solveAffine, priorFor } from '@/src/engine';

it('cold get returns empty affine stats at the population prior', async () => {
  const repo = makeCategoryStatsRepo(createMemoryDatabase());
  const row = await repo.get('admin', undefined);
  expect(row.n).toBe(0);
  expect(row.sw).toBe(0);
  const fit = solveAffine({ sw: row.sw, swx: row.swx, swy: row.swy, swxx: row.swxx, swxy: row.swxy }, row.priorMult);
  expect(fit.b).toBeCloseTo(row.priorMult, 6);
});

it('lazily seeds a legacy row (n>0, sw=0) from m_effective', async () => {
  const db = createMemoryDatabase();
  await db.upsertCategoryStat({
    categoryId: 'admin', n: 7, logEwma: 0, mEffective: 1.4, sharpness: 20,
    priorMult: 2.2, adaptSpeed: 'balanced', updatedAt: 1, reclaimedMinutes: 0,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
  });
  const row = await makeCategoryStatsRepo(db).get('admin', undefined);
  expect(row.sw).toBeGreaterThan(0);
  const fit = solveAffine({ sw: row.sw, swx: row.swx, swy: row.swy, swxx: row.swxx, swxy: row.swxy }, row.priorMult);
  expect(fit.b).toBeCloseTo(1.4, 4); // honest unchanged immediately after migration
});

describe('CategoryStatsRepo.deleteStat', () => {
  it('deletes the row so the raw db row is gone (repo.get falls back to the seed)', async () => {
    const db = createMemoryDatabase();
    const repo = makeCategoryStatsRepo(db);
    await repo.upsert({
      categoryId: 'cleaning', n: 3, logEwma: 0.4, mEffective: 2.0, sharpness: 30,
      priorMult: priorFor('cleaning'), adaptSpeed: 'balanced', updatedAt: 1,
      reclaimedMinutes: 0, firstHonestRange: null,
      sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });

    await repo.deleteStat('cleaning');

    // raw row gone
    expect(await db.getCategoryStat('cleaning')).toBeNull();
    // repo.get re-seeds a fresh n=0 row (never throws)
    expect((await repo.get('cleaning', undefined)).n).toBe(0);
  });
});
