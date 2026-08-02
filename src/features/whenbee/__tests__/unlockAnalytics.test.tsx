import { render } from '@testing-library/react-native';
import { UnlockLadder } from '../UnlockLadder';
import { NextUnlock } from '../NextUnlock';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { CachedStat } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// The unlock surfaces exist to test one hypothesis: does telling people what
// their logs sharpen make them log more? These two events are the only way to
// answer that, so they get the same protection as the copy — including the
// once-per-state guard, because an event that fires on every render measures
// render count, not attention.
// ──────────────────────────────────────────────────────────────────────────────

function statFor(sharpness: number, tier: CachedStat['tier']): CachedStat {
  return { mEffective: 1, n: 1, sharpness, tier, fit: { a: 0, b: 1 } };
}

let captureSpy: jest.SpyInstance;

beforeEach(() => {
  useCalibrationStore.setState({
    logs: 0,
    statsByCategory: {},
    companionStage: 1,
    keeperCappedHighWater: 0,
  });
  useCategoriesStore.setState({ categories: [] });
  useEntitlement.setState({ isPro: false });
  captureSpy = jest.spyOn(analytics, 'capture').mockImplementation(() => {});
});

afterEach(() => {
  captureSpy.mockRestore();
});

function eventsNamed(name: string) {
  return captureSpy.mock.calls.filter(([event]) => event === name);
}

describe('unlock_sentence_shown', () => {
  it('fires once with the surface, the stage and the capability the user is looking at', () => {
    render(<NextUnlock surface="today" />);

    const fired = eventsNamed('unlock_sentence_shown');
    expect(fired).toHaveLength(1);
    expect(fired[0]?.[1]).toEqual({
      surface: 'today',
      stage: 1,
      // Zero logs → stage 1 reached, so the sentence names stage 2's capability.
      capability: 'today-done-time',
      is_pro: false,
      just_earned: false,
    });
  });

  it('carries the surface it was rendered on, so the two mount sites are distinguishable', () => {
    render(<NextUnlock surface="reward" />);

    expect(eventsNamed('unlock_sentence_shown')[0]?.[1]).toMatchObject({ surface: 'reward' });
  });

  it('marks the log that just earned a rung, so the payoff beat is separable in the funnel', () => {
    render(<NextUnlock surface="reward" justUnlockedId="drift-recalibration" />);

    expect(eventsNamed('unlock_sentence_shown')[0]?.[1]).toMatchObject({
      capability: 'drift-recalibration',
      just_earned: true,
    });
  });

  it('does not fire again when a re-render shows the identical sentence', () => {
    const { rerender } = render(<NextUnlock surface="today" />);
    rerender(<NextUnlock surface="today" />);
    rerender(<NextUnlock surface="today" />);

    expect(eventsNamed('unlock_sentence_shown')).toHaveLength(1);
  });
});

describe('unlock_ladder_viewed', () => {
  it('fires once with the stage and how many rungs are lit', () => {
    render(<UnlockLadder keeper={false} />);

    const fired = eventsNamed('unlock_ladder_viewed');
    expect(fired).toHaveLength(1);
    expect(fired[0]?.[1]).toEqual({ stage: 1, rungs_reached: 1, is_pro: false });
  });

  it('reports the monotonic stage, not the live tier, as rungs reached', () => {
    // Live sharpness has fallen back to Raw, but the companion has earned stage 4.
    useCategoriesStore.setState({ categories: [{ id: 'deep', name: 'Deep work', emoji: '🎯' }] });
    useCalibrationStore.setState({
      logs: 40,
      statsByCategory: { deep: statFor(20, 'Raw') },
      companionStage: 4,
    });

    render(<UnlockLadder keeper={false} />);

    expect(eventsNamed('unlock_ladder_viewed')[0]?.[1]).toMatchObject({ rungs_reached: 4 });
  });

  it('does not fire again on a re-render that changed nothing', () => {
    const { rerender } = render(<UnlockLadder keeper={false} />);
    rerender(<UnlockLadder keeper={false} />);

    expect(eventsNamed('unlock_ladder_viewed')).toHaveLength(1);
  });
});
