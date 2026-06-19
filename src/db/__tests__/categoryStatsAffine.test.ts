import { createMemoryDatabase } from '../memoryDatabase';

it('round-trips affine sufficient stats', async () => {
  const db = createMemoryDatabase();
  await db.upsertCategoryStat({
    categoryId: 'admin',
    n: 3,
    logEwma: 0,
    mEffective: 1.8,
    sharpness: 10,
    priorMult: 2.2,
    adaptSpeed: 'balanced',
    updatedAt: 1,
    reclaimedMinutes: 0,
    sw: 2.5,
    swx: 37.5,
    swy: 67.5,
    swxx: 562.5,
    swxy: 1012.5,
  });
  const row = await db.getCategoryStat('admin');
  expect(row?.swxy).toBeCloseTo(1012.5, 6);
  expect(row?.sw).toBeCloseTo(2.5, 6);
});
