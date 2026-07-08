/* eslint-disable no-undef */
// Mocks the native RNGestureHandlerModule so any real GestureHandlerRootView
// (e.g. the plan sheet, FinishEditorSheet) can mount under jest without
// invoking a native install() call. Required as soon as gesture-handler is
// imported anywhere in the tree, so it must load before test files render.
require('react-native-gesture-handler/jestSetup');

const matchers = require('@testing-library/react-native/matchers');
expect.extend(matchers);

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
  // react-native-reorderable-list composes its internal scroll handler with an
  // optional caller-provided one via useComposedEventHandler; the bundled mock
  // doesn't implement it. A no-op stub is sufficient — no scroll events fire
  // under jsdom/react-test-renderer, so this is a UI-thread driver with no JS
  // effect under test (same rationale as the other stubs above).
  if (!Reanimated.useComposedEventHandler) {
    Reanimated.useComposedEventHandler = () => null;
  }
  // react-native-reorderable-list wires its FlatList ref through useAnimatedRef
  // and calls it as a function (`flatListRef(value)`) to attach the node. The
  // bundled mock's useAnimatedRef returns a plain `{ current: null }` object
  // (not callable) — real Reanimated returns a callable ref-function with a
  // `.current` property. Override unconditionally to match that shape.
  // Measurement (`measure(flatListRef)`) only ever runs inside runOnUI, which
  // the mock already no-ops, so a real layout measurement is never needed
  // under test.
  Reanimated.useAnimatedRef = () => {
    const ref = (node) => {
      ref.current = node;
    };
    ref.current = null;
    return ref;
  };
  return Reanimated;
});
