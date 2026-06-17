import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { HoneyRing } from '../HoneyRing';

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
});
