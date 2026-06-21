import { makeBandDomain } from '@/src/features/shared/bandDomain';

describe('makeBandDomain', () => {
  it('maps the range edges inside the padded domain', () => {
    // range 20–40 → domain [floor5(12)=10, ceil5(56)=60], span 50
    const { at } = makeBandDomain({ lowMinutes: 20, highMinutes: 40 });
    expect(at(20)).toBeCloseTo(0.2, 5); // (20-10)/50
    expect(at(40)).toBeCloseTo(0.6, 5); // (40-10)/50
    expect(at(30)).toBeCloseTo(0.4, 5); // point midway
  });

  it('clamps to [0,1] outside the domain', () => {
    const { at } = makeBandDomain({ lowMinutes: 20, highMinutes: 40 });
    expect(at(0)).toBe(0);
    expect(at(1000)).toBe(1);
  });
});
