import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ForgotCard } from '../ForgotCard';
import { useForgotStore } from '@/src/stores/forgotStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { createMemoryDatabase } from '@/src/db';
import type { PendingAutoClose } from '@/src/domain/types';

const pending: PendingAutoClose = {
  taskLabel: 'Deep work', category: 'Work', guessMin: 40, honestMin: 50,
  startedAt: 0, elapsedMin: 300, recoveredActualMin: 50,
};

describe('ForgotCard', () => {
  beforeEach(() => {
    useForgotStore.getState().clear();
    useCalibrationStore.getState().setDatabase(createMemoryDatabase());
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
    fireEvent.press(getByText(/honest/i));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', source: 'retro', actualMin: 50 }),
      );
      expect(useForgotStore.getState().pending).toBeNull();
    });
  });

  it('"still going" reopens the session without logging', async () => {
    const apply = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    apply.mockClear();
    const reopen = jest.spyOn(useTimerStore.getState(), 'reopen');
    useForgotStore.getState().setPending(pending);
    const { getByText } = render(<ForgotCard />);
    fireEvent.press(getByText(/still going/i));
    await waitFor(() => {
      expect(reopen).toHaveBeenCalled();
      expect(apply).not.toHaveBeenCalled();
      expect(useForgotStore.getState().pending).toBeNull();
    });
  });
});
