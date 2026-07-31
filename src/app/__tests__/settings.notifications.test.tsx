/**
 * Behavioral tests for the Notifications section of the Settings screen.
 *
 * Focus: per-type sub-rows are hidden when remindersEnabled is false and visible
 * when true; quiet-hours toggle + time-editor rows drive the store; sound chip
 * selector writes the correct value.
 */
import { render, fireEvent, act } from '@testing-library/react-native';
import Settings from '@/src/app/settings';
import { useSettingsStore } from '@/src/stores/settingsStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

// Start-by nudge now routes through useStartByToggle, which gates ON via
// ensureNotificationPermission before flipping the store. Mock it so ON/denied
// paths are deterministic instead of falling through to the native-module-absent
// no-op (always false) that the real implementation returns in unit tests.
const mockEnsurePermission = jest.fn(() => Promise.resolve(true));
jest.mock('@/src/services/timerNotifications', () => ({
  ensureNotificationPermission: () => mockEnsurePermission(),
  cancelStartBy: () => Promise.resolve(),
  cancelTimerDone: () => Promise.resolve(),
}));

beforeEach(() => {
  useSettingsStore.getState().reset();
  jest.clearAllMocks();
  mockEnsurePermission.mockImplementation(() => Promise.resolve(true));
});

describe('Settings — Notifications section', () => {
  it('hides per-type sub-rows when remindersEnabled is false, but Start-by nudge stays visible', () => {
    // After reset(), remindersEnabled is false.
    const { queryByLabelText, getByLabelText } = render(<Settings />);
    expect(queryByLabelText('Honest finish reached')).toBeNull();
    // Start-by nudge is plan-owned and independent of the master — always visible.
    expect(getByLabelText('Start-by nudge')).toBeTruthy();
  });

  it('shows per-type sub-rows when remindersEnabled is true', () => {
    useSettingsStore.setState({ remindersEnabled: true });
    const { getByLabelText } = render(<Settings />);
    expect(getByLabelText('Honest finish reached')).toBeTruthy();
    expect(getByLabelText('Start-by nudge')).toBeTruthy();
  });

  it('toggling Honest finish reached calls setHonestReachedEnabled', () => {
    useSettingsStore.setState({ remindersEnabled: true, honestReachedEnabled: true });
    const { getByLabelText } = render(<Settings />);
    const sw = getByLabelText('Honest finish reached');
    fireEvent(sw, 'valueChange', false);
    expect(useSettingsStore.getState().honestReachedEnabled).toBe(false);
  });

  it('toggling Start-by nudge off flips the store independently of remindersEnabled', async () => {
    useSettingsStore.setState({ remindersEnabled: false, startByEnabled: true });
    const { getByLabelText } = render(<Settings />);
    const sw = getByLabelText('Start-by nudge');
    await act(async () => {
      fireEvent(sw, 'valueChange', false);
    });
    expect(useSettingsStore.getState().startByEnabled).toBe(false);
  });

  it('toggling Start-by nudge on requests permission and flips the store when granted', async () => {
    mockEnsurePermission.mockImplementation(() => Promise.resolve(true));
    useSettingsStore.setState({ remindersEnabled: false, startByEnabled: false });
    const { getByLabelText } = render(<Settings />);
    const sw = getByLabelText('Start-by nudge');
    await act(async () => {
      fireEvent(sw, 'valueChange', true);
    });
    expect(useSettingsStore.getState().startByEnabled).toBe(true);
  });

  it('toggling Start-by nudge on shows a toast and leaves it off when permission is denied', async () => {
    mockEnsurePermission.mockImplementation(() => Promise.resolve(false));
    useSettingsStore.setState({ remindersEnabled: false, startByEnabled: false });
    const { getByLabelText, queryByText } = render(<Settings />);
    const sw = getByLabelText('Start-by nudge');
    await act(async () => {
      fireEvent(sw, 'valueChange', true);
    });
    expect(useSettingsStore.getState().startByEnabled).toBe(false);
    expect(queryByText('Allow notifications in iOS Settings to get reminders.')).toBeTruthy();
  });

  it('toggling Quiet hours switch updates the store', () => {
    useSettingsStore.setState({
      remindersEnabled: true,
      quietHours: { enabled: false, startMin: 1260, endMin: 480 },
    });
    const { getByLabelText } = render(<Settings />);
    const sw = getByLabelText('Quiet hours');
    fireEvent(sw, 'valueChange', true);
    expect(useSettingsStore.getState().quietHours.enabled).toBe(true);
  });

  it('quiet hours boundary rows appear only when quiet hours is enabled', () => {
    // Disabled — no boundary rows
    useSettingsStore.setState({
      remindersEnabled: true,
      quietHours: { enabled: false, startMin: 1260, endMin: 480 },
    });
    const { queryByLabelText, rerender } = render(<Settings />);
    expect(queryByLabelText('Quiet hours start time')).toBeNull();
    expect(queryByLabelText('Quiet hours end time')).toBeNull();

    // Enable quiet hours — boundary rows should appear
    act(() => {
      useSettingsStore.setState({ quietHours: { enabled: true, startMin: 1260, endMin: 480 } });
    });
    rerender(<Settings />);
    expect(queryByLabelText('Quiet hours start time')).toBeTruthy();
    expect(queryByLabelText('Quiet hours end time')).toBeTruthy();
  });

  it('tapping quiet hours start row opens the time editor', () => {
    useSettingsStore.setState({
      remindersEnabled: true,
      quietHours: { enabled: true, startMin: 1260, endMin: 480 },
    });
    const { getByLabelText, queryByText } = render(<Settings />);
    // Editor should not be open yet
    expect(queryByText('Quiet from')).toBeNull();
    // Tap the start-time row
    fireEvent.press(getByLabelText('Quiet hours start time'));
    // The modal title should now render
    expect(queryByText('Quiet from')).toBeTruthy();
  });

  it('tapping quiet hours end row opens the time editor with "Quiet until" title', () => {
    useSettingsStore.setState({
      remindersEnabled: true,
      quietHours: { enabled: true, startMin: 1260, endMin: 480 },
    });
    const { getByLabelText, queryByText } = render(<Settings />);
    expect(queryByText('Quiet until')).toBeNull();
    fireEvent.press(getByLabelText('Quiet hours end time'));
    expect(queryByText('Quiet until')).toBeTruthy();
  });

  it('sound chip selector writes the chosen value to the store', () => {
    useSettingsStore.setState({ remindersEnabled: true, notificationSound: 'honey' });
    const { getByText } = render(<Settings />);
    // Press the "None" chip
    fireEvent.press(getByText('None'));
    expect(useSettingsStore.getState().notificationSound).toBe('none');
  });

  it('Daily check-in row is always visible (not gated by remindersEnabled)', () => {
    // remindersEnabled is false after reset
    const { getByLabelText } = render(<Settings />);
    expect(getByLabelText('Daily check-in')).toBeTruthy();
  });

  it('master Reminders switch has accessibilityLabel "Reminders"', () => {
    const { getByLabelText } = render(<Settings />);
    expect(getByLabelText('Reminders')).toBeTruthy();
  });
});
