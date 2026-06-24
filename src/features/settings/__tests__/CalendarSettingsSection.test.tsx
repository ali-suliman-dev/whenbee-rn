import { renderHook, act, render, fireEvent, waitFor } from '@testing-library/react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRequestReadAccess = jest.fn(() => Promise.resolve(true));
const mockListCalendars = jest.fn(() =>
  Promise.resolve([
    { id: 'cal-1', title: 'Personal' },
    { id: 'cal-2', title: 'Work' },
  ]),
);

jest.mock('@/src/services/calendar', () => ({
  getCalendar: () => ({
    requestReadAccess: () => mockRequestReadAccess(),
    listCalendars: () => mockListCalendars(),
  }),
}));

jest.mock('@/src/services/analytics', () => ({
  analytics: { capture: jest.fn() },
}));

/* eslint-disable import/first */
import { CalendarSettingsSection } from '../CalendarSettingsSection';
import { useSettingsStore } from '@/src/stores/settingsStore';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestReadAccess.mockImplementation(() => Promise.resolve(true));
  mockListCalendars.mockImplementation(() =>
    Promise.resolve([
      { id: 'cal-1', title: 'Personal' },
      { id: 'cal-2', title: 'Work' },
    ]),
  );
  useSettingsStore.setState({ calendar: { showEvents: false, enabledCalendarIds: [] } });
});

describe('CalendarSettingsSection', () => {
  it('renders the master toggle in off state by default', () => {
    const { getByRole } = render(<CalendarSettingsSection />);
    const toggle = getByRole('switch');
    expect(toggle.props.value).toBe(false);
  });

  it('calls setShowEvents(true) + requestReadAccess when master toggle is turned on', async () => {
    const { getByRole } = render(<CalendarSettingsSection />);
    const toggle = getByRole('switch');

    await act(async () => {
      fireEvent(toggle, 'valueChange', true);
    });

    expect(mockRequestReadAccess).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().calendar.showEvents).toBe(true);
  });

  it('flips the toggle back to false when access is denied', async () => {
    mockRequestReadAccess.mockImplementation(() => Promise.resolve(false));
    const { getByRole } = render(<CalendarSettingsSection />);
    const toggle = getByRole('switch');

    await act(async () => {
      fireEvent(toggle, 'valueChange', true);
    });

    expect(useSettingsStore.getState().calendar.showEvents).toBe(false);
  });

  it('calls setShowEvents(false) without requesting access when master toggle is turned off', async () => {
    useSettingsStore.setState({ calendar: { showEvents: true, enabledCalendarIds: [] } });
    const { getByRole } = render(<CalendarSettingsSection />);
    const toggle = getByRole('switch');

    await act(async () => {
      fireEvent(toggle, 'valueChange', false);
    });

    expect(mockRequestReadAccess).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().calendar.showEvents).toBe(false);
  });

  it('renders the calendar list when showEvents is true and access is granted', async () => {
    useSettingsStore.setState({ calendar: { showEvents: true, enabledCalendarIds: [] } });
    const { findByText } = render(<CalendarSettingsSection />);

    await findByText('Personal');
    await findByText('Work');
  });

  it('does NOT render the calendar list when showEvents is false', () => {
    useSettingsStore.setState({ calendar: { showEvents: false, enabledCalendarIds: [] } });
    const { queryByText } = render(<CalendarSettingsSection />);
    expect(queryByText('Personal')).toBeNull();
    expect(queryByText('Work')).toBeNull();
  });

  it('toggles a calendar in/out of enabledCalendarIds when tapped', async () => {
    useSettingsStore.setState({ calendar: { showEvents: true, enabledCalendarIds: [] } });
    const { findByText } = render(<CalendarSettingsSection />);

    const personalRow = await findByText('Personal');

    await act(async () => {
      fireEvent.press(personalRow);
    });

    // empty list = all enabled; tapping one adds it to exclusion list
    // (toggleCalendar semantics: adds the id if not present)
    const { enabledCalendarIds } = useSettingsStore.getState().calendar;
    expect(enabledCalendarIds).toContain('cal-1');
  });

  it('removes a calendar from enabledCalendarIds when tapped a second time', async () => {
    useSettingsStore.setState({
      calendar: { showEvents: true, enabledCalendarIds: ['cal-1'] },
    });
    const { findByText } = render(<CalendarSettingsSection />);

    const personalRow = await findByText('Personal');

    await act(async () => {
      fireEvent.press(personalRow);
    });

    const { enabledCalendarIds } = useSettingsStore.getState().calendar;
    expect(enabledCalendarIds).not.toContain('cal-1');
  });
});
