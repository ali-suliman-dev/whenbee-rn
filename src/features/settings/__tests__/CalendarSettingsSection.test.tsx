import { act, render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRequestReadAccess = jest.fn<Promise<boolean>, []>(() => Promise.resolve(true));
const mockRequestWriteAccess = jest.fn<Promise<boolean>, []>(() => Promise.resolve(true));
const mockEnsureWhenbeeCalendar = jest.fn<Promise<string>, [string | null]>(() =>
  Promise.resolve('whenbee-cal-native'),
);
const mockListCalendars = jest.fn<Promise<{ id: string; title: string }[]>, []>(() =>
  Promise.resolve([
    { id: 'cal-1', title: 'Personal' },
    { id: 'cal-2', title: 'Work' },
  ]),
);

jest.mock('@/src/services/calendar', () => ({
  getCalendar: () => ({
    requestReadAccess: () => mockRequestReadAccess(),
    requestWriteAccess: () => mockRequestWriteAccess(),
    ensureWhenbeeCalendar: (id: string | null) => mockEnsureWhenbeeCalendar(id),
    listCalendars: () => mockListCalendars(),
  }),
}));

const mockDisableExport = jest.fn<Promise<number>, [string]>(() => Promise.resolve(0));

jest.mock('@/src/services/calendarExport', () => ({
  disableExport: (id: string) => mockDisableExport(id),
}));

jest.mock('@/src/services/analytics', () => ({
  analytics: { capture: jest.fn() },
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

jest.mock('@/src/features/paywall/useEntitlement', () => ({
  useEntitlement: (sel: (s: { isPro: boolean }) => unknown) =>
    sel({ isPro: mockIsPro }),
}));

let mockIsPro = true;

/* eslint-disable import/first */
import { CalendarSettingsSection } from '../CalendarSettingsSection';
import { useSettingsStore } from '@/src/stores/settingsStore';
/* eslint-enable import/first */

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsPro = true;
  mockRequestReadAccess.mockImplementation(() => Promise.resolve(true));
  mockRequestWriteAccess.mockImplementation(() => Promise.resolve(true));
  mockEnsureWhenbeeCalendar.mockImplementation(() => Promise.resolve('whenbee-cal-native'));
  mockDisableExport.mockImplementation(() => Promise.resolve(0));
  mockListCalendars.mockImplementation(() =>
    Promise.resolve([
      { id: 'cal-1', title: 'Personal' },
      { id: 'cal-2', title: 'Work' },
    ]),
  );
  useSettingsStore.setState({
    calendar: {
      showEvents: false,
      enabledCalendarIds: [],
      exportEnabled: false,
      whenbeeCalendarId: null,
    },
  });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('CalendarSettingsSection', () => {
  it('renders the master toggle in off state by default', () => {
    const { getByLabelText } = render(<CalendarSettingsSection />);
    const toggle = getByLabelText('Show calendar events');
    expect(toggle.props.value).toBe(false);
  });

  it('calls setShowEvents(true) + requestReadAccess when master toggle is turned on', async () => {
    const { getByLabelText } = render(<CalendarSettingsSection />);
    const toggle = getByLabelText('Show calendar events');

    await act(async () => {
      fireEvent(toggle, 'valueChange', true);
    });

    expect(mockRequestReadAccess).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().calendar.showEvents).toBe(true);
  });

  it('flips the toggle back to false when access is denied', async () => {
    mockRequestReadAccess.mockImplementation(() => Promise.resolve(false));
    const { getByLabelText } = render(<CalendarSettingsSection />);
    const toggle = getByLabelText('Show calendar events');

    await act(async () => {
      fireEvent(toggle, 'valueChange', true);
    });

    expect(useSettingsStore.getState().calendar.showEvents).toBe(false);
  });

  it('calls setShowEvents(false) without requesting access when master toggle is turned off', async () => {
    useSettingsStore.setState({ calendar: { showEvents: true, enabledCalendarIds: [], exportEnabled: false, whenbeeCalendarId: null } });
    const { getByLabelText } = render(<CalendarSettingsSection />);
    const toggle = getByLabelText('Show calendar events');

    await act(async () => {
      fireEvent(toggle, 'valueChange', false);
    });

    expect(mockRequestReadAccess).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().calendar.showEvents).toBe(false);
  });

  it('renders the calendar list when showEvents is true and access is granted', async () => {
    useSettingsStore.setState({ calendar: { showEvents: true, enabledCalendarIds: [], exportEnabled: false, whenbeeCalendarId: null } });
    const { findByText } = render(<CalendarSettingsSection />);

    await findByText('Personal');
    await findByText('Work');
  });

  it('does NOT render the calendar list when showEvents is false', () => {
    useSettingsStore.setState({ calendar: { showEvents: false, enabledCalendarIds: [], exportEnabled: false, whenbeeCalendarId: null } });
    const { queryByText } = render(<CalendarSettingsSection />);
    expect(queryByText('Personal')).toBeNull();
    expect(queryByText('Work')).toBeNull();
  });

  it('toggles a calendar in/out of enabledCalendarIds when tapped', async () => {
    useSettingsStore.setState({ calendar: { showEvents: true, enabledCalendarIds: [], exportEnabled: false, whenbeeCalendarId: null } });
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
      calendar: { showEvents: true, enabledCalendarIds: ['cal-1'], exportEnabled: false, whenbeeCalendarId: null },
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

// ── B1: Export toggle ─────────────────────────────────────────────────────────

// Mock clearAllCalendarLinks on dayTasksStore (needed for disable-export flow).
const mockClearAllCalendarLinks = jest.fn<Promise<void>, []>(() => Promise.resolve());
jest.mock('@/src/stores/dayTasksStore', () => ({
  useDayTasksStore: {
    getState: () => ({
      clearAllCalendarLinks: () => mockClearAllCalendarLinks(),
    }),
  },
}));

describe('CalendarSettingsSection — export toggle (B1)', () => {
  it('toggling ON (Pro, write granted) calls requestWriteAccess + ensureWhenbeeCalendar, stores the id, sets exportEnabled true', async () => {
    const { getByLabelText } = render(<CalendarSettingsSection />);
    // Label includes "currently off" suffix when export is off.
    const exportToggle = getByLabelText(/Add plan to a Whenbee calendar/i);

    await act(async () => {
      fireEvent(exportToggle, 'valueChange', true);
    });

    expect(mockRequestWriteAccess).toHaveBeenCalledTimes(1);
    expect(mockEnsureWhenbeeCalendar).toHaveBeenCalledWith(null);

    const { calendar } = useSettingsStore.getState();
    expect(calendar.whenbeeCalendarId).toBe('whenbee-cal-native');
    expect(calendar.exportEnabled).toBe(true);
  });

  it('shows the contract copy (Whenbee uses its own calendar) when export is enabled', async () => {
    const { getByLabelText, getByTestId } = render(<CalendarSettingsSection />);
    const exportToggle = getByLabelText(/Add plan to a Whenbee calendar/i);

    await act(async () => {
      fireEvent(exportToggle, 'valueChange', true);
    });

    // Contract copy is rendered — the testID is the source of truth.
    expect(getByTestId('export-contract-copy')).toBeTruthy();
  });

  it('stays off and shows a write-denied hint when write access is denied', async () => {
    mockRequestWriteAccess.mockImplementation(() => Promise.resolve(false));

    const { getByLabelText, queryByTestId, getByText } = render(<CalendarSettingsSection />);
    const exportToggle = getByLabelText(/Add plan to a Whenbee calendar/i);

    await act(async () => {
      fireEvent(exportToggle, 'valueChange', true);
    });

    expect(useSettingsStore.getState().calendar.exportEnabled).toBe(false);
    expect(mockEnsureWhenbeeCalendar).not.toHaveBeenCalled();
    // hint shown
    expect(getByText(/Calendar access is off/i)).toBeTruthy();
    // contract copy NOT shown (export still off)
    expect(queryByTestId('export-contract-copy')).toBeNull();
  });

  it('toggling OFF shows an Alert and on confirm calls disableExport + clearAllCalendarLinks, then clears ids', async () => {
    useSettingsStore.setState({
      calendar: {
        showEvents: false,
        enabledCalendarIds: [],
        exportEnabled: true,
        whenbeeCalendarId: 'whenbee-cal-native',
      },
    });
    alertSpy.mockImplementation((_title, _msg, buttons) => {
      // Simulate pressing the destructive "Remove and turn off" button.
      const destructive = (buttons as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === 'Remove and turn off',
      );
      destructive?.onPress?.();
    });

    const { getByLabelText } = render(<CalendarSettingsSection />);
    // When export is ON the label includes "currently on" and the contract note.
    const exportToggle = getByLabelText(/Add plan to a Whenbee calendar/i);

    await act(async () => {
      fireEvent(exportToggle, 'valueChange', false);
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(mockDisableExport).toHaveBeenCalledWith('whenbee-cal-native');
    // clearAllCalendarLinks must also be called (C1 wiring).
    expect(mockClearAllCalendarLinks).toHaveBeenCalledTimes(1);
    const { calendar } = useSettingsStore.getState();
    expect(calendar.exportEnabled).toBe(false);
    expect(calendar.whenbeeCalendarId).toBeNull();
  });

  it('free user: the export row routes to paywall (trigger calendar_export) and does NOT enable', async () => {
    mockIsPro = false;

    const { getByLabelText } = render(<CalendarSettingsSection />);

    // The row exists but tapping it routes to paywall (Pressable, not Switch).
    const exportRow = getByLabelText(/Add plan to a Whenbee calendar.*Pro feature/i);

    await act(async () => {
      fireEvent.press(exportRow);
    });

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(modals)/paywall',
      params: { trigger: 'calendar_export' },
    });
    expect(mockRequestWriteAccess).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().calendar.exportEnabled).toBe(false);
  });
});
