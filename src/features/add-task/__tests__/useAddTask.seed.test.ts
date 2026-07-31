import { act, renderHook } from '@testing-library/react-native';
import { useAddTask } from '../useAddTask';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { roundHonest } from '@/src/engine';

const setSeed = (m0: number) =>
  useSettingsStore.setState({ archetypeSeed: { m0, source: 'quiz', tookAt: 0 } });

describe('useAddTask honest suggestion — cold start', () => {
  beforeEach(() => {
    // Real sqlite hydrate is unavailable under jest; the suggestion only
    // needs statsByCategory (empty = cold category), never the db read.
    useCalibrationStore.setState({ hydrate: async () => {}, statsByCategory: {} });
  });

  it('gives a Dreamer a longer first honest number than a Steady Reader', () => {
    setSeed(3.0);
    const { result: dreamer } = renderHook(() => useAddTask());
    act(() => {
      dreamer.current.setCategory('admin');
      dreamer.current.setGuessMin(15);
    });
    const dreamerHonest = dreamer.current.suggestion!.honestMinutes;

    setSeed(1.15);
    const { result: steady } = renderHook(() => useAddTask());
    act(() => {
      steady.current.setCategory('admin');
      steady.current.setGuessMin(15);
    });

    expect(dreamerHonest).toBeGreaterThan(steady.current.suggestion!.honestMinutes);
  });

  it('matches the unseeded population behavior when no quiz was taken', () => {
    useSettingsStore.setState({ archetypeSeed: undefined });
    const { result } = renderHook(() => useAddTask());
    act(() => {
      result.current.setCategory('admin');
      result.current.setGuessMin(15);
    });
    // roundHonest rounds to the nearest 5 minutes — 15 × 2.2 = 33 → 35.
    expect(result.current.suggestion!.honestMinutes).toBe(roundHonest(15 * 2.2));
  });
});
