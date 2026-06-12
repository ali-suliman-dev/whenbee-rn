import { resolveNativePresence, type NativePresenceModule } from '../liveActivity';

/** A spy module standing in for the linked native presence module. */
function fakeNative(): NativePresenceModule {
  return {
    isStub: false,
    writeSnapshot: jest.fn(),
    clearSnapshot: jest.fn(),
    startLiveActivity: jest.fn(),
    updateLiveActivity: jest.fn(),
    endLiveActivity: jest.fn(),
  };
}

describe('resolveNativePresence', () => {
  it('returns a no-op stub in Expo Go (native loader is never called)', () => {
    const m = resolveNativePresence(true, () => {
      throw new Error('should not load native in Expo Go');
    });
    expect(m.isStub).toBe(true);
    expect(() => m.writeSnapshot({} as never)).not.toThrow();
    expect(() => m.startLiveActivity({} as never)).not.toThrow();
    expect(() => m.endLiveActivity()).not.toThrow();
  });

  it('falls back to the stub when the native module is not linked', () => {
    const m = resolveNativePresence(false, () => null);
    expect(m.isStub).toBe(true);
  });

  it('uses the native module when it is linked (dev build)', () => {
    const native = fakeNative();
    const m = resolveNativePresence(false, () => native);
    expect(m.isStub).toBe(false);
    expect(m).toBe(native);
  });
});
