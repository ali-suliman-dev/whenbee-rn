import { render, fireEvent } from '@testing-library/react-native';
import { ArchetypeReveal } from '../ArchetypeReveal';

// The crest's BeeMascot runs ambient motion via useFocusEffect — stub the router
// hooks so it renders outside a navigation container (same as beeMascot.glow.test).
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({ isFocused: () => true, addListener: () => () => {} }),
}));

it('reveals the archetype and continues', () => {
  const onContinue = jest.fn();
  const { getByText } = render(
    <ArchetypeReveal
      title="The Gentle Optimist"
      blurb="You lean hopeful."
      multiplier={1.5}
      onContinue={onContinue}
    />,
  );
  expect(getByText('The Gentle Optimist')).toBeTruthy();
  fireEvent.press(getByText(/continue|see my day|let's go/i));
  expect(onContinue).toHaveBeenCalled();
});
