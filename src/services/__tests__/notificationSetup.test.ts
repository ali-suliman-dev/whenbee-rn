// src/services/__tests__/notificationSetup.test.ts
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => null })); // no native module
jest.mock('@/src/lib/isExpoGo', () => ({ isExpoGo: true }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// eslint-disable-next-line import/first
import { initNotifications } from '@/src/services/notificationSetup';

it('returns a noop cleanup when the native module is absent, without throwing', () => {
  const cleanup = initNotifications();
  expect(typeof cleanup).toBe('function');
  expect(() => cleanup()).not.toThrow();
});
