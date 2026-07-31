import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { QuizStepScreen } from '../QuizStepScreen';
import { useOnboardingStore } from '@/src/stores/onboardingStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

const pushMock = router.push as jest.Mock;

beforeEach(() => {
  useOnboardingStore.getState().reset();
  pushMock.mockClear();
});

it('tells the user why Next is disabled, and stops once they answer', () => {
  const tree = render(<QuizStepScreen step={0} />);
  expect(tree.getByText('Pick one to continue')).toBeTruthy();

  fireEvent.press(tree.getByText('About right'));
  expect(tree.queryByText('Pick one to continue')).toBeNull();
});

it('offers no skip — the quiz is the product', () => {
  const tree = render(<QuizStepScreen step={0} />);
  expect(tree.queryByText('Skip to my type')).toBeNull();
  expect(tree.queryByText(/skip/i)).toBeNull();
});

it('double-tapping Next advances only once', () => {
  const tree = render(<QuizStepScreen step={0} />);
  fireEvent.press(tree.getByText('About right'));
  const next = tree.getByText('Next →');
  fireEvent.press(next);
  fireEvent.press(next);
  expect(pushMock).toHaveBeenCalledTimes(1);
  expect(pushMock).toHaveBeenCalledWith('/(onboarding)/quiz/1');
});
