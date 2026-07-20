import { renderHook } from '@testing-library/react-native';
import { useCapacityWidgetPublisher } from '../useCapacityWidgetPublisher';
import { publishWidgetData, clearWidgetData } from '@/src/services/presence/widgetData';
import type { DayCapacityResult } from '../useDayCapacity';
import type { DayLoadResult } from '@/src/engine/honestDayLoad';

jest.mock('@/src/services/presence/widgetData', () => ({
  publishWidgetData: jest.fn(),
  clearWidgetData: jest.fn(),
}));

const mockPublish = publishWidgetData as jest.Mock;
const mockClear = clearWidgetData as jest.Mock;

function makeLoad(overrides: Partial<DayLoadResult> = {}): DayLoadResult {
  return {
    taskMin: 60,
    eventMin: 0,
    committedMin: 60,
    freeMin: 900,
    openMin: 840,
    verdict: 'comfortable',
    overByMin: 0,
    ...overrides,
  };
}

function makeCap(overrides: Partial<DayCapacityResult> = {}): DayCapacityResult {
  return {
    status: 'ready',
    load: makeLoad(),
    events: [],
    allDayEvents: [],
    isPro: true,
    lastFetchedAtMs: null,
    refresh: jest.fn(async () => {}),
    refreshing: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCapacityWidgetPublisher', () => {
  it('publishes the mapped payload for a Pro, ready, comfortable day', () => {
    const cap = makeCap({ load: makeLoad({ verdict: 'comfortable', openMin: 300, overByMin: 0 }) });
    renderHook(() => useCapacityWidgetPublisher(cap));
    expect(mockPublish).toHaveBeenCalledWith(
      'capacity',
      expect.objectContaining({
        verdict: 'comfortable',
        slackMin: 300,
        overByMin: 0,
        isPro: true,
      }),
    );
  });

  it('publishes slackMin=0 and the real overByMin for an over-committed day', () => {
    const cap = makeCap({ load: makeLoad({ verdict: 'over', openMin: 0, overByMin: 45 }) });
    renderHook(() => useCapacityWidgetPublisher(cap));
    expect(mockPublish).toHaveBeenCalledWith(
      'capacity',
      expect.objectContaining({
        verdict: 'over',
        slackMin: 0,
        overByMin: 45,
        isPro: true,
      }),
    );
  });

  it('publishes slackMin from openMin for a snug day too', () => {
    const cap = makeCap({ load: makeLoad({ verdict: 'snug', openMin: 20, overByMin: 0 }) });
    renderHook(() => useCapacityWidgetPublisher(cap));
    expect(mockPublish).toHaveBeenCalledWith(
      'capacity',
      expect.objectContaining({ verdict: 'snug', slackMin: 20, overByMin: 0 }),
    );
  });

  it('publishes ONLY the locked sentinel for a free user — no verdict, slack, or overBy leak', () => {
    const cap = makeCap({ isPro: false, load: makeLoad({ verdict: 'over', openMin: 0, overByMin: 500 }) });
    renderHook(() => useCapacityWidgetPublisher(cap));
    expect(mockPublish).toHaveBeenCalledWith('capacity', { isPro: false });
    const [, payload] = mockPublish.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(payload)).toEqual(['isPro']);
    expect(payload).not.toHaveProperty('verdict');
    expect(payload).not.toHaveProperty('slackMin');
    expect(payload).not.toHaveProperty('overByMin');
  });

  it('clears the widget when Pro but load is genuinely absent (defensive, not currently reachable)', () => {
    const cap = makeCap({ status: 'loading', load: null });
    renderHook(() => useCapacityWidgetPublisher(cap));
    expect(mockClear).toHaveBeenCalledWith('capacity');
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('publishes the task-only load when calendar access was denied (widget stays live)', () => {
    const cap = makeCap({
      status: 'denied',
      load: makeLoad({ verdict: 'comfortable', openMin: 200, overByMin: 0 }),
    });
    renderHook(() => useCapacityWidgetPublisher(cap));
    expect(mockPublish).toHaveBeenCalledWith(
      'capacity',
      expect.objectContaining({ verdict: 'comfortable', slackMin: 200, overByMin: 0, isPro: true }),
    );
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('publishes the task-only load when calendar is toggled off (the common Pro case)', () => {
    const cap = makeCap({
      status: 'off',
      load: makeLoad({ verdict: 'over', openMin: 0, overByMin: 30 }),
    });
    renderHook(() => useCapacityWidgetPublisher(cap));
    expect(mockPublish).toHaveBeenCalledWith(
      'capacity',
      expect.objectContaining({ verdict: 'over', slackMin: 0, overByMin: 30, isPro: true }),
    );
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('republishes when the load result changes', () => {
    const { rerender } = renderHook(
      ({ cap }: { cap: DayCapacityResult }) => useCapacityWidgetPublisher(cap),
      { initialProps: { cap: makeCap({ load: makeLoad({ openMin: 300 }) }) } },
    );
    mockPublish.mockClear();
    rerender({ cap: makeCap({ load: makeLoad({ openMin: 100 }) }) });
    expect(mockPublish).toHaveBeenCalledWith(
      'capacity',
      expect.objectContaining({ slackMin: 100 }),
    );
  });

  it('never throws even if the underlying publish call throws', () => {
    mockPublish.mockImplementation(() => {
      throw new Error('native write failed');
    });
    const cap = makeCap();
    expect(() => renderHook(() => useCapacityWidgetPublisher(cap))).not.toThrow();
  });

  it('never throws even if the underlying clear call throws', () => {
    mockClear.mockImplementation(() => {
      throw new Error('native clear failed');
    });
    const cap = makeCap({ status: 'loading' });
    expect(() => renderHook(() => useCapacityWidgetPublisher(cap))).not.toThrow();
  });
});
