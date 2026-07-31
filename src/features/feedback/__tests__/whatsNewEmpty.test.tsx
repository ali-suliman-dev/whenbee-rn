import { render } from '@testing-library/react-native';
import { WhatsNewEmpty } from '@/src/features/feedback/WhatsNewEmpty';

// BeeMascot's ambient loops gate through expo-router's useFocusEffect/useNavigation
// (see useAmbientMotion) — stub a focused navigator so mount-time effects don't blow
// up under test even though `sleepy` renders the static (non-animated) path.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

describe('WhatsNewEmpty', () => {
  it('renders the resting-bee title and subtitle', () => {
    const { getByText } = render(<WhatsNewEmpty />);
    expect(getByText('All quiet for now')).toBeTruthy();
    expect(
      getByText('When I ship something you asked for, it lands right here.'),
    ).toBeTruthy();
  });
});
