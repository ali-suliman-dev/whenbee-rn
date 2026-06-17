import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { OnboardingFooterCard } from '../OnboardingFooterCard';

test('renders glyph slot + text', () => {
  const { getByText } = render(
    <OnboardingFooterCard glyph={<Text>G</Text>}>Stays here.</OnboardingFooterCard>,
  );
  expect(getByText('G')).toBeTruthy();
  expect(getByText('Stays here.')).toBeTruthy();
});
