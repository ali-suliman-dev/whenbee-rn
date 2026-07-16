import { render, fireEvent } from '@testing-library/react-native';
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

beforeEach(() => {
  useOnboardingStore.getState().reset();
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
