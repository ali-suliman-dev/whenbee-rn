// Verifies the two things the hook owns that the engine can't: the minute
// heartbeat, and the free-path gate that keeps routines/calendar out.
import { renderHook, act } from '@testing-library/react-native';
import { useHonestLanding } from '@/src/features/today/useHonestLanding';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { DayTask } from '@/src/engine';

const NOW = new Date(2026, 6, 25, 19, 10).getTime();

function makeDayTask(overrides: Partial<DayTask> & Pick<DayTask, 'id' | 'label' | 'category' | 'guessMin' | 'status'>): DayTask {
  return {
    plannedDate: '2026-07-25',
    orderIndex: 0,
    doneByMin: null,
    createdAt: NOW,
    completedAt: null,
    actualMin: null,
    fromRoutineId: null,
    calendarEventId: null,
    carriedFrom: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  useSettingsStore.setState({ dayEndMin: 21 * 60 }); // 9:00pm
  useEntitlement.setState({ isPro: false });
  useDayTasksStore.setState({
    selectedDate: '2026-07-25',
    dayTasks: [
      makeDayTask({ id: 'a', label: 'Finish invoice batch', category: 'admin', guessMin: 30, status: 'queued' }),
      makeDayTask({ id: 'b', label: 'Draft the deck', category: 'deep', guessMin: 60, status: 'queued' }),
      makeDayTask({ id: 'c', label: 'Standup', category: 'meetings', guessMin: 30, status: 'done', completedAt: NOW }),
    ],
  } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

test('only queued tasks feed the landing', () => {
  const { result } = renderHook(() => useHonestLanding());
  expect(result.current.landing.ends).toHaveLength(2); // the done row is out
});

test('the landing re-computes as the clock advances past a minute', () => {
  const { result } = renderHook(() => useHonestLanding());
  const first = result.current.nowMs;

  act(() => {
    jest.setSystemTime(NOW + 61_000);
    jest.advanceTimersByTime(61_000);
  });

  expect(result.current.nowMs).toBeGreaterThan(first);
});

test('the heartbeat is cleared on unmount', () => {
  const clearSpy = jest.spyOn(global, 'clearInterval');
  const { unmount } = renderHook(() => useHonestLanding());
  unmount();
  expect(clearSpy).toHaveBeenCalled();
  clearSpy.mockRestore();
});

test('dayEndMs comes from the user setting, not a constant window', () => {
  useSettingsStore.setState({ dayEndMin: 22 * 60 }); // 10:00pm
  const { result } = renderHook(() => useHonestLanding());
  expect(new Date(result.current.dayEndMs).getHours()).toBe(22);
});

test('a non-Pro user never has event minutes folded into the landing', () => {
  useEntitlement.setState({ isPro: false });
  const proResult = renderHook(() => useHonestLanding(120));
  const freeLanding = proResult.result.current.landing;

  act(() => {
    useEntitlement.setState({ isPro: true });
  });
  const withPro = renderHook(() => useHonestLanding(120));
  const proLanding = withPro.result.current.landing;

  expect(proLanding.remainingMin).toBe(freeLanding.remainingMin); // events aren't "your" work either way
  expect(proLanding.landingMs).not.toBe(freeLanding.landingMs); // but the free landing must exclude the 120 events minutes
});
