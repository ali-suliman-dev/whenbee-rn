// Verifies the two things the hook owns that the engine can't: the minute
// heartbeat, and the free-path gate that keeps routines/calendar out.
import { renderHook, act } from '@testing-library/react-native';
import {
  useHonestLanding,
  useEventMinAhead,
  eventMinutesAhead,
} from '@/src/features/today/useHonestLanding';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { getCalendar } from '@/src/services/calendar';
import type { DayTask } from '@/src/engine';

jest.mock('@/src/services/calendar', () => ({
  getCalendar: jest.fn(() => ({
    requestReadAccess: jest.fn(async () => true),
    getEventsForDay: jest.fn(async () => []),
  })),
}));

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

// The hook takes eventMinAhead as a plain parameter — it never imports the
// calendar service itself (only useDayCapacity does, and only for Pro users).
// This is a structural guard: it can't fail against today's code, but it WILL
// fail the moment a future refactor wires getCalendar() directly into this
// hook, which would be exactly the kind of accidental leak this task exists
// to catch.
test("a free user's landing never reads the calendar", () => {
  useEntitlement.setState({ isPro: false });
  renderHook(() => useHonestLanding(120)); // caller passes minutes; the gate must drop them
  expect(getCalendar).not.toHaveBeenCalled();
});

test('event minutes passed to a free user are ignored, not folded in', () => {
  useEntitlement.setState({ isPro: false });
  const zero = renderHook(() => useHonestLanding(0));
  const withEvents = renderHook(() => useHonestLanding(120));

  // Passing a non-zero eventMinAhead to a free caller must produce a landing
  // byte-identical to passing zero — not just "different from Pro's", but
  // literally unaffected by the argument.
  const freeLandingMs = withEvents.result.current.landing.landingMs;
  expect(freeLandingMs).toBe(zero.result.current.landing.landingMs);

  // Snapshotted above because `withEvents` stays mounted below: flipping the
  // store re-renders every subscribed hook, `withEvents` included, so reading
  // `withEvents.result.current` after the flip would silently pick up isPro
  // too and this assertion would compare pro against itself.
  act(() => {
    useEntitlement.setState({ isPro: true });
  });
  const { result: pro } = renderHook(() => useHonestLanding(120));
  expect(pro.current.landing.landingMs).toBeGreaterThan(freeLandingMs ?? 0);
});

// ── eventMinAhead: the number Pro feeds the hook ─────────────────────────────
// The trap this exists to close: computing it with a `Date.now()` read inside a
// memo keyed only on the event list. That freezes at first render, so a meeting
// that has already ended keeps padding the landing for the rest of the day.

test('only the part of a meeting still ahead of now counts', () => {
  const halfDone = { startMs: NOW - 30 * 60_000, endMs: NOW + 30 * 60_000 };
  const finished = { startMs: NOW - 120 * 60_000, endMs: NOW - 60 * 60_000 };
  const later = { startMs: NOW + 60 * 60_000, endMs: NOW + 105 * 60_000 };
  expect(eventMinutesAhead([halfDone, finished, later], NOW)).toBe(75);
});

test('no meetings is zero, not a guess', () => {
  expect(eventMinutesAhead([], NOW)).toBe(0);
});

test('the meeting minutes shrink as the clock moves — they never freeze', () => {
  const events = [{ startMs: NOW, endMs: NOW + 60 * 60_000 }];
  const { result } = renderHook(() => useEventMinAhead(events));
  expect(result.current).toBe(60);

  act(() => {
    jest.advanceTimersByTime(20 * 60_000);
  });

  expect(result.current).toBe(40);
});
