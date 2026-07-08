// src/features/today/__tests__/todayPlanEntry.test.tsx
//
// Option 1: Today is list-only. This focused harness covers the plan-entry
// wiring — the compact PlanButton's planned vs. unplanned label, and the
// handlePlanMyDay → sheet route. A separate file from todayScreen.test.tsx
// because it needs a configurable useDayPlan mock (that file hard-codes an
// empty plan).

import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import Today from '@/src/app/(tabs)/index';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useDayCapacity } from '@/src/features/today/useDayCapacity';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import type { DayTask } from '@/src/engine/daySelectors';
import type { PlanResult } from '@/src/domain/types';
import { toLocalDayKey } from '@/src/lib/day';

const FIXED_NOW = new Date(2026, 5, 24, 12, 0, 0).getTime(); // local 2026-06-24 noon
const FIXED_TODAY = toLocalDayKey(FIXED_NOW);
beforeAll(() => { jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW); });
afterAll(() => { (Date.now as jest.Mock).mockRestore(); });

// Native-pulling children stubbed so the screen test stays on plan-entry wiring.
jest.mock('@/src/features/today/calendarStrip/CalendarStrip', () => ({ CalendarStrip: () => null }));
jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: () => ({
    startMin: 540, endMin: 690, basis: 'prior' as const,
    confidence: 0.3, scoreByBin: new Array(38).fill(0.3), sampleCount: 0, distinctDays: 0, held: false,
  }),
}));
jest.mock('@/src/features/today/useDayCapacity');
const mockUseDayCapacity = jest.mocked(useDayCapacity);
jest.mock('@/src/features/today/useDayPlan');
const mockUseDayPlan = jest.mocked(useDayPlan);
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({ isFocused: () => true, addListener: () => () => {} }),
}));

const T0 = 1_700_000_000_000;
function makeQueued(id: string): DayTask {
  return {
    id, label: 'Leave for work', category: 'getting_ready', guessMin: 15,
    status: 'queued', plannedDate: FIXED_TODAY, orderIndex: T0, doneByMin: null,
    createdAt: T0, completedAt: null, actualMin: null, fromRoutineId: null,
    calendarEventId: null, carriedFrom: null,
  };
}
function makePlan(startBy: number): PlanResult {
  return { startBy, timeline: [], verdict: { kind: 'fits', startBy }, totalMin: 60 };
}

beforeEach(() => {
  jest.clearAllMocks();
  useEntitlement.setState({ isPro: false });
  useSettingsStore.setState({ startByEnabled: true });
  mockUseDayCapacity.mockReturnValue({ status: 'off', load: undefined as never, events: [], allDayEvents: [], isPro: false });
  mockUseDayPlan.mockReturnValue({ plan: null, status: 'empty', doneByMin: null, setDoneBy: jest.fn() });
  useDayTasksStore.setState({
    dayTasks: [], shelfTasks: [], selectedDate: FIXED_TODAY, dayMeta: null,
    selectFocusTask: () => null, loadShelf: async () => {}, markPlanned: jest.fn(async () => {}),
  });
  useCalibrationStore.setState({
    logs: 0, statsByCategory: {}, hydrate: async () => {},
    loadReclaimSummary: async () => ({
      lifetimeMin: 0, byCategory: [], biggestArea: null, honestLogCount: 0, discoveryCount: 0,
      companion: { stage: 2, capability: 'finish_time' as never, keeper: false, lifetimeNectar: 0, driftHealth: 'settled', seed: 1, name: null },
    } as never),
  });
});

describe('Today plan entry (Option 1)', () => {
  it('shows the compact PlanButton with the start-by clock (24-h) and no segmented control once a plan exists', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    useDayTasksStore.setState({ dayTasks: [makeQueued('a')], dayMeta: { doneByMin: 780, planComputedAt: FIXED_NOW } });
    mockUseDayPlan.mockReturnValue({ plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<Today />);
    expect(screen.getByText('plan 12:35')).toBeOnTheScreen();
    expect(screen.queryByTestId('view-toggle-timeline')).toBeNull();
    expect(screen.queryByTestId('view-toggle-list')).toBeNull();
  });

  it('shows the PlanButton reading "plan my day" when tasks exist but no plan yet', () => {
    useDayTasksStore.setState({ dayTasks: [makeQueued('b')], dayMeta: null });
    render(<Today />);
    expect(screen.getByTestId('plan-button')).toBeOnTheScreen();
    expect(screen.getByText('plan my day')).toBeOnTheScreen();
    expect(screen.queryByTestId('view-toggle-timeline')).toBeNull();
  });

  it('routes a free user to the paywall on Plan my day', () => {
    useEntitlement.setState({ isPro: false });
    useDayTasksStore.setState({ dayTasks: [makeQueued('c')], dayMeta: null });
    render(<Today />);
    fireEvent.press(screen.getByTestId('plan-button'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/(modals)/paywall', params: { trigger: 'plan_my_day' } });
  });

  it('marks planned and opens the plan sheet for a Pro user', () => {
    const markPlanned = jest.fn(async () => {});
    useEntitlement.setState({ isPro: true });
    useDayTasksStore.setState({ dayTasks: [makeQueued('d')], dayMeta: null, markPlanned });
    render(<Today />);
    fireEvent.press(screen.getByTestId('plan-button'));
    expect(markPlanned).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/(modals)/plan');
  });
});
