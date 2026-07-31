// TDD — calendar refresh (spec §C.1/§C.2).
//
// Two contracts live here:
//   1. `formatCalendarAge` — the quiet "updated 6m ago" stamp. Silent while the
//      read is fresh, present exactly once a tap is worth it.
//   2. The refetch triggers — screen focus, app foreground, and the explicit
//      `refresh()` call. Before this, `useDayCapacity` fetched once per
//      day-selection and never again, so an event added in the OS calendar while
//      Whenbee was open never appeared.

import { renderHook, act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import {
  useDayCapacity,
  formatCalendarAge,
  CALENDAR_STALE_AFTER_MS,
} from '../useDayCapacity';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { CalendarEvent } from '@/src/services/calendar';

// ── Calendar service mock ────────────────────────────────────────────────────

const mockGetEventsForDay = jest.fn<Promise<CalendarEvent[]>, [string, unknown]>();
const mockRequestReadAccess = jest.fn<Promise<boolean>, []>();

jest.mock('@/src/services/calendar', () => ({
  getCalendar: () => ({
    isStub: true,
    requestReadAccess: mockRequestReadAccess,
    getEventsForDay: mockGetEventsForDay,
    getTodaysEvents: jest.fn(),
    listCalendars: jest.fn(),
    writeAdjustments: jest.fn(),
  }),
}));

// ── expo-router focus mock ───────────────────────────────────────────────────
// Mirrors the real `useFocusEffect` contract closely enough to exercise a
// blur→focus round trip: the effect body runs on focus, its returned cleanup on
// blur. `mockFocusState` lets a test drive that transition by hand.

const mockFocusState: {
  callback: (() => void | (() => void)) | null;
  cleanup: (() => void) | null;
} = { callback: null, cleanup: null };

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react') as typeof import('react');
    React.useEffect(() => {
      mockFocusState.callback = cb;
      const cleanup = cb();
      mockFocusState.cleanup = typeof cleanup === 'function' ? cleanup : null;
      return () => {
        mockFocusState.cleanup?.();
        mockFocusState.cleanup = null;
      };
    }, [cb]);
  },
}));

/** Drive a blur→focus round trip through the mocked `useFocusEffect`. */
async function blurThenFocus(): Promise<void> {
  await act(async () => {
    mockFocusState.cleanup?.();
    const cleanup = mockFocusState.callback?.();
    mockFocusState.cleanup = typeof cleanup === 'function' ? cleanup : null;
  });
}

// ── AppState harness ─────────────────────────────────────────────────────────

let appStateHandler: ((status: AppStateStatus) => void) | null = null;

/** Drive the app back to the foreground through the captured AppState listener. */
async function foregroundApp(): Promise<void> {
  await act(async () => {
    appStateHandler?.('active');
  });
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SELECTED_DATE = '2024-03-15';
const MIN = 60_000;
const DAY_START = new Date('2024-03-15T00:00:00').getTime();

const TIMED_EVENT: CalendarEvent = {
  id: 'e1',
  title: 'Team sync',
  startMs: DAY_START + 9 * 60 * MIN,
  endMs: DAY_START + 10 * 60 * MIN,
  allDay: false,
  calendarId: 'mock-cal',
};

beforeEach(() => {
  appStateHandler = null;
  mockFocusState.callback = null;
  mockFocusState.cleanup = null;

  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, handler) => {
    if (type === 'change') appStateHandler = handler as (s: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });

  mockRequestReadAccess.mockResolvedValue(true);
  mockGetEventsForDay.mockResolvedValue([TIMED_EVENT]);

  useDayTasksStore.setState({ selectedDate: SELECTED_DATE, dayTasks: [] });
  useSettingsStore.setState({
    calendar: {
      showEvents: true,
      enabledCalendarIds: [],
      exportEnabled: false,
      whenbeeCalendarId: null,
    },
  });
  useCalibrationStore.setState({ statsByCategory: {} });
  useEntitlement.setState({ isPro: true, ready: true });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

// ── The staleness stamp ──────────────────────────────────────────────────────

describe('formatCalendarAge', () => {
  const NOW = new Date('2024-03-15T12:00:00').getTime();

  it('is silent when the calendar was never read', () => {
    expect(formatCalendarAge(null, NOW)).toBeNull();
  });

  it('is silent on a read that just happened', () => {
    expect(formatCalendarAge(NOW, NOW)).toBeNull();
  });

  it('is silent right up to the 2-minute threshold', () => {
    expect(formatCalendarAge(NOW - (CALENDAR_STALE_AFTER_MS - 1), NOW)).toBeNull();
  });

  it('appears exactly at the 2-minute threshold', () => {
    expect(formatCalendarAge(NOW - CALENDAR_STALE_AFTER_MS, NOW)).toBe('updated 2m ago');
  });

  it('reads whole minutes past the threshold', () => {
    expect(formatCalendarAge(NOW - 6 * MIN, NOW)).toBe('updated 6m ago');
  });

  it('floors partial minutes rather than rounding up', () => {
    expect(formatCalendarAge(NOW - (6 * MIN + 59_000), NOW)).toBe('updated 6m ago');
  });

  it('switches to whole hours at 60 minutes', () => {
    expect(formatCalendarAge(NOW - 60 * MIN, NOW)).toBe('updated 1h ago');
    expect(formatCalendarAge(NOW - 200 * MIN, NOW)).toBe('updated 3h ago');
  });

  it('stays silent if the clock moved backwards (negative age)', () => {
    expect(formatCalendarAge(NOW + 5 * MIN, NOW)).toBeNull();
  });

  it('threshold is two minutes', () => {
    expect(CALENDAR_STALE_AFTER_MS).toBe(2 * MIN);
  });
});

// ── Refetch triggers ─────────────────────────────────────────────────────────

describe('useDayCapacity — refetch triggers', () => {
  it('reads the calendar once on mount', async () => {
    renderHook(() => useDayCapacity());
    await act(async () => {});
    expect(mockGetEventsForDay).toHaveBeenCalledTimes(1);
  });

  it('records when the read landed', async () => {
    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});
    expect(result.current.lastFetchedAtMs).not.toBeNull();
  });

  it('re-reads the calendar when the screen regains focus', async () => {
    renderHook(() => useDayCapacity());
    await act(async () => {});
    expect(mockGetEventsForDay).toHaveBeenCalledTimes(1);

    await blurThenFocus();
    expect(mockGetEventsForDay).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-read on the initial focus (the mount read already covered it)', async () => {
    renderHook(() => useDayCapacity());
    await act(async () => {});
    // Mount + initial focus must not double-fetch.
    expect(mockGetEventsForDay).toHaveBeenCalledTimes(1);
  });

  it('re-reads the calendar when the app returns to the foreground', async () => {
    renderHook(() => useDayCapacity());
    await act(async () => {});
    expect(mockGetEventsForDay).toHaveBeenCalledTimes(1);

    await foregroundApp();
    expect(mockGetEventsForDay).toHaveBeenCalledTimes(2);
  });

  it('ignores non-active AppState transitions', async () => {
    renderHook(() => useDayCapacity());
    await act(async () => {});

    await act(async () => {
      appStateHandler?.('background');
      appStateHandler?.('inactive');
    });
    expect(mockGetEventsForDay).toHaveBeenCalledTimes(1);
  });

  it('re-reads the calendar on an explicit refresh()', async () => {
    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});

    await act(async () => {
      await result.current.refresh();
    });
    expect(mockGetEventsForDay).toHaveBeenCalledTimes(2);
  });

  it('picks up an event added to the OS calendar while the app was open', async () => {
    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});
    expect(result.current.events).toHaveLength(1);

    const added: CalendarEvent = { ...TIMED_EVENT, id: 'e2', title: 'New meeting' };
    mockGetEventsForDay.mockResolvedValue([TIMED_EVENT, added]);

    await foregroundApp();
    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[1]?.title).toBe('New meeting');
  });

  it('keeps status "ready" through a background refetch (never flashes loading)', async () => {
    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});
    expect(result.current.status).toBe('ready');

    await foregroundApp();
    expect(result.current.status).toBe('ready');
  });

  it('settles `refreshing` back to false after refresh() resolves', async () => {
    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});
    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.refreshing).toBe(false);
  });

  it('never reads the calendar for a free user, on any trigger', async () => {
    useEntitlement.setState({ isPro: false, ready: true });
    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});

    await foregroundApp();
    await blurThenFocus();
    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetEventsForDay).not.toHaveBeenCalled();
    expect(result.current.status).toBe('off');
    expect(result.current.lastFetchedAtMs).toBeNull();
  });

  it('never reads the calendar when the showEvents toggle is off', async () => {
    useSettingsStore.setState({
      calendar: {
        showEvents: false,
        enabledCalendarIds: [],
        exportEnabled: false,
        whenbeeCalendarId: null,
      },
    });
    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});

    await foregroundApp();
    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetEventsForDay).not.toHaveBeenCalled();
    expect(result.current.status).toBe('off');
  });

  it('clears the fetch stamp when access is denied (no stale age to report)', async () => {
    mockRequestReadAccess.mockResolvedValue(false);
    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});

    expect(result.current.status).toBe('denied');
    expect(result.current.lastFetchedAtMs).toBeNull();
  });
});
