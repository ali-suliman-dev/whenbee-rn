import { arcFraction } from '@/src/engine';

describe('arcFraction', () => {
  const start = 1_000;
  const finish = 2_000; // 1000s window

  it('returns 0 before the window starts', () => {
    expect(arcFraction(start, finish, 500)).toBe(0);
  });

  it('returns 0 at the start of the window', () => {
    expect(arcFraction(start, finish, start)).toBe(0);
  });

  it('returns 0.5 at the halfway point', () => {
    expect(arcFraction(start, finish, 1_500)).toBeCloseTo(0.5, 5);
  });

  it('returns 1 at the honest finish', () => {
    expect(arcFraction(start, finish, finish)).toBe(1);
  });

  it('returns 1 past the honest finish', () => {
    expect(arcFraction(start, finish, 5_000)).toBe(1);
  });

  it('returns 1 for a degenerate window (finish == updatedAt) to avoid divide-by-zero', () => {
    expect(arcFraction(start, start, start)).toBe(1);
  });

  it('returns 0 for a negative span (finish before updatedAt)', () => {
    expect(arcFraction(2_000, 1_000, 1_500)).toBe(0);
  });
});
