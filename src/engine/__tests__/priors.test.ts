import { seededPriorFor, priorFor } from '../priors';
import { RATIO_CEIL } from '../constants';

const seed = (m0: number, sink?: 'meetings' | 'chores' | 'errands' | 'deepwork') =>
  ({ m0, sink, source: 'quiz' as const, tookAt: 0 });

describe('seededPriorFor', () => {
  it('falls back to the population prior with no seed (the pre-quiz path)', () => {
    expect(seededPriorFor('admin', undefined)).toBe(priorFor('admin'));
  });

  it('separates a Dreamer from a Steady Reader on the same category', () => {
    const dreamer = seededPriorFor('admin', seed(3.0));
    const steady = seededPriorFor('admin', seed(1.15));
    expect(dreamer).toBeGreaterThan(steady);
  });

  it('keeps the category shape — a Dreamer still expects cooking to be faster than creative', () => {
    const s = seed(3.0);
    expect(seededPriorFor('cooking', s)).toBeLessThan(seededPriorFor('creative', s));
  });

  it('leaves an average person on the population prior', () => {
    // m0 === GLOBAL_PRIOR (1.8) → the scale factor is 1
    expect(seededPriorFor('admin', seed(1.8))).toBeCloseTo(priorFor('admin'), 5);
  });

  it('never exceeds the ratio ceiling', () => {
    expect(seededPriorFor('creative', seed(6.0))).toBeLessThanOrEqual(RATIO_CEIL);
  });

  it('never returns a non-positive multiplier', () => {
    expect(seededPriorFor('calls', seed(0.1))).toBeGreaterThan(0);
  });

  it('bumps the category the user named as their time sink', () => {
    const withSink = seededPriorFor('cleaning', seed(2.1, 'chores'));
    const without = seededPriorFor('cleaning', seed(2.1));
    expect(withSink).toBeGreaterThan(without);
  });

  it('bumps ONLY the named sink category', () => {
    const s = seed(2.1, 'chores');
    expect(seededPriorFor('cooking', s)).toBe(seededPriorFor('cooking', seed(2.1)));
  });

  it('is pure — same inputs, same output', () => {
    expect(seededPriorFor('admin', seed(2.4, 'deepwork'))).toBe(seededPriorFor('admin', seed(2.4, 'deepwork')));
  });
});
