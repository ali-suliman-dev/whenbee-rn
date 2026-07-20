import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import PlanRoute from '@/src/app/(modals)/plan';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { useStartByToggle } from '@/src/features/today/useStartByToggle';
import { formatClock } from '@/src/lib/time';
import { tokens } from '@/src/theme/tokens';
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
  const { Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FinishEditorSheet: ({
      visible,
      title,
      onUseNow,
    }: {
      visible: boolean;
      title?: string;
      onUseNow?: () => void;
    }) =>
      visible
        ? React.createElement(
            Pressable,
            { testID: `picker-${title ?? ''}`, onPress: onUseNow },
            React.createElement(Text, null, title ?? 'Finish by'),
            // Only rendered when the route hands down the start-only shortcut.
            onUseNow ? React.createElement(Text, null, 'Use now') : null,
          )
        : null,
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

/** The anchor-chooser half of useDayPlan's contract. Tests that assert nothing
 *  about it take these neutral defaults; the chooser suite overrides them. */
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

/** The route converts every stored minute-of-day against TODAY's local midnight. */
function todayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
const minutesOfDay = (h: number, m: number): number => h * 60 + m;
const clockAt = (h: number, m: number): string =>
  formatClock(todayMidnight() + minutesOfDay(h, m) * 60_000);

/** Flattened `color` off a rendered Text, whatever style shape it was given. */
function colorOf(node: { props: { style?: unknown } }): string | undefined {
  const style = node.props.style;
  const layers = Array.isArray(style) ? style : [style];
  return layers.reduce<string | undefined>(
    (found, layer) => (layer as { color?: string } | undefined)?.color ?? found,
    undefined,
  );
}

/** Mode-agnostic: the suite must not care which colour mode jest resolves to. */
const ACCENTS = [tokens.colors.light.accent, tokens.colors.dark.accent];


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

  it('renders the anchor chooser and a Nudge toggle in the footer', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    expect(screen.getByTestId('plan-anchor-chooser')).toBeOnTheScreen();
    expect(screen.getByTestId('plan-nudge-row')).toBeOnTheScreen();
    expect(screen.getByText('Nudge me to start')).toBeOnTheScreen();
  });

  // The standalone Done-by cell is gone — a finish time is one of the chooser's
  // two answers now, not a setting sitting on its own.
  it('no longer renders a standalone Done-by cell', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    expect(screen.queryByTestId('plan-doneby-pill')).toBeNull();
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

  // The anchor chooser: which end of the day is fixed, and the picker each row
  // opens. Both rows always show their derived clock — the comparison IS the
  // control — so these assert the unselected row's readout too.
  describe('anchor chooser', () => {
    const startBy = new Date(2026, 5, 24, 9, 0, 0).getTime();

    function renderWithAnchor(over: Partial<Parameters<typeof mockUseDayPlan.mockReturnValue>[0]> = {}) {
      mockUseDayPlan.mockReturnValue({
        ...anchorDefaults,
        plan: makePlan(startBy),
        status: 'ready',
        doneByMin: minutesOfDay(15, 30),
        setDoneBy: jest.fn(),
        derivedFinishMs: todayMidnight() + minutesOfDay(14, 55) * 60_000,
        derivedStartByMs: todayMidnight() + minutesOfDay(11, 0) * 60_000,
        ...over,
      });
      return render(<PlanRoute />);
    }

    it('shows both rows with their own value pill and derived clock', () => {
      renderWithAnchor({ planAnchor: 'start' });
      // Scope to the chooser: the footer times line quotes clocks of its own.
      const chooser = within(screen.getByTestId('plan-anchor-chooser'));
      expect(chooser.getByText('Start at')).toBeOnTheScreen();
      expect(chooser.getByText('Finish by')).toBeOnTheScreen();
      // Start unpinned reads the live Now anchor; finish reads the user's target.
      expect(chooser.getByText('Now')).toBeOnTheScreen();
      expect(chooser.getByText(clockAt(15, 30))).toBeOnTheScreen();
      expect(chooser.getByText(`finish ${clockAt(14, 55)}`)).toBeOnTheScreen();
      // The UNSELECTED row still states its outcome — that is the whole design.
      expect(chooser.getByText(`start by ${clockAt(11, 0)}`)).toBeOnTheScreen();
    });

    it('reads "Set" and "not set" on the finish row until a target exists', () => {
      renderWithAnchor({ planAnchor: 'start', doneByMin: null });
      expect(screen.getByText('Set')).toBeOnTheScreen();
      expect(screen.getByText('not set')).toBeOnTheScreen();
    });

    it('shows the pinned start clock once a start minute is set', () => {
      renderWithAnchor({ planAnchor: 'start', startAtMin: minutesOfDay(9, 30) });
      expect(screen.getByText(clockAt(9, 30))).toBeOnTheScreen();
    });

    // No red, no "you missed it", no rewriting their number — the row keeps the
    // 09:30 they chose and simply states what is actually happening.
    it('states a passed start calmly, keeping the number the user set', () => {
      renderWithAnchor({
        planAnchor: 'start',
        startAtMin: minutesOfDay(9, 30),
        startHasPassed: true,
        effectiveStartMs: todayMidnight() + minutesOfDay(14, 20) * 60_000,
      });
      expect(
        screen.getByText(`${clockAt(9, 30)} has passed · starting ${clockAt(14, 20)}`),
      ).toBeOnTheScreen();
    });

    it('selects a row when the row itself is pressed', () => {
      const setPlanAnchor = jest.fn();
      renderWithAnchor({ planAnchor: 'finish', setPlanAnchor });
      fireEvent.press(screen.getByTestId('plan-anchor-start'));
      expect(setPlanAnchor).toHaveBeenCalledWith('start');
    });

    it('selects the row AND opens its picker in one gesture on a value press', () => {
      const setPlanAnchor = jest.fn();
      renderWithAnchor({ planAnchor: 'finish', setPlanAnchor });
      fireEvent.press(screen.getByTestId('plan-anchor-start-value'));
      expect(setPlanAnchor).toHaveBeenCalledWith('start');
      expect(screen.getByTestId('picker-Start at')).toBeOnTheScreen();
    });

    it('opens the finish picker from the finish row value', () => {
      renderWithAnchor({ planAnchor: 'start' });
      expect(screen.queryByTestId('picker-Finish by')).toBeNull();
      fireEvent.press(screen.getByTestId('plan-anchor-finish-value'));
      expect(screen.getByTestId('picker-Finish by')).toBeOnTheScreen();
    });

    // "Finish by now" is meaningless, so the shortcut is start-only.
    it('offers Use now on the start picker only', () => {
      const { unmount } = renderWithAnchor({ planAnchor: 'start' });
      fireEvent.press(screen.getByTestId('plan-anchor-start-value'));
      expect(screen.getByText('Use now')).toBeOnTheScreen();
      unmount();

      renderWithAnchor({ planAnchor: 'start' });
      fireEvent.press(screen.getByTestId('plan-anchor-finish-value'));
      expect(screen.queryByText('Use now')).toBeNull();
    });

    it('hands the start row back to the live Now anchor and closes on Use now', () => {
      const setStartAt = jest.fn();
      renderWithAnchor({ planAnchor: 'start', startAtMin: minutesOfDay(9, 30), setStartAt });
      fireEvent.press(screen.getByTestId('plan-anchor-start-value'));
      fireEvent.press(screen.getByTestId('picker-Start at'));
      expect(setStartAt).toHaveBeenCalledWith(null);
      expect(screen.queryByTestId('picker-Start at')).toBeNull();
    });
  });

  // The footer's finish clock reads the day's REAL end. When that runs past the
  // done-by target it goes accent — amber, never red: the day ran long, nobody
  // failed. The gap between the two numbers is the message.
  describe('footer finish clock', () => {
    function planEndingAt(startBy: number, endAt: number): PlanResult {
      return {
        startBy,
        timeline: [
          { kind: 'task', id: 'a', label: 'Invoices', startAt: startBy, endAt },
        ],
        verdict: { kind: 'fits', startBy },
        totalMin: 50,
      };
    }

    it('stays ink while the day lands inside the target', () => {
      const startBy = new Date(2026, 5, 24, 9, 0, 0).getTime();
      const endAt = new Date(2026, 5, 24, 14, 0, 0).getTime();
      mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: planEndingAt(startBy, endAt), status: 'ready', doneByMin: minutesOfDay(15, 30), setDoneBy: jest.fn() });
      render(<PlanRoute />);
      const clock = screen.getByTestId('plan-finish-clock');
      expect(clock).toHaveTextContent(formatClock(endAt));
      expect(ACCENTS).not.toContain(colorOf(clock));
    });

    it('turns accent when the day runs past the target', () => {
      const startBy = new Date(2026, 5, 24, 9, 0, 0).getTime();
      const endAt = new Date(2026, 5, 24, 16, 20, 0).getTime();
      mockUseDayPlan.mockReturnValue({ ...anchorDefaults, plan: planEndingAt(startBy, endAt), status: 'ready', doneByMin: minutesOfDay(15, 30), setDoneBy: jest.fn() });
      render(<PlanRoute />);
      const clock = screen.getByTestId('plan-finish-clock');
      expect(clock).toHaveTextContent(formatClock(endAt));
      expect(ACCENTS).toContain(colorOf(clock));
    });
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
