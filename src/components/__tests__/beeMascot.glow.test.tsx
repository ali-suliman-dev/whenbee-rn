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

  // The bee's yellows are the fixed honey color at all times — never recolored by
  // seed. Two installs (different seeds) must render byte-identical, so there is no
  // reddish-hue flash when the real install seed loads after first render.
  it('renders identical yellows regardless of seed', () => {
    const a = JSON.stringify(render(<BeeMascot size={120} variant="stage-4" seed={1} />).toJSON());
    const b = JSON.stringify(
      render(<BeeMascot size={120} variant="stage-4" seed={874213} />).toJSON(),
    );
    expect(a).toEqual(b);
  });

  it('paints the head/stripes with the honey token, never a red-orange', () => {
    // RNSVG serializes a fill as a packed ARGB int. The yellows must be the honey
    // tokens: stripe #F6B442 → 0xFFF6B442, head-shadow #EA980B → 0xFFEA980B.
    const tree = JSON.stringify(render(<BeeMascot size={120} variant="stage-4" seed={874213} />).toJSON());
    expect(tree).toContain(String(0xfff6b442)); // brand.bee.stripe (honey)
    expect(tree).toContain(String(0xffea980b)); // brand.bee.stripeLo (head shadow)
  });
});
