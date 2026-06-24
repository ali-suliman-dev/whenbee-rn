/**
 * DayTimeline — unit tests (TDD).
 *
 * Mocks useDayPlan internally (the component reads the hook, not props)
 * and dayTasksStore.moveToTomorrow for the overflow "move" action.
 *
 * jest.mock() calls are hoisted by Babel so mocked modules resolve correctly
 * even though imports appear first in source order.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { DayTimeline } from '@/src/features/today/DayTimeline';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import type { PlanResult, LearnedFocusWindow } from '@/src/domain/types';

// ── Module mocks ──────────────────────────────────────────────────────────────
// Babel hoists jest.mock() to before any imports at runtime.

jest.mock('@/src/features/today/useDayPlan', () => ({
  useDayPlan: jest.fn(),
}));

const mockMoveToTomorrow = jest.fn();
jest.mock('@/src/stores/dayTasksStore', () => ({
  useDayTasksStore: (selector: (s: any) => any) =>
    selector({ moveToTomorrow: mockMoveToTomorrow }),
}));

jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: jest.fn(),
}));

jest.mock('@/src/theme/useColorMode', () => ({
  useColorMode: () => 'light',
}));

// ── Typed mock references ─────────────────────────────────────────────────────

const mockUseDayPlan = useDayPlan as jest.MockedFunction<typeof useDayPlan>;
const mockUseFocusWindow = useLearnedFocusWindow as jest.MockedFunction<
  typeof useLearnedFocusWindow
>;
const mockSetDoneBy = jest.fn();

// ── Reanimated: stub useReducedMotion ─────────────────────────────────────────

let reducedMotionSpy: jest.SpyInstance;
beforeEach(() => {
  reducedMotionSpy = jest
    .spyOn(Reanimated, 'useReducedMotion')
    .mockReturnValue(false);
});
afterEach(() => {
  reducedMotionSpy.mockRestore?.();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date('2026-06-24T09:00:00').getTime();

function atTime(h: number, m: number): number {
  const d = new Date(NOW);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePriorFocusWindow(): LearnedFocusWindow {
  return {
    startMin: 540,
    endMin: 720,
    basis: 'prior',
    confidence: 0.3,
    scoreByBin: new Array(38).fill(0) as number[],
    sampleCount: 0,
    distinctDays: 0,
    held: false,
  };
}

function makePersonalFocusWindow(): LearnedFocusWindow {
  return {
    startMin: 540,
    endMin: 720,
    basis: 'personal',
    confidence: 0.8,
    scoreByBin: new Array(38).fill(0.5) as number[],
    sampleCount: 12,
    distinctDays: 8,
    held: false,
  };
}

function makeFitsPlan(): PlanResult {
  return {
    startBy: atTime(9, 0),
    totalMin: 60,
    verdict: { kind: 'fits', startBy: atTime(9, 0) },
    timeline: [
      {
        id: 'task-1',
        label: 'Write report',
        startAt: atTime(9, 0),
        endAt: atTime(9, 45),
        kind: 'task',
      },
      {
        id: 'breather-1',
        label: '',
        startAt: atTime(9, 45),
        endAt: atTime(9, 50),
        kind: 'breather',
      },
      {
        id: 'event-1',
        label: 'Team standup',
        startAt: atTime(10, 0),
        endAt: atTime(10, 30),
        kind: 'event',
      },
    ],
  };
}

function makeCutOnePlan(): PlanResult {
  return {
    startBy: atTime(9, 0),
    totalMin: 90,
    verdict: {
      kind: 'cut-one',
      startBy: atTime(9, 0),
      cut: { id: 'task-big', label: 'Big project' },
      savedMin: 60,
    },
    timeline: [
      {
        id: 'task-1',
        label: 'Quick email',
        startAt: atTime(9, 0),
        endAt: atTime(9, 15),
        kind: 'task',
      },
      {
        id: 'event-1',
        label: 'Sync meeting',
        startAt: atTime(10, 0),
        endAt: atTime(10, 30),
        kind: 'event',
      },
    ],
  };
}

// ── Reset ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFocusWindow.mockReturnValue(makePriorFocusWindow());
  mockMoveToTomorrow.mockResolvedValue(undefined);
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 1 — fits plan: task row + event block + no overflow
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — fits plan', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({
      plan: makeFitsPlan(),
      status: 'ready',
      doneByMin: 1080,
      setDoneBy: mockSetDoneBy,
    });
  });

  it('renders the task label', () => {
    render(<DayTimeline />);
    expect(screen.getByText('Write report')).toBeOnTheScreen();
  });

  it('renders a read-only event block with the meeting label', () => {
    render(<DayTimeline />);
    expect(screen.getByText('Team standup')).toBeOnTheScreen();
    expect(screen.getByTestId('timeline-event-event-1')).toBeOnTheScreen();
  });

  it('does NOT render an overflow banner when verdict is fits', () => {
    render(<DayTimeline />);
    expect(screen.queryByTestId('timeline-overflow-banner')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 2 — personal focus window → focus band renders
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — focus band with personal window', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({
      plan: makeFitsPlan(),
      status: 'ready',
      doneByMin: 1080,
      setDoneBy: mockSetDoneBy,
    });
    mockUseFocusWindow.mockReturnValue(makePersonalFocusWindow());
  });

  it('renders the focus band element when basis is personal', () => {
    render(<DayTimeline />);
    expect(screen.getByTestId('timeline-focus-band')).toBeOnTheScreen();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 3 — prior focus window → NO focus band
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — no focus band when basis is prior', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({
      plan: makeFitsPlan(),
      status: 'ready',
      doneByMin: 1080,
      setDoneBy: mockSetDoneBy,
    });
    mockUseFocusWindow.mockReturnValue(makePriorFocusWindow());
  });

  it('does NOT render the focus band when basis is prior', () => {
    render(<DayTimeline />);
    expect(screen.queryByTestId('timeline-focus-band')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 4 — cut-one overflow: calm copy, no guilt words, move action present
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — cut-one overflow banner', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({
      plan: makeCutOnePlan(),
      status: 'ready',
      doneByMin: 1080,
      setDoneBy: mockSetDoneBy,
    });
  });

  it('renders the overflow banner', () => {
    render(<DayTimeline />);
    expect(screen.getByTestId('timeline-overflow-banner')).toBeOnTheScreen();
  });

  it('overflow copy contains NO guilt words (overdue, behind, failed)', () => {
    render(<DayTimeline />);
    const json = JSON.stringify(screen.toJSON()).toLowerCase();
    expect(json).not.toMatch(/overdue/);
    expect(json).not.toMatch(/behind/);
    expect(json).not.toMatch(/failed/);
  });

  it('overflow banner has a move action', () => {
    render(<DayTimeline />);
    expect(screen.getByTestId('timeline-move-action')).toBeOnTheScreen();
  });

  it('tapping the move action calls moveToTomorrow with the cut task id', () => {
    render(<DayTimeline />);
    const moveBtn = screen.getByTestId('timeline-move-action');
    fireEvent.press(moveBtn);
    expect(mockMoveToTomorrow).toHaveBeenCalledWith('task-big');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 5 — empty plan (status 'empty') → nothing rendered
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — empty plan', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({
      plan: null,
      status: 'empty',
      doneByMin: null,
      setDoneBy: mockSetDoneBy,
    });
  });

  it('renders nothing meaningful when plan is null', () => {
    render(<DayTimeline />);
    expect(screen.queryByTestId('timeline-overflow-banner')).toBeNull();
    expect(screen.queryByTestId('timeline-event-event-1')).toBeNull();
  });
});
