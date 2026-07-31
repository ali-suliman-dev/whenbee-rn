import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ForgotCard } from '../ForgotCard';
import { useForgotStore } from '@/src/stores/forgotStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { usePlanStore } from '@/src/stores/planStore';
import { createMemoryDatabase } from '@/src/db';
import type { PendingAutoClose } from '@/src/domain/types';

const pending: PendingAutoClose = {
  taskLabel: 'Deep work', category: 'Work', guessMin: 40, honestMin: 50,
  startedAt: 0, elapsedMin: 300, recoveredActualMin: 50,
  taskId: 'task-42', estimateMin: 45, pausedAccumMs: 120_000,
};

describe('ForgotCard', () => {
  beforeEach(() => {
    useForgotStore.getState().clear();
    useCalibrationStore.getState().setDatabase(createMemoryDatabase());
    useDayTasksStore.setState({
      completeTask: jest.fn(async () => {}),
      reload: jest.fn(async () => {}),
    } as never);
    usePlanStore.setState({ active: null } as never);
  });

  // zustand's shallow-merge `set()` copies the applyLog function reference into
  // every new state object, so a spy set in an earlier test rides along into the
  // next test's state, and `jest.spyOn` on an already-mocked fn returns the SAME
  // mock (with stale call history) instead of a fresh one — `mockClear()` right
  // after each spyOn (below) keeps assertions scoped to that test's presses.
  afterEach(() => jest.restoreAllMocks());

  it('renders nothing when there is no pending record', () => {
    const { toJSON } = render(<ForgotCard />);
    expect(toJSON()).toBeNull();
  });

  it('"at your honest number" logs a completed retro at the predicted finish and clears', async () => {
    const spy = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    useForgotStore.getState().setPending(pending);
    const { getByText } = render(<ForgotCard />);
    fireEvent.press(getByText(/log honest finish/i));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', source: 'retro', actualMin: 50 }),
      );
      expect(useForgotStore.getState().pending).toBeNull();
    });
  });

  it('a completed retro log marks the linked Today task done', async () => {
    useForgotStore.getState().setPending(pending);
    const { getByText } = render(<ForgotCard />);
    fireEvent.press(getByText(/log honest finish/i));
    await waitFor(() => {
      expect(useDayTasksStore.getState().completeTask).toHaveBeenCalledWith(
        'task-42',
        expect.objectContaining({ actualMin: 50 }),
      );
      expect(useDayTasksStore.getState().reload).toHaveBeenCalled();
    });
  });

  it('a completed retro log completes a running plan task', async () => {
    const planComplete = jest.fn();
    usePlanStore.setState({
      active: { tasks: [{ id: 'task-42', status: 'running' }] },
      completeTask: planComplete,
    } as never);
    useForgotStore.getState().setPending(pending);
    const { getByText } = render(<ForgotCard />);
    fireEvent.press(getByText(/log honest finish/i));
    await waitFor(() => {
      expect(planComplete).toHaveBeenCalledWith('task-42', 50);
    });
  });

  it('"not sure yet" (partial) never marks the task done', async () => {
    useForgotStore.getState().setPending(pending);
    const { getByText } = render(<ForgotCard />);
    fireEvent.press(getByText(/not sure yet/i));
    await waitFor(() => {
      expect(useForgotStore.getState().pending).toBeNull();
    });
    expect(useDayTasksStore.getState().completeTask).not.toHaveBeenCalled();
  });

  it('an ad-hoc session (no taskId) logs without touching Today', async () => {
    useForgotStore.getState().setPending({ ...pending, taskId: null });
    const { getByText } = render(<ForgotCard />);
    fireEvent.press(getByText(/log honest finish/i));
    await waitFor(() => {
      expect(useForgotStore.getState().pending).toBeNull();
    });
    expect(useDayTasksStore.getState().completeTask).not.toHaveBeenCalled();
  });

  it('"still going" reopens the session without logging', async () => {
    const apply = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    apply.mockClear();
    const reopen = jest.spyOn(useTimerStore.getState(), 'reopen');
    useForgotStore.getState().setPending(pending);
    const { getByText } = render(<ForgotCard />);
    fireEvent.press(getByText(/still going/i));
    await waitFor(() => {
      // Reopen must carry the ORIGINAL taskId (+ real estimate + prior paused time)
      // so a planned Today task keeps its linkage and is marked done on final stop.
      expect(reopen).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-42',
          estimateMin: 45,
          pausedAccumMs: 120_000,
        }),
      );
      expect(apply).not.toHaveBeenCalled();
      expect(useForgotStore.getState().pending).toBeNull();
    });
  });
});
