import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { kv } from '@/src/lib/kv';
import { wipeLearning, wipeEverything } from '@/src/services/dataReset';

beforeEach(() => kv.clearAll());

async function seedDb() {
  const db = createMemoryDatabase();
  await db.upsertCategoryStat({
    categoryId: 'cooking', n: 5, logEwma: 0.2, mEffective: 1.3, sharpness: 0.4,
    priorMult: 1.2, adaptSpeed: 'balanced', updatedAt: 1000, reclaimedMinutes: 30,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
  });
  await db.setCompanionName('Bramble');
  return db;
}

describe('wipeLearning', () => {
  it('clears learning data + keys but keeps setup keys and companion identity', async () => {
    const db = await seedDb();
    const seedBefore = (await db.getCompanion()).seed;
    kv.set('settings', '{"colorMode":"dark"}');
    kv.set('categories', '{"state":{"categories":[]}}');
    kv.set('paywall.founderReserved', '1');
    kv.set('whenbee.installAt', '1000');
    kv.set('calibration.graduatedCategories', '["cooking"]');
    kv.set('whenbee.ahaFired.cooking', '1');
    kv.set('today-tasks', '{"state":{"tasks":[]}}');

    await wipeLearning(db);

    // db wiped
    expect(await db.getCategoryStat('cooking')).toBeNull();
    // companion identity preserved (name + the existing appearance seed)
    const c = await db.getCompanion();
    expect(c.name).toBe('Bramble');
    expect(c.seed).toBe(seedBefore);
    // kept keys survive
    expect(kv.getString('settings')).not.toBeNull();
    expect(kv.getString('categories')).not.toBeNull();
    expect(kv.getString('paywall.founderReserved')).toBe('1');
    expect(kv.getString('whenbee.installAt')).toBe('1000');
    // learning keys gone
    expect(kv.getString('calibration.graduatedCategories')).toBeNull();
    expect(kv.getString('whenbee.ahaFired.cooking')).toBeNull();
    expect(kv.getString('today-tasks')).toBeNull();
  });
});

describe('wipeEverything', () => {
  it('clears the db and every KV key', async () => {
    const db = await seedDb();
    kv.set('settings', '{"colorMode":"dark"}');
    kv.set('vocab', '{"state":{"map":{}}}');

    await wipeEverything(db);

    expect(await db.getCategoryStat('cooking')).toBeNull();
    expect((await db.getCompanion()).name).toBeNull();
    expect(kv.getAllKeys()).toEqual([]);
  });
});
