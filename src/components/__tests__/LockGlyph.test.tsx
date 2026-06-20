import { render } from '@testing-library/react-native';
import { LockGlyph } from '../LockGlyph';

// useFocusEffect runs its effect immediately in tests (no real navigation focus).
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

test('renders a lock with accessible label', () => {
  const { getByLabelText } = render(<LockGlyph />);
  expect(getByLabelText('Locked — stored on this device')).toBeTruthy();
});
