import { render, screen, fireEvent } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import { router } from 'expo-router';
import Today from '@/src/app/(tabs)/index';
import { useCalibrationStore, type ReclaimSummary } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import type { DayTask } from '@/src/engine/daySelectors';
import { useDayCapacity } from '@/src/features/today/useDayCapacity';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { DayLoadResult } from '@/src/engine/honestDayLoad';
import { toLocalDayKey } from '@/src/lib/day';

// Pin the clock so "today" is always 2026-06-24 regardless of the real date.
// The Today screen calls Date.now() to compute today's date and isPastDay.
const FIXED_NOW = new Date(2026, 5, 24, 12, 0, 0).getTime(); // local 2026-06-24 noon
const FIXED_TODAY = toLocalDayKey(FIXED_NOW); // '2026-06-24'

beforeAll(() => {
  jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
});
afterAll(() => {
  (Date.now as jest.Mock).mockRestore();
});

// DayTimeline + useDayPlan pull native calendar and the engine planner —
// mock both so screen-level tests stay focused on toggle wiring, not plan internals.
jest.mock('@/src/features/today/DayTimeline', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DayTimeline: () => React.createElement(Text, { testID: 'day-timeline-root' }, 'DayTimeline'),
  };
});

jest.mock('@/src/features/today/useDayPlan', () => ({
  useDayPlan: () => ({
    plan: null,
    status: 'empty' as const,
    doneByMin: null,
    setDoneBy: jest.fn(),
  }),
}));

// useDayCapacity pulls native calendar — mock it for screen-level tests so
// calendar permission requests and async effects don't fire.
jest.mock('@/src/features/today/useDayCapacity');

const mockUseDayCapacity = jest.mocked(useDayCapacity);

function makeLoad(overrides: Partial<DayLoadResult> = {}): DayLoadResult {
  return {
    taskMin: 120, eventMin: 0, committedMin: 120,
    freeMin: 720, openMin: 720, verdict: 'comfortable', overByMin: 0,
    ...overrides,
  };
}

// CalendarStrip renders a FlatList with initialScrollIndex; the underlying
// scrollToIndex call in the effect warns in jsdom — mock the component so
// the Today screen tests stay focused on screen-level logic, not strip internals
// (the strip has its own dedicated test file).
jest.mock('@/src/features/today/calendarStrip/CalendarStrip', () => ({
  CalendarStrip: () => null,
}));

jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});

// TodayFocusHook uses useLearnedFocusWindow which triggers an async sqlite load.
// Stub it with a prior-basis window so TodayFocusHook renders null (gate: basis !== 'personal').
jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: () => ({
    startMin: 540, endMin: 690, basis: 'prior' as const,
    confidence: 0.3, scoreByBin: new Array(38).fill(0.3), sampleCount: 0, distinctDays: 0, held: false,
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

const T0 = 1_700_000_000_000;

function summary(over: Partial<{ lifetimeMin: number; lifetimeNectar: number; stage: number }>): ReclaimSummary {
  return {
    lifetimeMin: over.lifetimeMin ?? 0,
    byCategory: [],
    biggestArea: null,
    honestLogCount: 0,
    discoveryCount: 0,
    companion: {
      stage: (over.stage ?? 1) as ReclaimSummary['companion']['stage'],
      capability: 'finish_time' as unknown as ReclaimSummary['companion']['capability'],
      keeper: false,
      lifetimeNectar: over.lifetimeNectar ?? 0,
      driftHealth: 'settled',
      seed: 1,
      name: null,
    },
  };
}

/** Build a minimal queued DayTask for seeding dayTasksStore in screen tests. */
function makeQueued(overrides: {
  id: string;
  label: string;
  category: string;
  guessMin: number;
  createdAt?: number;
}): DayTask {
  const createdAt = overrides.createdAt ?? T0;
  return {
    id: overrides.id,
    label: overrides.label,
    category: overrides.category,
    guessMin: overrides.guessMin,
    status: 'queued',
    plannedDate: '2023-11-14',
    orderIndex: createdAt,
    doneByMin: null,
    createdAt,
    completedAt: null,
    actualMin: null,
    fromRoutineId: null,
    calendarEventId: null,
    carriedFrom: null,
  };
}

beforeEach(() => {
  // Default: free user (isPro = false). Tests that need Pro call setState directly.
  useEntitlement.setState({ isPro: false });
  mockUseDayCapacity.mockReturnValue({
    status: 'off',
    load: makeLoad(),
    events: [],
    allDayEvents: [],
    isPro: false,
  });
  // Reset to the pinned today so isPastDay is always false unless a test explicitly
  // sets a past date. Must use FIXED_TODAY (local key) — not a UTC ISO string — so
  // it matches the screen's own toLocalDayKey(Date.now()) computation.
  useDayTasksStore.setState({
    dayTasks: [],
    shelfTasks: [],
    selectedDate: FIXED_TODAY,
    selectFocusTask: () => null,
    loadShelf: async () => {},
  });
  useCalibrationStore.setState({
    logs: 0,
    statsByCategory: {},
    hydrate: async () => {},
    loadReclaimSummary: async () => summary({ lifetimeMin: 0, lifetimeNectar: 0 }),
  });
});

describe('Today screen', () => {
  it('renders the greeting in the header eyebrow (no standalone subtitle block)', () => {
    const { getByText } = render(<Today />);
    // The greeting text still appears (now as the eyebrow). useGreeting is time-based;
    // assert the time-independent prefix.
    expect(getByText(/^Good (morning|afternoon|evening)/)).toBeTruthy();
    // When selectedDate === today the title reads "Today".
    expect(getByText('Today')).toBeTruthy();
  });

  it('shows the weekday name when a non-today date is selected', () => {
    // Seed a past date (2023-11-13 = Monday).
    useDayTasksStore.setState({ selectedDate: '2023-11-13', dayTasks: [], selectFocusTask: () => null });
    const { getByText } = render(<Today />);
    expect(getByText('Monday')).toBeTruthy();
  });

  it('shows the first-run empty state when the user has never logged', async () => {
    render(<Today />);
    expect(await screen.findByText('Time your first thing')).toBeOnTheScreen();
  });

  it('shows the daily empty state for a returning user', async () => {
    useCalibrationStore.setState({
      loadReclaimSummary: async () => summary({ lifetimeMin: 860, lifetimeNectar: 12, stage: 2 }),
    });
    render(<Today />);
    expect(await screen.findByText("What's on today?")).toBeOnTheScreen();
    // No reclaim proof line — it was removed from the empty state.
    expect(screen.queryByText(/reclaimed so far/)).toBeNull();
  });

  it('renders the focus card plan total + guess→plan gap for a focus task', () => {
    useCalibrationStore.setState({
      statsByCategory: {
        getting_ready: { mEffective: 2.0, n: 8, sharpness: 70, tier: 'Ripening', fit: { a: 0, b: 2.0 } },
      },
    });
    const task = makeQueued({ id: 'f1', label: 'Leave for work', category: 'getting_ready', guessMin: 15 });
    useDayTasksStore.setState({ dayTasks: [task], selectFocusTask: () => task });

    render(<Today />);

    expect(screen.getByText('Leave for work')).toBeOnTheScreen();
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('+ 15 learned')).toBeOnTheScreen();
    expect(screen.getByText('Start')).toBeOnTheScreen();
    // No empty-state copy when a task is present.
    expect(screen.queryByText('Time your first thing')).toBeNull();
    expect(screen.queryByText("What's on today?")).toBeNull();
  });

  it('renders the free task-only capacity verdict line on today (free user)', () => {
    // selectedDate is today (set in beforeEach). The chip only weighs a day that
    // has tasks, so seed one.
    const task = makeQueued({ id: 'c1', label: 'Leave for work', category: 'getting_ready', guessMin: 15 });
    useDayTasksStore.setState({ dayTasks: [task], selectFocusTask: () => task });
    render(<Today />);
    // Free user now sees the real honest verdict line (capacity is free), not a teaser.
    expect(screen.getByTestId('capacity-free')).toBeOnTheScreen();
    expect(screen.getByText(/honest day/i)).toBeOnTheScreen();
  });

  it('renders the capacity chip collapsed for a Pro user on today', () => {
    useEntitlement.setState({ isPro: true });
    mockUseDayCapacity.mockReturnValue({
      status: 'ready',
      load: makeLoad(),
      events: [],
      allDayEvents: [],
      isPro: true,
    });
    const task = makeQueued({ id: 'c2', label: 'Leave for work', category: 'getting_ready', guessMin: 15 });
    useDayTasksStore.setState({ dayTasks: [task], selectFocusTask: () => task });
    render(<Today />);
    expect(screen.getByTestId('capacity-chip-collapsed')).toBeOnTheScreen();
  });

  it('does NOT render the capacity chip on an empty today', () => {
    // No tasks → nothing to weigh, so the chip stays hidden even on today.
    useDayTasksStore.setState({ dayTasks: [], selectFocusTask: () => null });
    render(<Today />);
    expect(screen.queryByTestId('capacity-free')).toBeNull();
    expect(screen.queryByTestId('capacity-chip-collapsed')).toBeNull();
  });

  it('does NOT render the capacity chip on a past day', () => {
    // 2023-11-13 is a past date.
    useDayTasksStore.setState({
      selectedDate: '2023-11-13',
      dayTasks: [],
      selectFocusTask: () => null,
    });
    render(<Today />);
    expect(screen.queryByTestId('capacity-chip-collapsed')).toBeNull();
    expect(screen.queryByTestId('capacity-free')).toBeNull();
  });

  it('leads up-next rows with the honest estimate and supports with the guess', async () => {
    useCalibrationStore.setState({
      statsByCategory: {
        getting_ready: { mEffective: 2.0, n: 8, sharpness: 70, tier: 'Ripening', fit: { a: 0, b: 2.0 } },
      },
    });
    // First task becomes the focus card; second is an up-next row with guessMin 25.
    const focus = makeQueued({ id: 'g1', label: 'Leave for work', category: 'getting_ready', guessMin: 15, createdAt: T0 });
    const upNext = makeQueued({ id: 'g2', label: 'Pack bag', category: 'getting_ready', guessMin: 25, createdAt: T0 + 1 });
    useDayTasksStore.setState({ dayTasks: [focus, upNext], selectFocusTask: () => focus });

    render(<Today />);

    // The up-next row leads with the honest estimate (~50) and supports with the guess.
    expect(await screen.findByText('~50')).toBeOnTheScreen();
    expect(screen.getByText('guessed 25')).toBeOnTheScreen();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Option 1 — Today is list-only; "Plan my day" opens the plan sheet
// ─────────────────────────────────────────────────────────────────────────────

describe('Today is list-only (Option 1)', () => {
  function seedTodayWithTask() {
    const task = makeQueued({
      id: 't1',
      label: 'Write tests',
      category: 'work',
      guessMin: 30,
    });
    useDayTasksStore.setState({
      dayTasks: [task],
      shelfTasks: [],
      selectedDate: new Date().toISOString().slice(0, 10),
      dayMeta: null,
      selectFocusTask: () => task,
      loadShelf: async () => {},
      markPlanned: jest.fn(async () => {}),
    });
  }

  it('never shows a List/Timeline segmented control on today', () => {
    seedTodayWithTask();
    render(<Today />);
    expect(screen.queryByTestId('view-toggle-list')).toBeNull();
    expect(screen.queryByTestId('view-toggle-timeline')).toBeNull();
  });

  it('does NOT show a Plan my day entry on a past day', () => {
    useDayTasksStore.setState({
      selectedDate: '2023-11-13',
      dayTasks: [],
      dayMeta: null,
      selectFocusTask: () => null,
      loadShelf: async () => {},
    });
    render(<Today />);
    expect(screen.queryByTestId('plan-my-day-btn')).toBeNull();
    expect(screen.queryByTestId('plan-strip')).toBeNull();
  });

  it('Pro: tapping "Plan my day" calls markPlanned and opens the plan sheet', () => {
    useEntitlement.setState({ isPro: true });
    seedTodayWithTask();
    const { getByTestId } = render(<Today />);
    fireEvent.press(getByTestId('plan-my-day-btn'));
    expect(useDayTasksStore.getState().markPlanned).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/(modals)/plan');
  });

  it('always shows the list body (UP NEXT), never the Timeline lens', () => {
    seedTodayWithTask();
    const task = makeQueued({ id: 'u1', label: 'Review PR', category: 'work', guessMin: 20 });
    useDayTasksStore.setState({ dayTasks: [task], selectFocusTask: () => null });
    render(<Today />);
    expect(screen.queryByTestId('day-timeline-root')).toBeNull();
    expect(screen.getByText('UP NEXT')).toBeOnTheScreen();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C1 — Pro gate: Plan-my-day
// ─────────────────────────────────────────────────────────────────────────────

describe('C1 — Pro gate: Plan-my-day', () => {
  function seedTodayWithTask() {
    const task = makeQueued({
      id: 'c1',
      label: 'Deep work block',
      category: 'work',
      guessMin: 60,
    });
    useDayTasksStore.setState({
      dayTasks: [task],
      shelfTasks: [],
      selectedDate: new Date().toISOString().slice(0, 10),
      dayMeta: null,
      selectFocusTask: () => task,
      loadShelf: async () => {},
      markPlanned: jest.fn(async () => {}),
    });
  }

  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  // ── Free user ──────────────────────────────────────────────────────────────

  it('free: tapping "Plan my day" routes to paywall with trigger=plan_my_day', () => {
    useEntitlement.setState({ isPro: false });
    seedTodayWithTask();
    const { getByTestId } = render(<Today />);
    fireEvent.press(getByTestId('plan-my-day-btn'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(modals)/paywall',
      params: { trigger: 'plan_my_day' },
    });
  });

  it('free: tapping "Plan my day" does NOT open the plan sheet', () => {
    useEntitlement.setState({ isPro: false });
    seedTodayWithTask();
    const { getByTestId } = render(<Today />);
    fireEvent.press(getByTestId('plan-my-day-btn'));
    expect(router.push).not.toHaveBeenCalledWith('/(modals)/plan');
  });

  // ── Pro user ───────────────────────────────────────────────────────────────

  it('Pro: tapping "Plan my day" opens the plan sheet, does NOT route to paywall', () => {
    useEntitlement.setState({ isPro: true });
    seedTodayWithTask();
    const { getByTestId } = render(<Today />);
    fireEvent.press(getByTestId('plan-my-day-btn'));
    expect(router.push).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/(modals)/paywall' }),
    );
    expect(router.push).toHaveBeenCalledWith('/(modals)/plan');
  });
});
