import { resolvePurchasesModule } from '../purchases';
describe('resolvePurchasesModule', () => {
  it('returns a stub (isPro:false) when running in Expo Go', async () => {
    const m = resolvePurchasesModule(true, () => { throw new Error('should not be called in Expo Go'); });
    expect(m.isStub).toBe(true);
    expect((await m.getEntitlement()).isPro).toBe(false);
  });
  it('loads the native module outside Expo Go', () => {
    const fake = { configure: jest.fn() };
    const m = resolvePurchasesModule(false, () => fake as never);
    expect(m.isStub).toBe(false);
  });
});
