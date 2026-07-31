import { render, screen } from '@testing-library/react-native';
import { StatColumn } from '@/src/features/today/StatColumn';

describe('StatColumn', () => {
  it('renders the value and its label', () => {
    render(<StatColumn value="2h 45m" label="HONEST" />);
    expect(screen.getByText('2h 45m')).toBeTruthy();
    expect(screen.getByText('HONEST')).toBeTruthy();
  });

  it('renders an optional unit suffix beside the value', () => {
    render(<StatColumn value="4" unit="tasks" label="LOGGED" />);
    expect(screen.getByText('tasks')).toBeTruthy();
  });

  it('omits the unit element when no unit is given', () => {
    render(<StatColumn value="4" label="LOGGED" />);
    expect(screen.queryByText('tasks')).toBeNull();
  });
});
