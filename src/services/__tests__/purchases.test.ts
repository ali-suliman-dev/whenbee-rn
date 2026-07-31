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

describe('native purchasePackage timing', () => {
  const pkg = { id: '$rc_monthly', duration: 'monthly' as const, priceString: '59 kr', productId: 'wb_pro_monthly' };
  const offerings = {
    current: { identifier: 'default', availablePackages: [{ identifier: '$rc_monthly' }] },
  };
  const proInfo = { entitlements: { active: { 'Whenbee Pro': {} } } };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('rejects when the pre-sheet offering lookup hangs', async () => {
    const native = {
      getOfferings: () => new Promise(() => {}),
      purchasePackage: jest.fn(),
    };
    const m = resolvePurchasesModule(false, () => native as never);

    const attempt = m.purchasePackage(pkg);
    const assertion = expect(attempt).rejects.toThrow(/offering/i);
    await jest.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(native.purchasePackage).not.toHaveBeenCalled();
  });

  // The store sheet is user-paced: reading the plan, picking a card, or a 3DS
  // step can take minutes. It must never be timed out into a false error.
  it('resolves a slow store sheet without reporting an error', async () => {
    const native = {
      getOfferings: async () => offerings,
      purchasePackage: () =>
        new Promise((resolve) => setTimeout(() => resolve({ customerInfo: proInfo }), 120_000)),
    };
    const m = resolvePurchasesModule(false, () => native as never);

    const attempt = m.purchasePackage(pkg);
    await jest.advanceTimersByTimeAsync(120_000);
    await expect(attempt).resolves.toEqual({ isPro: true });
  });
});
