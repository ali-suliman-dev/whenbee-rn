import { render } from '@testing-library/react-native';
import { LockGlyph } from '../LockGlyph';

test('renders a lock with accessible label', () => {
  const { getByLabelText } = render(<LockGlyph />);
  expect(getByLabelText('Locked — stored on this device')).toBeTruthy();
});
