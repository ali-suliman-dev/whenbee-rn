// TDD — Honest-Day calendar refresh (spec §C.1).
//
// `useHonestDay` had no refresh path: it read the calendar once and never again,
// so an event added in the OS calendar while the sheet was open never appeared.
// It also defaulted `nowMs` to `Date.now()` *inside the effect deps*, which
// re-fired the read on every render — the anchor is now pinned once (the
// `usePatterns` nowRef pattern) and only moves on a deliberate reload.

import { renderHook, act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useHonestDay } from '../useHonestDay';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { getCalendar, type CalendarEvent } from '@/src/services/calendar';

jest.mock('@/src/services/calendar', () => ({ getCalendar: jest.fn() }));
jest.mock('@/src/services/analytics', () => ({ analytics: { capture: jest.fn() } }));

// ── expo-router focus mock (mirrors focus → cleanup-on-blur) ─────────────────

const mockFocusState: {
  callback: (() => void | (() => void)) | null;
  cleanup: (() => void) | null;
} = { callback: null, cleanup: null };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
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

async function blurThenFocus(): Promise<void> {
  await act(async () => {
    mockFocusState.cleanup?.();
    const cleanup = mockFocusState.callback?.();
    mockFocusState.cleanup = typeof cleanup === 'function' ? cleanup : null;
  });
}

// ── AppState harness ─────────────────────────────────────────────────────────

let appStateHandler: ((status: AppStateStatus) => void) | null = null;

async function foregroundApp(): Promise<void> {
  await act(async () => {
    appStateHandler?.('active');
  });
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MIN = 60_000;
const DAY = new Date('2026-06-13T08:00:00').getTime();

const EVENTS: CalendarEvent[] = [
  { id: 'e1', title: 'Write report', startMs: DAY, endMs: DAY + 30 * MIN, allDay: false, calendarId: 'c' },
];

const mockGetCalendar = getCalendar as jest.MockedFunction<typeof getCalendar>;
const getTodaysEvents = jest.fn<Promise<CalendarEvent[]>, [number]>();
const requestReadAccess = jest.fn<Promise<boolean>, []>();
const writeAdjustments = jest.fn(async () => 0);

beforeEach(() => {
  appStateHandler = null;
  mockFocusState.callback = null;
  mockFocusState.cleanup = null;

  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, handler) => {
    if (type === 'change') appStateHandler = handler as (s: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });

  requestReadAccess.mockResolvedValue(true);
  getTodaysEvents.mockResolvedValue(EVENTS);
  mockGetCalendar.mockReturnValue({
    isStub: true,
    requestReadAccess,
    getTodaysEvents,
    getEventsForDay: jest.fn(async () => EVENTS),
    listCalendars: jest.fn(async () => []),
    writeAdjustments,
  } as unknown as ReturnType<typeof getCalendar>);

  useCalibrationStore.setState({ statsByCategory: {} });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('useHonestDay — refresh', () => {
  it('reads the calendar once on mount', async () => {
    const { result } = renderHook(() => useHonestDay(DAY));
    await act(async () => {});

    expect(getTodaysEvents).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
  });

  it('does NOT re-read on every render when nowMs is left to default', async () => {
    // Regression: `nowMs = Date.now()` as an effect dep re-fired the read on each
    // render. The anchor is pinned at first render instead.
    const { rerender } = renderHook(() => useHonestDay());
    await act(async () => {});
    rerender(undefined);
    rerender(undefined);
    await act(async () => {});

    expect(getTodaysEvents).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-read on the initial focus (the mount read already covered it)', async () => {
    renderHook(() => useHonestDay(DAY));
    await act(async () => {});
    expect(getTodaysEvents).toHaveBeenCalledTimes(1);
  });

  it('re-reads the calendar when the sheet regains focus', async () => {
    renderHook(() => useHonestDay(DAY));
    await act(async () => {});

    await blurThenFocus();
    expect(getTodaysEvents).toHaveBeenCalledTimes(2);
  });

  it('re-reads the calendar when the app returns to the foreground', async () => {
    renderHook(() => useHonestDay(DAY));
    await act(async () => {});

    await foregroundApp();
    expect(getTodaysEvents).toHaveBeenCalledTimes(2);
  });

  it('ignores non-active AppState transitions', async () => {
    renderHook(() => useHonestDay(DAY));
    await act(async () => {});

    await act(async () => {
      appStateHandler?.('background');
    });
    expect(getTodaysEvents).toHaveBeenCalledTimes(1);
  });

  it('re-reads the calendar on an explicit refresh()', async () => {
    const { result } = renderHook(() => useHonestDay(DAY));
    await act(async () => {});

    await act(async () => {
      await result.current.refresh();
    });
    expect(getTodaysEvents).toHaveBeenCalledTimes(2);
  });

  it('picks up an event added while the sheet was open', async () => {
    const { result } = renderHook(() => useHonestDay(DAY));
    await act(async () => {});
    expect(result.current.result?.after).toHaveLength(1);

    getTodaysEvents.mockResolvedValue([
      ...EVENTS,
      { id: 'e2', title: 'Client call', startMs: DAY + 120 * MIN, endMs: DAY + 150 * MIN, allDay: false, calendarId: 'c' },
    ]);

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.result?.after).toHaveLength(2);
  });

  it('settles `refreshing` back to false after refresh() resolves', async () => {
    const { result } = renderHook(() => useHonestDay(DAY));
    await act(async () => {});
    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.refreshing).toBe(false);
  });

  it('never writes to the calendar on any refresh path', async () => {
    const { result } = renderHook(() => useHonestDay(DAY));
    await act(async () => {});

    await foregroundApp();
    await blurThenFocus();
    await act(async () => {
      await result.current.refresh();
    });

    expect(writeAdjustments).not.toHaveBeenCalled();
  });

  it('reports denied when read access is refused', async () => {
    requestReadAccess.mockResolvedValue(false);
    const { result } = renderHook(() => useHonestDay(DAY));
    await act(async () => {});

    expect(result.current.status).toBe('denied');
  });
});
