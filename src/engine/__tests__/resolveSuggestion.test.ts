import { roundHonest, resolveSuggestion } from '../multiplier';

describe('roundHonest', () => {
  it('rounds to nearest 5 and floors at 5', () => {
    expect(roundHonest(33)).toBe(35);
    expect(roundHonest(2)).toBe(5);
    expect(roundHonest(77)).toBe(75);
  });
});

describe('resolveSuggestion (affine)', () => {
  const flat = (b: number) => ({ a: 0, b });

  it('uses the category fit when no recurring data', () => {
    const s = resolveSuggestion({
      guessMinutes: 15,
      category: { fit: flat(2.2), n: 0 },
      recurring: null,
    });
    expect(s.honestMinutes).toBe(35); // round5(33)
    expect(s.basis).toBe('prior');
    expect(s.multiplier).toBeCloseTo(2.2, 6);
  });

  it('marks personal once n ≥ 3', () => {
    const s = resolveSuggestion({
      guessMinutes: 15,
      category: { fit: flat(1.6), n: 5 },
      recurring: null,
    });
    expect(s.basis).toBe('personal');
    expect(s.label).toBe('based on your last 5 times');
  });

  it('prefers a recurring fit once it has ≥3 logs', () => {
    const s = resolveSuggestion({
      guessMinutes: 20,
      category: { fit: flat(2.0), n: 10 },
      recurring: { fit: flat(1.2), n: 3 },
    });
    expect(s.multiplier).toBeCloseTo(1.2, 6);
    expect(s.sampleSize).toBe(3);
  });

  it('effective multiplier reflects a non-zero intercept', () => {
    const s = resolveSuggestion({
      guessMinutes: 30,
      category: { fit: { a: 10, b: 1.3 }, n: 8 },
      recurring: null,
    });
    // exact = 10 + 1.3*30 = 49 → round 50; effective mult = 49/30
    expect(s.honestMinutes).toBe(50);
    expect(s.multiplier).toBeCloseTo(49 / 30, 6);
  });
});
