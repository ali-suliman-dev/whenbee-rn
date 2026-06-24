/**
 * Behavioral tests for the Notifications section of the Settings screen.
 *
 * Focus: per-type sub-rows are hidden when remindersEnabled is false and visible
 * when true; quiet-hours toggle drives the store setter.
 */
import { render, fireEvent } from '@testing-library/react-native';
import Settings from '@/src/app/settings';
import { useSettingsStore } from '@/src/stores/settingsStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

beforeEach(() => {
  useSettingsStore.getState().reset();
  jest.clearAllMocks();
});

describe('Settings — Notifications section', () => {
  it('hides per-type sub-rows when remindersEnabled is false', () => {
    // After reset(), remindersEnabled is false.
    const { queryByLabelText } = render(<Settings />);
    expect(queryByLabelText('Honest finish reached')).toBeNull();
    expect(queryByLabelText('Start-by nudge')).toBeNull();
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

  it('toggling Start-by nudge calls setStartByEnabled', () => {
    useSettingsStore.setState({ remindersEnabled: true, startByEnabled: true });
    const { getByLabelText } = render(<Settings />);
    const sw = getByLabelText('Start-by nudge');
    fireEvent(sw, 'valueChange', false);
    expect(useSettingsStore.getState().startByEnabled).toBe(false);
  });

  it('toggling Quiet hours switch updates the store', () => {
    useSettingsStore.setState({ remindersEnabled: true, quietHours: { enabled: false, startMin: 1260, endMin: 480 } });
    const { getByLabelText } = render(<Settings />);
    const sw = getByLabelText('Quiet hours');
    fireEvent(sw, 'valueChange', true);
    expect(useSettingsStore.getState().quietHours.enabled).toBe(true);
  });

  it('Daily check-in row is always visible (not gated by remindersEnabled)', () => {
    // remindersEnabled is false after reset
    const { getByLabelText } = render(<Settings />);
    expect(getByLabelText('Daily check-in')).toBeTruthy();
  });
});
