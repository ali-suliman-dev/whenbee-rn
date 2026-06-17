import { leadSharpnessOf } from './leadSharpness';

describe('leadSharpnessOf', () => {
  it('returns the highest cell sharpness', () => {
    expect(leadSharpnessOf([{ sharpness: 12 }, { sharpness: 46 }, { sharpness: 30 }])).toBe(46);
  });
  it('returns 0 for an empty comb', () => {
    expect(leadSharpnessOf([])).toBe(0);
  });
});
