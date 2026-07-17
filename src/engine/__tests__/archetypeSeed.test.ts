import { seedMultiplierFor, provisionalArchetypeMultiplier, buildRevealEcho, sinkCategoryFor } from '../archetypeSeed';
import { CATEGORY_PRIORS } from '../priors';

describe('seedMultiplierFor', () => {
  it('maps each pace answer to its band', () => {
    expect(seedMultiplierFor({ pace: 'about' })).toBeCloseTo(1.1);
    expect(seedMultiplierFor({ pace: 'lose' })).toBeCloseTo(2.2);
  });
  it('bumps the seed when mid-task goes to rabbit holes', () => {
    expect(seedMultiplierFor({ pace: 'bit', mid: 'rabbit' })).toBeGreaterThan(seedMultiplierFor({ pace: 'bit' }));
  });
  it('never exceeds the ratio ceiling', () => {
    expect(seedMultiplierFor({ pace: 'lose', mid: 'rabbit' })).toBeLessThanOrEqual(6);
  });
  it('sink field does not affect the multiplier', () => {
    const withSink = seedMultiplierFor({ pace: 'bit', mid: 'track', sink: 'meetings' });
    const withoutSink = seedMultiplierFor({ pace: 'bit', mid: 'track' });
    expect(withSink).toBeCloseTo(withoutSink);
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

describe('buildRevealEcho', () => {
  it('lot + rabbit + deepwork', () => {
    expect(buildRevealEcho({ pace: 'lot', mid: 'rabbit', sink: 'deepwork' })).toBe(
      'You plan tight · rabbit-hole on deep work'
    );
  });
  it('pace only (about)', () => {
    expect(buildRevealEcho({ pace: 'about' })).toBe('Your guesses land close');
  });
  it('lose + track + chores', () => {
    expect(buildRevealEcho({ pace: 'lose', mid: 'track', sink: 'chores' })).toBe(
      'Time slips away on you · you stay on track · chores eats your time'
    );
  });
  it('bit + errands (no mid)', () => {
    expect(buildRevealEcho({ pace: 'bit', sink: 'errands' })).toBe(
      'You plan a touch tight · errands eats your time'
    );
  });
  it('lot + rabbit (no sink)', () => {
    expect(buildRevealEcho({ pace: 'lot', mid: 'rabbit' })).toBe('You plan tight · rabbit-hole');
  });
});

describe('sinkCategoryFor', () => {
  it('maps every sink answer to a real, priced category', () => {
    for (const s of ['meetings', 'chores', 'errands', 'deepwork'] as const) {
      expect(CATEGORY_PRIORS[sinkCategoryFor(s)]).toBeDefined();
    }
  });

  it('maps each answer to its intended category', () => {
    expect(sinkCategoryFor('meetings')).toBe('calls');
    expect(sinkCategoryFor('chores')).toBe('cleaning');
    expect(sinkCategoryFor('errands')).toBe('errands');
    expect(sinkCategoryFor('deepwork')).toBe('creative');
  });
});
