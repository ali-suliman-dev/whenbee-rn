// The day-read's heartbeat. What's pinned here is that it is SHARED: the landing
// time and the meeting minutes ahead of now must be computed from the same tick,
// or the bar's meetings slice disagrees with the time the headline names.
import { renderHook, act } from '@testing-library/react-native';
import { useMinuteTick, MINUTE_TICK_MS } from '@/src/features/today/useMinuteTick';

const NOW = new Date(2026, 6, 25, 19, 10).getTime();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

test('every subscriber reads the same tick', () => {
  const a = renderHook(() => useMinuteTick());
  const b = renderHook(() => useMinuteTick());
  expect(a.result.current).toBe(b.result.current);

  act(() => {
    jest.advanceTimersByTime(MINUTE_TICK_MS); // fake timers carry the clock along
  });

  expect(a.result.current).toBe(NOW + MINUTE_TICK_MS);
  expect(b.result.current).toBe(a.result.current);
});

test('one interval serves every subscriber, and it stops with the last of them', () => {
  const setSpy = jest.spyOn(global, 'setInterval');
  const clearSpy = jest.spyOn(global, 'clearInterval');

  const a = renderHook(() => useMinuteTick());
  const b = renderHook(() => useMinuteTick());
  expect(setSpy).toHaveBeenCalledTimes(1);

  a.unmount();
  expect(clearSpy).not.toHaveBeenCalled(); // b is still watching the clock
  b.unmount();
  expect(clearSpy).toHaveBeenCalledTimes(1);

  setSpy.mockRestore();
  clearSpy.mockRestore();
});

test('a fresh subscriber re-reads the clock rather than serving a stale tick', () => {
  const first = renderHook(() => useMinuteTick());
  expect(first.result.current).toBe(NOW);
  first.unmount();

  jest.setSystemTime(NOW + 10 * MINUTE_TICK_MS);
  const second = renderHook(() => useMinuteTick());
  expect(second.result.current).toBe(NOW + 10 * MINUTE_TICK_MS);
});
