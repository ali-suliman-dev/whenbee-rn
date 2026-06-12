/* eslint-disable no-undef */
const matchers = require('@testing-library/react-native/matchers');
expect.extend(matchers);

jest.mock('expo-sqlite/kv-store', () => {
  const m = new Map();
  return { Storage: {
    setItemSync: (k, v) => m.set(k, v),
    getItemSync: (k) => (m.has(k) ? m.get(k) : null),
    removeItemSync: (k) => m.delete(k),
  } };
});

jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'light' }, notificationAsync: jest.fn(() => Promise.resolve()), NotificationFeedbackType: { Success: 'success', Error: 'error' } }));

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

// Patch react-native-reanimated mock: add useReducedMotion (not included by default)
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.useReducedMotion = () => false;
  return Reanimated;
});
