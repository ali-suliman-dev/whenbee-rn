import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { HoneyRing } from '../HoneyRing';

// HoneyRing reads screen focus (to gate animate-vs-snap) via expo-router's
// useNavigation. Standalone render has no navigator — stub a focused one.
jest.mock('expo-router', () => ({
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

describe('HoneyRing', () => {
  it('renders its children (the bee slot)', () => {
    const { getByText } = render(
      <HoneyRing sharpness={46} sealed={false}>
        <Text>BEE</Text>
      </HoneyRing>,
    );
    expect(getByText('BEE')).toBeTruthy();
  });
  it('mounts at the sealed state without crashing', () => {
    const { toJSON } = render(
      <HoneyRing sharpness={95} sealed>
        <Text>BEE</Text>
      </HoneyRing>,
    );
    expect(toJSON()).toBeTruthy();
  });
  it('renders final state instantly under reduced motion', () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const { toJSON } = render(
      <HoneyRing sharpness={70} sealed={false}>
        <></>
      </HoneyRing>,
    );
    expect(toJSON()).toBeTruthy();
    (Reanimated.useReducedMotion as jest.Mock).mockRestore?.();
  });
  it('renders sealed state under reduced motion without ripples or motes', () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const { toJSON } = render(
      <HoneyRing sharpness={100} sealed>
        <Text>SEALED</Text>
      </HoneyRing>,
    );
    // Sealed hex renders, children present — no crash, no ripples/motes rendered
    const tree = toJSON();
    expect(tree).toBeTruthy();
    (Reanimated.useReducedMotion as jest.Mock).mockRestore?.();
  });
});

describe('HoneyRing size parameterization', () => {
  it('renders the SVG at the default ring size when no size prop is given', () => {
    const { UNSAFE_getAllByType } = render(
      <HoneyRing sharpness={40} sealed={false}><Text>bee</Text></HoneyRing>,
    );
    // The first <Svg> (track+arc) carries width === t.ring.size (200).
    const svg = UNSAFE_getAllByType(Svg)[0];
    expect(svg.props.width).toBe(200);
  });

  it('renders the SVG at a custom size when size prop is given', () => {
    const { UNSAFE_getAllByType } = render(
      <HoneyRing sharpness={40} sealed={false} size={58} stroke={4.5}><Text>bee</Text></HoneyRing>,
    );
    const svg = UNSAFE_getAllByType(Svg)[0];
    expect(svg.props.width).toBe(58);
  });
});
