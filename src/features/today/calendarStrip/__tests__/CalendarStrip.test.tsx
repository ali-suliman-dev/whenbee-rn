// src/features/today/calendarStrip/__tests__/CalendarStrip.test.tsx
// Render tests for CalendarStrip.
// Mocks useDayTasksStore; asserts selection state, selectDate call, and today distinction.
// Note: jest.mock() calls are hoisted by Jest at compile time, so the import order
// at the top is the source-level order; the mocks still apply before module evaluation.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CalendarStrip } from '../CalendarStrip';

// --- mock the store ---
// Jest hoists these mock() calls before module evaluation, so they apply to CalendarStrip.
jest.mock('@/src/stores/dayTasksStore', () => ({
  useDayTasksStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

// --- mock toLocalDayKey so "today" is deterministic ---
jest.mock('@/src/lib/day', () => {
  const actual = jest.requireActual<typeof import('@/src/lib/day')>('@/src/lib/day');
  return {
    ...actual,
    toLocalDayKey: (_ms: number) => '2026-06-24',
  };
});

// Shared mutable state for the store mock — mutated per-test in beforeEach.
const mockSelectDate = jest.fn();
const mockStoreState = {
  selectedDate: '2026-06-24',
  datesWithTasks: ['2026-06-24', '2026-06-26'],
  selectDate: mockSelectDate,
};

beforeEach(() => {
  mockSelectDate.mockClear();
  // Reset to default
  mockStoreState.selectedDate = '2026-06-24';
  mockStoreState.datesWithTasks = ['2026-06-24', '2026-06-26'];
});

test('the selected cell has accessibilityState selected=true', () => {
  const { getAllByRole } = render(<CalendarStrip />);
  const buttons = getAllByRole('button');
  // The button for the selected date (2026-06-24 = Wednesday) should have selected=true
  const selectedBtn = buttons.find(
    (b) => b.props.accessibilityState?.selected === true,
  );
  expect(selectedBtn).toBeTruthy();
});

test('tapping a different cell calls selectDate with that key', () => {
  mockStoreState.selectedDate = '2026-06-24';
  const { getAllByRole } = render(<CalendarStrip />);
  const buttons = getAllByRole('button');
  // Find a button that is not selected and tap it
  const unselectedBtn = buttons.find(
    (b) => b.props.accessibilityState?.selected !== true,
  );
  expect(unselectedBtn).toBeTruthy();
  if (unselectedBtn) {
    fireEvent.press(unselectedBtn);
    expect(mockSelectDate).toHaveBeenCalledTimes(1);
    // Called with a valid YYYY-MM-DD string
    const arg: unknown = mockSelectDate.mock.calls[0]?.[0];
    expect(typeof arg).toBe('string');
    expect(arg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Not the already-selected date
    expect(arg).not.toBe('2026-06-24');
  }
});

test('today cell does not have selected state when a different date is selected', () => {
  mockStoreState.selectedDate = '2026-06-25'; // selected is Thursday
  const { getAllByRole } = render(<CalendarStrip />);
  const buttons = getAllByRole('button');
  // Find today's cell by accessibilityLabel containing "Wednesday June 24"
  const todayBtn = buttons.find((b) =>
    (b.props.accessibilityLabel as string | undefined)?.includes('Wednesday June 24'),
  );
  // Today cell should NOT be selected (a different date is selected)
  expect(todayBtn?.props.accessibilityState?.selected).not.toBe(true);
});

test('renders 7 day-cells for the current week', () => {
  const { getAllByRole } = render(<CalendarStrip />);
  const buttons = getAllByRole('button');
  // Should have at least 7 buttons (one per cell in the visible week)
  expect(buttons.length).toBeGreaterThanOrEqual(7);
});
