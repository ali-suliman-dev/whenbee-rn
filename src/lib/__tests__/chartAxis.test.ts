import { niceAxis } from '../chartAxis';

describe('niceAxis', () => {
  it('rounds a flat accuracy series to a generous, discrete %-band (the 60–80 ask)', () => {
    // Flat-ish reads in the high 60s should not hug the data — they get a clean,
    // rounded band with breathing room so "steady" reads as a calm line in context.
    const axis = niceAxis([66, 67, 65, 68], { step: 5, clampMin: 0, clampMax: 100, minSpanSteps: 4 });
    expect(axis).toEqual({ min: 60, max: 80, step: 5, ticks: [60, 65, 70, 75, 80] });
  });

  it('anchors the multiplier axis at the 1.0× ideal and steps by 0.1', () => {
    const axis = niceAxis([1.31, 1.27, 1.24, 1.21, 1.18], { step: 0.1, anchorValue: 1, minSpanSteps: 3 });
    expect(axis.min).toBeCloseTo(1.0, 6);
    expect(axis.max).toBeCloseTo(1.4, 6);
    expect(axis.step).toBeCloseTo(0.1, 6);
    expect(axis.ticks.map((t) => Number(t.toFixed(1)))).toEqual([1.0, 1.1, 1.2, 1.3, 1.4]);
  });

  it('never lets the top data point sit glued to the top gridline (adds headroom)', () => {
    // 70 lands exactly on a 5-step tick → the band must extend above it.
    const axis = niceAxis([60, 70], { step: 5, clampMin: 0, clampMax: 100, minSpanSteps: 1 });
    expect(axis.max).toBeGreaterThan(70);
  });

  it('respects clampMax — a near-ceiling series never exceeds 100%', () => {
    const axis = niceAxis([94, 97, 99], { step: 5, clampMin: 0, clampMax: 100, minSpanSteps: 4 });
    expect(axis.max).toBe(100);
    expect(axis.min).toBeGreaterThanOrEqual(0);
    expect(axis.ticks[axis.ticks.length - 1]).toBe(100);
  });

  it('enforces the minimum span by widening symmetrically (hi first, then lo)', () => {
    const axis = niceAxis([72, 73], { step: 5, clampMin: 0, clampMax: 100, minSpanSteps: 4 });
    expect((axis.max - axis.min) / axis.step).toBeGreaterThanOrEqual(4);
    // widened both ways around the data, not just upward
    expect(axis.min).toBeLessThan(70);
    expect(axis.max).toBeGreaterThan(75);
  });

  it('produces ascending, evenly-spaced ticks from min to max', () => {
    const axis = niceAxis([12, 40, 88], { step: 20, clampMin: 0, minSpanSteps: 1 });
    for (let i = 1; i < axis.ticks.length; i++) {
      expect(axis.ticks[i]! - axis.ticks[i - 1]!).toBeCloseTo(axis.step, 6);
    }
    expect(axis.ticks[0]).toBe(axis.min);
    expect(axis.ticks[axis.ticks.length - 1]).toBe(axis.max);
  });

  it('handles a single value without throwing', () => {
    const axis = niceAxis([68], { step: 5, clampMin: 0, clampMax: 100, minSpanSteps: 4 });
    expect(axis.max).toBeGreaterThan(axis.min);
    expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
  });
});
