import { correlateAccuracy, type AccuracySample } from '../accuracy';

// Helpers: a tight ratio (≈1.0) reads as accurate; a wild ratio (≈2.5) reads as off.
const tight = (hour: number, weekday: number): AccuracySample => ({ hour, weekday, ratio: 1.0 });
const off = (hour: number, weekday: number): AccuracySample => ({ hour, weekday, ratio: 2.5 });

describe('correlateAccuracy (S3)', () => {
  it('returns nothing without enough samples in both buckets', () => {
    const samples = [tight(9, 1), tight(9, 1), off(15, 1)];
    expect(correlateAccuracy(samples)).toEqual([]);
  });

  it('surfaces a time skew when mornings are clearly sharper than afternoons', () => {
    const samples = [
      ...Array.from({ length: 5 }, () => tight(9, 2)), // accurate mornings
      ...Array.from({ length: 5 }, () => off(18, 2)), // off afternoons
    ];
    const [corr] = correlateAccuracy(samples);
    expect(corr?.dimension).toBe('time');
    expect(corr?.betterLabel).toBe('mornings');
    expect(corr?.worseLabel).toBe('afternoons');
    expect(corr!.betterAccuracy).toBeGreaterThan(corr!.worseAccuracy);
    expect(corr?.sampleCount).toBe(10);
  });

  it('surfaces a weekday skew between a sharp day and an off day', () => {
    const samples = [
      ...Array.from({ length: 4 }, () => tight(9, 1)), // Monday accurate
      ...Array.from({ length: 4 }, () => off(9, 5)), // Friday off
    ];
    const weekday = correlateAccuracy(samples).find((c) => c.dimension === 'weekday');
    expect(weekday?.betterLabel).toBe('Monday');
    expect(weekday?.worseLabel).toBe('Friday');
    expect(weekday!.gap).toBeGreaterThanOrEqual(12);
  });

  it('is deterministic — same input, same output', () => {
    const samples = [
      ...Array.from({ length: 5 }, () => tight(8, 3)),
      ...Array.from({ length: 5 }, () => off(20, 3)),
    ];
    expect(correlateAccuracy(samples)).toEqual(correlateAccuracy(samples));
  });
});
