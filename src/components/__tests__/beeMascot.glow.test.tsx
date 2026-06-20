import { render } from '@testing-library/react-native';
import { BeeMascot } from '@/src/components/BeeMascot';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

describe('BeeMascot glow prop', () => {
  it('renders without crashing when glow is disabled', () => {
    const { toJSON } = render(<BeeMascot size={120} variant="stage-4" seed={1} glow={false} />);
    const tree = JSON.stringify(toJSON());
    // The glow halo uses a RadialGradient id "beeGlow"; with glow off it must be absent.
    expect(tree).not.toContain('beeGlow');
  });
  it('renders the glow by default', () => {
    const { toJSON } = render(<BeeMascot size={120} variant="stage-4" seed={1} />);
    expect(JSON.stringify(toJSON())).toContain('beeGlow');
  });
});
