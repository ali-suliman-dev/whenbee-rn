import { createMemoryDatabase } from '../../memoryDatabase';
import { makeCategoryStatsRepo } from '../categoryStatsRepo';
import { solveAffine } from '@/src/engine';

it('cold get returns empty affine stats at the population prior', async () => {
  const repo = makeCategoryStatsRepo(createMemoryDatabase());
  const row = await repo.get('admin');
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
  const row = await makeCategoryStatsRepo(db).get('admin');
  expect(row.sw).toBeGreaterThan(0);
  const fit = solveAffine({ sw: row.sw, swx: row.swx, swy: row.swy, swxx: row.swxx, swxy: row.swxy }, row.priorMult);
  expect(fit.b).toBeCloseTo(1.4, 4); // honest unchanged immediately after migration
});
