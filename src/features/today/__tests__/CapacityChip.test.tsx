import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { CapacityChip } from '@/src/features/today/CapacityChip';
import type { DayCapacityResult } from '@/src/features/today/useDayCapacity';
import type { DayLoadResult } from '@/src/engine/honestDayLoad';

// ── Mocks ────────────────────────────────────────────────────────────────────

// useEntitlement is a Zustand store — mock the selector pattern directly.
let mockIsPro = false;
jest.mock('@/src/features/paywall/useEntitlement', () => ({
  useEntitlement: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ isPro: mockIsPro }),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// ── Helpers ──────────────────────────────────────────────────────────────────

// Stub useReducedMotion (returns false = animations run, no effect in tests)
let reducedMotionSpy: jest.SpyInstance;
beforeEach(() => {
  reducedMotionSpy = jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(false);
});
afterEach(() => {
  reducedMotionSpy.mockRestore?.();
});

function makeLoad(overrides: Partial<DayLoadResult> = {}): DayLoadResult {
  return {
    taskMin: 120,
    eventMin: 60,
    committedMin: 180,
    freeMin: 540,
    verdict: 'comfortable',
    overByMin: 0,
    ...overrides,
  };
}

function makeCap(
  loadOverrides: Partial<DayLoadResult> = {},
  partial: Partial<DayCapacityResult> = {},
): DayCapacityResult {
  return {
    status: 'ready',
    load: makeLoad(loadOverrides),
    events: [],
    allDayEvents: [],
    isPro: true,
    ...partial,
  };
}

function setupPro(loadOverrides: Partial<DayLoadResult> = {}): DayCapacityResult {
  mockIsPro = true;
  return makeCap(loadOverrides);
}

function setupFree(): DayCapacityResult {
  mockIsPro = false;
  return makeCap({}, { status: 'off', isPro: false });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CapacityChip — Pro ready', () => {
  it('renders the comfortable verdict "fits" in the collapsed chip', () => {
    render(<CapacityChip cap={setupPro()} />);
    expect(screen.getByText(/fits/i)).toBeOnTheScreen();
  });

  it('renders "snug" when verdict is snug', () => {
    render(<CapacityChip cap={setupPro({ verdict: 'snug' })} />);
    expect(screen.getByText(/snug/i)).toBeOnTheScreen();
  });

  it('renders "heavy" when verdict is over', () => {
    render(<CapacityChip cap={setupPro({ verdict: 'over', overByMin: 75 })} />);
    expect(screen.getByText(/heavy/i)).toBeOnTheScreen();
  });

  it('expands on press to show the legend with "free"', () => {
    render(<CapacityChip cap={setupPro()} />);
    // Initially collapsed — "free" not yet visible
    const chip = screen.getByTestId('capacity-chip-collapsed');
    fireEvent.press(chip);
    // After expand, "free" text should appear
    expect(screen.getByText(/free/i)).toBeOnTheScreen();
  });

  it('shows "move" copy when over but never "overdue" or "behind"', () => {
    render(<CapacityChip cap={setupPro({ verdict: 'over', overByMin: 60 })} />);
    // Expand first
    const chip = screen.getByTestId('capacity-chip-collapsed');
    fireEvent.press(chip);
    expect(screen.getByText(/move/i)).toBeOnTheScreen();
    expect(screen.queryByText(/overdue/i)).toBeNull();
    expect(screen.queryByText(/behind/i)).toBeNull();
  });

  it('does NOT render "failed" copy anywhere', () => {
    render(<CapacityChip cap={setupPro({ verdict: 'over', overByMin: 120 })} />);
    expect(screen.queryByText(/failed/i)).toBeNull();
  });

  it('shows "Pad my calendar" link in expanded state (the write surface CTA)', () => {
    render(<CapacityChip cap={setupPro()} />);
    const chip = screen.getByTestId('capacity-chip-collapsed');
    fireEvent.press(chip);
    expect(screen.getByText(/pad my calendar/i)).toBeOnTheScreen();
  });
});

describe('CapacityChip — Free user', () => {
  it('renders the teaser "will fit"', () => {
    render(<CapacityChip cap={setupFree()} />);
    expect(screen.getByText(/will fit/i)).toBeOnTheScreen();
  });

  it('renders the "Pro" pill', () => {
    render(<CapacityChip cap={setupFree()} />);
    expect(screen.getByText('Pro')).toBeOnTheScreen();
  });

  it('does NOT render the honest-day number text', () => {
    render(<CapacityChip cap={setupFree()} />);
    // The chip text should NOT contain "Honest day" or the time display (e.g. "2h")
    expect(screen.queryByTestId('capacity-chip-collapsed')).toBeNull();
  });

  it('does NOT render the bar/legend container', () => {
    render(<CapacityChip cap={setupFree()} />);
    expect(screen.queryByTestId('capacity-bar')).toBeNull();
    expect(screen.queryByText(/free/i)).toBeNull();
  });

  it('does NOT render the "Pad my calendar" write link (Pro-only write surface)', () => {
    render(<CapacityChip cap={setupFree()} />);
    expect(screen.queryByText(/pad my calendar/i)).toBeNull();
  });

  it('does NOT render any capacity number in the accessible output', () => {
    render(<CapacityChip cap={setupFree()} />);
    // The collapsed chip with testID "capacity-chip-collapsed" must be absent
    expect(screen.queryByTestId('capacity-chip-collapsed')).toBeNull();
    // "Honest day" prefix must not appear (the number is right after it)
    expect(screen.queryByText(/honest day/i)).toBeNull();
  });

  it('routes to paywall with day_capacity trigger on press', () => {
    const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
    render(<CapacityChip cap={setupFree()} />);
    const teaser = screen.getByTestId('capacity-teaser');
    fireEvent.press(teaser);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(modals)/paywall',
      params: { trigger: 'day_capacity' },
    });
  });
});

describe('CapacityChip — Pro denied/off', () => {
  it('shows task-only load when status is denied', () => {
    mockIsPro = true;
    const cap = makeCap({ eventMin: 0 }, { status: 'denied' });
    render(<CapacityChip cap={cap} />);
    // Still shows a collapsed chip for Pro users even when denied
    expect(screen.getByTestId('capacity-chip-collapsed')).toBeOnTheScreen();
  });

  it('shows task-only load when status is off', () => {
    mockIsPro = true;
    const cap = makeCap({ eventMin: 0 }, { status: 'off' });
    render(<CapacityChip cap={cap} />);
    expect(screen.getByTestId('capacity-chip-collapsed')).toBeOnTheScreen();
  });
});
