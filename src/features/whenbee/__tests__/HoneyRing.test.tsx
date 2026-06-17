import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
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
});
