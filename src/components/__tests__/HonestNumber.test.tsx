import { render, screen } from '@testing-library/react-native';
import { HonestNumber } from '@/src/components/HonestNumber';

describe('HonestNumber', () => {
  it('renders an md-size value with its unit', () => {
    render(<HonestNumber size="md" value="~30" unit="min" />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('min')).toBeOnTheScreen();
  });
});
