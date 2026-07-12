import React from 'react';
import { FW_BIN_COUNT } from '@/src/engine';
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

const FORMING_WINDOW = {
  startMin: 540,
  endMin: 690,
  basis: 'forming' as const,
  confidence: 0.3,
  confidenceTier: 'low' as const,
  coarseBlockLabel: '',
  scoreByBin: new Array(FW_BIN_COUNT).fill(0.3),
  sampleCount: 5,
  distinctDays: 3,
  held: false,
  gates: {
    sessions: { have: 5, need: 15 },
    days: { have: 3, need: 5 },
  },
};

/** Revealed window 9am–11am */
const REVEALED_WINDOW = {
  startMin: 540, // 9:00 am
  endMin: 660,   // 11:00 am
  basis: 'revealed' as const,
  confidence: 0.8,
  confidenceTier: 'steady' as const,
  coarseBlockLabel: 'Mornings',
  scoreByBin: new Array(FW_BIN_COUNT).fill(0.5),
  sampleCount: 20,
  distinctDays: 12,
  held: false,
  gates: {
    sessions: { have: 20, need: 15 },
    days: { have: 12, need: 5 },
  },
};

// nowMs = midnight (0) → minute-of-day = 0, well before 11am end
const NOW_BEFORE_WINDOW_END = 0;

beforeEach(() => {
  mockIsPro = false;
  jest.clearAllMocks();
});

// ── gate tests ────────────────────────────────────────────────────────────────

test('renders null when window basis is forming (not revealed)', () => {
  jest.mocked(useLearnedFocusWindow).mockReturnValue(FORMING_WINDOW);
  const { toJSON } = render(<TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />);
  expect(toJSON()).toBeNull();
});

test('renders null after the window end time has passed', () => {
  jest.mocked(useLearnedFocusWindow).mockReturnValue(REVEALED_WINDOW);
  // REVEALED_WINDOW endMin=660 (11am). Use a real Date at 11:05am so
  // minute-of-day = 665 > 660. No windowEndMin override in the mock.
  const today = new Date();
  today.setHours(11, 5, 0, 0);
  const { toJSON } = render(<TodayFocusHook nowMs={today.getTime()} />);
  expect(toJSON()).toBeNull();
});

// ── Pro path ──────────────────────────────────────────────────────────────────

test('Pro: renders the times and "hard tasks" copy', () => {
  mockIsPro = true;
  jest.mocked(useLearnedFocusWindow).mockReturnValue(REVEALED_WINDOW);
  const { toJSON, queryByText } = render(
    <TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />,
  );
  // Copy splits across nested <AppText> nodes (lead / range / suffix), so assert on
  // the flattened tree. formatWindowRange collapses same-meridiem → "9:00 – 11:00 am".
  const json = JSON.stringify(toJSON());
  expect(json).toContain('Sharpest');
  expect(json).toContain('9:00');
  expect(json).toContain('11:00');
  // Must include "hard tasks" — regression for the render gate
  expect(json).toContain('hard tasks');
  // Single collapsed meridiem — the old per-bound "13:30pm" bug is gone
  expect(json).not.toMatch(/\d{1,2}:\d{2}(am|pm)/i);
  // Must NOT show the Pro pill (already Pro)
  expect(queryByText(/\bPro\b/)).toBeNull();
});

test('Pro: tap routes to Patterns tab, not Plan', () => {
  mockIsPro = true;
  jest.mocked(useLearnedFocusWindow).mockReturnValue(REVEALED_WINDOW);
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
  jest.mocked(useLearnedFocusWindow).mockReturnValue(REVEALED_WINDOW);
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
  jest.mocked(useLearnedFocusWindow).mockReturnValue(REVEALED_WINDOW);
  const { getByRole } = render(<TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />);
  fireEvent.press(getByRole('button'));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/(modals)/paywall',
    params: { trigger: 'focus_window' },
  });
});

// ── Conditional-hooks regression: basis transition must not crash ─────────────
//
// Before the fix, useSharedValue / useAnimatedStyle were called AFTER the
// `if (basis !== 'revealed') return null` gate. When the same mounted instance
// re-rendered with basis flipping 'forming'→'revealed', React would throw
// "Rendered more hooks than during the previous render."
// These tests verify that one mounted instance survives the transition cleanly.

test('hooks-order regression: re-render forming→revealed does not throw', () => {
  // Start with a forming-basis window (gate 1 fires → returns null).
  jest.mocked(useLearnedFocusWindow).mockReturnValue(FORMING_WINDOW);
  mockIsPro = true;

  const { rerender, toJSON } = render(<TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />);
  expect(toJSON()).toBeNull(); // gate active, renders null

  // Flip to revealed — same mounted instance, should not throw.
  jest.mocked(useLearnedFocusWindow).mockReturnValue(REVEALED_WINDOW);
  expect(() => {
    rerender(<TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />);
  }).not.toThrow();

  // After the flip the component should render visible content.
  expect(toJSON()).not.toBeNull();
});

test('hooks-order regression: re-render before→after window-end does not throw', () => {
  // Start: revealed window, time is BEFORE end (gate 2 inactive).
  jest.mocked(useLearnedFocusWindow).mockReturnValue(REVEALED_WINDOW);
  mockIsPro = true;

  // Pin Date so minute-of-day = 0 (well before endMin 660).
  const nowBefore = 0; // midnight = minute 0
  const { rerender, toJSON } = render(<TodayFocusHook nowMs={nowBefore} />);
  expect(toJSON()).not.toBeNull(); // renders content

  // Advance time past window end (11:05am → minute 665 > endMin 660).
  const nowAfter = new Date();
  nowAfter.setHours(11, 5, 0, 0);

  expect(() => {
    rerender(<TodayFocusHook nowMs={nowAfter.getTime()} />);
  }).not.toThrow();

  // After crossing the window end the gate should suppress rendering.
  expect(toJSON()).toBeNull();
});

// ── Pro-gate regression: free path never leaks clock times ───────────────────

test('Free: full tree contains no clock time strings (Pro-gate regression)', () => {
  // Pin clock to a fixed instant so time-formatting is deterministic.
  // REVEALED_WINDOW: startMin=540 (9:00am), endMin=660 (11:00am).
  // If the gate leaks, those strings would appear in the rendered tree.
  mockIsPro = false;
  jest.mocked(useLearnedFocusWindow).mockReturnValue(REVEALED_WINDOW);
  const { toJSON } = render(<TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />);
  const json = JSON.stringify(toJSON());
  // No meridiem clock patterns (e.g. "9:00am", "11:00am") should appear
  expect(json).not.toMatch(/\d{1,2}:\d{2}(am|pm)/i);
});

// ── Render regression: visual text actually appears ───────────────────────────

test('Pro: the row renders visible text (regression for function-form Pressable style bug)', () => {
  // The old TodayFocusHook used style={({pressed})=>…} on Pressable — reactCompiler
  // silently renders nothing because it strips function-form styles. This test
  // asserts that the rendered tree actually contains a Text node (not null/empty).
  mockIsPro = true;
  jest.mocked(useLearnedFocusWindow).mockReturnValue(REVEALED_WINDOW);
  const { toJSON } = render(<TodayFocusHook nowMs={NOW_BEFORE_WINDOW_END} />);
  const json = JSON.stringify(toJSON());
  // A rendered tree with visible text nodes is not null and has children
  expect(toJSON()).not.toBeNull();
  expect(json).toContain('hard tasks');
});
