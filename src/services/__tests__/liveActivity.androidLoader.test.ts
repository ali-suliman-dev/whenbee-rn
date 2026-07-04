import { resolveNativePresence, type NativePresenceModule } from '@/src/services/liveActivity';

// resolveNativePresence stays pure — this test proves an Android-style loader is
// honored (real module returned when not in Expo Go).
test('resolveNativePresence returns the injected android module outside Expo Go', () => {
  const android: NativePresenceModule = {
    isStub: false, writeWidgetData: jest.fn(), clearWidgetData: jest.fn(),
    writeSnapshot: jest.fn(), clearSnapshot: jest.fn(),
    startLiveActivity: jest.fn(), updateLiveActivity: jest.fn(), endLiveActivity: jest.fn(),
  };
  const resolved = resolveNativePresence(false, () => android);
  expect(resolved).toBe(android);
  expect(resolved.isStub).toBe(false);
});

test('resolveNativePresence still returns the stub in Expo Go even if a loader would provide one', () => {
  const android: NativePresenceModule = {
    isStub: false, writeWidgetData: jest.fn(), clearWidgetData: jest.fn(),
    writeSnapshot: jest.fn(), clearSnapshot: jest.fn(),
    startLiveActivity: jest.fn(), updateLiveActivity: jest.fn(), endLiveActivity: jest.fn(),
  };
  const resolved = resolveNativePresence(true, () => android);
  expect(resolved.isStub).toBe(true);
});
