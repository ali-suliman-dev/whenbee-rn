// src/features/today/calendarStrip/__tests__/variants.test.tsx
// Contract tests for both strip variants (Lens + Segment) and the selector.
// Each variant must: render 7 day buttons, mark the selected one, call selectDate
// on a different tap, and render its final state under reduced motion.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { CalendarStripLens } from '../CalendarStripLens';
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

// settingsStore is real; default stripVariant is 'segment'.

beforeEach(() => {
  mockSelectDate.mockClear();
  mockStoreState.selectedDate = '2026-06-24';
  mockStoreState.datesWithTasks = ['2026-06-24', '2026-06-26'];
});

describe.each([
  ['Lens', CalendarStripLens],
  ['Segment', CalendarStripSegment],
])('%s variant', (_name, Variant) => {
  test('renders day buttons (whole weeks of 7)', () => {
    const { getAllByRole } = render(<Variant />);
    const btns = getAllByRole('button');
    expect(btns.length).toBeGreaterThanOrEqual(7);
    expect(btns.length % 7).toBe(0); // FlatList renders N whole week pages
  });

  test('the selected cell exposes accessibilityState selected=true', () => {
    const { getAllByRole } = render(<Variant />);
    const selected = getAllByRole('button').find(
      (b) => b.props.accessibilityState?.selected === true,
    );
    expect(selected).toBeTruthy();
  });

  test('tapping a non-selected cell calls selectDate', () => {
    const { getAllByRole } = render(<Variant />);
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

  test.each([
    ['Lens', CalendarStripLens],
    ['Segment', CalendarStripSegment],
  ])('%s renders its final state with no animation', (_n, Variant) => {
    const { getAllByRole } = render(<Variant />);
    expect(getAllByRole('button').length % 7).toBe(0);
  });
});

describe('selector', () => {
  test('renders a strip (default = segment)', () => {
    const { getAllByRole } = render(<CalendarStrip />);
    const btns = getAllByRole('button');
    expect(btns.length).toBeGreaterThanOrEqual(7);
    expect(btns.length % 7).toBe(0);
  });
});
