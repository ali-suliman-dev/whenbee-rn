// The day-read's heartbeat. What's pinned here is that it is SHARED: the landing
// time and the meeting minutes ahead of now must be computed from the same tick,
// or the bar's meetings slice disagrees with the time the headline names.
import { renderHook, act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
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

// iOS suspends `setInterval` while the app is backgrounded, so a screen reopened
// hours later would keep rendering the tick it froze on until the next fire —
// "now · 7:10pm" at half past nine. The foreground resync is what prevents that.
describe('foreground resync', () => {
  function captureAppStateListener(): (next: AppStateStatus) => void {
    let listener: ((next: AppStateStatus) => void) | null = null;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type: string, handler: (next: AppStateStatus) => void) => {
        listener = handler;
        return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
      });
    return (next) => {
      if (listener === null) throw new Error('useMinuteTick never subscribed to AppState');
      listener(next);
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('coming back to the foreground re-reads the clock without waiting out a minute', () => {
    const foreground = captureAppStateListener();
    const hook = renderHook(() => useMinuteTick());
    expect(hook.result.current).toBe(NOW);

    // Two hours pass with the app suspended: the interval never fires.
    jest.setSystemTime(NOW + 140 * MINUTE_TICK_MS);
    expect(hook.result.current).toBe(NOW);

    act(() => foreground('active'));
    expect(hook.result.current).toBe(NOW + 140 * MINUTE_TICK_MS);
  });

  test('a background transition does not move the clock', () => {
    const appState = captureAppStateListener();
    const hook = renderHook(() => useMinuteTick());

    jest.setSystemTime(NOW + 5 * MINUTE_TICK_MS);
    act(() => appState('background'));
    expect(hook.result.current).toBe(NOW);
  });

  test('the subscription is dropped with the last subscriber', () => {
    const remove = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<typeof AppState.addEventListener>);

    const a = renderHook(() => useMinuteTick());
    const b = renderHook(() => useMinuteTick());
    a.unmount();
    expect(remove).not.toHaveBeenCalled();
    b.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

test('a fresh subscriber re-reads the clock rather than serving a stale tick', () => {
  const first = renderHook(() => useMinuteTick());
  expect(first.result.current).toBe(NOW);
  first.unmount();

  jest.setSystemTime(NOW + 10 * MINUTE_TICK_MS);
  const second = renderHook(() => useMinuteTick());
  expect(second.result.current).toBe(NOW + 10 * MINUTE_TICK_MS);
});
