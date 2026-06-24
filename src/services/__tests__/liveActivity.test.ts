/**
 * Tests for liveActivity.ts — the RN bridge to native presence surfaces.
 *
 * All requires are lazy (inside `jest.isolateModules`) so that:
 *  1. `expo-modules-core` is never pre-loaded into the main module registry,
 *     which would prevent `jest.doMock('expo-modules-core', …)` from taking
 *     effect inside isolated scopes.
 *  2. Module-level state (`cached`, `homeWidgetSeen`) starts fresh per case.
 *
 * `resolveNativePresence` is a pure function (injected deps, no module cache)
 * and does not need isolation — it is required lazily per test for the same
 * reason: if the module were loaded in the outer scope, expo-modules-core would
 * be registered in the main registry and isolation would not replace it.
 */
import type { NativePresenceModule, WidgetSnapshot } from '../liveActivity';

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

/** A valid WidgetSnapshot literal for use in tests. */
const VALID_SNAPSHOT: WidgetSnapshot = {
  nextTaskLabel: 'x',
  category: 'c',
  honestFinishClock: '7:10',
  startDeepLink: 'whenbee://timer',
  updatedAtEpoch: 1000,
  honestFinishEpoch: 2000,
  isPro: true,
};

describe('resolveNativePresence', () => {
  it('returns a no-op stub in Expo Go (native loader is never called)', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { resolveNativePresence } = require('../liveActivity') as typeof import('../liveActivity');
      const m = resolveNativePresence(true, () => {
        throw new Error('should not load native in Expo Go');
      });
      expect(m.isStub).toBe(true);
      expect(() => m.writeSnapshot({} as never)).not.toThrow();
      expect(() => m.startLiveActivity({} as never)).not.toThrow();
      expect(() => m.endLiveActivity()).not.toThrow();
    });
  });

  it('falls back to the stub when the native module is not linked', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { resolveNativePresence } = require('../liveActivity') as typeof import('../liveActivity');
      const m = resolveNativePresence(false, () => null);
      expect(m.isStub).toBe(true);
    });
  });

  it('uses the native module when it is linked (dev build)', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { resolveNativePresence } = require('../liveActivity') as typeof import('../liveActivity');
      const native = fakeNative();
      const m = resolveNativePresence(false, () => native);
      expect(m.isStub).toBe(false);
      expect(m).toBe(native);
    });
  });
});

describe('presenceAvailable', () => {
  it('returns false when in Expo Go (stub is resolved)', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => null,
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: true }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { presenceAvailable } = require('@/src/services/liveActivity') as {
        presenceAvailable: () => boolean;
      };
      expect(presenceAvailable()).toBe(false);
    });
  });

  it('returns true when a real native module is linked', () => {
    jest.isolateModules(() => {
      const mockReal = fakeNative(); // isStub: false
      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => mockReal,
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { presenceAvailable } = require('@/src/services/liveActivity') as {
        presenceAvailable: () => boolean;
      };
      expect(presenceAvailable()).toBe(true);
    });
  });
});

describe('publishWidgetSnapshot — widget_added one-shot', () => {
  it('fires analytics.capture("widget_added", { surface: "home" }) exactly once across multiple calls when native is real', () => {
    jest.isolateModules(() => {
      const mockReal = fakeNative();
      const mockCapture = jest.fn();
      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => mockReal,
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
      jest.doMock('@/src/services/analytics', () => ({
        analytics: { capture: mockCapture },
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { publishWidgetSnapshot } = require('@/src/services/liveActivity') as {
        publishWidgetSnapshot: (s: WidgetSnapshot) => void;
      };

      publishWidgetSnapshot(VALID_SNAPSHOT);
      publishWidgetSnapshot(VALID_SNAPSHOT);

      const widgetAddedCalls = mockCapture.mock.calls.filter(
        ([event]: [string]) => event === 'widget_added',
      );
      expect(widgetAddedCalls).toHaveLength(1);
      expect(widgetAddedCalls[0]).toEqual(['widget_added', { surface: 'home' }]);
    });
  });

  it('never fires widget_added when the module is the stub (Expo Go)', () => {
    jest.isolateModules(() => {
      const mockCapture = jest.fn();
      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => null,
      }));
      jest.doMock('@/src/lib/isExpoGo', () => ({ isExpoGo: true }));
      jest.doMock('@/src/services/analytics', () => ({
        analytics: { capture: mockCapture },
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { publishWidgetSnapshot } = require('@/src/services/liveActivity') as {
        publishWidgetSnapshot: (s: WidgetSnapshot) => void;
      };

      publishWidgetSnapshot(VALID_SNAPSHOT);
      publishWidgetSnapshot(VALID_SNAPSHOT);

      const widgetAddedCalls = mockCapture.mock.calls.filter(
        ([event]: [string]) => event === 'widget_added',
      );
      expect(widgetAddedCalls).toHaveLength(0);
    });
  });
});
