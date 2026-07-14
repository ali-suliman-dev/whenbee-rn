import { computeFocusInsights, confidenceLabel } from '../focusWindowInsights';
import type { FocusEventInput } from '@/src/domain/types';
import { FW_CONTRAST_MAX } from '../constants';

const fit = { a: 0, b: 1.5 };
const fits = { Work: fit };

// helper: build a completed event starting at `startMin`, est/actual minutes
function ev(startMin: number, estimateMin: number, actualMin: number, dayKey: number): FocusEventInput {
  return { category: 'Work', estimateMin, actualMin, status: 'completed', startLocalMinute: startMin, ageDays: 1, dayKey };
}

describe('confidenceLabel', () => {
  it('buckets by threshold', () => {
    expect(confidenceLabel(0.9)).toBe('High');
    expect(confidenceLabel(0.6)).toBe('Building');
    expect(confidenceLabel(0.2)).toBe('Low');
  });
});

describe('computeFocusInsights', () => {
  it('returns null Tier-2 metrics when too few events', () => {
    const events = [ev(840, 30, 30, 1), ev(840, 30, 30, 2)];
    const r = computeFocusInsights(events, fits, 810, 960);
    expect(r.contrast).toBeNull();
    expect(r.accuracyBetterInWindow).toBeNull();
    expect(r.durationLongerInWindow).toBeNull();
    expect(typeof r.peakMin).toBe('number');
    expect(typeof r.troughMin).toBe('number');
  });

  it('computes a clamped positive contrast when bins are covered', () => {
    // afternoon cluster sharp (actual ≈ honest), morning cluster slow (actual ≫ honest)
    const events: FocusEventInput[] = [];
    for (let d = 0; d < 8; d++) {
      events.push(ev(870, 30, 30, d));   // ~14:30 sharp
      events.push(ev(540, 30, 90, d));   // ~09:00 slow (over-runs)
    }
    const r = computeFocusInsights(events, fits, 840, 960);
    expect(r.contrast).not.toBeNull();
    expect(r.contrast!).toBeGreaterThan(1);
    expect(r.contrast!).toBeLessThanOrEqual(FW_CONTRAST_MAX);
  });

  it('is deterministic (no clock/random)', () => {
    const events: FocusEventInput[] = [];
    for (let d = 0; d < 8; d++) { events.push(ev(870, 30, 30, d)); events.push(ev(540, 30, 90, d)); }
    const a = computeFocusInsights(events, fits, 840, 960);
    const b = computeFocusInsights(events, fits, 840, 960);
    expect(a).toEqual(b);
  });

  it('never picks a boundary bin as the trough when an interior eligible bin exists', () => {
    // Bin 0 (05:00–06:00, the very first waking bin) is the most extreme slump —
    // a far worse over-run than any interior bin. Without the interior-only guard
    // the boundary bin would win argmin and "your foggiest stretch" would always
    // read 5:00am for any user with an idle/noisy first bin. Bin 2 is a real,
    // well-covered interior slump bin; bin 9 is the sharp peak.
    const events: FocusEventInput[] = [];
    for (let d = 0; d < 8; d++) {
      events.push(ev(315, 30, 300, d)); // bin 0 (boundary): honest 45 vs actual 300 → very negative s (clamped)
      events.push(ev(450, 30, 90, d));  // bin 2 (interior): honest 45 vs actual 90 → moderately negative s
      events.push(ev(870, 30, 30, d));  // bin 9 (interior): honest 45 vs actual 30 → positive s, the peak
    }
    const r = computeFocusInsights(events, fits, 840, 960);
    expect(r.troughMin).not.toBe(315); // boundary bin must never be selected
    expect(r.troughMin).toBe(450); // the interior slump bin wins instead
    expect(r.peakMin).toBe(870);
  });

  it('exposes the trough bin bounds as a real stretch (start/end, not just a point)', () => {
    const events: FocusEventInput[] = [];
    for (let d = 0; d < 8; d++) {
      events.push(ev(450, 30, 90, d));  // bin 2 interior slump, center 450 (07:30)
      events.push(ev(870, 30, 30, d));  // bin 9 peak
    }
    const r = computeFocusInsights(events, fits, 840, 960);
    expect(r.troughMin).toBe(450);
    expect(r.troughStartMin).toBe(420); // 07:00 — bin start
    expect(r.troughEndMin).toBe(480);   // 08:00 — bin end (one full 60-min bin)
    expect(r.troughEndMin - r.troughStartMin).toBe(60);
  });
});
