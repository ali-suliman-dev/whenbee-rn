import { seedMultiplierFor, provisionalArchetypeMultiplier } from '../archetypeSeed';

describe('seedMultiplierFor', () => {
  it('maps each pace answer to its band', () => {
    expect(seedMultiplierFor({ pace: 'about' })).toBeCloseTo(1.15);
    expect(seedMultiplierFor({ pace: 'lose' })).toBeCloseTo(3.0);
  });
  it('bumps the seed when mid-task goes to rabbit holes', () => {
    expect(seedMultiplierFor({ pace: 'bit', mid: 'rabbit' })).toBeGreaterThan(seedMultiplierFor({ pace: 'bit' }));
  });
  it('never exceeds the ratio ceiling', () => {
    expect(seedMultiplierFor({ pace: 'lose', mid: 'rabbit' })).toBeLessThanOrEqual(6);
  });
});

describe('provisionalArchetypeMultiplier', () => {
  it('returns the seed when there is no data', () => {
    expect(provisionalArchetypeMultiplier(2.1, [])).toBeCloseTo(2.1);
  });
  it('pulls toward the data as logs accumulate', () => {
    // seed says 3.0, but the data runs ~1.0 (perfect) — blend lands between, nearer data as n grows
    const few = provisionalArchetypeMultiplier(3.0, [1, 1, 1]);
    const many = provisionalArchetypeMultiplier(3.0, Array(20).fill(1));
    expect(few).toBeGreaterThan(many); // more data → closer to 1.0
    expect(many).toBeLessThan(3.0);
    expect(many).toBeGreaterThan(1.0);
  });
});
