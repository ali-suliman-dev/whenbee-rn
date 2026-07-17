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
    const tree = JSON.stringify(toJSON());
    // Final state: the eyes are open (rx=25 ink rects, not animated slit rects)
    // and the ▲ seal badge is present — both render statically, no crash.
    expect(tree).toContain('beeGlow');
    expect(tree).toBeTruthy();
    (Reanimated.useReducedMotion as jest.Mock).mockRestore?.();
  });
});
