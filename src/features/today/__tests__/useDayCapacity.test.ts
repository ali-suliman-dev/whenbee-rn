import { renderHook, act } from '@testing-library/react-native';
import { useDayCapacity } from '../useDayCapacity';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { DayTask } from '@/src/engine/daySelectors';
import type { CalendarEvent } from '@/src/services/calendar';

// `useDayCapacity` re-reads the calendar on screen focus. The mock runs the
// effect body once and never invokes its blur cleanup, so the hook's "skip the
// first focus" guard holds and the read count below stays at one.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    cb();
  },
}));

// ── Stable references for the mock calendar module ──────────────────────────

const mockGetEventsForDay = jest.fn<Promise<CalendarEvent[]>, [string, (readonly string[] | undefined)?]>();
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const SELECTED_DATE = '2024-03-15';
/** epoch ms for a local-midnight offset on SELECTED_DATE (value not critical — only used for event times). */
const DAY_START = new Date('2024-03-15T00:00:00').getTime();
const MIN = 60_000;

function makeQueued(overrides: {
  id: string;
  category: string;
  guessMin: number;
}): DayTask {
  return {
    id: overrides.id,
    label: `Task ${overrides.id}`,
    category: overrides.category,
    guessMin: overrides.guessMin,
    status: 'queued',
    plannedDate: SELECTED_DATE,
    orderIndex: Date.now(),
    doneByMin: null,
    createdAt: Date.now(),
    completedAt: null,
    actualMin: null,
    fromRoutineId: null,
    calendarEventId: null,
    carriedFrom: null,
  };
}

function makeTimedEvent(id: string, durationMin: number): CalendarEvent {
  return {
    id,
    title: `Event ${id}`,
    startMs: DAY_START + 9 * 60 * MIN,
    endMs: DAY_START + 9 * 60 * MIN + durationMin * MIN,
    allDay: false,
    calendarId: 'mock-cal',
  };
}

function makeAllDayEvent(id: string): CalendarEvent {
  return {
    id,
    title: `All-day ${id}`,
    startMs: DAY_START,
    endMs: DAY_START + 24 * 60 * MIN,
    allDay: true,
    calendarId: 'mock-cal',
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Two queued tasks: 30 min guess + 60 min guess (prior M≈1.8 for admin → ~54 and ~108 honest). */
const QUEUED_TASKS: DayTask[] = [
  makeQueued({ id: 't1', category: 'admin', guessMin: 30 }),
  makeQueued({ id: 't2', category: 'admin', guessMin: 60 }),
];

/** One 60-min timed event + one all-day event. */
const TIMED_EVENT = makeTimedEvent('e1', 60);
const ALL_DAY_EVENT = makeAllDayEvent('e2');

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockRequestReadAccess.mockResolvedValue(true);
  mockGetEventsForDay.mockResolvedValue([TIMED_EVENT, ALL_DAY_EVENT]);

  // Default store state
  useDayTasksStore.setState({
    selectedDate: SELECTED_DATE,
    dayTasks: QUEUED_TASKS,
  });

  useSettingsStore.setState({
    calendar: { showEvents: true, enabledCalendarIds: [], exportEnabled: false, whenbeeCalendarId: null },
  });

  useCalibrationStore.setState({
    statsByCategory: {},
  });

  useEntitlement.setState({ isPro: true, ready: true });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useDayCapacity', () => {
  describe('when isPro=true and showEvents=true', () => {
    it('returns status "ready" with load summing tasks + timed events', async () => {
      const { result } = renderHook(() => useDayCapacity());

      // Wait for async calendar effect to resolve
      await act(async () => {});

      expect(result.current.status).toBe('ready');
      expect(result.current.isPro).toBe(true);

      // load must include event minutes (60 min timed event)
      expect(result.current.load).not.toBeNull();
      expect(result.current.load?.eventMin).toBe(60);

      // timed event is in events[]
      expect(result.current.events).toHaveLength(1);
      expect(result.current.events[0]?.id).toBe('e1');
    });

    it('excludes all-day events from load.eventMin but puts them in allDayEvents', async () => {
      const { result } = renderHook(() => useDayCapacity());
      await act(async () => {});

      // allDay event must NOT be counted in the load
      expect(result.current.load?.eventMin).toBe(60); // only the timed one

      // but must appear in allDayEvents
      expect(result.current.allDayEvents).toHaveLength(1);
      expect(result.current.allDayEvents[0]?.id).toBe('e2');
    });

    it('load.taskMin is > 0 (queued tasks contribute honest minutes)', async () => {
      const { result } = renderHook(() => useDayCapacity());
      await act(async () => {});

      // Tasks exist → task contribution must be positive
      expect(result.current.load?.taskMin).toBeGreaterThan(0);
    });

    it('calls getEventsForDay with the selectedDate', async () => {
      renderHook(() => useDayCapacity());
      await act(async () => {});

      expect(mockGetEventsForDay).toHaveBeenCalledWith(SELECTED_DATE, undefined);
    });

    it('passes enabledCalendarIds when non-empty', async () => {
      useSettingsStore.setState({
        calendar: { showEvents: true, enabledCalendarIds: ['cal-a', 'cal-b'], exportEnabled: false, whenbeeCalendarId: null },
      });

      renderHook(() => useDayCapacity());
      await act(async () => {});

      expect(mockGetEventsForDay).toHaveBeenCalledWith(
        SELECTED_DATE,
        ['cal-a', 'cal-b'],
      );
    });

    it('returns status "denied" when requestReadAccess returns false', async () => {
      mockRequestReadAccess.mockResolvedValue(false);

      const { result } = renderHook(() => useDayCapacity());
      await act(async () => {});

      expect(result.current.status).toBe('denied');
      expect(result.current.events).toHaveLength(0);
      // task-only load is still computed (eventMin = 0)
      expect(result.current.load?.eventMin).toBe(0);
    });
  });

  describe('when showEvents=false', () => {
    beforeEach(() => {
      useSettingsStore.setState({
        calendar: { showEvents: false, enabledCalendarIds: [], exportEnabled: false, whenbeeCalendarId: null },
      });
    });

    it('returns status "off" and does not fetch events', async () => {
      const { result } = renderHook(() => useDayCapacity());
      await act(async () => {});

      expect(result.current.status).toBe('off');
      expect(mockGetEventsForDay).not.toHaveBeenCalled();
      expect(result.current.events).toHaveLength(0);
      expect(result.current.allDayEvents).toHaveLength(0);
    });

    it('still computes a task-only load (eventMin=0)', async () => {
      const { result } = renderHook(() => useDayCapacity());
      await act(async () => {});

      expect(result.current.load).not.toBeNull();
      expect(result.current.load?.eventMin).toBe(0);
      expect(result.current.load?.taskMin).toBeGreaterThan(0);
    });
  });

  describe('when isPro=false', () => {
    beforeEach(() => {
      useEntitlement.setState({ isPro: false, ready: true });
    });

    it('returns status "off" and does not fetch events', async () => {
      const { result } = renderHook(() => useDayCapacity());
      await act(async () => {});

      expect(result.current.status).toBe('off');
      expect(mockGetEventsForDay).not.toHaveBeenCalled();
      expect(result.current.isPro).toBe(false);
      expect(result.current.events).toHaveLength(0);
    });

    it('still computes a task-only load', async () => {
      const { result } = renderHook(() => useDayCapacity());
      await act(async () => {});

      expect(result.current.load).not.toBeNull();
      expect(result.current.load?.eventMin).toBe(0);
    });
  });

  describe('empty day', () => {
    beforeEach(() => {
      useDayTasksStore.setState({
        selectedDate: SELECTED_DATE,
        dayTasks: [],
      });
      mockGetEventsForDay.mockResolvedValue([]);
    });

    it('returns comfortable verdict with all zeros', async () => {
      const { result } = renderHook(() => useDayCapacity());
      await act(async () => {});

      expect(result.current.load?.taskMin).toBe(0);
      expect(result.current.load?.eventMin).toBe(0);
      expect(result.current.load?.verdict).toBe('comfortable');
    });
  });
});
