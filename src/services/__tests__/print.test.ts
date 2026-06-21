import { resolvePrintModule, type PrintNativeModule } from '../print';

function fakeNative(): PrintNativeModule {
  return {
    printToFileAsync: jest.fn(async () => ({ uri: 'file:///tmp/report.pdf' })),
    shareAsync: jest.fn(async () => {}),
    isAvailableAsync: jest.fn(async () => true),
  };
}
const throwNative = (): PrintNativeModule => {
  throw new Error('native print should not load in Expo Go');
};

describe('resolvePrintModule', () => {
  it('returns a no-op stub in Expo Go (native loader never called)', async () => {
    const mod = resolvePrintModule(true, throwNative);
    expect(mod.isStub).toBe(true);
    await expect(mod.printAndShare('<html></html>')).resolves.toBe('unavailable');
  });

  it('wraps the native loader on a dev build and reports shared', async () => {
    const native = fakeNative();
    const mod = resolvePrintModule(false, () => native);
    expect(mod.isStub).toBe(false);
    await expect(mod.printAndShare('<html></html>')).resolves.toBe('shared');
    expect(native.printToFileAsync).toHaveBeenCalledWith({ html: '<html></html>' });
    expect(native.shareAsync).toHaveBeenCalledWith('file:///tmp/report.pdf', expect.any(Object));
  });

  it('reports unavailable when the OS share sheet is not available', async () => {
    const native = fakeNative();
    (native.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    const mod = resolvePrintModule(false, () => native);
    await expect(mod.printAndShare('<html></html>')).resolves.toBe('unavailable');
    expect(native.shareAsync).not.toHaveBeenCalled();
  });

  it('maps a native failure to error, never throws', async () => {
    const native = fakeNative();
    (native.printToFileAsync as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const mod = resolvePrintModule(false, () => native);
    await expect(mod.printAndShare('<html></html>')).resolves.toBe('error');
  });
});
