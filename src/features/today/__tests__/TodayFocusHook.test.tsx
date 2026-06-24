import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TodayFocusHook } from '../TodayFocusHook';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { router } from 'expo-router';

jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: jest.fn(),
}));

// Entitlement mock — overridden per-test via mockEntitlement
let mockIsPro = false;
jest.mock('@/src/features/paywall/useEntitlement', () => ({
  useEntitlement: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ isPro: mockIsPro }),
}));

jest.mock('@/src/stores/dayTasksStore', () => ({
  useDayTasksStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ dayTasks: [{ id: '1', status: 'queued', carriedFrom: null }] }),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// windowEndMin is undefined so the gate falls back to the window's own endMin
jest.mock('@/src/stores/settingsStore', () => ({
  useSettingsStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ colorMode: 'light', windowStartMin: undefined, windowEndMin: undefined }),
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const PRIOR_WINDOW = {
  startMin: 540,
  endMin: 690,
  basis: 'prior' as const,
  confidence: 0.3,
  scoreByBin: new Array(38).fill(0.3),
  sampleCount: 5,
  distinctDays: 3,
  held: false,
};

/** Personal window 9am–11am */
const PERSONAL_WINDOW = {
  startMin: 540, // 9:00 am
  endMin: 660,   // 11:00 am
  basis: 'personal' as const,
  confidence: 0.8,
  scoreByBin: new Array(38).fill(0.5),
  sampleCount: 20,
  distinctDays: 12,
  held: false,
};

// nowMs = midnight (0) → minute-of-day = 0, well before 11am end
const NOW_BEFORE_WINDOW_END = 0;
// nowMs at 11:01am, past the 11am end
const NOW_AFTER_WINDOW_END = new Date().setHours(11, 1, 0, 0) - new Date().setHours(0, 0, 0, 0);

beforeEach(() => {
  mockIsPro = false;
  jest.clearAllMocks();
});

// ── gate tests ────────────────────────────────────────────────────────────────

test('renders null when window basis is prior (not personal)', () => {
  jest.mocked(useLearnedFocusWindow).mockReturnValue(PRIOR_WINDOW);
  const { toJSON } = render(<TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />);
  expect(toJSON()).toBeNull();
});

test('renders null after the window end time has passed', () => {
  jest.mocked(useLearnedFocusWindow).mockReturnValue(PERSONAL_WINDOW);
  // PERSONAL_WINDOW endMin=660 (11am). Use a real Date at 11:05am so
  // minute-of-day = 665 > 660. No windowEndMin override in the mock.
  const today = new Date();
  today.setHours(11, 5, 0, 0);
  const { toJSON } = render(<TodayFocusHook nowMs={today.getTime()} />);
  expect(toJSON()).toBeNull();
});

// ── Pro path ──────────────────────────────────────────────────────────────────

test('Pro: renders the times and "hard tasks" copy', () => {
  mockIsPro = true;
  jest.mocked(useLearnedFocusWindow).mockReturnValue(PERSONAL_WINDOW);
  const { getByText, queryByText } = render(
    <TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />,
  );
  // The insight text must include the time range
  expect(getByText(/9:00am/i)).toBeTruthy();
  expect(getByText(/11:00am/i)).toBeTruthy();
  // Must include "hard tasks" — regression for the render gate
  expect(getByText(/hard tasks/i)).toBeTruthy();
  // Must NOT show the Pro pill (already Pro)
  expect(queryByText(/\bPro\b/)).toBeNull();
});

test('Pro: tap routes to Patterns tab, not Plan', () => {
  mockIsPro = true;
  jest.mocked(useLearnedFocusWindow).mockReturnValue(PERSONAL_WINDOW);
  const { getByRole } = render(<TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />);
  fireEvent.press(getByRole('button'));
  expect(router.push).toHaveBeenCalledWith('/(tabs)/patterns');
  expect(router.push).not.toHaveBeenCalledWith(
    expect.stringContaining('/plan'),
  );
});

// ── Free path ─────────────────────────────────────────────────────────────────

test('Free: renders teaser copy without times', () => {
  mockIsPro = false;
  jest.mocked(useLearnedFocusWindow).mockReturnValue(PERSONAL_WINDOW);
  const { getByText, queryByText } = render(
    <TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />,
  );
  // Must show teaser label
  expect(getByText(/focus window is ready/i)).toBeTruthy();
  // NEVER shows the actual times for free users
  expect(queryByText(/9:00am/i)).toBeNull();
  expect(queryByText(/11:00am/i)).toBeNull();
  // Must show the Pro pill
  expect(getByText(/\bPro\b/)).toBeTruthy();
});

test('Free: tap routes to paywall with trigger focus_window', () => {
  mockIsPro = false;
  jest.mocked(useLearnedFocusWindow).mockReturnValue(PERSONAL_WINDOW);
  const { getByRole } = render(<TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />);
  fireEvent.press(getByRole('button'));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/(modals)/paywall',
    params: { trigger: 'focus_window' },
  });
});

// ── Render regression: visual text actually appears ───────────────────────────

test('Pro: the row renders visible text (regression for function-form Pressable style bug)', () => {
  // The old TodayFocusHook used style={({pressed})=>…} on Pressable — reactCompiler
  // silently renders nothing because it strips function-form styles. This test
  // asserts that the rendered tree actually contains a Text node (not null/empty).
  mockIsPro = true;
  jest.mocked(useLearnedFocusWindow).mockReturnValue(PERSONAL_WINDOW);
  const { toJSON } = render(<TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />);
  const json = JSON.stringify(toJSON());
  // A rendered tree with visible text nodes is not null and has children
  expect(toJSON()).not.toBeNull();
  expect(json).toContain('hard tasks');
});
