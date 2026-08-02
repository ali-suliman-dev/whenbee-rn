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
  useCalibrationStore.setState({ logs: 0, statsByCategory: {}, companionStage: 1 });
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

  it('holds the reached stage at the monotonic companion stage when live sharpness falls', () => {
    // Capped at Honest once (companionStage 5), then 8 sloppy logs dragged the
    // lead category's rolling window back down to Ripening. The progress read
    // may fall; the stage may not, and no passed capability may be re-offered.
    useCalibrationStore.setState({
      logs: 60,
      companionStage: 5,
      statsByCategory: { cleaning: statFor(70, 'Ripening') },
    });

    const { result } = renderHook(() => useNextUnlock());

    expect(result.current.stage).toBe(5);
    expect(result.current.sealed).toBe(true);
    expect(result.current.nextCapabilityId).toBeNull();
    expect(result.current.nextCapabilityLabel).toBeNull();
    // The live progress read still reports the truth — it is not a gate.
    expect(result.current.tier).toBe('Ripening');
    expect(result.current.pct).toBe(70);
  });

  it('never reads below what the live tier already proves (cold-boot mirror)', () => {
    // A cold boot before loadReclaimSummary() fills the mirror: companionStage
    // is still 1 but the cached stats prove Thickening, so the floor wins.
    useCalibrationStore.setState({
      logs: 30,
      companionStage: 1,
      statsByCategory: { cleaning: statFor(85, 'Thickening') },
    });

    const { result } = renderHook(() => useNextUnlock());

    expect(result.current.stage).toBe(4);
    expect(result.current.nextCapabilityId).toBe('drift-recalibration');
    expect(result.current.nextCapabilityIsPro).toBe(false);
  });

  it('F2 regression: away-count measures the rung the capability actually names, not the lead\'s own next tier band', () => {
    // Deep work reached Thickening (85, sharpness), companionStage 4. The user
    // resets Deep work from Manage-this-area (sharpness → 0), so the lead
    // becomes Errands at 20 (Raw) while the monotonic mirror stays at 4 — the
    // exact "stage runs ahead of the live tier" scenario. The OLD code paired
    // this with `logsToNextTier(20)` = ceil((40-20)/4) = 5, which measures the
    // Raw→Setting hop, a rung nothing here is chasing. The capability offered
    // is stage 5 (Honest tier, threshold 93) — the away-count must measure
    // THAT distance: ceil((93-20)/4) = 19.
    useCalibrationStore.setState({
      logs: 40,
      companionStage: 4,
      statsByCategory: { errands: statFor(20, 'Raw') },
    });

    const { result } = renderHook(() => useNextUnlock());

    expect(result.current.stage).toBe(4);
    expect(result.current.tier).toBe('Raw');
    expect(result.current.nextCapabilityId).toBe('drift-recalibration');
    expect(result.current.logsToNext).toBe(19);
    // Never the tier-band number the old bug quoted.
    expect(result.current.logsToNext).not.toBe(5);
  });

  it('flags a Pro-gated next capability', () => {
    useCalibrationStore.setState({
      logs: 20,
      companionStage: 3,
      statsByCategory: { cleaning: statFor(64, 'Ripening') },
    });

    const { result } = renderHook(() => useNextUnlock());

    expect(result.current.nextCapabilityId).toBe('honest-day-forecast');
    expect(result.current.nextCapabilityIsPro).toBe(true);
  });
});
