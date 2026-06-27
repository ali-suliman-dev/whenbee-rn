import { render, fireEvent } from '@testing-library/react-native';
import { ArchetypeReveal } from '../ArchetypeReveal';

// The crest's BeeMascot runs ambient motion via useFocusEffect — stub the router
// hooks so it renders outside a navigation container (same as beeMascot.glow.test).
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({ isFocused: () => true, addListener: () => () => {} }),
}));

const QUIZ_ANSWERS = { pace: 'lot' as const, mid: 'rabbit' as const };

it('reveals the archetype, echo line, and continues', () => {
  const onContinue = jest.fn();
  const { getByText } = render(
    <ArchetypeReveal
      title="The Gentle Optimist"
      blurb="You lean hopeful."
      multiplier={1.5}
      quizAnswers={QUIZ_ANSWERS}
      onContinue={onContinue}
    />,
  );
  expect(getByText('The Gentle Optimist')).toBeTruthy();
  // Echo line renders with the prefix and engine output.
  expect(getByText(/From your answers:/)).toBeTruthy();
  // CTA uses the new label from §D.
  fireEvent.press(getByText(/Sharpen it on my tasks/i));
  expect(onContinue).toHaveBeenCalled();
});
