import { buildAccuracySeries } from '../accuracyTrend';

// Helper: a ratio of 1 is a perfect guess (accuracy 100); 2 or 0.5 is ~50.
const perfect = (n: number) => Array(n).fill(1);

describe('buildAccuracySeries', () => {
  it('returns null below the min-log gate', () => {
    expect(buildAccuracySeries(perfect(5))).toBeNull();
  });

  it('buckets ordered ratios into an accuracy series', () => {
    const out = buildAccuracySeries(perfect(12));
    expect(out).not.toBeNull();
    expect(out!.points).toHaveLength(6);
    out!.points.forEach((p) => expect(p).toBe(100));
    expect(out!.deltaPts).toBe(0);
  });

  it('reports a positive delta when recent buckets are sharper', () => {
    // first half loose (ratio 2 → ~50), second half perfect (ratio 1 → 100)
    const ratios = [...Array(6).fill(2), ...Array(6).fill(1)];
    const out = buildAccuracySeries(ratios);
    expect(out).not.toBeNull();
    expect(out!.points[0]).toBeLessThan(out!.points[out!.points.length - 1]);
    expect(out!.deltaPts).toBeGreaterThan(0);
  });

  it('caps the series at ACCURACY_TREND_BUCKETS even with many logs', () => {
    const out = buildAccuracySeries(perfect(40));
    expect(out!.points.length).toBeLessThanOrEqual(6);
  });

  it('allows a negative delta (steady/loosening) without throwing', () => {
    const ratios = [...Array(6).fill(1), ...Array(6).fill(2)];
    const out = buildAccuracySeries(ratios);
    expect(out!.deltaPts).toBeLessThan(0);
  });
});
