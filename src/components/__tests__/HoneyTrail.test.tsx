import { render } from '@testing-library/react-native';
import { HoneyTrail } from '../HoneyTrail';

// useFocusEffect runs its effect immediately in tests (no real navigation focus).
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

const nodes = [
  { label: 'Raw', state: 'done' as const },
  { label: 'Setting', state: 'done' as const },
  { label: 'Ripening', state: 'now' as const },
  { label: 'Thickening', state: 'ahead' as const },
  { label: 'Honest', state: 'ahead' as const },
];

test('renders a label per node', () => {
  const { getByText } = render(<HoneyTrail nodes={nodes} />);
  nodes.forEach((n) => expect(getByText(n.label)).toBeTruthy());
});

test('exposes accessible state per node', () => {
  const { getByLabelText } = render(<HoneyTrail nodes={nodes} />);
  expect(getByLabelText('Ripening: now')).toBeTruthy();
  expect(getByLabelText('Honest: ahead')).toBeTruthy();
});
