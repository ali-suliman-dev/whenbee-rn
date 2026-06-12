import { render, screen, fireEvent } from '@testing-library/react-native';
import Retro from '@/src/app/(modals)/retro';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import type { LogResult } from '@/src/stores/calibrationStore';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
}));

const okResult: LogResult = {
  counted: true,
  multiplier: 2,
  sharpness: 50,
  tierBefore: 'Setting',
  tierAfter: 'Setting',
  leveledUp: false,
  reclaimDeltaMin: 0,
};

beforeEach(() => {
  mockReplace.mockClear();
  useRewardStore.getState().clear();
  useCategoriesStore.setState({
    categories: [{ id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' }],
  });
  useCalibrationStore.setState({
    hydrate: async () => {},
    applyLog: jest.fn(async () => okResult),
  });
});

describe('Retro screen', () => {
  it('Save & ripen: applyLog completed/retro, hands off to reward, navigates', async () => {
    render(<Retro />);
    const applyLog = useCalibrationStore.getState().applyLog as jest.Mock;

    fireEvent.press(screen.getByText('Cleaning'));
    // Both the guess and actual rows render the same chip labels; the guess row
    // renders first, the actual row second.
    fireEvent.press(screen.getAllByText('15m')[0]); // guess
    fireEvent.press(screen.getAllByText('30m')[1]); // actual

    fireEvent.press(screen.getByText('Save & ripen'));
    await Promise.resolve();
    await Promise.resolve();

    expect(applyLog).toHaveBeenCalledTimes(1);
    const arg = applyLog.mock.calls[0][0];
    expect(arg.status).toBe('completed');
    expect(arg.source).toBe('retro');
    expect(arg.category).toBe('cleaning');
    expect(arg.estimateMin).toBe(15); // the guess (ratio = actual / guess)
    expect(arg.actualMin).toBe(30);
    // Retro has no honest number surfaced to the user → null triggers the
    // engine fallback: honestNumber(guess, M_before).
    expect(arg.suggestedHonestMin).toBeNull();

    // Reward hand-off populated with the retro source + navigation.
    expect(useRewardStore.getState().result).toEqual(okResult);
    expect(useRewardStore.getState().source).toBe('retro');
    expect(mockReplace).toHaveBeenCalledWith('/(modals)/reward');
  });

  it('does not save until category + both times are chosen', async () => {
    render(<Retro />);
    const applyLog = useCalibrationStore.getState().applyLog as jest.Mock;

    // Only a category + guess, no actual → button disabled, applyLog never runs.
    fireEvent.press(screen.getByText('Cleaning'));
    fireEvent.press(screen.getAllByText('15m')[0]);
    fireEvent.press(screen.getByText('Save & ripen'));
    await Promise.resolve();

    expect(applyLog).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
