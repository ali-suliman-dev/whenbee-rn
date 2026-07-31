import { renderHook } from '@testing-library/react-native';
import { useBiasWidgetPublisher } from '../useBiasWidgetPublisher';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { publishWidgetData, clearWidgetData } from '@/src/services/presence/widgetData';
import type { CachedStat } from '@/src/stores/calibrationStore';

jest.mock('@/src/services/presence/widgetData', () => ({
  publishWidgetData: jest.fn(),
  clearWidgetData: jest.fn(),
}));

const mockPublish = publishWidgetData as jest.Mock;
const mockClear = clearWidgetData as jest.Mock;

function stat(overrides: Partial<CachedStat> = {}): CachedStat {
  return {
    mEffective: 1.4,
    n: 8,
    sharpness: 70,
    tier: 'Ripening',
    fit: { a: 0, b: 1.4 },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useEntitlement.setState({ isPro: false });
  useCalibrationStore.setState({ statsByCategory: {} });
});

describe('useBiasWidgetPublisher', () => {
  it('publishes the mapped payload for a Pro user with a qualifying category', () => {
    useEntitlement.setState({ isPro: true });
    useCalibrationStore.setState({ statsByCategory: { deep_work: stat() } });
    renderHook(() => useBiasWidgetPublisher());
    expect(mockPublish).toHaveBeenCalledWith(
      'bias',
      expect.objectContaining({
        categoryLabel: 'Deep Work',
        multiplierText: '1.4× over',
        tier: 'Ripening',
        isPro: true,
      }),
    );
  });

  it('formats an under-runner with "under"', () => {
    useEntitlement.setState({ isPro: true });
    useCalibrationStore.setState({
      statsByCategory: { writing: stat({ mEffective: 0.8, n: 5, sharpness: 50, tier: 'Setting' }) },
    });
    renderHook(() => useBiasWidgetPublisher());
    expect(mockPublish).toHaveBeenCalledWith(
      'bias',
      expect.objectContaining({ categoryLabel: 'Writing', multiplierText: '0.8× under' }),
    );
  });

  it('publishes ONLY the locked sentinel for a free user — no category/multiplier/tier leak', () => {
    useEntitlement.setState({ isPro: false });
    useCalibrationStore.setState({ statsByCategory: { deep_work: stat() } });
    renderHook(() => useBiasWidgetPublisher());
    expect(mockPublish).toHaveBeenCalledWith('bias', { isPro: false });
    const [, payload] = mockPublish.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(payload)).toEqual(['isPro']);
  });

  it('clears the widget when Pro but no category qualifies', () => {
    useEntitlement.setState({ isPro: true });
    useCalibrationStore.setState({
      statsByCategory: { deep_work: stat({ n: 1 }) },
    });
    renderHook(() => useBiasWidgetPublisher());
    expect(mockClear).toHaveBeenCalledWith('bias');
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('clears the widget when Pro but there are no categories at all', () => {
    useEntitlement.setState({ isPro: true });
    useCalibrationStore.setState({ statsByCategory: {} });
    renderHook(() => useBiasWidgetPublisher());
    expect(mockClear).toHaveBeenCalledWith('bias');
  });

  it('never throws even if the underlying publish call throws', () => {
    mockPublish.mockImplementation(() => {
      throw new Error('native write failed');
    });
    useEntitlement.setState({ isPro: true });
    useCalibrationStore.setState({ statsByCategory: { deep_work: stat() } });
    expect(() => renderHook(() => useBiasWidgetPublisher())).not.toThrow();
  });

  it('never throws even if the underlying clear call throws', () => {
    mockClear.mockImplementation(() => {
      throw new Error('native clear failed');
    });
    useEntitlement.setState({ isPro: true });
    useCalibrationStore.setState({ statsByCategory: {} });
    expect(() => renderHook(() => useBiasWidgetPublisher())).not.toThrow();
  });

  it('republishes when statsByCategory changes', () => {
    useEntitlement.setState({ isPro: true });
    useCalibrationStore.setState({ statsByCategory: { deep_work: stat() } });
    const { rerender } = renderHook(() => useBiasWidgetPublisher());
    mockPublish.mockClear();
    useCalibrationStore.setState({
      statsByCategory: { deep_work: stat({ mEffective: 2.0 }) },
    });
    rerender({});
    expect(mockPublish).toHaveBeenCalledWith(
      'bias',
      expect.objectContaining({ multiplierText: '2.0× over' }),
    );
  });
});
