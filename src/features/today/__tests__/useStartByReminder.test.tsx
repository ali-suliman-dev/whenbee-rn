import { renderHook } from '@testing-library/react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSchedule = jest.fn((_o?: unknown) => Promise.resolve());
const mockCancel = jest.fn(() => Promise.resolve());
jest.mock('@/src/services/timerNotifications', () => ({
  scheduleStartBy: (o: unknown) => mockSchedule(o),
  cancelStartBy: () => mockCancel(),
}));

/* eslint-disable import/first */
import { useStartByReminder } from '../useStartByReminder';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { PlanResult } from '@/src/domain/types';
/* eslint-enable import/first */

// A minimal plan whose first task item drives the reminder. `deadline` is the
// max endAt across the timeline; a leading breather is ignored for the label.
function makePlan(startBy: number, opts?: { firstLabel?: string; deadline?: number }): PlanResult {
  const deadline = opts?.deadline ?? startBy + 60 * 60_000;
  return {
    startBy,
    timeline: [
      { id: 'b1', label: '', startAt: startBy, endAt: startBy + 5 * 60_000, kind: 'breather' },
      { id: 't1', label: opts?.firstLabel ?? 'Write report', startAt: startBy + 5 * 60_000, endAt: deadline, kind: 'task' },
    ],
    verdict: { kind: 'fits', startBy },
    totalMin: Math.round((deadline - startBy) / 60_000),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ remindersEnabled: true, startByEnabled: true });
});

describe('useStartByReminder', () => {
  it('schedules with the first task, start-by and deadline when enabled', () => {
    const plan = makePlan(1_000_000, { firstLabel: 'Ship PR', deadline: 4_600_000 });
    renderHook(() => useStartByReminder(plan));

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledWith({
      startByMs: 1_000_000,
      firstTaskLabel: 'Ship PR',
      deadlineMs: 4_600_000,
    });
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cancels and never schedules when master reminders are off', () => {
    useSettingsStore.setState({ remindersEnabled: false, startByEnabled: true });
    renderHook(() => useStartByReminder(makePlan(1_000_000)));

    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels when the start-by toggle is off', () => {
    useSettingsStore.setState({ remindersEnabled: true, startByEnabled: false });
    renderHook(() => useStartByReminder(makePlan(1_000_000)));

    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels when there is no plan', () => {
    renderHook(() => useStartByReminder(null));

    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('does not reschedule when a new plan object has the same start-by, label and deadline', () => {
    const { rerender } = renderHook((p: PlanResult | null) => useStartByReminder(p), {
      initialProps: makePlan(1_000_000),
    });
    expect(mockSchedule).toHaveBeenCalledTimes(1);

    // New object, identical schedule-relevant values (e.g. a clock tick recompute).
    rerender(makePlan(1_000_000));
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it('reschedules when the start-by moment changes', () => {
    const { rerender } = renderHook((p: PlanResult | null) => useStartByReminder(p), {
      initialProps: makePlan(1_000_000),
    });
    expect(mockSchedule).toHaveBeenCalledTimes(1);

    rerender(makePlan(1_200_000));
    expect(mockSchedule).toHaveBeenCalledTimes(2);
    expect(mockSchedule).toHaveBeenLastCalledWith(
      expect.objectContaining({ startByMs: 1_200_000 }),
    );
  });
});
