import { renderHook } from '@testing-library/react-native';
import { useWidgetPublisher } from '../useWidgetPublisher';
import { useTimerStore } from '@/src/stores/timerStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { publishWidgetSnapshot, clearWidgetSnapshot } from '@/src/services/liveActivity';
import type { DayTask } from '@/src/engine/daySelectors';

jest.mock('@/src/services/liveActivity', () => ({
  publishWidgetSnapshot: jest.fn(),
  clearWidgetSnapshot: jest.fn(),
}));

const mockPublish = publishWidgetSnapshot as jest.Mock;
const mockClear = clearWidgetSnapshot as jest.Mock;

const T0 = 1_700_000_000_000;

function makeFocus(overrides: Partial<DayTask> = {}): DayTask {
  return {
    id: 'task-1',
    label: 'Write report',
    category: 'admin',
    guessMin: 30,
    status: 'queued',
    plannedDate: '2023-11-14',
    orderIndex: T0,
    doneByMin: null,
    createdAt: T0,
    completedAt: null,
    actualMin: null,
    fromRoutineId: null,
    calendarEventId: null,
    carriedFrom: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useTimerStore.setState({ isRunning: false, taskId: null });
  useEntitlement.setState({ isPro: false });
  useCalibrationStore.setState({ statsByCategory: {} });
});

describe('useWidgetPublisher', () => {
  it('clears the widget when there is no focus task', () => {
    renderHook(() => useWidgetPublisher({ focus: null, honestMin: null }));
    expect(mockClear).toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('clears the widget when focus exists but honestMin is null', () => {
    renderHook(() => useWidgetPublisher({ focus: makeFocus(), honestMin: null }));
    expect(mockClear).toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('publishes on initial mount with a focus + honestMin', () => {
    renderHook(() => useWidgetPublisher({ focus: makeFocus(), honestMin: 30 }));
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ nextTaskLabel: 'Write report' }),
    );
  });

  it('start deep link carries the FULL session context, not just the taskId', () => {
    // A taskId-only link made the timer start with placeholder params (15 min
    // 'Focus session' in 'getting_ready') — the widget must pass everything the
    // timer needs to start THIS task correctly.
    renderHook(() => useWidgetPublisher({ focus: makeFocus(), honestMin: 42 }));
    const [payload] = mockPublish.mock.calls[0] as [{ startDeepLink: string }];
    expect(payload.startDeepLink).toBe(
      'whenbee://timer?taskId=task-1&label=Write%20report&category=admin&estimateMin=42&guessMin=30',
    );
  });

  it('republishes when focus changes', () => {
    const { rerender } = renderHook(
      ({ focus }: { focus: DayTask | null }) => useWidgetPublisher({ focus, honestMin: 30 }),
      { initialProps: { focus: makeFocus() } },
    );
    mockPublish.mockClear();
    rerender({ focus: makeFocus({ id: 'task-2', label: 'Different task' }) });
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ nextTaskLabel: 'Different task' }),
    );
  });

  it('republishes when honestMin changes', () => {
    const { rerender } = renderHook(
      ({ honestMin }: { honestMin: number }) => useWidgetPublisher({ focus: makeFocus(), honestMin }),
      { initialProps: { honestMin: 30 } },
    );
    mockPublish.mockClear();
    rerender({ honestMin: 45 });
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('republishes when the timer starts/stops running', () => {
    const { rerender } = renderHook(() => useWidgetPublisher({ focus: makeFocus(), honestMin: 30 }));
    mockPublish.mockClear();
    useTimerStore.setState({ isRunning: true });
    rerender({});
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('republishes reactively when isPro changes (a purchase lights the widget immediately)', () => {
    const { rerender } = renderHook(() => useWidgetPublisher({ focus: makeFocus(), honestMin: 30 }));
    mockPublish.mockClear();
    useEntitlement.setState({ isPro: true });
    rerender({});
    const [payload] = mockPublish.mock.calls[0] as [{ isPro: boolean }];
    expect(payload.isPro).toBe(true);
  });

  it('republishes when the focus category mEffective changes', () => {
    const { rerender } = renderHook(() => useWidgetPublisher({ focus: makeFocus(), honestMin: 30 }));
    mockPublish.mockClear();
    useCalibrationStore.setState({
      statsByCategory: {
        admin: { mEffective: 1.5, n: 3, sharpness: 50, tier: 'Setting', fit: { a: 0, b: 1.5 } },
      },
    });
    rerender({});
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('never throws even if the underlying publish call throws', () => {
    mockPublish.mockImplementation(() => {
      throw new Error('native write failed');
    });
    expect(() =>
      renderHook(() => useWidgetPublisher({ focus: makeFocus(), honestMin: 30 })),
    ).not.toThrow();
  });
});
