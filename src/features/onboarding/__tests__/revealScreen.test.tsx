import { render, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Reveal, { __resetRevealTrackingForTests } from '@/src/app/(onboarding)/reveal';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { analytics } from '@/src/services/analytics';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

const pushMock = router.push as jest.Mock;
const replaceMock = router.replace as jest.Mock;
const captureSpy = jest.spyOn(analytics, 'capture').mockImplementation(() => {});

beforeEach(() => {
  pushMock.mockClear();
  replaceMock.mockClear();
  captureSpy.mockClear();
  useOnboardingStore.setState({ quizAnswers: { pace: 'lot', mid: 'rabbit' } });
  useSettingsStore.getState().reset();
  __resetRevealTrackingForTests();
});

afterAll(() => {
  captureSpy.mockRestore();
});

describe('Reveal screen', () => {
  test('mounting fires quiz_completed and reveal_shown exactly once', () => {
    render(<Reveal />);
    expect(
      captureSpy.mock.calls.filter(([event]) => event === 'quiz_completed'),
    ).toHaveLength(1);
    expect(
      captureSpy.mock.calls.filter(([event]) => event === 'reveal_shown'),
    ).toHaveLength(1);
  });

  test('a same-answers re-mount (back-swipe round-trip) does not re-fire the funnel', () => {
    const { unmount } = render(<Reveal />);
    unmount();
    // Same answers still in the store — simulates reveal -> quiz -> reveal.
    render(<Reveal />);
    expect(
      captureSpy.mock.calls.filter(([event]) => event === 'quiz_completed'),
    ).toHaveLength(1);
    expect(
      captureSpy.mock.calls.filter(([event]) => event === 'reveal_shown'),
    ).toHaveLength(1);
  });

  test('double-tapping Continue pushes to categories only once', () => {
    render(<Reveal />);
    const cta = screen.getByText(/Sharpen it on my tasks/i);
    fireEvent.press(cta);
    fireEvent.press(cta);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/(onboarding)/categories');
  });
});
