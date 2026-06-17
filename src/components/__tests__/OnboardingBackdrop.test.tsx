import { render } from '@testing-library/react-native';
import { OnboardingBackdrop } from '../OnboardingBackdrop';

test('renders', () => {
  expect(render(<OnboardingBackdrop />).toJSON()).toBeTruthy();
});
