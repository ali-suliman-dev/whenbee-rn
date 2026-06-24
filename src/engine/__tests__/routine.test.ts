import {
  stepHonestMinutes,
  routineHonestTotal,
  routineBasis,
  distributeRoutineRun,
  honestNumber,
  TRANSITION_PRIOR,
  TRANSITION_CEIL,
  TRANSITION_FLOOR,
  TRANSITION_ALPHA,
} from '../index';
import type { RoutineStepKey } from '../../domain/types';

describe('routineHonestTotal', () => {
  it('sums per-step honest minutes with factor 1.0 (no seam overhead)', () => {
    expect(routineHonestTotal([20, 10, 15], 1.0)).toBe(45);
  });

  it('applies the transition factor then round5s (51.75 → 50)', () => {
    expect(routineHonestTotal([20, 10, 15], 1.15)).toBe(50);
  });

  it('floors at 5, never 0, for an empty chain', () => {
    expect(routineHonestTotal([], 1.15)).toBe(5);
    expect(routineHonestTotal([], 1.0)).toBe(5);
  });
});

describe('stepHonestMinutes', () => {
  it('delegates to honestNumber(guess, M)', () => {
    for (const [guess, m] of [
      [15, 1.0],
      [20, 1.4],
      [10, 2.2],
      [7, 1.8],
    ] as const) {
      expect(stepHonestMinutes(guess, m)).toBe(honestNumber(guess, m));
    }
  });
});

describe('routineBasis', () => {
  it('0 or below min runs → prior + "typical patterns"', () => {
    expect(routineBasis(0)).toEqual({ basis: 'prior', label: 'based on typical patterns' });
    expect(routineBasis(2)).toEqual({ basis: 'prior', label: 'based on typical patterns' });
  });

  it('at the min-runs threshold → personal + "based on your last N runs"', () => {
    expect(routineBasis(3)).toEqual({ basis: 'personal', label: 'based on your last 3 runs' });
    expect(routineBasis(4)).toEqual({ basis: 'personal', label: 'based on your last 4 runs' });
  });
});

describe('distributeRoutineRun', () => {
  const key = (id: string): RoutineStepKey => `routine:r1:${id}`;

  it('produces one applyLog-ready training per step (estimate=guess, actual=recorded)', () => {
    const result = distributeRoutineRun({
      steps: [
        { stepKey: key('a'), guessMin: 20, actualMin: 24, stepMBefore: 1.0 },
        { stepKey: key('b'), guessMin: 10, actualMin: 12, stepMBefore: 1.0 },
      ],
      priorFactor: TRANSITION_PRIOR,
    });
    expect(result.stepTrainings).toEqual([
      { stepKey: key('a'), estimateMin: 20, actualMin: 24 },
      { stepKey: key('b'), estimateMin: 10, actualMin: 12 },
    ]);
  });

  it('trains the transition factor from the chain residual (EWMA toward observed)', () => {
    // baseline = honest(20,1) + honest(10,1) = 20 + 10 = 30; actual total = 36 → observed 1.2.
    const prior = TRANSITION_PRIOR; // 1.15
    const result = distributeRoutineRun({
      steps: [
        { stepKey: key('a'), guessMin: 20, actualMin: 24, stepMBefore: 1.0 },
        { stepKey: key('b'), guessMin: 10, actualMin: 12, stepMBefore: 1.0 },
      ],
      priorFactor: prior,
    });
    const observed = 36 / 30; // 1.2
    const expected = TRANSITION_ALPHA * observed + (1 - TRANSITION_ALPHA) * prior;
    expect(result.nextTransitionFactor).toBeCloseTo(expected, 6);
  });

  it('clamps a chaotic 3× run so the factor cannot exceed the ceiling', () => {
    const result = distributeRoutineRun({
      steps: [
        { stepKey: key('a'), guessMin: 20, actualMin: 60, stepMBefore: 1.0 },
        { stepKey: key('b'), guessMin: 10, actualMin: 30, stepMBefore: 1.0 },
      ],
      priorFactor: TRANSITION_CEIL, // already at the ceiling
    });
    expect(result.nextTransitionFactor).toBeLessThanOrEqual(TRANSITION_CEIL);
  });

  it('floors so an unusually fast run never claims faster than the honest steps', () => {
    const result = distributeRoutineRun({
      steps: [
        { stepKey: key('a'), guessMin: 20, actualMin: 5, stepMBefore: 1.0 },
        { stepKey: key('b'), guessMin: 10, actualMin: 5, stepMBefore: 1.0 },
      ],
      priorFactor: TRANSITION_FLOOR, // already at the floor
    });
    expect(result.nextTransitionFactor).toBeGreaterThanOrEqual(TRANSITION_FLOOR);
  });

  it('trains the factor for a single-step routine (baseline = that one step)', () => {
    const result = distributeRoutineRun({
      steps: [{ stepKey: key('only'), guessMin: 30, actualMin: 45, stepMBefore: 1.0 }],
      priorFactor: TRANSITION_PRIOR,
    });
    expect(result.stepTrainings).toHaveLength(1);
    // baseline 30, actual 45 → observed 1.5; EWMA toward it from 1.15.
    const expected = TRANSITION_ALPHA * 1.5 + (1 - TRANSITION_ALPHA) * TRANSITION_PRIOR;
    expect(result.nextTransitionFactor).toBeCloseTo(expected, 6);
  });

  it('is pure — does not mutate its inputs and uses no clock', () => {
    const input = {
      steps: [{ stepKey: key('a'), guessMin: 20, actualMin: 24, stepMBefore: 1.0 }],
      priorFactor: TRANSITION_PRIOR,
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    const a = distributeRoutineRun(input);
    const b = distributeRoutineRun(input);
    expect(input).toEqual(snapshot);
    expect(a).toEqual(b);
  });

  it('converges (repeated identical runs settle toward observed without overshoot)', () => {
    let factor = TRANSITION_PRIOR; // 1.15
    const step = { stepKey: key('a'), guessMin: 20, actualMin: 24, stepMBefore: 1.0 };
    let prev = factor;
    const observed = 24 / 20; // 1.2
    for (let i = 0; i < 30; i += 1) {
      const r = distributeRoutineRun({ steps: [step], priorFactor: factor });
      // Monotone approach toward observed (1.15 → 1.2), never overshooting it.
      expect(r.nextTransitionFactor).toBeGreaterThanOrEqual(prev);
      expect(r.nextTransitionFactor).toBeLessThanOrEqual(observed);
      factor = r.nextTransitionFactor;
      prev = factor;
    }
    expect(factor).toBeGreaterThan(1.19);
    expect(factor).toBeLessThan(1.21);
  });
});
