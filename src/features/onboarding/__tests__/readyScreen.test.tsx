import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import Ready from '@/src/app/(onboarding)/ready';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useSettingsStore } from '@/src/stores/settingsStore';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

const replaceMock = router.replace as jest.Mock;
const pushMock = router.push as jest.Mock;

describe('Onboarding Step 2 — Ready screen', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    useOnboardingStore.setState({ completed: false, picked: [] });
  });

  test('ready shows trail, legend, promise, nickname field, CTA', () => {
    render(<Ready />);
    expect(screen.getByText('Raw')).toBeTruthy();
    // Trail legend — new copy from §E
    expect(screen.getByText(/Your accuracy ripens as you log/i)).toBeTruthy();
    expect(screen.getByText(/no streak to break/i)).toBeTruthy();
    expect(screen.getByText(/Empty days are fine/i)).toBeTruthy();
    expect(screen.getByText(/Forgot to time something\? Add it in one tap/i)).toBeTruthy();
    // Optional nickname field — demoted to tap-to-reveal ghost row
    expect(screen.getByLabelText('Set a nickname')).toBeTruthy();
    expect(screen.queryByLabelText('Your nickname')).toBeNull();
    // CTA — new label from §E
    expect(screen.getByText(/Time my first thing/)).toBeTruthy();
  });

  test('tapping "Set a nickname" reveals the input', () => {
    render(<Ready />);
    expect(screen.queryByLabelText('Your nickname')).toBeNull();
    fireEvent.press(screen.getByLabelText('Set a nickname'));
    expect(screen.getByLabelText('Your nickname')).toBeTruthy();
  });

  test('CTA with no nickname calls replace to tabs', () => {
    render(<Ready />);
    fireEvent.press(screen.getByText(/Time my first thing/));
    expect(replaceMock).toHaveBeenCalledWith('/(tabs)');
  });

  test('expanding then leaving the nickname empty still completes without a name', () => {
    useSettingsStore.setState({ displayName: undefined });
    render(<Ready />);
    fireEvent.press(screen.getByLabelText('Set a nickname'));
    fireEvent.press(screen.getByText(/Time my first thing/));
    expect(useOnboardingStore.getState().completed).toBe(true);
    expect(useSettingsStore.getState().displayName).toBeUndefined();
  });

  test('CTA with a nickname saves it before completing', () => {
    render(<Ready />);
    fireEvent.press(screen.getByLabelText('Set a nickname'));
    fireEvent.changeText(screen.getByLabelText('Your nickname'), 'Jordan');
    fireEvent.press(screen.getByText(/Time my first thing/));
    expect(replaceMock).toHaveBeenCalledWith('/(tabs)');
    expect(useOnboardingStore.getState().completed).toBe(true);
    expect(useSettingsStore.getState().displayName).toBe('Jordan');
  });

  test('double-tapping the CTA only completes onboarding once', () => {
    render(<Ready />);
    const cta = screen.getByText(/Time my first thing/);
    fireEvent.press(cta);
    fireEvent.press(cta);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  test('hands off into the add-task sheet, not a bare tab screen', () => {
    render(<Ready />);
    fireEvent.press(screen.getByText(/Time my first thing/));
    expect(replaceMock).toHaveBeenCalledWith('/(tabs)');
    expect(pushMock).toHaveBeenCalledWith('/(modals)/add-task');
    // anchor (tabs) beneath the modal before opening it
    const replaceOrder = replaceMock.mock.invocationCallOrder[0];
    const pushOrder = pushMock.mock.invocationCallOrder[0];
    expect(replaceOrder).toBeDefined();
    expect(pushOrder).toBeDefined();
    expect(replaceOrder).toBeLessThan(pushOrder as number);
  });

  test('completes onboarding before handing off', () => {
    render(<Ready />);
    fireEvent.press(screen.getByText(/Time my first thing/));
    expect(useOnboardingStore.getState().completed).toBe(true);
    expect(pushMock).toHaveBeenCalledWith('/(modals)/add-task');
  });
});
