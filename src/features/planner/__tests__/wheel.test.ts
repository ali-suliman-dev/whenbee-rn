/**
 * Unit tests for wheel clamping helper.
 *
 * TDD: written BEFORE the fix to prove the Critical off-by-one bug exists, then
 * passing once `clampWheelIndex` is correctly wired in DurationWheel.
 */
import { clampWheelIndex, clampToRange } from '../wheelShared';

describe('clampToRange', () => {
  it('returns lo when n is below lo', () => {
    expect(clampToRange(2, 5, 10)).toBe(5);
    expect(clampToRange(-100, 0, 3)).toBe(0);
  });

  it('returns hi when n is above hi', () => {
    expect(clampToRange(20, 5, 10)).toBe(10);
    expect(clampToRange(100, 0, 3)).toBe(3);
  });

  it('returns n when it is inside [lo, hi] (inclusive)', () => {
    expect(clampToRange(7, 5, 10)).toBe(7);
    expect(clampToRange(5, 5, 10)).toBe(5);
    expect(clampToRange(10, 5, 10)).toBe(10);
  });

  it('guards an inverted range (lo > hi) by returning lo', () => {
    expect(clampToRange(7, 10, 5)).toBe(10);
    expect(clampToRange(0, 10, 5)).toBe(10);
  });
});

describe('clampWheelIndex', () => {
  it('returns 0 for negative input', () => {
    expect(clampWheelIndex(-1, 36)).toBe(0);
    expect(clampWheelIndex(-100, 36)).toBe(0);
  });

  it('returns 0 for zero input', () => {
    expect(clampWheelIndex(0, 36)).toBe(0);
  });

  it('returns the last valid index (count - 1) for an input equal to count - 1', () => {
    // count = 36 → last index is 35; must be reachable
    expect(clampWheelIndex(35, 36)).toBe(35);
  });

  it('returns the last valid index for input exactly at count - 1', () => {
    // Specifically proves the "180 minutes" item is reachable with step=5 (count=36)
    const count = 36;
    const lastIdx = count - 1;
    expect(clampWheelIndex(lastIdx, count)).toBe(lastIdx);
  });

  it('clamps overshooting input to count - 1 (not count - 2)', () => {
    expect(clampWheelIndex(100, 36)).toBe(35);
  });

  it('works for small counts', () => {
    expect(clampWheelIndex(0, 1)).toBe(0);
    expect(clampWheelIndex(5, 1)).toBe(0);
    expect(clampWheelIndex(1, 2)).toBe(1);
  });
});
