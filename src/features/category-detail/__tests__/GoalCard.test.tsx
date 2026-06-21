import { render, screen, act } from '@testing-library/react-native';
import { GoalCard } from '../GoalCard';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { kv } from '@/src/lib/kv';
import { analytics } from '@/src/services/analytics';

jest.spyOn(analytics, 'capture').mockImplementation(() => {});

function seedStat(categoryId: string, sharpness: number, n: number): void {
  useCalibrationStore.setState({
    statsByCategory: {
      [categoryId]: { mEffective: 1, n, sharpness, tier: 'Ripening', fit: { a: 0, b: 1 } },
    },
  });
}

describe('GoalCard loss-proof', () => {
  beforeEach(() => {
    kv.delete('goal.celebrated');
    kv.delete('goal.admin');
    useEntitlement.setState({ isPro: true });
    useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
    seedStat('admin', 70, 8); // band 30
    useCalibrationStore.getState().setGoal('admin', 25); // target 75, best 70
  });

  it('a sharpness dip does not lower the displayed best (the progress never retreats)', () => {
    const { rerender } = render(<GoalCard categoryId="admin" categoryName="Admin" />);
    // Active goal: best so far is the band of best=70 → within 30%.
    expect(screen.getByText('Best so far: within 30%')).toBeOnTheScreen();

    // A rough stretch drops live sharpness to 50 (band 50). The best is max-latched,
    // so loadGoal reconciles best up only — it must stay 70 (within 30%), never 50.
    act(() => seedStat('admin', 50, 9));
    rerender(<GoalCard categoryId="admin" categoryName="Admin" />);

    // Still within 30% — the dip is never surfaced and the best did not retreat.
    expect(screen.getByText('Best so far: within 30%')).toBeOnTheScreen();
    expect(screen.queryByText('Best so far: within 50%')).toBeNull();
  });

  it('renders the not-enough state below GOAL_MIN_LOGS', () => {
    kv.delete('goal.writing');
    seedStat('writing', 60, 3);
    render(<GoalCard categoryId="writing" categoryName="Writing" />);
    expect(screen.getByText('A few more logs and you can aim here')).toBeOnTheScreen();
    expect(screen.getByText('3 of 5 logged')).toBeOnTheScreen();
  });
});
