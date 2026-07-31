import { render, fireEvent } from '@testing-library/react-native';
import { QuizStepScreen } from '../QuizStepScreen';
import { StepProgress } from '../StepProgress';
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

it('exposes quiz options as radios in a group', () => {
  const tree = render(<QuizStepScreen step={0} />);
  // The radiogroup wrapper stays a plain (non-`accessible`) container on purpose —
  // marking it `accessible` would collapse VoiceOver into one opaque stop and hide
  // the individual radios beneath it, so we assert the semantic prop directly
  // instead of going through the accessible-element gate `getByRole` requires.
  expect(tree.UNSAFE_getByProps({ accessibilityRole: 'radiogroup' })).toBeTruthy();
  const radios = tree.getAllByRole('radio');
  expect(radios).toHaveLength(4);
  expect(radios[0].props.accessibilityState.checked).toBe(false);
});

it('marks the chosen option checked', () => {
  const tree = render(<QuizStepScreen step={0} />);
  fireEvent.press(tree.getByText('About right'));
  expect(tree.getAllByRole('radio')[0].props.accessibilityState.checked).toBe(true);
});

it('gives the progress bar a value, not just a label', () => {
  const tree = render(<StepProgress current={2} total={7} />);
  expect(tree.getByRole('progressbar').props.accessibilityValue).toEqual({ min: 0, max: 7, now: 3 });
});
