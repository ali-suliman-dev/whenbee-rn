import { renderHook } from '@testing-library/react-native';
import { useGreeting, shouldUseName } from '../useGreeting';
import { useSettingsStore } from '@/src/stores/settingsStore';

beforeEach(() => useSettingsStore.getState().reset());

afterEach(() => jest.useRealTimers());

// --- shouldUseName pure unit tests ---

it('shouldUseName returns true for an even dayIndex', () => {
  expect(shouldUseName(0)).toBe(true);
  expect(shouldUseName(2)).toBe(true);
  expect(shouldUseName(100)).toBe(true);
});

it('shouldUseName returns false for an odd dayIndex', () => {
  expect(shouldUseName(1)).toBe(false);
  expect(shouldUseName(3)).toBe(false);
  expect(shouldUseName(101)).toBe(false);
});

// --- useGreeting hook tests ---

it('returns a bare greeting with no name', () => {
  const { result } = renderHook(() => useGreeting());
  expect(result.current).toMatch(/^Good (morning|afternoon|evening)$/);
});

it('includes the name when one is set (even-day via fake timers)', () => {
  // 2026-06-22 dayIndex = floor(1750550400000 / 86400000) = 20260 (even)
  jest.useFakeTimers().setSystemTime(new Date('2026-06-22T09:00:00'));
  useSettingsStore.getState().setDisplayName('Ali');
  const { result } = renderHook(() => useGreeting());
  expect(result.current).toMatch(/, Ali$/);
});
