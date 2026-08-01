import { renderHook } from '@testing-library/react-native';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { CachedStat } from '@/src/stores/calibrationStore';
import { useNextUnlock } from '../useNextUnlock';

function statFor(sharpness: number, tier: CachedStat['tier']): CachedStat {
  return {
    mEffective: 1,
    n: 1,
    sharpness,
    tier,
    fit: { a: 0, b: 1 },
  };
}

beforeEach(() => {
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
});

describe('useNextUnlock', () => {
  it('zero logs: Raw tier, unlocks the next stage capability, not sealed', () => {
    const { result } = renderHook(() => useNextUnlock());

    expect(result.current.tier).toBe('Raw');
    expect(result.current.tierLabel).toBe('Just started');
    expect(result.current.pct).toBe(0);
    expect(result.current.logsToNext).toBeGreaterThan(0);
    expect(result.current.nextCapabilityLabel).toBe('Done-time on Today and Add task');
    expect(result.current.sealed).toBe(false);
  });

  it('mid-tier: reflects the lead category and the next stage up', () => {
    useCalibrationStore.setState({
      logs: 12,
      statsByCategory: {
        cleaning: statFor(50, 'Setting'),
        admin: statFor(10, 'Raw'),
      },
    });

    const { result } = renderHook(() => useNextUnlock());

    expect(result.current.tier).toBe('Setting');
    expect(result.current.tierLabel).toBe('Learning');
    expect(result.current.pct).toBe(50);
    expect(result.current.logsToNext).toBe(4);
    expect(result.current.nextCapabilityLabel).toBe('Reverse start-by anchor');
    expect(result.current.sealed).toBe(false);
  });

  it('one log short of a tier: logsToNext is exactly 1', () => {
    useCalibrationStore.setState({
      logs: 20,
      statsByCategory: { cleaning: statFor(79, 'Ripening') },
    });

    const { result } = renderHook(() => useNextUnlock());

    expect(result.current.tier).toBe('Ripening');
    expect(result.current.logsToNext).toBe(1);
    expect(result.current.nextCapabilityLabel).toBe('Honest-Day forecast on the widget');
    expect(result.current.sealed).toBe(false);
  });

  it('sealed at Honest: no next capability, zero logs to next', () => {
    useCalibrationStore.setState({
      logs: 40,
      statsByCategory: { cleaning: statFor(95, 'Honest') },
    });

    const { result } = renderHook(() => useNextUnlock());

    expect(result.current.tier).toBe('Honest');
    expect(result.current.tierLabel).toBe('Honest');
    expect(result.current.logsToNext).toBe(0);
    expect(result.current.nextCapabilityLabel).toBeNull();
    expect(result.current.sealed).toBe(true);
  });
});
