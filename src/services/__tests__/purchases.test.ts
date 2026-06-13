import { resolvePurchasesModule } from '../purchases';

const throwNative = () => {
  throw new Error('native module should not be loaded in Expo Go');
};

describe('resolvePurchasesModule', () => {
  it('returns a stub flagged isStub when running in Expo Go', () => {
    const m = resolvePurchasesModule(true, throwNative);
    expect(m.isStub).toBe(true);
  });

  it('starts non-pro in Expo Go', async () => {
    const m = resolvePurchasesModule(true, throwNative);
    expect((await m.getEntitlement()).isPro).toBe(false);
  });

  it('resolves a mock offering with packages carrying a priceString', async () => {
    const m = resolvePurchasesModule(true, throwNative);
    const offering = await m.getOfferings();
    expect(offering).not.toBeNull();
    expect(offering?.packages.length).toBeGreaterThan(0);
    for (const pkg of offering?.packages ?? []) {
      expect(typeof pkg.priceString).toBe('string');
      expect(pkg.priceString.length).toBeGreaterThan(0);
      expect(typeof pkg.productId).toBe('string');
    }
    expect(offering?.packages.map((p) => p.duration)).toEqual(
      expect.arrayContaining(['monthly', 'yearly', 'lifetime']),
    );
  });

  it('flips the entitlement to pro after purchasing a package', async () => {
    const m = resolvePurchasesModule(true, throwNative);
    const offering = await m.getOfferings();
    const pkg = offering?.packages[0];
    expect(pkg).toBeDefined();
    if (!pkg) return;

    expect((await m.purchasePackage(pkg)).isPro).toBe(true);
    expect((await m.getEntitlement()).isPro).toBe(true);
  });

  it('reports pro via restore once a purchase has happened', async () => {
    const m = resolvePurchasesModule(true, throwNative);
    expect((await m.restore()).isPro).toBe(false);

    const offering = await m.getOfferings();
    const pkg = offering?.packages[0];
    if (!pkg) throw new Error('expected a stub package');
    await m.purchasePackage(pkg);

    expect((await m.restore()).isPro).toBe(true);
  });

  it('never throws in Expo Go (does not touch the native module)', async () => {
    const m = resolvePurchasesModule(true, throwNative);
    await expect(
      (async () => {
        m.configure('mock-key');
        await m.getOfferings();
        await m.getEntitlement();
        await m.restore();
      })(),
    ).resolves.not.toThrow();
  });

  it('builds the native module without loading it at construction', () => {
    const fake = { configure: jest.fn() };
    const m = resolvePurchasesModule(false, () => fake as never);
    expect(m.isStub).toBe(false);
  });
});
