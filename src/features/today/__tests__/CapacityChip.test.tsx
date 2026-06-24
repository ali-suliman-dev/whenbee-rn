import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { CapacityChip } from '@/src/features/today/CapacityChip';
import { useDayCapacity } from '@/src/features/today/useDayCapacity';
import type { DayLoadResult } from '@/src/engine/honestDayLoad';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/src/features/today/useDayCapacity');

// useEntitlement is a Zustand store — mock the selector pattern directly.
let mockIsPro = false;
jest.mock('@/src/features/paywall/useEntitlement', () => ({
  useEntitlement: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ isPro: mockIsPro }),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockUseDayCapacity = jest.mocked(useDayCapacity);

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

function setupPro(loadOverrides: Partial<DayLoadResult> = {}) {
  mockIsPro = true;
  mockUseDayCapacity.mockReturnValue({
    status: 'ready',
    load: makeLoad(loadOverrides),
    events: [],
    allDayEvents: [],
    isPro: true,
  });
}

function setupFree() {
  mockIsPro = false;
  mockUseDayCapacity.mockReturnValue({
    status: 'off',
    load: makeLoad(),
    events: [],
    allDayEvents: [],
    isPro: false,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CapacityChip — Pro ready', () => {
  beforeEach(() => setupPro());

  it('renders the comfortable verdict "fits" in the collapsed chip', () => {
    render(<CapacityChip />);
    expect(screen.getByText(/fits/i)).toBeOnTheScreen();
  });

  it('renders "snug" when verdict is snug', () => {
    setupPro({ verdict: 'snug' });
    render(<CapacityChip />);
    expect(screen.getByText(/snug/i)).toBeOnTheScreen();
  });

  it('renders "heavy" when verdict is over', () => {
    setupPro({ verdict: 'over', overByMin: 75 });
    render(<CapacityChip />);
    expect(screen.getByText(/heavy/i)).toBeOnTheScreen();
  });

  it('expands on press to show the legend with "free"', () => {
    render(<CapacityChip />);
    // Initially collapsed — "free" not yet visible
    const chip = screen.getByTestId('capacity-chip-collapsed');
    fireEvent.press(chip);
    // After expand, "free" text should appear
    expect(screen.getByText(/free/i)).toBeOnTheScreen();
  });

  it('shows "move" copy when over but never "overdue" or "behind"', () => {
    setupPro({ verdict: 'over', overByMin: 60 });
    render(<CapacityChip />);
    // Expand first
    const chip = screen.getByTestId('capacity-chip-collapsed');
    fireEvent.press(chip);
    expect(screen.getByText(/move/i)).toBeOnTheScreen();
    expect(screen.queryByText(/overdue/i)).toBeNull();
    expect(screen.queryByText(/behind/i)).toBeNull();
  });

  it('does NOT render "failed" copy anywhere', () => {
    setupPro({ verdict: 'over', overByMin: 120 });
    render(<CapacityChip />);
    expect(screen.queryByText(/failed/i)).toBeNull();
  });
});

describe('CapacityChip — Free user', () => {
  beforeEach(() => setupFree());

  it('renders the teaser "will fit"', () => {
    render(<CapacityChip />);
    expect(screen.getByText(/will fit/i)).toBeOnTheScreen();
  });

  it('renders the "Pro" pill', () => {
    render(<CapacityChip />);
    expect(screen.getByText('Pro')).toBeOnTheScreen();
  });

  it('does NOT render the honest-day number text', () => {
    render(<CapacityChip />);
    // The chip text should NOT contain "Honest day" or the time display (e.g. "2h")
    expect(screen.queryByTestId('capacity-chip-collapsed')).toBeNull();
  });

  it('does NOT render the bar/legend container', () => {
    render(<CapacityChip />);
    expect(screen.queryByTestId('capacity-bar')).toBeNull();
    expect(screen.queryByText(/free/i)).toBeNull();
  });

  it('routes to paywall with day_capacity trigger on press', () => {
    const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
    render(<CapacityChip />);
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
    mockUseDayCapacity.mockReturnValue({
      status: 'denied',
      load: makeLoad({ eventMin: 0 }),
      events: [],
      allDayEvents: [],
      isPro: true,
    });
    render(<CapacityChip />);
    // Still shows a collapsed chip for Pro users even when denied
    expect(screen.getByTestId('capacity-chip-collapsed')).toBeOnTheScreen();
  });

  it('shows task-only load when status is off', () => {
    mockIsPro = true;
    mockUseDayCapacity.mockReturnValue({
      status: 'off',
      load: makeLoad({ eventMin: 0 }),
      events: [],
      allDayEvents: [],
      isPro: true,
    });
    render(<CapacityChip />);
    expect(screen.getByTestId('capacity-chip-collapsed')).toBeOnTheScreen();
  });
});
