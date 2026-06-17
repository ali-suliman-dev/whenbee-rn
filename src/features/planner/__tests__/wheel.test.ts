/**
 * Unit tests for wheel clamping helper.
 *
 * TDD: written BEFORE the fix to prove the Critical off-by-one bug exists, then
 * passing once `clampWheelIndex` is correctly wired in DurationWheel.
 */
import { clampWheelIndex } from '../wheelShared';

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
