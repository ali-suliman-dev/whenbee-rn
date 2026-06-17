import { render, screen } from '@testing-library/react-native';
import { HonestNumber } from '@/src/components/HonestNumber';

describe('HonestNumber', () => {
  it('renders a big-size value with its unit', () => {
    render(<HonestNumber size="big" value="~30" unit="min" />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('min')).toBeOnTheScreen();
  });
});
