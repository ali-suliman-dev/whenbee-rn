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
    openMin: 420,
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

function setupFree(loadOverrides: Partial<DayLoadResult> = {}): DayCapacityResult {
  mockIsPro = false;
  // Free users have no calendar → task-only load (eventMin 0).
  return makeCap({ eventMin: 0, ...loadOverrides }, { status: 'off', isPro: false });
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

  it('expands on press to show the honest "open" leftover', () => {
    render(<CapacityChip cap={setupPro()} />);
    const chip = screen.getByTestId('capacity-chip-collapsed');
    fireEvent.press(chip);
    // After expand, the "open" leftover (window − committed) should appear
    expect(screen.getByText(/open/i)).toBeOnTheScreen();
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

  it('shows the "Pad calendar" action in expanded state (the write surface CTA)', () => {
    render(<CapacityChip cap={setupPro()} />);
    const chip = screen.getByTestId('capacity-chip-collapsed');
    fireEvent.press(chip);
    expect(screen.getByText(/pad calendar/i)).toBeOnTheScreen();
  });
});

describe('CapacityChip — Free user (task-only verdict)', () => {
  it('renders the honest task-only verdict line ("Honest day … · fits")', () => {
    render(<CapacityChip cap={setupFree()} />);
    expect(screen.getByTestId('capacity-free')).toBeOnTheScreen();
    expect(screen.getByText(/honest day/i)).toBeOnTheScreen();
    expect(screen.getByText(/fits/i)).toBeOnTheScreen();
  });

  it('renders "snug" when the task-only verdict is snug', () => {
    render(<CapacityChip cap={setupFree({ verdict: 'snug' })} />);
    expect(screen.getByText(/snug/i)).toBeOnTheScreen();
  });

  it('renders "heavy — move" when over, never "overdue"/"behind"/"failed"', () => {
    render(<CapacityChip cap={setupFree({ verdict: 'over', overByMin: 75 })} />);
    expect(screen.getByText(/heavy/i)).toBeOnTheScreen();
    expect(screen.getByText(/move/i)).toBeOnTheScreen();
    expect(screen.queryByText(/overdue/i)).toBeNull();
    expect(screen.queryByText(/behind/i)).toBeNull();
    expect(screen.queryByText(/failed/i)).toBeNull();
  });

  it('does NOT render the calendar bar or the "Pad calendar" write action', () => {
    render(<CapacityChip cap={setupFree()} />);
    expect(screen.queryByTestId('capacity-bar')).toBeNull();
    expect(screen.queryByText(/pad calendar/i)).toBeNull();
  });

  it('renders nothing on an empty day (no queued tasks)', () => {
    render(<CapacityChip cap={setupFree({ taskMin: 0 })} />);
    expect(screen.queryByTestId('capacity-free')).toBeNull();
    expect(screen.queryByText(/honest day/i)).toBeNull();
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
