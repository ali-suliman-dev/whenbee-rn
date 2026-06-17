import { correlateContext, type ContextSample } from '../context';

const tight = (value: string): ContextSample => ({ value, ratio: 1.0 });
const off = (value: string): ContextSample => ({ value, ratio: 2.5 });

describe('correlateContext (S4)', () => {
  it('returns null without two buckets at the sample floor', () => {
    const samples = [...Array.from({ length: 5 }, () => tight('high')), off('low')];
    expect(correlateContext('energy', samples)).toBeNull();
  });

  it('finds best vs worst value when accuracy diverges enough', () => {
    const samples = [
      ...Array.from({ length: 5 }, () => tight('high')), // sharp on high energy
      ...Array.from({ length: 5 }, () => off('low')), // off on low energy
    ];
    const corr = correlateContext('energy', samples);
    expect(corr?.key).toBe('energy');
    expect(corr?.bestValue).toBe('high');
    expect(corr?.worstValue).toBe('low');
    expect(corr!.gap).toBeGreaterThanOrEqual(12);
    expect(corr?.sampleCount).toBe(10);
  });

  it('returns null when buckets are similar (no real pattern)', () => {
    const samples = [
      ...Array.from({ length: 5 }, () => tight('high')),
      ...Array.from({ length: 5 }, () => tight('low')),
    ];
    expect(correlateContext('energy', samples)).toBeNull();
  });
});
