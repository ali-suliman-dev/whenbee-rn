/**
 * useDayPlan — integration tests.
 *
 * Strategy: mock the external hooks and stores at boundaries. The pure engine
 * (planDayAroundAnchors, orderForFocus, resolveSuggestion) runs for real so
 * the assertions reflect actual scheduling logic.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDayPlan } from '../useDayPlan';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { DayTask } from '@/src/engine/daySelectors';
import type { CalendarEvent } from '@/src/services/calendar';

// useDayPlan → useDayCapacity, which re-reads the calendar on screen focus.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    cb();
  },
}));

// ── Stable mock references ───────────────────────────────────────────────────

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

// Mock the entitlement so calendar events are fetched (Pro = true).
jest.mock('@/src/features/paywall/useEntitlement', () => ({
  useEntitlement: Object.assign(
    (selector: (s: { isPro: boolean; ready: boolean }) => unknown) =>
      selector({ isPro: true, ready: true }),
    { getState: () => ({ isPro: true, ready: true }), setState: jest.fn() },
  ),
}));

// Mock settings store for calendar + focus-window settings.
jest.mock('@/src/stores/settingsStore', () => {
  const store = {
    calendar: { showEvents: true, enabledCalendarIds: [] as string[] },
    focusWindowUserSet: false,
    focusShownStartMin: null as number | null,
    focusShownEndMin: null as number | null,
    focusLastMoveAtMs: null as number | null,
    setLearnedFocusWindow: jest.fn(),
  };
  return {
    useSettingsStore: Object.assign(
      (selector: (s: typeof store) => unknown) => selector(store),
      { getState: () => store, setState: (patch: Partial<typeof store>) => Object.assign(store, patch) },
    ),
  };
});

// Mock calibrationStore.loadFocusEvents (used by useLearnedFocusWindow).
const mockLoadFocusEvents = jest.fn().mockResolvedValue([]);

// ── Constants ────────────────────────────────────────────────────────────────

const SELECTED_DATE = '2026-06-24';
/** Local midnight for SELECTED_DATE */
const MIDNIGHT = new Date(2026, 5, 24, 0, 0, 0, 0).getTime();
const MIN = 60_000;

/** A test "now" at 07:00 — before the waking window (08:00), so dayStartMs = 08:00. */
const NOW_BEFORE_WAKING = MIDNIGHT + 7 * 60 * MIN;

/** A test "now" at 09:00 — inside the waking window, so the anchor drives placement. */
const NOW_MID_MORNING = MIDNIGHT + 9 * 60 * MIN;

// ── Factories ─────────────────────────────────────────────────────────────────

function makeQueued(overrides: {
  id: string;
  label: string;
  category: string;
  guessMin: number;
}): DayTask {
  return {
    id: overrides.id,
    label: overrides.label,
    category: overrides.category,
    guessMin: overrides.guessMin,
    status: 'queued',
    plannedDate: SELECTED_DATE,
    orderIndex: 1,
    doneByMin: null,
    createdAt: MIDNIGHT,
    completedAt: null,
    actualMin: null,
    fromRoutineId: null,
    calendarEventId: null,
    carriedFrom: null,
  };
}

function makeTimedEvent(id: string, startHour: number, durationMin: number): CalendarEvent {
  return {
    id,
    title: `Meeting ${id}`,
    startMs: MIDNIGHT + startHour * 60 * MIN,
    endMs: MIDNIGHT + startHour * 60 * MIN + durationMin * MIN,
    allDay: false,
    calendarId: 'mock-cal',
  };
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestReadAccess.mockResolvedValue(true);
  mockGetEventsForDay.mockResolvedValue([]);
  mockLoadFocusEvents.mockResolvedValue([]);

  useDayTasksStore.setState({
    selectedDate: SELECTED_DATE,
    dayTasks: [],
    dayMeta: null,
    hasManualOrder: false,
    setDoneBy: jest.fn(),
  });

  useCalibrationStore.setState({
    statsByCategory: {},
    loadFocusEvents: mockLoadFocusEvents,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useDayPlan', () => {
  describe('empty day', () => {
    it('returns plan=null and status="empty" when no queued tasks', async () => {
      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      expect(result.current.plan).toBeNull();
      expect(result.current.status).toBe('empty');
    });

    it('returns doneByMin=null when no dayMeta', async () => {
      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      expect(result.current.doneByMin).toBeNull();
    });
  });

  describe('with queued tasks, no calendar events', () => {
    beforeEach(() => {
      useDayTasksStore.setState({
        selectedDate: SELECTED_DATE,
        dayTasks: [
          makeQueued({ id: 't1', label: 'Write report', category: 'deep-work', guessMin: 60 }),
          makeQueued({ id: 't2', label: 'Reply emails', category: 'admin', guessMin: 30 }),
        ],
        dayMeta: null,
        setDoneBy: jest.fn(),
      });
    });

    it('returns status="ready" and a non-null plan', async () => {
      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      expect(result.current.status).toBe('ready');
      expect(result.current.plan).not.toBeNull();
    });

    it('plan.timeline contains task items for all tasks', async () => {
      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      const taskItems = result.current.plan?.timeline.filter((i) => i.kind === 'task') ?? [];
      expect(taskItems.length).toBe(2);
      expect(taskItems.map((i) => i.label)).toContain('Write report');
      expect(taskItems.map((i) => i.label)).toContain('Reply emails');
    });

    it('tasks are scheduled within the waking window [08:00, 22:00)', async () => {
      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      const wakingStart = MIDNIGHT + 8 * 60 * MIN;
      const wakingEnd = MIDNIGHT + 22 * 60 * MIN;
      const taskItems = result.current.plan?.timeline.filter((i) => i.kind === 'task') ?? [];

      for (const item of taskItems) {
        expect(item.startAt).toBeGreaterThanOrEqual(wakingStart);
        expect(item.endAt).toBeLessThanOrEqual(wakingEnd);
      }
    });
  });

  describe('with a timed calendar anchor', () => {
    const MEETING = makeTimedEvent('m1', 10, 60); // 10:00–11:00

    beforeEach(() => {
      mockGetEventsForDay.mockResolvedValue([MEETING]);
      useDayTasksStore.setState({
        selectedDate: SELECTED_DATE,
        dayTasks: [
          makeQueued({ id: 't1', label: 'Task A', category: 'admin', guessMin: 30 }),
          makeQueued({ id: 't2', label: 'Task B', category: 'admin', guessMin: 30 }),
        ],
        dayMeta: null,
        setDoneBy: jest.fn(),
      });
    });

    it('plan is non-null and contains an event item for the meeting', async () => {
      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      const eventItems = result.current.plan?.timeline.filter((i) => i.kind === 'event') ?? [];
      expect(result.current.plan).not.toBeNull();
      expect(eventItems.length).toBeGreaterThanOrEqual(1);
    });

    it('no task item overlaps the meeting block [10:00, 11:00)', async () => {
      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      const meetingStart = MEETING.startMs;
      const meetingEnd = MEETING.endMs;
      const taskItems = result.current.plan?.timeline.filter((i) => i.kind === 'task') ?? [];

      for (const task of taskItems) {
        // Task must not overlap [meetingStart, meetingEnd)
        const overlaps = task.startAt < meetingEnd && task.endAt > meetingStart;
        expect(overlaps).toBe(false);
      }
    });
  });

  describe('doneByMin from dayMeta', () => {
    it('returns doneByMin when dayMeta is set', async () => {
      useDayTasksStore.setState({
        selectedDate: SELECTED_DATE,
        dayTasks: [],
        dayMeta: { doneByMin: 18 * 60, planComputedAt: null },
        setDoneBy: jest.fn(),
      });

      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      expect(result.current.doneByMin).toBe(18 * 60);
    });

    it('uses doneByMin as the deadline when planning', async () => {
      // Set done-by to 10:00 (600 min) — tight window
      useDayTasksStore.setState({
        selectedDate: SELECTED_DATE,
        dayTasks: [
          makeQueued({ id: 't1', label: 'Quick task', category: 'admin', guessMin: 15 }),
        ],
        dayMeta: { doneByMin: 10 * 60, planComputedAt: null },
        setDoneBy: jest.fn(),
      });

      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      // The plan must place the task before 10:00
      const deadline = MIDNIGHT + 10 * 60 * MIN;
      const taskItems = result.current.plan?.timeline.filter((i) => i.kind === 'task') ?? [];
      for (const item of taskItems) {
        expect(item.endAt).toBeLessThanOrEqual(deadline);
      }
    });
  });

  // ── Task 4B: manual order feeds the planner (skips orderForFocus reshuffle) ──
  describe('manual order', () => {
    // Two light (non-deep) tasks so orderForFocus's deep-first partition is a
    // no-op (stable identity) regardless of the focus window — isolating the
    // hasManualOrder branch as the only thing that can change the order.
    // dayTasks array order is [t1, t2] but orderIndex is reversed (t2 < t1).
    function makeReversedOrderTasks(): DayTask[] {
      return [
        { ...makeQueued({ id: 't1', label: 'First in array', category: 'admin', guessMin: 20 }), orderIndex: 2 },
        { ...makeQueued({ id: 't2', label: 'Second in array', category: 'admin', guessMin: 20 }), orderIndex: 1 },
      ];
    }

    it('without the manual-order flag, keeps array order (orderForFocus identity for two light tasks)', async () => {
      useDayTasksStore.setState({
        selectedDate: SELECTED_DATE,
        dayTasks: makeReversedOrderTasks(),
        dayMeta: null,
        hasManualOrder: false,
        setDoneBy: jest.fn(),
      });

      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      const taskItems = result.current.plan?.timeline.filter((i) => i.kind === 'task') ?? [];
      expect(taskItems.map((i) => i.label)).toEqual(['First in array', 'Second in array']);
    });

    it('with the manual-order flag, sorts by orderIndex and skips the reshuffle', async () => {
      useDayTasksStore.setState({
        selectedDate: SELECTED_DATE,
        dayTasks: makeReversedOrderTasks(),
        dayMeta: null,
        hasManualOrder: true,
        setDoneBy: jest.fn(),
      });

      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      const taskItems = result.current.plan?.timeline.filter((i) => i.kind === 'task') ?? [];
      // orderIndex order is t2 (1) then t1 (2) — the reverse of array order.
      expect(taskItems.map((i) => i.label)).toEqual(['Second in array', 'First in array']);
    });
  });

  describe('the plan anchor', () => {
    /** Two light tasks so the whole day fits comfortably in either direction. */
    function twoTasks() {
      return [
        makeQueued({ id: 't1', label: 'Task A', category: 'admin', guessMin: 30 }),
        makeQueued({ id: 't2', label: 'Task B', category: 'admin', guessMin: 30 }),
      ];
    }

    function setAnchor(patch: { startAtMin?: number | null; planAnchor?: 'start' | 'finish' }) {
      useDayTasksStore.setState({
        selectedDate: SELECTED_DATE,
        dayTasks: twoTasks(),
        dayMeta: null,
        hasManualOrder: false,
        startAtMin: patch.startAtMin ?? null,
        planAnchor: patch.planAnchor ?? 'finish',
        setDoneBy: jest.fn(),
        setStartAt: jest.fn(),
        setPlanAnchor: jest.fn(),
      });
    }

    /** Earliest task block in the returned plan. */
    function firstTaskStart(plan: { timeline: { kind: string; startAt: number }[] } | null): number {
      const tasks = (plan?.timeline ?? []).filter((i) => i.kind === 'task');
      return Math.min(...tasks.map((i) => i.startAt));
    }

    it('exposes both derived clocks at once so the chooser can compare them', async () => {
      setAnchor({ planAnchor: 'finish' });
      const { result } = renderHook(() => useDayPlan(NOW_MID_MORNING));
      await act(async () => {});

      expect(typeof result.current.derivedFinishMs).toBe('number');
      expect(typeof result.current.derivedStartByMs).toBe('number');
    });

    it('defaults to the finish anchor, so the plan still fills backward', async () => {
      setAnchor({ planAnchor: 'finish' });
      const { result } = renderHook(() => useDayPlan(NOW_MID_MORNING));
      await act(async () => {});

      expect(result.current.planAnchor).toBe('finish');
      expect(result.current.plan?.startBy).toBe(result.current.derivedStartByMs);
    });

    it('anchoring the start on Now begins the plan a short lead from now', async () => {
      setAnchor({ planAnchor: 'start', startAtMin: null });
      const { result } = renderHook(() => useDayPlan(NOW_MID_MORNING));
      await act(async () => {});

      expect(firstTaskStart(result.current.plan)).toBe(NOW_MID_MORNING + 5 * MIN);
    });

    it('a pinned start time begins the plan there', async () => {
      setAnchor({ planAnchor: 'start', startAtMin: 10 * 60 });
      const { result } = renderHook(() => useDayPlan(NOW_MID_MORNING));
      await act(async () => {});

      expect(firstTaskStart(result.current.plan)).toBe(MIDNIGHT + 10 * 60 * MIN);
    });

    it('the finish anchor ignores the pinned start and still fills backward', async () => {
      setAnchor({ planAnchor: 'finish', startAtMin: 10 * 60 });
      const { result } = renderHook(() => useDayPlan(NOW_MID_MORNING));
      await act(async () => {});

      expect(result.current.plan?.startBy).toBe(result.current.derivedStartByMs);
    });

    it('derivedFinishMs is the end of the last block in the forward fill', async () => {
      setAnchor({ planAnchor: 'start', startAtMin: 10 * 60 });
      const { result } = renderHook(() => useDayPlan(NOW_MID_MORNING));
      await act(async () => {});

      const ends = (result.current.plan?.timeline ?? [])
        .filter((i) => i.kind === 'task')
        .map((i) => i.endAt);
      expect(result.current.derivedFinishMs).toBe(Math.max(...ends));
    });

    it('a start still ahead of now is not reported as passed', async () => {
      setAnchor({ planAnchor: 'start', startAtMin: 10 * 60 });
      const { result } = renderHook(() => useDayPlan(NOW_MID_MORNING));
      await act(async () => {});

      expect(result.current.startHasPassed).toBe(false);
      expect(result.current.effectiveStartMs).toBe(MIDNIGHT + 10 * 60 * MIN);
    });

    // Edge case: "09:30 has passed · starting 14:20". Their number is kept as-is.
    it('a start that has passed keeps the user\'s minute and reports the floored start', async () => {
      const afternoon = MIDNIGHT + (14 * 60 + 15) * MIN;
      setAnchor({ planAnchor: 'start', startAtMin: 9 * 60 + 30 });
      const { result } = renderHook(() => useDayPlan(afternoon));
      await act(async () => {});

      expect(result.current.startAtMin).toBe(9 * 60 + 30);
      expect(result.current.startHasPassed).toBe(true);
      expect(result.current.effectiveStartMs).toBe(afternoon + 5 * MIN);
    });

    it('the live Now anchor is never reported as passed', async () => {
      setAnchor({ planAnchor: 'start', startAtMin: null });
      const { result } = renderHook(() => useDayPlan(NOW_MID_MORNING));
      await act(async () => {});

      expect(result.current.startHasPassed).toBe(false);
    });

    it('setStartAt and setPlanAnchor delegate to the store', async () => {
      const mockSetStartAt = jest.fn();
      const mockSetPlanAnchor = jest.fn();
      setAnchor({});
      useDayTasksStore.setState({ setStartAt: mockSetStartAt, setPlanAnchor: mockSetPlanAnchor });

      const { result } = renderHook(() => useDayPlan(NOW_MID_MORNING));
      await act(async () => {});

      act(() => {
        result.current.setStartAt(9 * 60 + 30);
        result.current.setPlanAnchor('finish');
      });

      expect(mockSetStartAt).toHaveBeenCalledWith(9 * 60 + 30);
      expect(mockSetPlanAnchor).toHaveBeenCalledWith('finish');
    });
  });

  describe('setDoneBy', () => {
    it('calls the store setDoneBy with the given minute', async () => {
      const mockStoreSetDoneBy = jest.fn();
      useDayTasksStore.setState({
        selectedDate: SELECTED_DATE,
        dayTasks: [],
        dayMeta: null,
        setDoneBy: mockStoreSetDoneBy,
      });

      const { result } = renderHook(() => useDayPlan(NOW_BEFORE_WAKING));
      await act(async () => {});

      act(() => {
        result.current.setDoneBy(20 * 60);
      });

      expect(mockStoreSetDoneBy).toHaveBeenCalledWith(20 * 60);
    });
  });
});
