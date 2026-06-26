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
    const { rerender } = render(
      <GoalCard categoryId="admin" categoryName="Admin" lever={null} ratios={[]} currentAccuracy={70} />,
    );
    // Active goal: best so far is the band of best=70 → ±30%.
    expect(screen.getByText('±30%')).toBeOnTheScreen();

    // A rough stretch drops live sharpness to 50 (band 50). The best is max-latched,
    // so loadGoal reconciles best up only — it must stay 70 (±30%), never 50.
    act(() => seedStat('admin', 50, 9));
    rerender(<GoalCard categoryId="admin" categoryName="Admin" lever={null} ratios={[]} currentAccuracy={50} />);

    // Still ±30% — the dip is never surfaced and the best did not retreat.
    expect(screen.getByText('±30%')).toBeOnTheScreen();
    expect(screen.queryByText('±50%')).toBeNull();
  });

  it('shows the biggest-lever coach row when a real lever is present', () => {
    render(
      <GoalCard
        categoryId="admin"
        categoryName="Admin"
        currentAccuracy={70}
        ratios={[]}
        lever={{
          key: 'timeOfDay',
          bestValue: 'evenings',
          worstValue: 'mornings',
          bestAccuracy: 90,
          worstAccuracy: 60,
          gap: 30,
          sampleCount: 8,
        }}
      />,
    );
    expect(screen.getByText('Your biggest lever')).toBeOnTheScreen();
    expect(screen.getByText('mornings')).toBeOnTheScreen();
  });

  it('renders the not-enough state below GOAL_MIN_LOGS', () => {
    kv.delete('goal.writing');
    seedStat('writing', 60, 3);
    render(<GoalCard categoryId="writing" categoryName="Writing" lever={null} ratios={[]} currentAccuracy={60} />);
    expect(screen.getByText('A few more logs and you can aim here')).toBeOnTheScreen();
    expect(screen.getByText('3 of 5 logged')).toBeOnTheScreen();
  });
});
