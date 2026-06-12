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

// Patch react-native-reanimated mock: add useReducedMotion (not included by default)
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.useReducedMotion = () => false;
  return Reanimated;
});
