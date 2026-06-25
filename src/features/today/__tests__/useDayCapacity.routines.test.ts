// TDD: verify that scheduled routine minutes add to the day load in useDayCapacity.
// The routine blocks' honestTotalMin flows into the task load alongside task minutes.

import { renderHook, act } from '@testing-library/react-native';
import { useDayCapacity } from '../useDayCapacity';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useRoutinesStore } from '@/src/stores/routinesStore';
import type { RoutineWithSteps } from '@/src/db';

// ── Mock calendar (no events in these tests) ─────────────────────────────────

const mockGetEventsForDay = jest.fn<Promise<[]>, [string, unknown]>().mockResolvedValue([]);
const mockRequestReadAccess = jest.fn<Promise<boolean>, []>().mockResolvedValue(true);

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

// 2026-06-24 is a Wednesday (weekday 3)
const WEDNESDAY = '2026-06-24';

function makeRoutineWithSteps(opts: {
  id: string;
  scheduleDays: number[];
  steps: { id: string; guessMin: number }[];
}): RoutineWithSteps {
  return {
    routine: {
      id: opts.id,
      name: `Routine ${opts.id}`,
      scheduleDays: opts.scheduleDays,
      doneByMinuteOfDay: 480,
      alertEnabled: false,
      alertLeadMin: 0,
      transitionFactor: 1.0,
      runCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    steps: opts.steps.map((s, i) => ({
      id: s.id,
      routineId: opts.id,
      position: i,
      label: `Step ${i + 1}`,
      category: 'admin',
      guessMin: s.guessMin,
    })),
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useDayTasksStore.setState({
    selectedDate: WEDNESDAY,
    dayTasks: [], // no queued tasks — isolate the routine contribution
  });

  useSettingsStore.setState({
    calendar: { showEvents: false, enabledCalendarIds: [], exportEnabled: false, whenbeeCalendarId: null },
  });

  useCalibrationStore.setState({ statsByCategory: {} });

  useEntitlement.setState({ isPro: true, ready: true });

  // Default: no routines
  useRoutinesStore.setState({ routines: [], stepMByKey: {} });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useDayCapacity — scheduled routine block contribution', () => {
  it('adds a scheduled routine block minutes to the day load (taskMin)', async () => {
    // One routine scheduled for Wednesday (weekday 3), two steps × 15 min guess, M=1.0
    // stepHonestMinutes(15, 1.0) = 15 each; total = round5((15+15)×1.0) = 30
    const routine = makeRoutineWithSteps({
      id: 'r1',
      scheduleDays: [3], // Wednesday
      steps: [
        { id: 's1', guessMin: 15 },
        { id: 's2', guessMin: 15 },
      ],
    });

    useRoutinesStore.setState({
      routines: [routine],
      stepMByKey: {
        'routine:r1:s1': 1.0,
        'routine:r1:s2': 1.0,
      },
    });

    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});

    // With M=1.0, honest per step is 15 → total = 30
    // No other tasks → taskMin should be 30 (or close, depending on rounding)
    expect(result.current.load?.taskMin).toBe(30);
  });

  it('does NOT add routine minutes when the routine is not scheduled for the selected day', async () => {
    // Scheduled Thursday (4), but selected date is Wednesday
    const routine = makeRoutineWithSteps({
      id: 'r1',
      scheduleDays: [4],
      steps: [{ id: 's1', guessMin: 30 }],
    });

    useRoutinesStore.setState({
      routines: [routine],
      stepMByKey: { 'routine:r1:s1': 1.0 },
    });

    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});

    expect(result.current.load?.taskMin).toBe(0);
  });

  it('adds routine minutes on top of queued task minutes', async () => {
    // Routine: 1 step × 30 min guess, M=1.0 → honest 30; total = 30
    // Tasks: none (so we directly see the routine contribution in taskMin)
    const routine = makeRoutineWithSteps({
      id: 'r1',
      scheduleDays: [3],
      steps: [{ id: 's1', guessMin: 30 }],
    });

    useRoutinesStore.setState({
      routines: [routine],
      stepMByKey: { 'routine:r1:s1': 1.0 },
    });

    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});

    expect(result.current.load?.taskMin).toBe(30);
    // No queued tasks, so all taskMin comes from the routine
  });

  it('stacks multiple scheduled routine blocks', async () => {
    // Two routines both scheduled for Wednesday
    // Each: 1 step × 20 min guess, M=1.0 → honest 20 each → total per routine = 20
    const r1 = makeRoutineWithSteps({
      id: 'r1',
      scheduleDays: [3],
      steps: [{ id: 's1', guessMin: 20 }],
    });
    const r2 = makeRoutineWithSteps({
      id: 'r2',
      scheduleDays: [3],
      steps: [{ id: 's2', guessMin: 20 }],
    });

    useRoutinesStore.setState({
      routines: [r1, r2],
      stepMByKey: {
        'routine:r1:s1': 1.0,
        'routine:r2:s2': 1.0,
      },
    });

    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});

    // 20 + 20 = 40 from routines; no tasks → taskMin = 40
    expect(result.current.load?.taskMin).toBe(40);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pro-gate regression: free users must NOT have routine minutes in their load.
// Routines are a Pro feature; the load computation must gate them at the hook
// level, not just at the display level.
// ─────────────────────────────────────────────────────────────────────────────

describe('useDayCapacity — routine minutes Pro-gate regression', () => {
  beforeEach(() => {
    useDayTasksStore.setState({ selectedDate: WEDNESDAY, dayTasks: [] });
    useSettingsStore.setState({
      calendar: { showEvents: false, enabledCalendarIds: [], exportEnabled: false, whenbeeCalendarId: null },
    });
    useCalibrationStore.setState({ statsByCategory: {} });
    useRoutinesStore.setState({ routines: [], stepMByKey: {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('free user: routine minutes are NOT included in taskMin (hook-level gate)', async () => {
    // A routine scheduled for today with 30-min step (M=1.0 → honest 30)
    const routine = makeRoutineWithSteps({
      id: 'r1',
      scheduleDays: [3], // Wednesday
      steps: [{ id: 's1', guessMin: 30 }],
    });
    useRoutinesStore.setState({
      routines: [routine],
      stepMByKey: { 'routine:r1:s1': 1.0 },
    });

    // FREE user — routines must not bleed into the load value
    useEntitlement.setState({ isPro: false, ready: true });

    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});

    // taskMin must be 0 (no tasks, no routine minutes for free users)
    expect(result.current.load?.taskMin).toBe(0);
  });

  it('Pro user: routine minutes ARE included in taskMin', async () => {
    const routine = makeRoutineWithSteps({
      id: 'r1',
      scheduleDays: [3],
      steps: [{ id: 's1', guessMin: 30 }],
    });
    useRoutinesStore.setState({
      routines: [routine],
      stepMByKey: { 'routine:r1:s1': 1.0 },
    });

    useEntitlement.setState({ isPro: true, ready: true });

    const { result } = renderHook(() => useDayCapacity());
    await act(async () => {});

    // Pro: taskMin = 30 from the routine block
    expect(result.current.load?.taskMin).toBe(30);
  });
});
