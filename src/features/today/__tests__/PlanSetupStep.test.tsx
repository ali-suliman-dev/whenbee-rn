import { render, fireEvent, act } from '@testing-library/react-native';
import { PlanSetupStep } from '../PlanSetupStep';
import { useStartByToggle } from '../useStartByToggle';
import { getCalendar } from '@/src/services/calendar';
import { useSettingsStore } from '@/src/stores/settingsStore';

jest.mock('../useStartByToggle');
jest.mock('@/src/services/calendar');

const mockToggle = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({
    calendar: { showEvents: false, enabledCalendarIds: [], exportEnabled: false, whenbeeCalendarId: null },
  });
  (useStartByToggle as jest.Mock).mockReturnValue({ enabled: false, toggle: mockToggle });
  (getCalendar as jest.Mock).mockReturnValue({ requestReadAccess: jest.fn().mockResolvedValue(true) });
});

it('renders both consent rows and a Continue button, both toggles off', () => {
  const { getByText, getByTestId } = render(<PlanSetupStep onContinue={jest.fn()} />);
  expect(getByText("Read today's calendar")).toBeTruthy();
  expect(getByText('Nudge me when to start')).toBeTruthy();
  expect(getByTestId('plan-setup-calendar').props.value).toBe(false);
  expect(getByTestId('plan-setup-reminder').props.value).toBe(false);
});

it('enabling the calendar row requests read access, then flips showEvents', async () => {
  const { getByTestId } = render(<PlanSetupStep onContinue={jest.fn()} />);
  await act(async () => {
    fireEvent(getByTestId('plan-setup-calendar'), 'valueChange', true);
  });
  expect(getCalendar().requestReadAccess).toHaveBeenCalled();
  expect(useSettingsStore.getState().calendar.showEvents).toBe(true);
});

it('leaves showEvents off when calendar permission is denied', async () => {
  (getCalendar as jest.Mock).mockReturnValue({ requestReadAccess: jest.fn().mockResolvedValue(false) });
  const { getByTestId } = render(<PlanSetupStep onContinue={jest.fn()} />);
  await act(async () => {
    fireEvent(getByTestId('plan-setup-calendar'), 'valueChange', true);
  });
  expect(useSettingsStore.getState().calendar.showEvents).toBe(false);
});

it('enabling the reminder row calls toggle(true)', () => {
  const { getByTestId } = render(<PlanSetupStep onContinue={jest.fn()} />);
  fireEvent(getByTestId('plan-setup-reminder'), 'valueChange', true);
  expect(mockToggle).toHaveBeenCalledWith(true);
});

it('Continue calls onContinue', () => {
  const onContinue = jest.fn();
  const { getByText } = render(<PlanSetupStep onContinue={onContinue} />);
  fireEvent.press(getByText('Continue'));
  expect(onContinue).toHaveBeenCalled();
});
