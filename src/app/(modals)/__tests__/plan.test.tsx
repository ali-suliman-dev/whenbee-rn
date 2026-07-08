import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import PlanRoute from '@/src/app/(modals)/plan';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { formatClock } from '@/src/lib/time';
import type { PlanResult } from '@/src/domain/types';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

// DayTimeline pulls the native calendar + engine planner — stub it to a marker.
jest.mock('@/src/features/today/DayTimeline', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { DayTimeline: () => React.createElement(Text, { testID: 'day-timeline-root' }, 'DayTimeline') };
});

// PlanReminderChip is exercised in its own foundation test — here we only need to
// see which clock the sheet handed it.
jest.mock('@/src/features/today/PlanReminderChip', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlanReminderChip: ({ startByClock }: { startByClock: string | null }) =>
      React.createElement(Text, { testID: 'plan-reminder-chip' }, startByClock ?? 'no-clock'),
  };
});

jest.mock('@/src/features/today/useDayPlan');
const mockUseDayPlan = jest.mocked(useDayPlan);

function makePlan(startBy: number): PlanResult {
  return { startBy, timeline: [], verdict: { kind: 'fits', startBy }, totalMin: 60 };
}

afterEach(() => jest.clearAllMocks());

describe('(modals)/plan', () => {
  it('renders the title, the timeline, and the reminder chip with the start-by clock', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime(); // 12:35 PM local
    mockUseDayPlan.mockReturnValue({ plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    expect(screen.getByText("Today's plan")).toBeOnTheScreen();
    expect(screen.getByTestId('day-timeline-root')).toBeOnTheScreen();
    expect(screen.getByTestId('plan-reminder-chip')).toHaveTextContent('12:35pm');
  });

  it('passes a null clock to the chip when there is no plan yet', () => {
    mockUseDayPlan.mockReturnValue({ plan: null, status: 'empty', doneByMin: null, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    expect(screen.getByTestId('plan-reminder-chip')).toHaveTextContent('no-clock');
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
