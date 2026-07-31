import { pickTopBias, type BiasStat } from '../widgetBias';

function stat(mEffective: number, n: number, sharpness: number): BiasStat {
  return { mEffective, n, sharpness };
}

describe('pickTopBias', () => {
  it('picks the most-notable personal category (largest |mEffective - 1|)', () => {
    const stats: Record<string, BiasStat> = {
      deepWork: stat(1.4, 8, 70), // |0.4| notable
      email: stat(1.05, 10, 60), // |0.05| barely off
    };
    const result = pickTopBias(stats);
    expect(result).toEqual({ categoryId: 'deepWork', multiplier: 1.4, tier: 'Ripening' });
  });

  it('returns null when no category has enough personal data', () => {
    const stats: Record<string, BiasStat> = {
      deepWork: stat(1.4, 2, 70), // below PERSONAL_MIN_LOGS
      email: stat(0.6, 1, 40),
    };
    expect(pickTopBias(stats)).toBeNull();
  });

  it('ignores under-data categories even when their bias is larger', () => {
    const stats: Record<string, BiasStat> = {
      deepWork: stat(2.5, 1, 70), // huge bias but n too low
      email: stat(1.3, 5, 60), // qualifies
    };
    expect(pickTopBias(stats)).toEqual({ categoryId: 'email', multiplier: 1.3, tier: 'Setting' });
  });

  it('tie-breaks by higher n when |mEffective - 1| is equal', () => {
    const stats: Record<string, BiasStat> = {
      a: stat(1.3, 5, 60),
      b: stat(1.3, 9, 60),
      c: stat(0.7, 5, 60), // same |gap| = 0.3 as a/b
    };
    const result = pickTopBias(stats);
    expect(result?.categoryId).toBe('b');
  });

  it('returns null for an empty map', () => {
    expect(pickTopBias({})).toBeNull();
  });
});
