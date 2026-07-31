import { render } from '@testing-library/react-native';
import { BeeMascot } from '@/src/components/BeeMascot';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

describe('BeeMascot sleepy prop', () => {
  it('renders without crashing when sleepy', () => {
    const { toJSON } = render(<BeeMascot size={120} sleepy />);
    expect(toJSON()).toBeTruthy();
  });

  it('swaps the open-eye rects for closed-eye arc paths when sleepy', () => {
    const tree = JSON.stringify(render(<BeeMascot size={120} sleepy />).toJSON());
    // Sleepy closed-lid arcs (see BeeMascot's sleepyEyes).
    expect(tree).toContain('M1315 930 q45 34 90 0');
    expect(tree).toContain('M955 930 q45 34 90 0');
  });

  it('leaves the default (non-sleepy) bee unchanged: open-eye rects still present', () => {
    const tree = JSON.stringify(render(<BeeMascot size={120} />).toJSON());
    expect(tree).not.toContain('M1315 930 q45 34 90 0');
    // The static open-eye rects (x=1355 / x=995, height 100) are still there.
    const rects: { props: Record<string, unknown> }[] = [];
    const treeObj = render(<BeeMascot size={120} />).toJSON();
    const collect = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as { type?: string; props?: Record<string, unknown>; children?: unknown[] };
      if (n.type === 'RNSVGRect') rects.push({ props: n.props ?? {} });
      if (Array.isArray(n.children)) n.children.forEach(collect);
    };
    collect(treeObj);
    const eyeRects = rects.filter((r) => r.props.x === 1355 || r.props.x === 995);
    expect(eyeRects.length).toBe(2);
    for (const eye of eyeRects) {
      expect(eye.props.height).toBe(100);
      expect(eye.props.rx).toBe(25);
    }
  });
});
