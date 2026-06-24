// src/lib/__tests__/notifyTiming.test.ts
import {
  nextAllowedFireMs,
  honestReachedFireMs,
  shouldSuppressHonestBanner,
  guardCollidesWithHonest,
  type QuietHours,
} from '@/src/lib/notifyTiming';

// A fixed local day to make minute-of-day math deterministic.
// 2026-06-24 is a Wednesday. Build ms from local components.
const MS_PER_DAY = 24 * 60 * 60_000;
const at = (h: number, m = 0): number => new Date(2026, 5, 24, h, m, 0, 0).getTime();
const QUIET: QuietHours = { enabled: true, startMin: 21 * 60, endMin: 8 * 60 }; // 21:00–08:00 wrap

describe('nextAllowedFireMs', () => {
  it('returns desired unchanged when quiet hours disabled', () => {
    const off: QuietHours = { enabled: false, startMin: 0, endMin: 0 };
    expect(nextAllowedFireMs(at(23), off, at(20))).toBe(at(23));
  });

  it('returns desired unchanged when outside the quiet window', () => {
    expect(nextAllowedFireMs(at(14), QUIET, at(13))).toBe(at(14)); // 2pm, awake
  });

  it('pushes a late-night fire to the window end (next morning 08:00)', () => {
    expect(nextAllowedFireMs(at(23), QUIET, at(22))).toBe(at(8) + MS_PER_DAY); // 08:00 next day
  });

  it('pushes an early-morning fire (inside wrap) to 08:00 same day', () => {
    expect(nextAllowedFireMs(at(3), QUIET, at(2))).toBe(at(8));
  });

  it('treats the startMin boundary as inside (defer)', () => {
    expect(nextAllowedFireMs(at(21), QUIET, at(20))).toBe(at(8) + MS_PER_DAY); // 21:00 → next 08:00
  });

  it('treats the endMin boundary as outside (allow)', () => {
    expect(nextAllowedFireMs(at(8), QUIET, at(7))).toBe(at(8));
  });

  it('handles a non-wrapping window (13:00–14:00)', () => {
    const lunch: QuietHours = { enabled: true, startMin: 13 * 60, endMin: 14 * 60 };
    expect(nextAllowedFireMs(at(13, 30), lunch, at(13))).toBe(at(14));
    expect(nextAllowedFireMs(at(15), lunch, at(14, 30))).toBe(at(15));
  });
});

describe('honestReachedFireMs', () => {
  it('adds anchor minutes to the start', () => {
    expect(honestReachedFireMs(at(10), 45)).toBe(at(10, 45));
  });
});

describe('shouldSuppressHonestBanner', () => {
  it('suppresses only when presence is available AND an activity is live', () => {
    expect(shouldSuppressHonestBanner(true, true)).toBe(true);
    expect(shouldSuppressHonestBanner(true, false)).toBe(false);
    expect(shouldSuppressHonestBanner(false, true)).toBe(false);
    expect(shouldSuppressHonestBanner(false, false)).toBe(false);
  });
});

describe('guardCollidesWithHonest', () => {
  it('flags a guard within the default 60s gap of the honest ping', () => {
    expect(guardCollidesWithHonest(at(11), at(11), 60_000)).toBe(true);
    expect(guardCollidesWithHonest(at(11), at(11, 0) + 30_000, 60_000)).toBe(true);
  });
  it('allows a guard well after the honest ping', () => {
    expect(guardCollidesWithHonest(at(11), at(12), 60_000)).toBe(false);
  });
});
