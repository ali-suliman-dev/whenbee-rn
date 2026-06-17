import { render } from '@testing-library/react-native';
import { Chip } from '../Chip';

test('add variant renders its label and is a button', () => {
  const { getByText, getByRole } = render(<Chip label="Add your own" variant="add" onPress={() => {}} />);
  expect(getByText('Add your own')).toBeTruthy();
  expect(getByRole('button')).toBeTruthy();
});

test('default selectable chip renders', () => {
  const { getByText } = render(<Chip label="Cooking" selected onPress={() => {}} />);
  expect(getByText('Cooking')).toBeTruthy();
});
