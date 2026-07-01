/* eslint-disable no-undef */
const matchers = require('@testing-library/react-native/matchers');
expect.extend(matchers);

// i18next must be initialized before any component using `useTranslation` renders,
// or react-i18next falls back to echoing the raw key. Real resources, real English
// fallback — every test sees production copy, not translation keys.
//
// Required LAZILY (inside beforeAll, not at this file's top level): this setup
// file loads before a test file's own `jest.mock(...)` calls take effect, so an
// eager top-level require here would cache `src/i18n/detectLanguage` (and its
// `expo-localization` import) against the REAL module — permanently poisoning
// any test that later mocks `expo-localization` (see detectLanguage.test.ts).
// A lazy require resolves after the test file's mocks are already registered.
// expo-localization's native module import (requireNativeModule) runs at
// import time and throws in suites where the native-module shim is disturbed
// (e.g. src/services/__tests__/notifications, liveActivity) — even though
// those suites never touch i18n themselves, the global `initI18n()` beforeAll
// below pulls detectLanguage.ts -> expo-localization eagerly. Mock it globally
// so no suite ever hits the native binding. Per-file mocks (e.g.
// detectLanguage.test.ts) still take effect for their own file — jest applies
// the closest/most specific mock.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US', regionCode: 'US' }],
  getCalendars: () => [{ uses24hourClock: false }],
}));

beforeAll(async () => {
  const { initI18n } = require('./src/i18n');
  await initI18n();
});

jest.mock('expo-sqlite/kv-store', () => {
  const m = new Map();
  return { Storage: {
    setItemSync: (k, v) => m.set(k, v),
    getItemSync: (k) => (m.has(k) ? m.get(k) : null),
    removeItemSync: (k) => m.delete(k),
    getAllKeysSync: () => [...m.keys()],
    clearSync: () => m.clear(),
  } };
});

jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), selectionAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'light' }, notificationAsync: jest.fn(() => Promise.resolve()), NotificationFeedbackType: { Success: 'success', Error: 'error' } }));

// useSafeAreaInsets throws without a <SafeAreaProvider>; screens call it directly,
// so return zero insets in tests (the rest of the package stays real).
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// expo-sqlite pulls expo-asset (not installed) through its hooks; stub it so the
// db barrel is importable in tests. Stores inject createMemoryDatabase(), so the
// real sqlite adapter (openDatabaseAsync) is never exercised under jest.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() => Promise.reject(new Error('sqlite unavailable in tests'))),
}));

// @expo/vector-icons pulls expo-font → expo-asset (not installed) at import time.
// Stub the icon set as a lightweight host component so screens using icons render
// in tests without the native asset pipeline.
jest.mock('@expo/vector-icons', () => {
  const make = (name) => {
    const Icon = () => null;
    Icon.displayName = name;
    return Icon;
  };
  return new Proxy({}, { get: (_t, key) => make(String(key)) });
});

// expo-speech-recognition requires a native module; stub it so the service
// module is importable in tests. Individual tests mock the service barrel
// (@/src/services/voice/speechRecognition) — this just prevents the
// requireNativeModule call from throwing at import time.
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    supportsOnDeviceRecognition: jest.fn(() => false),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
    start: jest.fn(),
    stop: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    getSupportedLocales: jest.fn(() => Promise.resolve({ locales: [], installedLocales: [] })),
    androidTriggerOfflineModelDownload: jest.fn(() =>
      Promise.resolve({ status: 'download_success' }),
    ),
  },
}));

// react-native-apple-llm requires a native module (iOS 26 Foundation Models);
// stub it so the adapter is importable in tests. Feature hooks mock the service
// barrel (getOnDeviceLlm) — this just prevents requireNativeModule from
// throwing at import time.
jest.mock('react-native-apple-llm', () => ({
  isFoundationModelsEnabled: jest.fn(() => Promise.resolve('unavailable')),
  AppleLLMSession: jest.fn().mockImplementation(() => ({
    configure: jest.fn(() => Promise.resolve(true)),
    generateStructuredOutput: jest.fn(() => Promise.resolve(null)),
    dispose: jest.fn(),
  })),
}));

// Patch react-native-reanimated mock: the bundled mock omits a few hooks the
// Live Timer relies on (frame callback + the derived/reaction graph). Stub them
// so components render in jest; they're UI-thread drivers with no JS effect under
// test (we assert store/router behaviour, not per-frame animation).
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.useReducedMotion = () => false;
  if (!Reanimated.useFrameCallback) {
    Reanimated.useFrameCallback = () => ({ setActive: () => {}, isActive: false });
  }
  if (!Reanimated.useDerivedValue) {
    Reanimated.useDerivedValue = (fn) => ({ value: typeof fn === 'function' ? fn() : 0 });
  }
  if (!Reanimated.useAnimatedReaction) {
    Reanimated.useAnimatedReaction = () => {};
  }
  if (!Reanimated.addWhitelistedNativeProps) {
    Reanimated.addWhitelistedNativeProps = () => {};
  }
  return Reanimated;
});
