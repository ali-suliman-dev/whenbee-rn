import { createMemoryDatabase } from '../../memoryDatabase';
import { makeCompanionRepo } from '../companionRepo';

describe('companionRepo — fuel ops route to monotonic port methods', () => {
  it('get exposes reclaim bank + all fuel layers', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    const row = await repo.get();
    expect(row.lifetimeDataPoints).toBe(0);
    expect(row.maxTier).toBe(0);
    expect(row.keeper).toBe(false);
  });
  it('bumpNectar increments Layer 1', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    await repo.bumpNectar();
    expect((await repo.get()).lifetimeDataPoints).toBe(1);
  });
  it('raiseTier is monotonic', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    await repo.raiseTier(4);
    await repo.raiseTier(2);
    expect((await repo.get()).maxTier).toBe(4);
  });
  it('setKeeper latches true', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    await repo.setKeeper();
    expect((await repo.get()).keeper).toBe(true);
  });
  it('ensureSeed is a no-op when a seed already exists', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    const before = (await repo.get()).seed;
    await repo.ensureSeed(() => before + 123);
    expect((await repo.get()).seed).toBe(before);
  });
  it('starts unnamed; setName sets and trims; blank clears back to null', async () => {
    const repo = makeCompanionRepo(createMemoryDatabase());
    expect((await repo.get()).name).toBeNull();
    await repo.setName('  Buzz  ');
    expect((await repo.get()).name).toBe('Buzz');
    await repo.setName('   ');
    expect((await repo.get()).name).toBeNull();
  });
});
