import { emptyGlobalBias, updateGlobalBias, coldStartAnchor } from '../globalPrior';

describe('updateGlobalBias', () => {
  it('seeds at alpha·ln(r) from empty and counts up', () => {
    const g = updateGlobalBias(emptyGlobalBias(), Math.E, 0.3); // ln(e)=1
    expect(g.lnEwma).toBeCloseTo(0.3, 6);
    expect(g.n).toBe(1);
  });
});

describe('coldStartAnchor', () => {
  it('returns the population prior when global data is too thin', () => {
    const anchor = coldStartAnchor(1.3, { lnEwma: Math.log(2.0), n: 2 });
    expect(anchor).toBeCloseTo(1.3, 6);
  });

  it('blends toward the personal global once past the gate, capped', () => {
    // user runs ~2.0× everywhere; new category population prior 1.3
    const anchor = coldStartAnchor(1.3, { lnEwma: Math.log(2.0), n: 50 });
    // capped personal weight 0.6 → geo blend exp(0.4·ln1.3 + 0.6·ln2.0)
    const expected = Math.exp(0.4 * Math.log(1.3) + 0.6 * Math.log(2.0));
    expect(anchor).toBeCloseTo(expected, 6);
    expect(anchor).toBeGreaterThan(1.3);
    expect(anchor).toBeLessThan(2.0);
  });
});
