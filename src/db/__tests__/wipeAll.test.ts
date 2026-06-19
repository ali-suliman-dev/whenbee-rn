import { createMemoryDatabase } from '@/src/db/memoryDatabase';

describe('Database.wipeAll', () => {
  it('clears every table and resets the companion to defaults', async () => {
    const db = createMemoryDatabase();

    await db.upsertCategoryStat({
      categoryId: 'cooking', n: 5, logEwma: 0.2, mEffective: 1.3,
      sharpness: 0.4, priorMult: 1.2, adaptSpeed: 'balanced',
      updatedAt: 1000, reclaimedMinutes: 30,
      sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });
    await db.insertTaskEvent({
      id: 'e1', category: 'cooking', label: null, estimateMin: 15, actualMin: 20,
      status: 'completed', source: 'timed', startedAt: null, endedAt: 2000,
      createdAt: 2000, suggestedHonestMin: 18, reclaimDividendMin: 2,
    });
    await db.insertDiscovery({
      id: 'd1', categoryId: 'cooking', multiplier: 1.3, honestForFifteen: 20,
      headline: 'x', discoveredAt: 3000,
    });
    await db.setCompanionName('Bramble');
    await db.bumpLifetimeNectar();
    await db.raiseMaxTier(3);

    await db.wipeAll();

    expect(await db.getCategoryStat('cooking')).toBeNull();
    expect(await db.listRecentEvents(10)).toEqual([]);
    expect(await db.listDiscoveries(10)).toEqual([]);
    const companion = await db.getCompanion();
    expect(companion).toEqual({
      reclaimedMinutesLifetime: 0,
      lifetimeDataPoints: 0,
      maxTier: 0,
      keeper: false,
      seed: 0,
      driftHealth: 'settled',
      discoveryCount: 0,
      name: null,
    });
  });
});
