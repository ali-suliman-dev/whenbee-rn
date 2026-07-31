import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useQuickTasks } from '@/src/features/quick-tasks/useQuickTasks';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { createMemoryDatabase } from '@/src/db';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// Push events into the recent past so recency decay doesn't zero them out.
const RECENT_MS = Date.now() - 60_000;

async function seed() {
  const db = createMemoryDatabase();
  for (let i = 0; i < 3; i++) {
    await db.insertTaskEvent({
      id: `e${i}`,
      category: 'admin',
      label: 'Emails',
      estimateMin: 30,
      actualMin: 50,
      status: 'completed',
      source: 'timed',
      startedAt: RECENT_MS + i,
      endedAt: RECENT_MS + i,
      createdAt: RECENT_MS + i,
      suggestedHonestMin: 50,
      reclaimDividendMin: 0,
      startLocalMinute: null,
    });
  }
  useCalibrationStore.setState({ statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

beforeEach(() => {
  useTimerStore.setState({
    taskLabel: null,
    category: null,
    estimateMin: 0,
    startedAt: null,
    pausedAccumMs: 0,
    pausedAt: null,
    isRunning: false,
    guessMin: 0,
    taskId: null,
    suggestedHonestMin: 0,
  });
});

it('exposes thresholded chips with a resolved honest estimate', async () => {
  await seed();
  const { result } = renderHook(() => useQuickTasks());
  await waitFor(() => expect(result.current.chips.length).toBe(1));
  const chip = result.current.chips[0]!;
  expect(chip.label).toBe('Emails');
  expect(chip.guessMin).toBe(30);
  expect(chip.honestMin).toBeGreaterThanOrEqual(30);
});

it('startQuickTask does NOT mutate the timer store — the gate decides, not the chip', async () => {
  await seed();
  const { result } = renderHook(() => useQuickTasks());
  await waitFor(() => expect(result.current.chips.length).toBe(1));
  act(() => result.current.startQuickTask(result.current.chips[0]!));
  expect(useTimerStore.getState().isRunning).toBe(false);
});

it('startQuickTask navigates to the timer route with the chip params', async () => {
  await seed();
  const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
  router.push.mockClear();
  const { result } = renderHook(() => useQuickTasks());
  await waitFor(() => expect(result.current.chips.length).toBe(1));
  const chip = result.current.chips[0]!;
  act(() => result.current.startQuickTask(chip));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/(modals)/timer',
    params: {
      label: chip.label,
      category: chip.category,
      estimateMin: String(chip.honestMin),
      guessMin: String(chip.guessMin),
      suggestedHonestMin: String(chip.honestMin),
    },
  });
});

it('returns empty chips when no frequent tasks exist', async () => {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  const { result } = renderHook(() => useQuickTasks());
  await waitFor(() => expect(result.current.chips).toBeDefined());
  expect(result.current.chips).toHaveLength(0);
});
