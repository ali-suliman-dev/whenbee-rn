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
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import ReorderableList from 'react-native-reorderable-list';
import { FW_BIN_COUNT } from '@/src/engine';
import { DayTimeline } from '@/src/features/today/DayTimeline';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { formatClock } from '@/src/lib/time';
import type { PlanResult, LearnedFocusWindow } from '@/src/domain/types';

// ── Module mocks ──────────────────────────────────────────────────────────────
// Babel hoists jest.mock() to before any imports at runtime.

jest.mock('@/src/features/today/useDayPlan', () => ({
  useDayPlan: jest.fn(),
}));

const mockMoveToTomorrow = jest.fn();
const mockReorderTasks = jest.fn();
jest.mock('@/src/stores/dayTasksStore', () => ({
  useDayTasksStore: (selector: (s: any) => any) =>
    selector({ moveToTomorrow: mockMoveToTomorrow, reorderTasks: mockReorderTasks }),
}));

jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: jest.fn(),
}));

jest.mock('@/src/theme/useColorMode', () => ({
  useColorMode: () => 'light',
}));

// Rows now render the shared Plan-tab spine (PlanRail → RailNode → useAmbientMotion
// → useFocusEffect), which needs a navigation context. Mock expo-router so the
// focus effect is a no-op in this isolated unit test.
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

// Default: Pro enabled so existing tests are unaffected by the Pro guard.
jest.mock('@/src/features/paywall/useEntitlement', () => ({
  useEntitlement: jest.fn((selector: (s: any) => any) =>
    selector({ isPro: true }),
  ),
}));

// ── Typed mock references ─────────────────────────────────────────────────────

const mockUseDayPlan = useDayPlan as jest.MockedFunction<typeof useDayPlan>;

/** The anchor-chooser half of useDayPlan's contract. These tests predate it and
 *  assert nothing about it, so they take the neutral defaults. */
const anchorDefaults = {
  startAtMin: null,
  setStartAt: jest.fn(),
  planAnchor: 'finish' as const,
  setPlanAnchor: jest.fn(),
  derivedFinishMs: null,
  derivedStartByMs: null,
  effectiveStartMs: 0,
  startHasPassed: false,
};

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

function makeFormingFocusWindow(): LearnedFocusWindow & { hydrated: boolean } {
  return {
    startMin: 540,
    endMin: 720,
    basis: 'forming',
    confidence: 0.3,
    confidenceTier: 'low',
    coarseBlockLabel: '',
    scoreByBin: new Array(FW_BIN_COUNT).fill(0) as number[],
    sampleCount: 0,
    distinctDays: 0,
    held: false,
    hydrated: true,
    gates: {
      sessions: { have: 0, need: 15 },
      days: { have: 0, need: 5 },
    },
  };
}

function makeRevealedFocusWindow(): LearnedFocusWindow & { hydrated: boolean } {
  return {
    startMin: 540,
    endMin: 720,
    basis: 'revealed',
    confidence: 0.8,
    confidenceTier: 'steady',
    coarseBlockLabel: 'Mornings',
    scoreByBin: new Array(FW_BIN_COUNT).fill(0.5) as number[],
    sampleCount: 12,
    distinctDays: 8,
    held: false,
    hydrated: true,
    gates: {
      sessions: { have: 12, need: 15 },
      days: { have: 8, need: 5 },
    },
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

/**
 * A day that runs over: one task fits up to the 15:30 done-by, one does not and
 * lands as an `overflow` block ending 16:20 — 50 minutes past.
 *
 * The engine starts the overflow chain AT the deadline, so the first overflow
 * row's startAt IS the done-by; the component reads both boundary clocks from
 * these rows rather than re-deriving a deadline.
 */
function makeOverflowPlan(): PlanResult {
  return {
    startBy: atTime(14, 40),
    totalMin: 100,
    verdict: {
      kind: 'cut-one',
      startBy: atTime(14, 40),
      cut: { id: 'task-big', label: 'Big project' },
      savedMin: 50,
    },
    timeline: [
      {
        id: 'task-1',
        label: 'Quick email',
        startAt: atTime(14, 40),
        endAt: atTime(15, 30),
        kind: 'task',
      },
      {
        id: 'task-big',
        label: 'Big project',
        startAt: atTime(15, 30),
        endAt: atTime(16, 20),
        kind: 'overflow',
      },
    ],
  };
}

/** Three overflow blocks stacked past the same boundary — the "does it still read
 *  calm?" case. One boundary, three identical rows, no second design. */
function makeThreeOverflowPlan(): PlanResult {
  return {
    startBy: atTime(14, 40),
    totalMin: 210,
    verdict: {
      kind: 'multi-cut',
      startBy: atTime(14, 40),
      cuts: [
        { id: 'task-big', label: 'Big project' },
        { id: 'task-calls', label: 'Return calls' },
        { id: 'task-review', label: 'Review deck' },
      ],
      savedMin: 120,
    },
    timeline: [
      {
        id: 'task-1',
        label: 'Quick email',
        startAt: atTime(14, 40),
        endAt: atTime(15, 30),
        kind: 'task',
      },
      {
        id: 'task-big',
        label: 'Big project',
        startAt: atTime(15, 30),
        endAt: atTime(16, 20),
        kind: 'overflow',
      },
      {
        id: 'task-calls',
        label: 'Return calls',
        startAt: atTime(16, 20),
        endAt: atTime(16, 50),
        kind: 'overflow',
      },
      {
        id: 'task-review',
        label: 'Review deck',
        startAt: atTime(16, 50),
        endAt: atTime(17, 30),
        kind: 'overflow',
      },
    ],
  };
}

// ── Reset ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFocusWindow.mockReturnValue(makeFormingFocusWindow());
  mockMoveToTomorrow.mockResolvedValue(undefined);
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 1 — fits plan: task row + event block + no overflow
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — fits plan', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
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
// Task 4C — drag-to-reorder: only task rows get a grip; renders inside the
// ReorderableList without crashing. The drag GESTURE itself can't be driven
// from a unit test (no real touch/pan simulation here) — this only asserts
// the render seam (grip present/absent) and that the component mounts under
// the real react-native-reorderable-list + GestureHandler stack. The actual
// drag feel needs on-device verification.
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — drag-to-reorder grip', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
      plan: makeFitsPlan(),
      status: 'ready',
      doneByMin: 1080,
      setDoneBy: mockSetDoneBy,
    });
  });

  it('renders a drag handle on the task row', () => {
    render(<DayTimeline />);
    expect(screen.getByTestId('timeline-drag-handle-task-1')).toBeOnTheScreen();
  });

  it('does NOT render a drag handle on event or breather rows', () => {
    render(<DayTimeline />);
    expect(screen.queryByTestId('timeline-drag-handle-event-1')).toBeNull();
    expect(screen.queryByTestId('timeline-drag-handle-breather-1')).toBeNull();
  });

  it('mounts the reorderable list without crashing (full timeline: task + breather + event)', () => {
    render(<DayTimeline />);
    expect(screen.getByText('Write report')).toBeOnTheScreen();
    expect(screen.getByText('Team standup')).toBeOnTheScreen();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 2 — revealed focus window → focus band renders
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — focus band with revealed window', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
      plan: makeFitsPlan(),
      status: 'ready',
      doneByMin: 1080,
      setDoneBy: mockSetDoneBy,
    });
    mockUseFocusWindow.mockReturnValue(makeRevealedFocusWindow());
  });

  it('renders the focus band element when basis is revealed', () => {
    render(<DayTimeline />);
    expect(screen.getByTestId('timeline-focus-band')).toBeOnTheScreen();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 3 — forming focus window → NO focus band
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — no focus band when basis is forming', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
      plan: makeFitsPlan(),
      status: 'ready',
      doneByMin: 1080,
      setDoneBy: mockSetDoneBy,
    });
    mockUseFocusWindow.mockReturnValue(makeFormingFocusWindow());
  });

  it('does NOT render the focus band when basis is forming', () => {
    render(<DayTimeline />);
    expect(screen.queryByTestId('timeline-focus-band')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 4 — overflow IN PLACE. The banner named a task it never showed; this
// replaces it with the task itself, rendered below a done-by boundary.
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — overflow in place', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
      plan: makeOverflowPlan(),
      status: 'ready',
      doneByMin: 930, // 15:30
      setDoneBy: mockSetDoneBy,
    });
  });

  it('SHOWS the overflowing task instead of only naming it in a banner', () => {
    render(<DayTimeline />);
    expect(screen.getByText('Big project')).toBeOnTheScreen();
    expect(screen.getByTestId('timeline-overflow-task-big')).toBeOnTheScreen();
  });

  it('no longer renders the old banner', () => {
    render(<DayTimeline />);
    expect(screen.queryByTestId('timeline-overflow-banner')).toBeNull();
  });

  it('renders the done-by boundary with the deadline clock', () => {
    render(<DayTimeline />);
    expect(screen.getByTestId('timeline-overflow-boundary')).toBeOnTheScreen();
    expect(
      screen.getByText(`${formatClock(atTime(15, 30))} DONE BY`),
    ).toBeOnTheScreen();
  });

  it('names BOTH exits in one sentence, with the real overrun clock', () => {
    render(<DayTimeline />);
    expect(screen.getByText(/Past here you run over/)).toBeOnTheScreen();
    // The push-to clock is the furthest overflow end, not the done-by.
    expect(screen.getByText(formatClock(atTime(16, 20)))).toBeOnTheScreen();
    expect(screen.getByText(/move a task to tomorrow/)).toBeOnTheScreen();
  });

  it('states how far past the done-by the block runs', () => {
    render(<DayTimeline />);
    expect(screen.getByText('+50m over')).toBeOnTheScreen();
  });

  it('the Tomorrow chip moves that exact task', () => {
    render(<DayTimeline />);
    fireEvent.press(screen.getByTestId('timeline-move-tomorrow-task-big'));
    expect(mockMoveToTomorrow).toHaveBeenCalledWith('task-big');
  });

  it('copy carries no guilt and no alarm (overdue/behind/failed/late/warning)', () => {
    render(<DayTimeline />);
    const json = JSON.stringify(screen.toJSON()).toLowerCase();
    expect(json).not.toMatch(/overdue/);
    expect(json).not.toMatch(/behind/);
    expect(json).not.toMatch(/failed/);
    expect(json).not.toMatch(/too late/);
    expect(json).not.toMatch(/warning/);
  });

  it('draws the boundary as a flat rule — never a left border or inset edge', () => {
    render(<DayTimeline />);
    const block = screen.getByTestId('timeline-overflow-task-big');
    const style = StyleSheet.flatten(block.props.style) as Record<string, unknown>;
    expect(style.borderLeftWidth).toBeUndefined();
    expect(style.borderWidth).toBeUndefined();
    expect(style.boxShadow).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 4b — three overflowing tasks: the treatment holds. One boundary, three
// identical rows, no second design and no escalation.
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — three overflowing tasks', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
      plan: makeThreeOverflowPlan(),
      status: 'ready',
      doneByMin: 930,
      setDoneBy: mockSetDoneBy,
    });
  });

  it('renders every overflowing task', () => {
    render(<DayTimeline />);
    expect(screen.getByText('Big project')).toBeOnTheScreen();
    expect(screen.getByText('Return calls')).toBeOnTheScreen();
    expect(screen.getByText('Review deck')).toBeOnTheScreen();
  });

  it('draws exactly ONE boundary, above the first overflowing row', () => {
    render(<DayTimeline />);
    expect(screen.getAllByTestId('timeline-overflow-boundary')).toHaveLength(1);
  });

  it('each row states its own overrun, cumulative from the done-by', () => {
    render(<DayTimeline />);
    expect(screen.getByText('+50m over')).toBeOnTheScreen();
    expect(screen.getByText('+1h 20m over')).toBeOnTheScreen();
    expect(screen.getByText('+2h over')).toBeOnTheScreen();
  });

  it('offers the push-to clock of the LAST block, and still no guilt words', () => {
    render(<DayTimeline />);
    expect(screen.getByText(formatClock(atTime(17, 30)))).toBeOnTheScreen();
    const json = JSON.stringify(screen.toJSON()).toLowerCase();
    expect(json).not.toMatch(/overdue|behind|failed|warning/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 4c — drag, both directions. Overflow rows are ordinary cells, and a drop
// is never refused: the optimistic order renders immediately and the boundary
// moves to wherever the first overflowing row now sits.
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — dragging across the boundary', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
      plan: makeOverflowPlan(),
      status: 'ready',
      doneByMin: 930,
      setDoneBy: mockSetDoneBy,
    });
  });

  /** Drive the list's reorder contract directly — the pan gesture itself cannot
   *  be simulated here, but every rule under test hangs off this callback. */
  function drop(from: number, to: number): void {
    const list = screen.UNSAFE_getByType(ReorderableList);
    act(() => {
      (list.props as { onReorder: (e: { from: number; to: number }) => void }).onReorder({
        from,
        to,
      });
    });
  }

  it('gives an overflow row the same grip as a fitting task', () => {
    render(<DayTimeline />);
    expect(screen.getByTestId('timeline-drag-handle-task-big')).toBeOnTheScreen();
    expect(screen.getByTestId('timeline-drag-handle-task-1')).toBeOnTheScreen();
  });

  it('persists overflow rows in the new order — they are never dropped from it', () => {
    render(<DayTimeline />);
    drop(1, 0); // overflow row dragged above the fitting one
    expect(mockReorderTasks).toHaveBeenCalledWith(['task-big', 'task-1']);
  });

  it('a drop above the line STICKS even while the plan still says otherwise', () => {
    render(<DayTimeline />);
    drop(1, 0);
    // useDayPlan is mocked and keeps returning the OLD order — exactly the async
    // round-trip window the optimistic override exists to cover. The dragged row
    // must stay where it was dropped, not snap back.
    const labels = screen
      .getAllByText(/Big project|Quick email/)
      .map((node) => node.props.children);
    expect(labels[0]).toBe('Big project');
  });

  it('moves the boundary UP above a row that still does not fit', () => {
    render(<DayTimeline />);
    drop(1, 0);
    // The overflowing row is now first, so the day runs over from the very top:
    // the line is a readout of where that happens, not a wall that refuses it.
    const boundary = screen.getByTestId('timeline-overflow-boundary');
    expect(boundary).toBeOnTheScreen();
    expect(screen.getByText('Big project')).toBeOnTheScreen();
  });

  it('a fitting task dragged below the line becomes the overflowing one', () => {
    render(<DayTimeline />);
    drop(0, 1);
    expect(mockReorderTasks).toHaveBeenCalledWith(['task-big', 'task-1']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 5 — empty plan (status 'empty') → nothing rendered
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — empty plan', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
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

// ═════════════════════════════════════════════════════════════════════════════
// Test 6 — DoneByChip: label reflects doneByMin as a LOCAL time
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — DoneByChip local-time label', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
      plan: makeFitsPlan(),
      status: 'ready',
      doneByMin: 1080, // 18:00 local (6 PM)
      setDoneBy: mockSetDoneBy,
    });
  });

  it('displays "Done by" with the time that formatClock produces for local midnight + doneByMin', () => {
    render(<DayTimeline />);
    // Derive the expected label exactly as the component does:
    // local midnight + doneByMin * 60_000 → formatClock
    const localMidnight = new Date();
    localMidnight.setHours(0, 0, 0, 0);
    const expectedTime = formatClock(localMidnight.getTime() + 1080 * 60_000);
    expect(screen.getByText(`Done by ${expectedTime}`)).toBeOnTheScreen();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 8 — hideHeader: header block suppressed, rows still render
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — hideHeader', () => {
  beforeEach(() => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
      plan: makeFitsPlan(),
      status: 'ready',
      doneByMin: 1080,
      setDoneBy: mockSetDoneBy,
    });
  });

  it('renders no "Start by" header when hideHeader is true, but still renders task rows', () => {
    render(<DayTimeline hideHeader />);
    expect(screen.queryByText(/Start by/)).toBeNull();
    expect(screen.getByText('Write report')).toBeOnTheScreen();
  });

  it('renders the "Start by" header by default (hideHeader omitted)', () => {
    render(<DayTimeline />);
    expect(screen.getByText(/Start by/)).toBeOnTheScreen();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test 7 — Pro guard: renders nothing when isPro is false
// ═════════════════════════════════════════════════════════════════════════════

describe('DayTimeline — Pro guard', () => {
  beforeEach(() => {
    // Override useEntitlement to return isPro = false for this suite.
    const { useEntitlement } = jest.requireMock(
      '@/src/features/paywall/useEntitlement',
    ) as { useEntitlement: jest.Mock };
    useEntitlement.mockImplementation((selector: (s: any) => any) =>
      selector({ isPro: false }),
    );
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
      plan: makeFitsPlan(),
      status: 'ready',
      doneByMin: 1080,
      setDoneBy: mockSetDoneBy,
    });
  });

  afterEach(() => {
    // Restore to Pro = true so other suites are unaffected.
    const { useEntitlement } = jest.requireMock(
      '@/src/features/paywall/useEntitlement',
    ) as { useEntitlement: jest.Mock };
    useEntitlement.mockImplementation((selector: (s: any) => any) =>
      selector({ isPro: true }),
    );
  });

  it('renders nothing when isPro is false (defence-in-depth guard)', () => {
    render(<DayTimeline />);
    expect(screen.queryByTestId('timeline-overflow-banner')).toBeNull();
    expect(screen.queryByText('Write report')).toBeNull();
  });
});
