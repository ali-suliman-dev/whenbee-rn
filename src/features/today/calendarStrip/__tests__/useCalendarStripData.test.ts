// src/features/today/calendarStrip/__tests__/useCalendarStripData.test.ts
// Tests the shared, variant-agnostic strip logic hook: week anchors, the
// selected-week index, and the select-date passthrough. Visual variants build
// on top of this — keeping the paging/store wiring here means both render the
// same correct data.

import { renderHook, act } from '@testing-library/react-native';
import {
  useCalendarStripData,
  TODAY_INDEX,
} from '../useCalendarStripData';

// Deterministic "today".
jest.mock('@/src/lib/day', () => {
  const actual = jest.requireActual<typeof import('@/src/lib/day')>('@/src/lib/day');
  return { ...actual, toLocalDayKey: (_ms: number) => '2026-06-24' };
});

const mockSelectDate = jest.fn();
const mockStoreState = {
  selectedDate: '2026-06-24',
  datesWithTasks: ['2026-06-24', '2026-06-26'],
  selectDate: mockSelectDate,
};
jest.mock('@/src/stores/dayTasksStore', () => ({
  useDayTasksStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

beforeEach(() => {
  mockSelectDate.mockClear();
  mockStoreState.selectedDate = '2026-06-24';
  mockStoreState.datesWithTasks = ['2026-06-24', '2026-06-26'];
});

test('builds 105 week anchors centered on today', () => {
  const { result } = renderHook(() => useCalendarStripData());
  expect(result.current.weekAnchors).toHaveLength(105);
  // The anchor at TODAY_INDEX is in today's week.
  expect(result.current.weekAnchors[TODAY_INDEX]).toBe('2026-06-24');
});

test('selectedWeekIndex points at the week containing the selected date', () => {
  const { result } = renderHook(() => useCalendarStripData());
  // 2026-06-24 lives in today's week → TODAY_INDEX.
  expect(result.current.selectedWeekIndex).toBe(TODAY_INDEX);
});

test('selecting a far-future date moves selectedWeekIndex forward', () => {
  mockStoreState.selectedDate = '2026-07-15'; // ~3 weeks out
  const { result } = renderHook(() => useCalendarStripData());
  expect(result.current.selectedWeekIndex).toBeGreaterThan(TODAY_INDEX);
});

test('handleSelectDate forwards the key to the store', () => {
  const { result } = renderHook(() => useCalendarStripData());
  act(() => result.current.handleSelectDate('2026-06-26'));
  expect(mockSelectDate).toHaveBeenCalledWith('2026-06-26');
});

test('datesSet reflects the store dates-with-tasks', () => {
  const { result } = renderHook(() => useCalendarStripData());
  expect(result.current.datesSet.has('2026-06-26')).toBe(true);
  expect(result.current.datesSet.has('2026-06-25')).toBe(false);
});
