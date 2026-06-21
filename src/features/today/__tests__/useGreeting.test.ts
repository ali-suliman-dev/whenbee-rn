import { renderHook } from '@testing-library/react-native';
import { useGreeting, shouldUseNameToday } from '../useGreeting';
import { useSettingsStore } from '@/src/stores/settingsStore';

beforeEach(() => useSettingsStore.getState().reset());

afterEach(() => jest.useRealTimers());

// --- shouldUseNameToday pure unit tests ---

it('shouldUseNameToday returns true for an even dayIndex', () => {
  expect(shouldUseNameToday(0)).toBe(true);
  expect(shouldUseNameToday(2)).toBe(true);
  expect(shouldUseNameToday(100)).toBe(true);
});

it('shouldUseNameToday returns false for an odd dayIndex', () => {
  expect(shouldUseNameToday(1)).toBe(false);
  expect(shouldUseNameToday(3)).toBe(false);
  expect(shouldUseNameToday(101)).toBe(false);
});

// --- useGreeting hook tests ---

it('returns a bare greeting with no name', () => {
  const { result } = renderHook(() => useGreeting());
  expect(result.current).toMatch(/^Good (morning|afternoon|evening)$/);
});

it('includes the name when one is set (even-day via fake timers)', () => {
  // 2026-06-22T12:00:00Z → dayIndex = floor(1782129600000 / 86400000) = 20626 (even)
  jest.useFakeTimers().setSystemTime(new Date('2026-06-22T12:00:00Z'));
  useSettingsStore.getState().setDisplayName('Ali');
  const { result } = renderHook(() => useGreeting());
  expect(result.current).toMatch(/, Ali$/);
});
