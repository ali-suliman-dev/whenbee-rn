import { render } from '@testing-library/react-native';
import { DiscoveryHex } from '../DiscoveryHex';

test('renders for the longer direction', () => {
  const { toJSON } = render(<DiscoveryHex direction="longer" size={30} />);
  expect(toJSON()).toBeTruthy();
});

test('renders for the faster direction', () => {
  const { toJSON } = render(<DiscoveryHex direction="faster" size={30} />);
  expect(toJSON()).toBeTruthy();
});
