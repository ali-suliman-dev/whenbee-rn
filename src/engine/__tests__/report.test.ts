import {
  reportAccuracy,
  reportAccuracySpark,
  topSurprises,
  steadiestCategory,
  type ReportEventInput,
} from '../report';
import { sharpnessFromWindow } from '../sharpness';
import { clampRatio } from '../ratio';

function ev(partial: Partial<ReportEventInput>): ReportEventInput {
  return {
    category: 'admin',
    label: null,
    estimateMin: 10,
    actualMin: 10,
    endedAt: 1000,
    ...partial,
  };
}

describe('reportAccuracy', () => {
  it('delegates to sharpnessFromWindow for the same ratios', () => {
    const ratios = [1, 1.5, 2, 0.8, 1.2];
    expect(reportAccuracy(ratios)).toBe(sharpnessFromWindow(ratios));
  });

  it('returns 0 for an empty window', () => {
    expect(reportAccuracy([])).toBe(0);
  });
});

describe('reportAccuracySpark', () => {
  it('returns exactly `buckets` values', () => {
    const events = Array.from({ length: 12 }, (_, i) =>
      ev({ estimateMin: 10, actualMin: 10, endedAt: i }),
    );
    expect(reportAccuracySpark(events, 6)).toHaveLength(6);
  });

  it('reads accuracy per time-ordered bucket (perfect estimates → 100)', () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      ev({ estimateMin: 20, actualMin: 20, endedAt: i }),
    );
    expect(reportAccuracySpark(events, 3)).toEqual([100, 100, 100]);
  });

  it('orders by endedAt regardless of input order', () => {
    const events = [
      ev({ estimateMin: 10, actualMin: 20, endedAt: 5 }), // later, biased
      ev({ estimateMin: 10, actualMin: 10, endedAt: 1 }), // earlier, perfect
    ];
    const spark = reportAccuracySpark(events, 2);
    expect(spark[0]).toBe(100); // earliest bucket is the perfect one
    expect(spark[1]).toBeLessThan(100);
  });

  it('carries the previous value forward for an empty bucket (never invents a dip)', () => {
    // Sparse data spread across more buckets than samples: once a real value lands,
    // a following empty bucket carries it forward rather than dropping to 0, so the
    // line never shows a phantom dip between real samples.
    const events = [
      ev({ estimateMin: 10, actualMin: 10, endedAt: 0 }),
      ev({ estimateMin: 10, actualMin: 10, endedAt: 1 }),
    ];
    const spark = reportAccuracySpark(events, 6);
    // No value drops below a preceding real value (monotone-friendly carry-forward).
    let lastReal = 0;
    for (const v of spark) {
      if (v !== 0) {
        expect(v).toBeGreaterThanOrEqual(lastReal === 100 ? 100 : 0);
        lastReal = v;
      } else {
        // a 0 only ever appears before the first real sample, never after
        expect(lastReal).toBe(0);
      }
    }
    // The last bucket holds a real value (carry-forward guarantees no trailing dip).
    expect(spark[spark.length - 1]).toBe(100);
  });

  it('returns all zeros when there are no completed events', () => {
    expect(reportAccuracySpark([], 4)).toEqual([0, 0, 0, 0]);
  });

  it('ignores events with no actual (a leading empty bucket reads 0, then the real value)', () => {
    const events = [
      ev({ estimateMin: 10, actualMin: null, endedAt: 0 }),
      ev({ estimateMin: 10, actualMin: 10, endedAt: 1 }),
    ];
    // One completed event over two buckets: bucket 0 has no sample (0), bucket 1 has it.
    expect(reportAccuracySpark(events, 2)).toEqual([0, 100]);
  });
});

describe('topSurprises', () => {
  it('ranks by absolute gap between actual and estimate, descending', () => {
    const events = [
      ev({ estimateMin: 10, actualMin: 12, endedAt: 1 }), // gap 2
      ev({ estimateMin: 10, actualMin: 40, endedAt: 2 }), // gap 30
      ev({ estimateMin: 10, actualMin: 18, endedAt: 3 }), // gap 8
    ];
    const out = topSurprises(events, 5);
    expect(out.map((s) => s.actualMin)).toEqual([40, 18, 12]);
  });

  it('caps at k', () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      ev({ estimateMin: 10, actualMin: 10 + (i + 1) * 5, endedAt: i }),
    );
    expect(topSurprises(events, 3)).toHaveLength(3);
  });

  it('breaks ties by larger actual, then endedAt descending', () => {
    const events = [
      ev({ estimateMin: 10, actualMin: 20, endedAt: 1 }), // gap 10, actual 20
      ev({ estimateMin: 30, actualMin: 20, endedAt: 5 }), // gap 10, actual 20, later
      ev({ estimateMin: 30, actualMin: 40, endedAt: 2 }), // gap 10, actual 40
    ];
    const out = topSurprises(events, 3);
    // Larger actual first; among equal actuals the later endedAt wins.
    expect(out[0]?.actualMin).toBe(40);
    expect(out[1]?.estimateMin).toBe(30); // the later endedAt of the two actual-20 ties
    expect(out[2]?.estimateMin).toBe(10);
  });

  it('ignores non-completed events (no actual)', () => {
    const events = [
      ev({ estimateMin: 10, actualMin: null, endedAt: 1 }),
      ev({ estimateMin: 10, actualMin: 30, endedAt: 2 }),
    ];
    const out = topSurprises(events, 5);
    expect(out).toHaveLength(1);
    expect(out[0]?.actualMin).toBe(30);
  });

  it('carries the label and category through', () => {
    const events = [ev({ category: 'writing', label: 'Blog post', estimateMin: 10, actualMin: 30 })];
    const out = topSurprises(events, 5);
    expect(out[0]?.category).toBe('writing');
    expect(out[0]?.label).toBe('Blog post');
  });
});

describe('steadiestCategory', () => {
  it('returns the category with the lowest CV of clamped ratios', () => {
    const steady = Array.from({ length: 4 }, () => clampRatio(10, 12)); // all identical → CV 0
    const noisy = [clampRatio(10, 8), clampRatio(10, 18), clampRatio(10, 6), clampRatio(10, 20)];
    expect(steadiestCategory({ admin: steady, writing: noisy })).toBe('admin');
  });

  it('ignores categories below REPORT_CATEGORY_MIN_LOGS', () => {
    const tooFew = [clampRatio(10, 10), clampRatio(10, 10)]; // 2 logs, perfectly steady but < min
    const enough = [
      clampRatio(10, 12),
      clampRatio(10, 14),
      clampRatio(10, 11),
      clampRatio(10, 13),
    ];
    expect(steadiestCategory({ admin: tooFew, writing: enough })).toBe('writing');
  });

  it('returns null when no category clears the minimum', () => {
    expect(steadiestCategory({ admin: [clampRatio(10, 10)] })).toBeNull();
  });

  it('returns null for an empty map', () => {
    expect(steadiestCategory({})).toBeNull();
  });
});
