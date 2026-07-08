import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import PlanRoute from '@/src/app/(modals)/plan';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { useStartByToggle } from '@/src/features/today/useStartByToggle';
import { formatClock } from '@/src/lib/time';
import type { PlanResult } from '@/src/domain/types';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

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

jest.mock('@/src/features/today/useDayPlan');
const mockUseDayPlan = jest.mocked(useDayPlan);

jest.mock('@/src/features/today/useStartByToggle');
const mockUseStartByToggle = jest.mocked(useStartByToggle);
const mockToggleNudge = jest.fn().mockResolvedValue(true);

function makePlan(startBy: number): PlanResult {
  return { startBy, timeline: [], verdict: { kind: 'fits', startBy }, totalMin: 60 };
}

beforeEach(() => {
  mockUseStartByToggle.mockReturnValue({ enabled: false, toggle: mockToggleNudge });
});

afterEach(() => jest.clearAllMocks());

describe('(modals)/plan', () => {
  it('renders the title and the timeline', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime(); // 12:35 PM local
    mockUseDayPlan.mockReturnValue({ plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
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
    mockUseDayPlan.mockReturnValue({ plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    const root = screen.getByTestId('plan-gesture-root');
    expect(root).toBeOnTheScreen();
    expect(within(root).getByTestId('day-timeline-root')).toBeOnTheScreen();
    expect(within(root).getByText("Today's plan")).toBeOnTheScreen();
    expect(within(root).getByText('Done')).toBeOnTheScreen();
  });

  it('renders a neutral Done-by control and a Nudge toggle in the footer', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    mockUseDayPlan.mockReturnValue({ plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    expect(screen.getByTestId('plan-doneby-pill')).toBeOnTheScreen();
    expect(screen.getByTestId('plan-nudge-pill')).toBeOnTheScreen();
    expect(screen.getByText('Nudge')).toBeOnTheScreen();
  });

  it('opens the same done-by picker DoneByChip uses on Done-by pill press', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    const setDoneBy = jest.fn();
    mockUseDayPlan.mockReturnValue({ plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy });
    render(<PlanRoute />);
    expect(screen.queryByText('Finish by')).not.toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('plan-doneby-pill'));
    expect(screen.getByText('Finish by')).toBeOnTheScreen();
  });

  it('toggles the nudge control via useStartByToggle', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    mockUseDayPlan.mockReturnValue({ plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    fireEvent(screen.getByTestId('plan-nudge-switch'), 'valueChange', true);
    expect(mockToggleNudge).toHaveBeenCalledWith(true);
  });

  it('renders a justified start-by/finish-by line at equal font size', () => {
    const startBy = new Date(2026, 5, 24, 9, 0, 0).getTime(); // 9:00 AM local
    const doneByMin = 1080; // 18:00 local
    mockUseDayPlan.mockReturnValue({
      plan: makePlan(startBy),
      status: 'ready',
      doneByMin,
      setDoneBy: jest.fn(),
    });
    render(<PlanRoute />);

    const startByNode = screen.getByText(`Start by ${formatClock(startBy)}`);
    const localMidnight = new Date(startBy);
    localMidnight.setHours(0, 0, 0, 0);
    const finishAt = localMidnight.getTime() + doneByMin * 60_000;
    const finishByNode = screen.getByText(`finish by ${formatClock(finishAt)}`);

    expect(startByNode).toBeOnTheScreen();
    expect(finishByNode).toBeOnTheScreen();

    const startSize = Array.isArray(startByNode.props.style)
      ? startByNode.props.style.find((s: { fontSize?: number }) => s?.fontSize)?.fontSize
      : startByNode.props.style?.fontSize;
    const finishSize = Array.isArray(finishByNode.props.style)
      ? finishByNode.props.style.find((s: { fontSize?: number }) => s?.fontSize)?.fontSize
      : finishByNode.props.style?.fontSize;
    expect(startSize).toBe(finishSize);
  });

  it('dismisses on Done', () => {
    mockUseDayPlan.mockReturnValue({ plan: makePlan(Date.now()), status: 'ready', doneByMin: null, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    fireEvent.press(screen.getByText('Done'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
