import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import PlanRoute from '@/src/app/(modals)/plan';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { useStartByToggle } from '@/src/features/today/useStartByToggle';
import { formatClock } from '@/src/lib/time';
import type { PlanResult } from '@/src/domain/types';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

const mockClearPlan = jest.fn().mockResolvedValue(undefined);
jest.mock('@/src/stores/dayTasksStore', () => ({
  useDayTasksStore: { getState: jest.fn(() => ({ clearPlan: mockClearPlan })) },
}));

// DayTimeline pulls the native calendar + engine planner — stub it to a marker.
jest.mock('@/src/features/today/DayTimeline', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { DayTimeline: () => React.createElement(Text, { testID: 'day-timeline-root' }, 'DayTimeline') };
});

// FinishEditorSheet mounts a real GestureHandlerRootView (needed on-device for the
// wheel's pan gestures) which isn't initialized in this unit-test environment —
// its own picker behavior is covered by DayTimeline/FinishEditorSheet tests. Stub
// it to a visibility marker so we can assert the pill opens it.
jest.mock('@/src/features/routines/FinishEditorSheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FinishEditorSheet: ({ visible }: { visible: boolean }) =>
      visible ? React.createElement(Text, null, 'Finish by') : null,
  };
});

// ConfirmSheet renders a Modal with its own reanimated/insets deps — stub it to
// a visibility marker plus a Pressable that fires onConfirm, so the confirm flow
// can be driven without the native sheet. Its full behavior is covered by
// ConfirmSheet's own tests.
jest.mock('@/src/components/ConfirmSheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ConfirmSheet: ({
      visible,
      title,
      onConfirm,
    }: {
      visible: boolean;
      title: string;
      onConfirm: () => void;
    }) =>
      visible
        ? React.createElement(
            Pressable,
            { testID: 'confirm-sheet-confirm', onPress: onConfirm },
            React.createElement(Text, null, title),
          )
        : null,
  };
});

jest.mock('@/src/features/today/useDayPlan');
const mockUseDayPlan = jest.mocked(useDayPlan);

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


jest.mock('@/src/features/today/useStartByToggle');
const mockUseStartByToggle = jest.mocked(useStartByToggle);
const mockToggleNudge = jest.fn().mockResolvedValue(true);

function makePlan(startBy: number): PlanResult {
  return { startBy, timeline: [], verdict: { kind: 'fits', startBy }, totalMin: 60 };
}

beforeEach(() => {
  mockUseStartByToggle.mockReturnValue({ enabled: false, toggle: mockToggleNudge });
  mockClearPlan.mockClear();
});

afterEach(() => jest.clearAllMocks());

describe('(modals)/plan', () => {
  it('renders the title and the timeline', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime(); // 12:35 PM local
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    expect(screen.getByText("Today's plan")).toBeOnTheScreen();
    expect(screen.getByTestId('day-timeline-root')).toBeOnTheScreen();
  });

  // The formSheet is a separate native container from the app-root
  // GestureHandlerRootView, so react-native-reorderable-list's drag pans
  // (inside DayTimeline) never fire unless the sheet's own content re-
  // establishes a gesture root. Assert it wraps the grabber/header/timeline/
  // footer so dragging works on device (the drag gesture itself can't be
  // unit-tested — see DayTimeline.test.tsx's grip-only coverage).
  it('wraps the sheet content in its own GestureHandlerRootView', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    const root = screen.getByTestId('plan-gesture-root');
    expect(root).toBeOnTheScreen();
    expect(within(root).getByTestId('day-timeline-root')).toBeOnTheScreen();
    expect(within(root).getByText("Today's plan")).toBeOnTheScreen();
    expect(within(root).getByText('Done')).toBeOnTheScreen();
  });

  it('renders a neutral Done-by control and a Nudge toggle in the footer', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    expect(screen.getByTestId('plan-doneby-pill')).toBeOnTheScreen();
    expect(screen.getByTestId('plan-nudge-row')).toBeOnTheScreen();
    expect(screen.getByText('Nudge me to start')).toBeOnTheScreen();
  });

  it('opens the same done-by picker DoneByChip uses on Done-by pill press', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    const setDoneBy = jest.fn();
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy });
    render(<PlanRoute />);
    expect(screen.queryByText('Finish by')).not.toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('plan-doneby-pill'));
    expect(screen.getByText('Finish by')).toBeOnTheScreen();
  });

  it('toggles the nudge control via useStartByToggle', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    fireEvent(screen.getByTestId('plan-nudge-switch'), 'valueChange', true);
    expect(mockToggleNudge).toHaveBeenCalledWith(true);
  });

  it('renders the start-by · finish times line with equal-size clocks', () => {
    const startBy = new Date(2026, 5, 24, 9, 0, 0).getTime(); // 9:00 AM local
    const doneByMin = 1080; // 18:00 local
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults,
      plan: makePlan(startBy),
      status: 'ready',
      doneByMin,
      setDoneBy: jest.fn(),
    });
    render(<PlanRoute />);

    // The summary line lives in the footer now (title stays clean). Scope every
    // lookup to it so the Done-by pill's own clock can't be mistaken for the
    // finish clock.
    const line = screen.getByTestId('plan-times-line');
    expect(within(line).getByText('Start by')).toBeOnTheScreen();
    expect(within(line).getByText('finish')).toBeOnTheScreen();

    const localMidnight = new Date(startBy);
    localMidnight.setHours(0, 0, 0, 0);
    const finishAt = localMidnight.getTime() + doneByMin * 60_000;

    const startClock = within(line).getByText(formatClock(startBy));
    const finishClock = within(line).getByText(formatClock(finishAt));

    const sizeOf = (node: { props: { style?: unknown } }): number | undefined => {
      const style = node.props.style;
      return Array.isArray(style)
        ? style.find((s: { fontSize?: number }) => s?.fontSize)?.fontSize
        : (style as { fontSize?: number } | undefined)?.fontSize;
    };
    expect(sizeOf(startClock)).toBe(sizeOf(finishClock));
  });

  it('dismisses on Done', () => {
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: makePlan(Date.now()), status: 'ready', doneByMin: null, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    fireEvent.press(screen.getByText('Done'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  describe('Clear plan', () => {
    it('shows the Clear control when a plan exists', () => {
      mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: makePlan(Date.now()), status: 'ready', doneByMin: null, setDoneBy: jest.fn() });
      render(<PlanRoute />);
      expect(screen.getByTestId('plan-clear-button')).toBeOnTheScreen();
    });

    it('hides the Clear control when there is no plan', () => {
      mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: null, status: 'empty', doneByMin: null, setDoneBy: jest.fn() });
      render(<PlanRoute />);
      expect(screen.queryByTestId('plan-clear-button')).toBeNull();
    });

    it('opens the ConfirmSheet on Clear press, then clears the plan, turns off the nudge, and dismisses on confirm', async () => {
      mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: makePlan(Date.now()), status: 'ready', doneByMin: null, setDoneBy: jest.fn() });
      render(<PlanRoute />);

      // Sheet hidden until the trigger is pressed.
      expect(screen.queryByTestId('confirm-sheet-confirm')).toBeNull();
      fireEvent.press(screen.getByTestId('plan-clear-button'));
      expect(screen.getByTestId('confirm-sheet-confirm')).toBeOnTheScreen();

      fireEvent.press(screen.getByTestId('confirm-sheet-confirm'));

      // Flush the async confirm handler.
      await Promise.resolve();
      await Promise.resolve();

      expect(mockClearPlan).toHaveBeenCalledTimes(1);
      expect(mockToggleNudge).toHaveBeenCalledWith(false);
      expect(router.back).toHaveBeenCalledTimes(1);
    });
  });
});
