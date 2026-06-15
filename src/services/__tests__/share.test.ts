import { resolveShareModule, type ShareNativeModule } from '../share';

function fakeNative(): ShareNativeModule {
  return { isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) };
}
const throwNative = () => {
  throw new Error('native sharing should not load in Expo Go');
};

describe('resolveShareModule', () => {
  it('returns a no-op stub in Expo Go (native loader never called)', async () => {
    const m = resolveShareModule(true, throwNative);
    expect(m.isStub).toBe(true);
    await expect(m.share('file:///mock.png')).resolves.toBe('unavailable');
  });

  it('uses the native module on a dev build and reports shared', async () => {
    const native = fakeNative();
    const m = resolveShareModule(false, () => native);
    expect(m.isStub).toBe(false);
    await expect(m.share('file:///plan.png')).resolves.toBe('shared');
    expect(native.shareAsync).toHaveBeenCalledWith('file:///plan.png', expect.any(Object));
  });

  it('reports unavailable when the OS share sheet is not available', async () => {
    const native = fakeNative();
    (native.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    const m = resolveShareModule(false, () => native);
    await expect(m.share('file:///plan.png')).resolves.toBe('unavailable');
    expect(native.shareAsync).not.toHaveBeenCalled();
  });

  it('never rejects — a failed share returns "error", never throws', async () => {
    const native = fakeNative();
    (native.shareAsync as jest.Mock).mockRejectedValueOnce(new Error('io'));
    const m = resolveShareModule(false, () => native);
    await expect(m.share('file:///plan.png')).resolves.toBe('error');
  });
});
