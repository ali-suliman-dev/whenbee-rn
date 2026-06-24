import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { FocusPatternsCard } from '../FocusPatternsCard';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { LearnedFocusWindow } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// FocusPatternsCard tests
//
// Three paths tested:
//  1. Pro + personal window — full curve, window range, maturity, no task-packing
//  2. Free + personal window — locked teaser, no window times, → paywall
//  3. Pro + forming (basis 'prior') — maturity progress shown, no personal window
// ──────────────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: jest.fn(),
}));

jest.mock('@/src/features/paywall/useEntitlement', () => ({
  useEntitlement: jest.fn(),
}));

// FocusWindowEditorSheet uses Modal — just render null so tests don't need a
// real native layer.
jest.mock('@/src/features/planner/FocusWindowEditorSheet', () => ({
  FocusWindowEditorSheet: () => null,
}));

// FocusCurve renders an SVG — replace with a testID so assertions don't depend
// on SVG internals.
jest.mock('@/src/features/planner/FocusCurve', () => ({
  FocusCurve: ({ variant }: { variant: string }) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return <View testID={`focus-curve-${variant}`} />;
  },
}));

const BINS = Array(38).fill(0.5);

/** Shorthand: set the mock return value for useLearnedFocusWindow. */
function mockWindow(overrides: Partial<LearnedFocusWindow>) {
  const base: LearnedFocusWindow = {
    basis: 'personal',
    startMin: 540,   // 9:00am
    endMin: 690,     // 11:30am
    scoreByBin: BINS,
    sampleCount: 20,
    distinctDays: 10,
    confidence: 0.9,
    held: false,
  };
  (useLearnedFocusWindow as unknown as jest.Mock).mockReturnValue({ ...base, ...overrides });
}

/** Shorthand: set the mock return value for useEntitlement. */
function mockEntitlement(isPro: boolean) {
  (useEntitlement as unknown as jest.Mock).mockImplementation((sel: (s: { isPro: boolean }) => unknown) =>
    sel({ isPro }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FocusPatternsCard', () => {
  describe('Pro + personal window', () => {
    beforeEach(() => {
      mockWindow({ basis: 'personal', startMin: 540, endMin: 690, sampleCount: 20 });
      mockEntitlement(true);
    });

    it('renders the focus curve', () => {
      render(<FocusPatternsCard />);
      expect(screen.getByTestId('focus-curve-learned')).toBeTruthy();
    });

    it('renders the learned window range', () => {
      render(<FocusPatternsCard />);
      expect(screen.getByTestId('focus-window-range')).toBeTruthy();
    });

    it('renders the maturity line with session count', () => {
      render(<FocusPatternsCard />);
      expect(screen.getByTestId('focus-maturity')).toBeTruthy();
      expect(screen.getByText(/20 sessions/)).toBeTruthy();
    });

    it('does NOT render task-packing text', () => {
      render(<FocusPatternsCard />);
      expect(screen.queryByText(/fits/i)).toBeNull();
      expect(screen.queryByText(/spill/i)).toBeNull();
    });

    it('does NOT render the locked teaser', () => {
      render(<FocusPatternsCard />);
      expect(screen.queryByText(/Unlock my focus window/i)).toBeNull();
    });
  });

  describe('Free + personal window', () => {
    beforeEach(() => {
      mockWindow({ basis: 'personal', startMin: 540, endMin: 690, sampleCount: 20 });
      mockEntitlement(false);
    });

    it('renders the locked teaser, not the window times', () => {
      render(<FocusPatternsCard />);
      expect(screen.getByTestId('focus-locked-teaser')).toBeTruthy();
      // Window times must NOT be shown to free users
      expect(screen.queryByTestId('focus-window-range')).toBeNull();
    });

    it('shows the Unlock CTA', () => {
      render(<FocusPatternsCard />);
      expect(screen.getByText(/Unlock my focus window/i)).toBeTruthy();
    });

    it('routes to the paywall with trigger focus_window on CTA press', () => {
      render(<FocusPatternsCard />);
      fireEvent.press(screen.getByText(/Unlock my focus window/i));
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/(modals)/paywall',
        params: { trigger: 'focus_window' },
      });
    });

    it('renders the locked curve variant (not the learned curve)', () => {
      render(<FocusPatternsCard />);
      expect(screen.getByTestId('focus-curve-locked')).toBeTruthy();
      expect(screen.queryByTestId('focus-curve-learned')).toBeNull();
    });

    it('full tree contains no clock time strings (Pro-gate regression)', () => {
      // startMin=540 (9:00am), endMin=690 (11:30am). If the gate leaks, those
      // meridiem strings would appear anywhere in the rendered tree.
      const { toJSON } = render(<FocusPatternsCard />);
      const json = JSON.stringify(toJSON());
      expect(json).not.toMatch(/\d{1,2}:\d{2}(am|pm)/i);
    });
  });

  describe('Pro + forming (basis prior)', () => {
    beforeEach(() => {
      // forming: startMin/endMin fall back to the prior window defaults (540/690),
    // but basis === 'prior' is the controlling signal — the card shows progress, not the range.
    mockWindow({ basis: 'prior', startMin: 540, endMin: 690, sampleCount: 8 });
      mockEntitlement(true);
    });

    it('renders the forming curve', () => {
      render(<FocusPatternsCard />);
      expect(screen.getByTestId('focus-curve-forming')).toBeTruthy();
    });

    it('shows maturity progress (X / 15 sessions), not a personal window', () => {
      render(<FocusPatternsCard />);
      expect(screen.getByTestId('focus-maturity')).toBeTruthy();
      expect(screen.getByText(/8 \/ 15 sessions/)).toBeTruthy();
    });

    it('does NOT show a window range when forming', () => {
      render(<FocusPatternsCard />);
      expect(screen.queryByTestId('focus-window-range')).toBeNull();
    });
  });
});
