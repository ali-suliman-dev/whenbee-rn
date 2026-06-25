// src/features/today/__tests__/exportWiring.test.tsx
//
// C1: Export wiring + write-safety regression tests.
//
// Tests:
//  1. Plan-my-day with export ON → syncExportForSelectedDay called with timed tasks.
//  2. Plan-my-day with export OFF → no calendar sync (zero writes).
//  3. Plan-my-day free user → routes to paywall, no calendar sync.
//  4. When plan is null (no tasks) → no calendar sync.
//  5. [WRITE-SAFETY] task items passed to syncExportForSelectedDay contain no calendarId field.
//  6. [WRITE-SAFETY] no calendar sync when export is disabled regardless of Pro status.
//
// All calendar ops are mocked. No native modules load.

import { render, fireEvent, act } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import { router } from 'expo-router';
import Today from '@/src/app/(tabs)/index';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useDayCapacity } from '@/src/features/today/useDayCapacity';
import { toLocalDayKey } from '@/src/lib/day';
import type { DayTask } from '@/src/engine/daySelectors';
import type { DayLoadResult } from '@/src/engine/honestDayLoad';
import type { PlanResult } from '@/src/domain/types';
import { useCalibrationStore, type ReclaimSummary } from '@/src/stores/calibrationStore';

// ── Clock pin ─────────────────────────────────────────────────────────────────
const FIXED_NOW = new Date(2026, 5, 24, 12, 0, 0).getTime();
const FIXED_TODAY = toLocalDayKey(FIXED_NOW);

beforeAll(() => {
  jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
});
afterAll(() => {
  (Date.now as jest.Mock).mockRestore();
});

// ── Component mocks ───────────────────────────────────────────────────────────

// DayTimeline is self-contained; stub it so it doesn't pull in native calendar.
jest.mock('@/src/features/today/DayTimeline', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DayTimeline: () => React.createElement(Text, { testID: 'day-timeline-root' }, 'DayTimeline'),
  };
});

// useDayCapacity pulls native calendar — stub it.
jest.mock('@/src/features/today/useDayCapacity');
const mockUseDayCapacity = jest.mocked(useDayCapacity);

// CalendarStrip pulls a FlatList with an async scroll effect — stub.
jest.mock('@/src/features/today/calendarStrip/CalendarStrip', () => ({
  CalendarStrip: () => null,
}));

// TodayFocusHook uses useLearnedFocusWindow which triggers an async sqlite load.
jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: () => ({
    startMin: 540,
    endMin: 690,
    basis: 'prior' as const,
    confidence: 0.3,
    scoreByBin: new Array(38).fill(0.3),
    sampleCount: 0,
    distinctDays: 0,
    held: false,
  }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});

// ── useDayPlan mock — lets individual tests control the plan ─────────────────
const mockPlanResult: PlanResult = {
  startBy: FIXED_NOW + 60_000,
  totalMin: 30,
  verdict: { kind: 'fits', startBy: FIXED_NOW + 60_000 },
  timeline: [
    {
      id: 'task-1',
      label: 'Deep work',
      startAt: FIXED_NOW + 60_000,
      endAt: FIXED_NOW + 31 * 60_000,
      kind: 'task',
    },
    {
      id: 'task-2',
      label: 'Review',
      startAt: FIXED_NOW + 32 * 60_000,
      endAt: FIXED_NOW + 47 * 60_000,
      kind: 'task',
    },
    {
      id: 'breather-1',
      label: '',
      startAt: FIXED_NOW + 31 * 60_000,
      endAt: FIXED_NOW + 32 * 60_000,
      kind: 'breather',
    },
  ],
};

let mockPlan: PlanResult | null = mockPlanResult;

jest.mock('@/src/features/today/useDayPlan', () => ({
  useDayPlan: () => ({
    plan: mockPlan,
    status: mockPlan !== null ? ('ready' as const) : ('empty' as const),
    doneByMin: null,
    setDoneBy: jest.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLoad(overrides: Partial<DayLoadResult> = {}): DayLoadResult {
  return {
    taskMin: 120,
    eventMin: 0,
    committedMin: 120,
    freeMin: 720,
    verdict: 'comfortable',
    overByMin: 0,
    ...overrides,
  };
}

function summary(): ReclaimSummary {
  return {
    lifetimeMin: 0,
    byCategory: [],
    biggestArea: null,
    honestLogCount: 0,
    discoveryCount: 0,
    companion: {
      stage: 1 as ReclaimSummary['companion']['stage'],
      capability: 'finish_time' as unknown as ReclaimSummary['companion']['capability'],
      keeper: false,
      lifetimeNectar: 0,
      driftHealth: 'settled',
      seed: 1,
      name: null,
    },
  };
}

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
    plannedDate: FIXED_TODAY,
    orderIndex: FIXED_NOW,
    doneByMin: null,
    createdAt: FIXED_NOW,
    completedAt: null,
    actualMin: null,
    fromRoutineId: null,
    calendarEventId: null,
    carriedFrom: null,
  };
}

const WHENBEE_CAL_ID = 'whenbee-cal-abc';

/** Spy on syncExportForSelectedDay via getState. */
let syncExportSpy: jest.SpyInstance;

/** Seed the store with today's date + a task + Plan-my-day actions. */
function seedToday() {
  const task = makeQueued({ id: 'task-1', label: 'Deep work', category: 'work', guessMin: 30 });
  useDayTasksStore.setState({
    dayTasks: [task],
    shelfTasks: [],
    selectedDate: FIXED_TODAY,
    viewMode: 'list',
    selectFocusTask: () => null,
    loadShelf: async () => {},
    setViewMode: jest.fn((m: 'list' | 'timeline') =>
      useDayTasksStore.setState({ viewMode: m }),
    ),
    markPlanned: jest.fn(async () => {}),
    syncExportForSelectedDay: jest.fn(async () => {}),
    clearAllCalendarLinks: jest.fn(async () => {}),
  });

  // Spy on the getState() method so fireEvent can capture calls.
  syncExportSpy = jest.spyOn(useDayTasksStore.getState(), 'syncExportForSelectedDay');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlan = mockPlanResult;

  useEntitlement.setState({ isPro: true });

  useSettingsStore.setState({
    calendar: {
      showEvents: false,
      enabledCalendarIds: [],
      exportEnabled: false,
      whenbeeCalendarId: null,
    },
  });

  mockUseDayCapacity.mockReturnValue({
    status: 'off',
    load: makeLoad(),
    events: [],
    allDayEvents: [],
    isPro: false,
  });

  useCalibrationStore.setState({
    logs: 0,
    statsByCategory: {},
    hydrate: async () => {},
    loadReclaimSummary: async () => summary(),
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('C1 — export wiring: Plan-my-day → syncExportForSelectedDay', () => {
  it('with export ON: tapping "Plan my day" calls syncExportForSelectedDay with the timed tasks', async () => {
    useEntitlement.setState({ isPro: true });
    useSettingsStore.setState({
      calendar: {
        showEvents: false,
        enabledCalendarIds: [],
        exportEnabled: true,
        whenbeeCalendarId: WHENBEE_CAL_ID,
      },
    });
    seedToday();

    const { getByTestId } = render(<Today />);

    await act(async () => {
      fireEvent.press(getByTestId('plan-my-day-btn'));
    });

    expect(syncExportSpy).toHaveBeenCalledTimes(1);

    // The argument must be an array of timed tasks (kind === 'task' only, no breathers).
    const [tasks] = syncExportSpy.mock.calls[0] as [unknown[]];
    expect(Array.isArray(tasks)).toBe(true);
    // mockPlanResult has 2 'task' items + 1 'breather' — only the task items pass through.
    expect(tasks).toHaveLength(2);

    const first = tasks[0] as { id: string; startMs: number; endMs: number };
    expect(first.id).toBe('task-1');
    expect(typeof first.startMs).toBe('number');
    expect(typeof first.endMs).toBe('number');
  });

  it('with export OFF: tapping "Plan my day" does NOT call syncExportForSelectedDay', async () => {
    useEntitlement.setState({ isPro: true });
    useSettingsStore.setState({
      calendar: {
        showEvents: false,
        enabledCalendarIds: [],
        exportEnabled: false,
        whenbeeCalendarId: null,
      },
    });
    seedToday();

    const { getByTestId } = render(<Today />);

    await act(async () => {
      fireEvent.press(getByTestId('plan-my-day-btn'));
    });

    expect(syncExportSpy).not.toHaveBeenCalled();
  });

  it('free user: tapping "Plan my day" routes to paywall, no calendar sync', async () => {
    useEntitlement.setState({ isPro: false });
    useSettingsStore.setState({
      calendar: {
        showEvents: false,
        enabledCalendarIds: [],
        exportEnabled: true,
        whenbeeCalendarId: WHENBEE_CAL_ID,
      },
    });
    seedToday();

    const { getByTestId } = render(<Today />);

    await act(async () => {
      fireEvent.press(getByTestId('plan-my-day-btn'));
    });

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(modals)/paywall',
      params: { trigger: 'plan_my_day' },
    });
    expect(syncExportSpy).not.toHaveBeenCalled();
  });

  it('when plan is null (no queued tasks): no calendar sync even with export ON', async () => {
    mockPlan = null;
    useEntitlement.setState({ isPro: true });
    useSettingsStore.setState({
      calendar: {
        showEvents: false,
        enabledCalendarIds: [],
        exportEnabled: true,
        whenbeeCalendarId: WHENBEE_CAL_ID,
      },
    });
    seedToday();

    const { getByTestId } = render(<Today />);

    await act(async () => {
      fireEvent.press(getByTestId('plan-my-day-btn'));
    });

    expect(syncExportSpy).not.toHaveBeenCalled();
  });
});

// ── WRITE-SAFETY regression ───────────────────────────────────────────────────

describe('[WRITE-SAFETY] C1 — export wiring write-safety', () => {
  it('planned tasks passed to syncExportForSelectedDay contain no calendarId field (only calendarEventId)', async () => {
    useEntitlement.setState({ isPro: true });
    useSettingsStore.setState({
      calendar: {
        showEvents: false,
        enabledCalendarIds: [],
        exportEnabled: true,
        whenbeeCalendarId: WHENBEE_CAL_ID,
      },
    });
    seedToday();

    const { getByTestId } = render(<Today />);

    await act(async () => {
      fireEvent.press(getByTestId('plan-my-day-btn'));
    });

    expect(syncExportSpy).toHaveBeenCalledTimes(1);
    const [tasks] = syncExportSpy.mock.calls[0] as [Record<string, unknown>[]];

    // The screen must not embed a raw calendarId into the task objects.
    // calendarEventId (the Whenbee-event id for an individual task) is fine.
    for (const task of tasks) {
      expect(Object.keys(task)).not.toContain('calendarId');
    }
  });

  it('[WRITE-SAFETY] no calendar sync when export is disabled, even with Pro + calendarId present', async () => {
    useEntitlement.setState({ isPro: true });
    // exportEnabled is false even though calendarId is set.
    useSettingsStore.setState({
      calendar: {
        showEvents: false,
        enabledCalendarIds: [],
        exportEnabled: false,
        whenbeeCalendarId: WHENBEE_CAL_ID,
      },
    });
    seedToday();

    const { getByTestId } = render(<Today />);

    await act(async () => {
      fireEvent.press(getByTestId('plan-my-day-btn'));
    });

    expect(syncExportSpy).not.toHaveBeenCalled();
  });
});
