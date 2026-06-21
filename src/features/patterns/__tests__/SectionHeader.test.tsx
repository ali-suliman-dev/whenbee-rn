import { render } from '@testing-library/react-native';
import { SectionHeader } from '../SectionHeader';

it('renders its label', () => {
  const { getByText } = render(<SectionHeader label="Your progress" />);
  expect(getByText('Your progress')).toBeTruthy();
});
