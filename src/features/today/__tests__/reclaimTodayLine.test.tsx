import { render, screen } from '@testing-library/react-native';
import { ReclaimTodayLine } from '../ReclaimTodayLine';

describe('ReclaimTodayLine', () => {
  it('renders nothing when no minutes were reclaimed today', () => {
    render(<ReclaimTodayLine minutes={0} />);
    expect(screen.queryByText(/reclaimed today/)).toBeNull();
  });

  it('renders the BINDING copy with the minute total when there is reclaim', () => {
    render(<ReclaimTodayLine minutes={35} />);
    expect(screen.getByText('+35m reclaimed today')).toBeOnTheScreen();
  });
});
