import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import PlanScreen from '@/src/app/(modals)/plan';
import { kv } from '@/src/lib/kv';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));

jest.mock('@/src/features/today/useDayPlan', () => ({
  useDayPlan: () => ({
    plan: { startBy: new Date(2026, 0, 1, 12, 35).getTime() },
    status: 'ready' as const,
    doneByMin: null,
    setDoneBy: jest.fn(),
  }),
}));

jest.mock('@/src/features/today/DayTimeline', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { DayTimeline: () => React.createElement(Text, { testID: 'day-timeline-root' }, 'timeline') };
});

jest.mock('@/src/features/today/PlanReminderChip', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlanReminderChip: ({ startByClock }: { startByClock: string | null }) =>
      React.createElement(Text, { testID: 'plan-reminder-chip' }, String(startByClock)),
  };
});

jest.mock('@/src/features/today/PlanSetupStep', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlanSetupStep: ({ onContinue }: { onContinue: () => void }) =>
      React.createElement(
        Pressable,
        { testID: 'plan-setup-step', onPress: onContinue },
        React.createElement(Text, null, 'setup'),
      ),
  };
});

beforeEach(() => {
  kv.delete('plan.setupSeen');
  jest.clearAllMocks();
});

it('shows the setup step on first run (no plan.setupSeen flag)', () => {
  const { getByTestId, queryByTestId } = render(<PlanScreen />);
  expect(getByTestId('plan-setup-step')).toBeTruthy();
  expect(queryByTestId('day-timeline-root')).toBeNull();
});

it('continuing the setup burns the flag and reveals the plan', () => {
  const { getByTestId } = render(<PlanScreen />);
  fireEvent.press(getByTestId('plan-setup-step'));
  expect(kv.getString('plan.setupSeen')).toBe('1');
  expect(getByTestId('day-timeline-root')).toBeTruthy();
});

it('skips setup entirely when plan.setupSeen is already set', () => {
  kv.set('plan.setupSeen', '1');
  const { getByTestId, queryByTestId } = render(<PlanScreen />);
  expect(getByTestId('day-timeline-root')).toBeTruthy();
  expect(queryByTestId('plan-setup-step')).toBeNull();
});

it('passes the formatted start-by clock into the reminder chip', () => {
  kv.set('plan.setupSeen', '1');
  const { getByTestId } = render(<PlanScreen />);
  // Real formatClockMeridiem runs — assert it is a non-null clock string, not "null".
  expect(getByTestId('plan-reminder-chip').props.children).not.toBe('null');
});

it('"Looks good" routes back to today', () => {
  kv.set('plan.setupSeen', '1');
  const { getByText } = render(<PlanScreen />);
  fireEvent.press(getByText('Looks good'));
  expect(router.back).toHaveBeenCalled();
});
