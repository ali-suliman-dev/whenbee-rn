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
    useSettingsStore.getState().reset();
  });

  test('ready shows the archetype crest, headline, ripening rail, nickname link, CTA', () => {
    useSettingsStore.setState({
      archetypeSeed: { m0: 1.7, source: 'quiz', tookAt: Date.now() },
    });
    render(<Ready />);
    expect(screen.getByText('Your time-style')).toBeTruthy();
    expect(screen.getByText('The Sprint Optimist')).toBeTruthy();
    expect(screen.getByText(/Your first/)).toBeTruthy();
    expect(screen.getByText('honest')).toBeTruthy();
    expect(screen.getByText(/times are already set/)).toBeTruthy();
    expect(screen.getByText(/I read them from your time-style/i)).toBeTruthy();
    // Ripening rail — five stages, no guilt/streak framing
    expect(screen.getByText('Raw')).toBeTruthy();
    expect(screen.getByText('Honest')).toBeTruthy();
    // The "forgot to time something" tip is gone
    expect(screen.queryByText(/Forgot to time something/i)).toBeNull();
    // Optional nickname — 6C quiet link, tap-to-reveal
    expect(screen.getByLabelText('Set a nickname')).toBeTruthy();
    expect(screen.getByText('Give me a nickname')).toBeTruthy();
    expect(screen.queryByLabelText('Your nickname')).toBeNull();
    expect(screen.getByText(/Time my first thing/)).toBeTruthy();
  });

  test('falls back to a neutral kicker with no archetype title when the quiz was skipped', () => {
    render(<Ready />);
    expect(screen.getByText("You're calibrated")).toBeTruthy();
    expect(screen.queryByText('Your time-style')).toBeNull();
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
