import { correlateReasons, reasonNoteFor, REASON_MIN_OVER_SAMPLES } from '@/src/engine';
import type { ReasonSample } from '@/src/domain/types';

function over(category: string, reason: string, hour = 10, weekday = 1): ReasonSample {
  return { category, reason, direction: 'over', hour, weekday };
}

describe('correlateReasons', () => {
  it('returns nothing below the min-over-sample gate', () => {
    const samples = Array.from({ length: REASON_MIN_OVER_SAMPLES - 1 }, () =>
      over('cleaning', 'context_switch'),
    );
    expect(correlateReasons(samples)).toEqual([]);
  });
  it('surfaces a dominant cause once it clears the gates', () => {
    const samples = [
      over('cleaning', 'context_switch'),
      over('cleaning', 'context_switch'),
      over('cleaning', 'context_switch'),
      over('cleaning', 'interrupted'),
    ];
    const [c] = correlateReasons(samples);
    expect(c?.categoryId).toBe('cleaning');
    expect(c?.reason).toBe('context_switch');
    expect(c?.share).toBeCloseTo(0.75, 5);
    expect(c?.sampleCount).toBe(3);
    expect(c?.totalOver).toBe(4);
  });
  it('does not surface when no cause is dominant (tie at the boundary)', () => {
    const samples = [
      over('cooking', 'context_switch'),
      over('cooking', 'interrupted'),
      over('cooking', 'underestimated'),
      over('cooking', 'context_switch'),
    ];
    expect(correlateReasons(samples)).toEqual([]);
  });
  it('ignores under-runs', () => {
    const samples: ReasonSample[] = [
      ...Array.from({ length: 4 }, () => over('email', 'context_switch')),
      { category: 'email', reason: 'focused', direction: 'under', hour: 9, weekday: 2 },
    ];
    expect(correlateReasons(samples)[0]?.totalOver).toBe(4);
  });
  it('detects an afternoon time skew', () => {
    const samples = [
      over('cleaning', 'context_switch', 17),
      over('cleaning', 'context_switch', 18),
      over('cleaning', 'context_switch', 16),
      over('cleaning', 'context_switch', 9),
    ];
    expect(correlateReasons(samples)[0]?.timeSkew).toBe('afternoon');
  });
  it('reports no time skew when evenly split', () => {
    const samples = [
      over('cleaning', 'context_switch', 17),
      over('cleaning', 'context_switch', 18),
      over('cleaning', 'context_switch', 9),
      over('cleaning', 'context_switch', 10),
    ];
    expect(correlateReasons(samples)[0]?.timeSkew).toBeNull();
  });
  it('sorts by share descending across categories', () => {
    const samples = [
      ...Array.from({ length: 4 }, () => over('a', 'interrupted')),
      over('b', 'context_switch'),
      over('b', 'context_switch'),
      over('b', 'context_switch'),
      over('b', 'interrupted'),
    ];
    expect(correlateReasons(samples).map((c) => c.categoryId)).toEqual(['a', 'b']);
  });
});

describe('reasonNoteFor (B15)', () => {
  it('returns null when the dominant share is below the note gate', () => {
    const samples = [
      over('cleaning', 'context_switch'),
      over('cleaning', 'context_switch'),
      over('cleaning', 'context_switch'),
      over('cleaning', 'interrupted'),
      over('cleaning', 'interrupted'),
    ];
    expect(reasonNoteFor('cleaning', samples, { share: 0.7 })).toBeNull();
  });
  it('builds a kind, deterministic note for a dominated category', () => {
    const samples = Array.from({ length: 5 }, () => over('cleaning', 'context_switch'));
    expect(reasonNoteFor('cleaning', samples)).toBe(
      'Most overruns here trace back to getting pulled away.',
    );
  });
  it('never throws on an unknown category', () => {
    expect(reasonNoteFor('cleaning', [])).toBeNull();
  });
});
