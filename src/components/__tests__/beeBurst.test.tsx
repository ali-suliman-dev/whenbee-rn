import { render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { BeeBurst } from '@/src/components/bee/BeeBurst';

// BeeBurst → BeeMascot/RayBurst/CoinBadge all gate their ambient loops through
// expo-router's useFocusEffect/useNavigation (see useAmbientMotion). Stub a
// focused navigator so the mount-time effects run under test.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

describe('BeeBurst', () => {
  it('renders the upgrade variant (Proud-seal entrance) without crashing', () => {
    const { toJSON } = render(<BeeBurst variant="upgrade" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders the reward and aha variants without crashing (unchanged calm float)', () => {
    expect(render(<BeeBurst variant="reward" />).toJSON()).toBeTruthy();
    expect(render(<BeeBurst variant="aha" />).toJSON()).toBeTruthy();
  });

  it('renders the upgrade variant at its final static state under reduced motion', () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const { toJSON } = render(<BeeBurst variant="upgrade" />);
    const tree = toJSON();
    const treeJson = JSON.stringify(tree);
    expect(treeJson).toContain('beeGlow');

    // Final state: the eyes render as the STATIC open pair (BeeMascot's
    // `staticEyes`, width 50 / height 100 / rx 25 ink rects, rendered by
    // react-native-svg as host node type "RNSVGRect") — not the animated
    // `AnimatedRect` slit rects that blink under motion. Find every rect in
    // the rendered tree and assert the two eye rects (x=1355 / x=995) are at
    // their open resting height, never collapsed to the EYE_SLIT (8) shape.
    const rects: { props: Record<string, unknown> }[] = [];
    const collect = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as { type?: string; props?: Record<string, unknown>; children?: unknown[] };
      if (n.type === 'RNSVGRect') rects.push({ props: n.props ?? {} });
      if (Array.isArray(n.children)) n.children.forEach(collect);
    };
    collect(tree);
    const eyeRects = rects.filter((r) => r.props.x === 1355 || r.props.x === 995);
    expect(eyeRects.length).toBe(2);
    for (const eye of eyeRects) {
      expect(eye.props.height).toBe(100);
      expect(eye.props.rx).toBe(25);
    }

    (Reanimated.useReducedMotion as jest.Mock).mockRestore?.();
  });
});
