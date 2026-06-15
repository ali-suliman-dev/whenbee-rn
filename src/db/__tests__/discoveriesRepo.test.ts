import { createMemoryDatabase } from '../memoryDatabase';
import { makeDiscoveriesRepo } from '../repositories/discoveriesRepo';
import type { DiscoveryRow } from '../types';

function disc(overrides: Partial<DiscoveryRow> = {}): DiscoveryRow {
  return { id: 'd1', categoryId: 'cleaning', multiplier: 1.9, honestForFifteen: 29,
    headline: '~29m vs your 15m guess · runs 1.9×', discoveredAt: 1, ...overrides };
}
describe('memoryDatabase — discoveries', () => {
  it('companion starts with discoveryCount = 0', async () => {
    const db = createMemoryDatabase();
    expect((await db.getCompanion()).discoveryCount).toBe(0);
  });
  it('incrementDiscoveryCount rises monotonically', async () => {
    const db = createMemoryDatabase();
    await db.incrementDiscoveryCount(); expect((await db.getCompanion()).discoveryCount).toBe(1);
    await db.incrementDiscoveryCount(); expect((await db.getCompanion()).discoveryCount).toBe(2);
  });
  it('insertDiscovery → listDiscoveries round-trips newest-first', async () => {
    const db = createMemoryDatabase();
    await db.insertDiscovery(disc({ id: 'a', discoveredAt: 1 }));
    await db.insertDiscovery(disc({ id: 'b', discoveredAt: 2 }));
    expect((await db.listDiscoveries(10)).map((r) => r.id)).toEqual(['b', 'a']);
  });
  it('getLastDiscoveryForCategory returns the newest for that category, null otherwise', async () => {
    const db = createMemoryDatabase();
    expect(await db.getLastDiscoveryForCategory('cleaning')).toBeNull();
    await db.insertDiscovery(disc({ id: 'a', categoryId: 'cleaning', multiplier: 1.9, discoveredAt: 1 }));
    await db.insertDiscovery(disc({ id: 'b', categoryId: 'cleaning', multiplier: 2.5, discoveredAt: 2 }));
    await db.insertDiscovery(disc({ id: 'c', categoryId: 'email', multiplier: 1.8, discoveredAt: 3 }));
    const last = await db.getLastDiscoveryForCategory('cleaning');
    expect(last?.id).toBe('b'); expect(last?.multiplier).toBe(2.5);
  });
});
describe('discoveriesRepo', () => {
  it('bank → list round-trips and lastForCategory tracks the newest', async () => {
    const db = createMemoryDatabase();
    const repo = makeDiscoveriesRepo(db);
    await repo.bank(disc({ id: 'a', multiplier: 1.9, discoveredAt: 1 }));
    await repo.bank(disc({ id: 'b', multiplier: 2.5, discoveredAt: 2 }));
    expect((await repo.list(10)).map((r) => r.id)).toEqual(['b', 'a']);
    expect((await repo.lastForCategory('cleaning'))?.id).toBe('b');
  });
  it('list defaults to a limit of 50', async () => {
    const db = createMemoryDatabase();
    const spy = jest.spyOn(db, 'listDiscoveries');
    await makeDiscoveriesRepo(db).list();
    expect(spy).toHaveBeenCalledWith(50);
  });
});
