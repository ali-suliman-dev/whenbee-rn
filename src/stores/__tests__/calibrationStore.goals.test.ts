import { useCalibrationStore } from '../calibrationStore';
import { errorBandToAccuracy } from '@/src/engine';
import { kv } from '@/src/lib/kv';
import { analytics } from '@/src/services/analytics';

// Silence the analytics sink; the goal_set event fires inside setGoal.
jest.spyOn(analytics, 'capture').mockImplementation(() => {});

/** Seed a single category's cached stat (sharpness + n) the way the store reads it.
 *  Goals read `statsByCategory[id]?.sharpness` and `.n` only — nothing else needed. */
function seedStat(categoryId: string, sharpness: number, n: number): void {
  useCalibrationStore.setState({
    statsByCategory: {
      [categoryId]: { mEffective: 1, n, sharpness, tier: 'Ripening', fit: { a: 0, b: 1 } },
    },
  });
}

/** Drop every kv key so a goal/celebration ledger never leaks between tests
 *  (the kv mock persists its Map across a file). */
function clearGoalKeys(categoryIds: string[]): void {
  kv.delete('goal.celebrated');
  for (const id of categoryIds) kv.delete(`goal.${id}`);
}

describe('calibrationStore goals', () => {
  beforeEach(() => {
    clearGoalKeys(['admin', 'writing']);
    useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  });

  it('setGoal persists a goal built from current sharpness', () => {
    seedStat('admin', 60, 6);
    const g = useCalibrationStore.getState().setGoal('admin', 25);
    expect(g.targetAccuracy).toBe(errorBandToAccuracy(25)); // 75
    expect(g.baselineAccuracy).toBe(60);
    expect(g.bestAccuracy).toBe(60);
    expect(g.met).toBe(false);
    expect(useCalibrationStore.getState().loadGoal('admin')?.targetAccuracy).toBe(75);
  });

  it('loadGoal reconciles best upward against improved sharpness and persists it', () => {
    seedStat('admin', 60, 6);
    useCalibrationStore.getState().setGoal('admin', 25); // baseline/best 60

    // Sharpness climbs to 72 → loadGoal advances best.
    seedStat('admin', 72, 8);
    const g = useCalibrationStore.getState().loadGoal('admin');
    expect(g?.bestAccuracy).toBe(72);

    // A later dip to 50 must NOT lower the persisted best (loss-proof).
    seedStat('admin', 50, 9);
    expect(useCalibrationStore.getState().loadGoal('admin')?.bestAccuracy).toBe(72);
  });

  it('loadGoal latches met once best reaches target and keeps it through a dip', () => {
    seedStat('admin', 60, 6);
    useCalibrationStore.getState().setGoal('admin', 25); // target 75
    seedStat('admin', 78, 8);
    expect(useCalibrationStore.getState().loadGoal('admin')?.met).toBe(true);
    seedStat('admin', 40, 9);
    expect(useCalibrationStore.getState().loadGoal('admin')?.met).toBe(true);
  });

  it('clearGoal removes it and its celebration entry', () => {
    seedStat('admin', 60, 6);
    useCalibrationStore.getState().setGoal('admin', 25);
    useCalibrationStore.getState().markGoalCelebrated('admin');
    expect(useCalibrationStore.getState().hasCelebratedGoal('admin')).toBe(true);
    useCalibrationStore.getState().clearGoal('admin');
    expect(useCalibrationStore.getState().loadGoal('admin')).toBeNull();
    expect(useCalibrationStore.getState().hasCelebratedGoal('admin')).toBe(false);
  });

  it('markGoalCelebrated is idempotent and latched', () => {
    useCalibrationStore.getState().markGoalCelebrated('admin');
    useCalibrationStore.getState().markGoalCelebrated('admin');
    expect(useCalibrationStore.getState().hasCelebratedGoal('admin')).toBe(true);
  });

  it('loadGoal returns null when none set', () => {
    expect(useCalibrationStore.getState().loadGoal('writing')).toBeNull();
  });
});
