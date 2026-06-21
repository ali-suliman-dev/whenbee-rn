import { renderHook, act } from '@testing-library/react-native';
import { useCategoryGoal } from '../useCategoryGoal';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
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

describe('useCategoryGoal', () => {
  beforeEach(() => {
    kv.delete('goal.celebrated');
    kv.delete('goal.admin');
    useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
    seedStat('admin', 60, 6);
  });

  it('canSet reflects log count and exposes tighter presets', () => {
    const { result } = renderHook(() => useCategoryGoal('admin'));
    expect(result.current.canSet).toBe(true);
    expect(result.current.presets.every((b) => b < result.current.currentBand)).toBe(true);
  });

  it('canSet is false below GOAL_MIN_LOGS', () => {
    seedStat('admin', 60, 4);
    const { result } = renderHook(() => useCategoryGoal('admin'));
    expect(result.current.canSet).toBe(false);
  });

  it('setGoal then reads back an active goal', () => {
    const { result } = renderHook(() => useCategoryGoal('admin'));
    act(() => result.current.setGoal(25));
    expect(result.current.goal?.targetAccuracy).toBe(75);
  });
});
