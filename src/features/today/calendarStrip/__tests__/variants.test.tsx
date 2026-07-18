// src/features/today/calendarStrip/__tests__/variants.test.tsx
// Contract tests for the calendar strip. The Segment variant must: render 7 day
// buttons, mark the selected one, call selectDate on a different tap, and render
// its final state under reduced motion. CalendarStrip re-exports Segment.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { CalendarStripSegment } from '../CalendarStripSegment';
import { CalendarStrip } from '../CalendarStrip';

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
  useDayTasksStore: (selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

beforeEach(() => {
  mockSelectDate.mockClear();
  mockStoreState.selectedDate = '2026-06-24';
  mockStoreState.datesWithTasks = ['2026-06-24', '2026-06-26'];
});

describe('Segment variant', () => {
  test('renders day buttons (whole weeks of 7)', () => {
    const { getAllByRole } = render(<CalendarStripSegment />);
    const btns = getAllByRole('button');
    expect(btns.length).toBeGreaterThanOrEqual(7);
    expect(btns.length % 7).toBe(0); // FlatList renders N whole week pages
  });

  test('the selected cell exposes accessibilityState selected=true', () => {
    const { getAllByRole } = render(<CalendarStripSegment />);
    const selected = getAllByRole('button').find(
      (b) => b.props.accessibilityState?.selected === true,
    );
    expect(selected).toBeTruthy();
  });

  test('tapping a non-selected cell calls selectDate', () => {
    const { getAllByRole } = render(<CalendarStripSegment />);
    const other = getAllByRole('button').find(
      (b) => b.props.accessibilityState?.selected !== true,
    );
    expect(other).toBeTruthy();
    fireEvent.press(other!);
    expect(mockSelectDate).toHaveBeenCalledTimes(1);
    expect(mockSelectDate).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});

describe('reduced motion', () => {
  beforeAll(() => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
  });
  afterAll(() => jest.restoreAllMocks());

  test('Segment renders its final state with no animation', () => {
    const { getAllByRole } = render(<CalendarStripSegment />);
    expect(getAllByRole('button').length % 7).toBe(0);
  });
});

describe('CalendarStrip', () => {
  test('renders a strip', () => {
    const { getAllByRole } = render(<CalendarStrip />);
    const btns = getAllByRole('button');
    expect(btns.length).toBeGreaterThanOrEqual(7);
    expect(btns.length % 7).toBe(0);
  });
});
