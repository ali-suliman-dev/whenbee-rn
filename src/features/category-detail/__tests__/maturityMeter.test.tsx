import { render, screen } from '@testing-library/react-native';
import { MaturityMeter } from '@/src/features/category-detail/MaturityMeter';
import { maturityMeter } from '@/src/features/category-detail/maturity';

describe('MaturityMeter', () => {
  it('shows the runs-left caption while learning', () => {
    render(<MaturityMeter meter={maturityMeter(2, 'setting')} />);
    expect(screen.getByText(/4 more runs/)).toBeOnTheScreen();
    expect(screen.getByText(/sharpen this to one number/)).toBeOnTheScreen();
  });

  it('singularizes a single remaining run', () => {
    render(<MaturityMeter meter={maturityMeter(5, 'setting')} />);
    expect(screen.getByText(/1 more run/)).toBeOnTheScreen();
  });

  it('shows the settle nudge when enough logs but still noisy', () => {
    render(<MaturityMeter meter={maturityMeter(8, 'setting')} />);
    expect(screen.getByText(/A few more runs and this settles/)).toBeOnTheScreen();
  });
});
