import {
  resolveWeekPeriod,
  resolveMonthPeriod,
  reviewCadenceFor,
  deriveTightened,
  buildReviewSummary,
  deriveReflection,
  deriveWeekRead,
  REVIEW_REFLECTION_QUESTION_COUNT,
} from '../review';
import type { ReviewReflection } from '../review';
import { REVIEW_MAX_TIGHTENED } from '../constants';
import type { ReviewBiggestSurprise } from '../../domain/types';

// All inputs use a LOCAL time built via the Date constructor so the period math is
// validated against the test runner's own local-day boundaries (the engine reads
// local day/month from the passed nowMs, exactly like the rest of the engine).

// ── resolveWeekPeriod ─────────────────────────────────────────────────────────

describe('resolveWeekPeriod', () => {
  it('a Wednesday returns the prior Monday–Sunday week', () => {
    // Wed 2026-06-17 14:00 local → the week that just ended is Mon Jun 8 – Sun Jun 14.
    const now = new Date(2026, 5, 17, 14, 0, 0).getTime();
    const p = resolveWeekPeriod(now);
    expect(p.kind).toBe('week');
    const start = new Date(p.startMs);
    const end = new Date(p.endMs);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(5); // June
    expect(start.getDate()).toBe(8); // Monday
    expect(start.getDay()).toBe(1); // Monday
    // endMs is exclusive — the following Monday (Jun 15) at local midnight.
    expect(end.getDate()).toBe(15);
    expect(end.getDay()).toBe(1);
  });

  it('starts and ends at local midnight', () => {
    const now = new Date(2026, 5, 17, 14, 30, 0).getTime();
    const p = resolveWeekPeriod(now);
    const start = new Date(p.startMs);
    const end = new Date(p.endMs);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(0);
    expect(end.getMinutes()).toBe(0);
  });

  it('spans exactly 7 calendar days regardless of DST', () => {
    // Late March in many zones contains a spring-forward; the period must still
    // resolve to 7 distinct calendar days (Mon→next Mon), not 7×24h.
    const now = new Date(2026, 2, 18, 12, 0, 0).getTime(); // Wed Mar 18 2026
    const p = resolveWeekPeriod(now);
    const start = new Date(p.startMs);
    const end = new Date(p.endMs);
    expect(start.getDay()).toBe(1);
    expect(end.getDay()).toBe(1);
    // Seven calendar days between the two Mondays.
    const dayMs = 24 * 60 * 60 * 1000;
    const spanDays = Math.round((p.endMs - p.startMs) / dayMs);
    expect(spanDays).toBeGreaterThanOrEqual(6);
    expect(spanDays).toBeLessThanOrEqual(8);
  });

  it('handles a Monday (returns the immediately preceding week)', () => {
    const now = new Date(2026, 5, 15, 9, 0, 0).getTime(); // Mon Jun 15
    const p = resolveWeekPeriod(now);
    const start = new Date(p.startMs);
    expect(start.getDate()).toBe(8); // prior Monday
    expect(new Date(p.endMs).getDate()).toBe(15); // up to this Monday
  });

  it('crosses a year boundary cleanly', () => {
    // Fri Jan 2 2026 → this week's Monday is Dec 29 2025, so the week that JUST
    // ended is Mon Dec 22 – Sun Dec 28 2025.
    const now = new Date(2026, 0, 2, 10, 0, 0).getTime();
    const p = resolveWeekPeriod(now);
    const start = new Date(p.startMs);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(11); // December
    expect(start.getDate()).toBe(22);
    expect(start.getDay()).toBe(1);
    expect(new Date(p.endMs).getDate()).toBe(29); // exclusive end = this week's Monday
  });

  it('produces a stable id and a locale-free label (no month names)', () => {
    const now = new Date(2026, 5, 17, 14, 0, 0).getTime();
    const p = resolveWeekPeriod(now);
    expect(p.id.length).toBeGreaterThan(0);
    // The engine emits no copy: the label is the period id, and the UI formats
    // the human label from startMs/endMs.
    expect(p.label).toBe(p.id);
    expect(p.label).toMatch(/^\d{4}-W\d{2}$/);
    // deterministic for the same now
    expect(resolveWeekPeriod(now).id).toBe(p.id);
  });
});

// ── resolveMonthPeriod ────────────────────────────────────────────────────────

describe('resolveMonthPeriod', () => {
  it('the 1st of a month returns the previous calendar month', () => {
    const now = new Date(2026, 5, 1, 9, 0, 0).getTime(); // Jun 1 2026
    const p = resolveMonthPeriod(now);
    expect(p.kind).toBe('month');
    const start = new Date(p.startMs);
    const end = new Date(p.endMs);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(4); // May
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(5); // June (exclusive)
    expect(end.getDate()).toBe(1);
  });

  it('mid-month also returns the previous calendar month', () => {
    const now = new Date(2026, 5, 17, 9, 0, 0).getTime(); // Jun 17
    const p = resolveMonthPeriod(now);
    expect(new Date(p.startMs).getMonth()).toBe(4); // May
  });

  it('January rolls back to the prior December and decrements the year', () => {
    const now = new Date(2026, 0, 1, 9, 0, 0).getTime(); // Jan 1 2026
    const p = resolveMonthPeriod(now);
    const start = new Date(p.startMs);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(11); // December
  });

  it('labels the month with the locale-free period id, never a month name', () => {
    const p = resolveMonthPeriod(new Date(2026, 5, 17, 9, 0, 0).getTime());
    expect(p.id).toBe('2026-05');
    expect(p.label).toBe(p.id);
  });

  it('captures the full length of a leap February', () => {
    const now = new Date(2024, 2, 10, 9, 0, 0).getTime(); // Mar 10 2024 → Feb 2024
    const p = resolveMonthPeriod(now);
    const start = new Date(p.startMs);
    const end = new Date(p.endMs);
    expect(start.getMonth()).toBe(1); // February
    // Feb 2024 is a leap month — the exclusive end is Mar 1.
    expect(end.getMonth()).toBe(2);
    expect(end.getDate()).toBe(1);
    const dayMs = 24 * 60 * 60 * 1000;
    const spanDays = Math.round((p.endMs - p.startMs) / dayMs);
    expect(spanDays).toBe(29);
  });
});

// ── reviewCadenceFor ──────────────────────────────────────────────────────────

describe('reviewCadenceFor', () => {
  it("is 'month' on the 1st of the month", () => {
    expect(reviewCadenceFor(new Date(2026, 5, 1, 8, 0, 0).getTime())).toBe('month');
  });

  it("is 'week' on any other day", () => {
    expect(reviewCadenceFor(new Date(2026, 5, 2, 8, 0, 0).getTime())).toBe('week');
    expect(reviewCadenceFor(new Date(2026, 5, 17, 8, 0, 0).getTime())).toBe('week');
    expect(reviewCadenceFor(new Date(2026, 5, 28, 8, 0, 0).getTime())).toBe('week');
  });
});

// ── deriveTightened ───────────────────────────────────────────────────────────

const rowsFrom = (
  entries: { categoryId: string; categoryName: string; ratios: number[] }[],
) => deriveTightened(entries);

describe('deriveTightened', () => {
  it('surfaces a category whose multiplier dropped toward 1.0 by ≥ the gap', () => {
    // early half ~2.0×, recent half ~1.2× → a clear tightening (drop ≈ 0.8).
    const out = rowsFrom([
      { categoryId: 'admin', categoryName: 'Admin', ratios: [2.0, 2.0, 1.2, 1.2] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.categoryId).toBe('admin');
    expect(out[0]?.earlyMultiplier).toBeGreaterThan(out[0]!.recentMultiplier);
  });

  it('ignores a category that barely moved (drop < gap)', () => {
    const out = rowsFrom([
      { categoryId: 'email', categoryName: 'Email', ratios: [1.5, 1.5, 1.45, 1.45] },
    ]);
    expect(out).toHaveLength(0);
  });

  it('never surfaces a loosened category (recent > early)', () => {
    const out = rowsFrom([
      { categoryId: 'deep', categoryName: 'Deep work', ratios: [1.2, 1.2, 2.0, 2.0] },
    ]);
    expect(out).toHaveLength(0);
  });

  it('ignores a category too thin to half-split', () => {
    const out = rowsFrom([
      { categoryId: 'thin', categoryName: 'Thin', ratios: [2.0, 1.0] },
    ]);
    expect(out).toHaveLength(0);
  });

  it('caps the result at REVIEW_MAX_TIGHTENED, keeping the largest drops', () => {
    const out = rowsFrom([
      { categoryId: 'a', categoryName: 'A', ratios: [3.0, 3.0, 1.1, 1.1] }, // big drop
      { categoryId: 'b', categoryName: 'B', ratios: [2.5, 2.5, 1.3, 1.3] }, // big drop
      { categoryId: 'c', categoryName: 'C', ratios: [1.9, 1.9, 1.6, 1.6] }, // smaller drop
    ]);
    expect(out).toHaveLength(REVIEW_MAX_TIGHTENED);
    expect(out.map((r) => r.categoryId)).toEqual(['a', 'b']);
  });
});

// ── buildReviewSummary ────────────────────────────────────────────────────────

const surprise: ReviewBiggestSurprise = {
  categoryId: 'admin',
  categoryName: 'Admin',
  estimateMin: 15,
  actualMin: 40,
  ratio: 2.67,
};

const fixedPeriod = resolveWeekPeriod(new Date(2026, 5, 17, 14, 0, 0).getTime());

// The engine never words the reflection: it hands back a descriptor and the
// caller (the i18n boundary) turns it into a sentence. The stub below renders
// the descriptor verbatim so these tests assert STRUCTURE, not English.
const asJson = (r: ReviewReflection) => JSON.stringify(r);

const emptyInput = {
  period: fixedPeriod,
  loggedCount: 0,
  loggedMinutes: 0,
  accuracyLine: null,
  sharpestPhrase: null,
  tightenedEntries: [],
  biggestSurprise: null,
  weekRead: null,
  forwardAction: null,
  confidenceBand: null,
};

describe('deriveReflection', () => {
  it('names the strongest tightening when one was earned', () => {
    const r = deriveReflection(
      fixedPeriod,
      [{ categoryId: 'admin', categoryName: 'Admin', earlyMultiplier: 2, recentMultiplier: 1.1 }],
      surprise,
    );
    expect(r).toEqual({ kind: 'tightened', categoryName: 'Admin' });
  });

  it('falls back to the biggest surprise when nothing tightened', () => {
    expect(deriveReflection(fixedPeriod, [], surprise)).toEqual({
      kind: 'surprise',
      categoryName: 'Admin',
    });
  });

  it('falls back to a question index inside the bundle range', () => {
    const r = deriveReflection(fixedPeriod, [], null);
    expect(r.kind).toBe('question');
    if (r.kind !== 'question') throw new Error('unreachable');
    expect(r.index).toBeGreaterThanOrEqual(0);
    expect(r.index).toBeLessThan(REVIEW_REFLECTION_QUESTION_COUNT);
  });

  it('is deterministic per period id', () => {
    expect(deriveReflection(fixedPeriod, [], null)).toEqual(
      deriveReflection(fixedPeriod, [], null),
    );
  });
});

// ── deriveWeekRead ────────────────────────────────────────────────────────────

describe('deriveWeekRead', () => {
  const noLogs: { createdAt: number }[] = [];
  const entry = (categoryId: string, ratio: number) => ({
    categoryId,
    categoryName: categoryId,
    ratios: [ratio, ratio],
  });

  it("returns the 'tight' id when most areas landed close", () => {
    const wr = deriveWeekRead([entry('a', 1.0), entry('b', 1.1)], fixedPeriod, noLogs);
    expect(wr.verdict).toBe('tight');
    expect(wr.areasClose).toBe(2);
  });

  it("returns the 'loose' id when almost nothing landed close", () => {
    const wr = deriveWeekRead([entry('a', 2.5), entry('b', 2.2)], fixedPeriod, noLogs);
    expect(wr.verdict).toBe('loose');
    expect(wr.areasClose).toBe(0);
  });

  it("returns the 'mixed' id in between", () => {
    const wr = deriveWeekRead(
      [entry('a', 1.0), entry('b', 2.5), entry('c', 2.4)],
      fixedPeriod,
      noLogs,
    );
    expect(wr.verdict).toBe('mixed');
  });
});

describe('buildReviewSummary', () => {
  it('reports zero logs with null card fields but a present reflection', () => {
    const s = buildReviewSummary(emptyInput, asJson);
    expect(s.loggedCount).toBe(0);
    expect(s.loggedMinutes).toBe(0);
    expect(s.accuracyLine).toBeNull();
    expect(s.sharpestPhrase).toBeNull();
    expect(s.tightened).toEqual([]);
    expect(s.biggestSurprise).toBeNull();
    expect(s.reflection.length).toBeGreaterThan(0);
  });

  it('passes through only the cards that were earned', () => {
    const s = buildReviewSummary(
      {
        ...emptyInput,
        loggedCount: 9,
        loggedMinutes: 240,
        accuracyLine: 'Your estimates got a little sharper.',
        tightenedEntries: [
          { categoryId: 'admin', categoryName: 'Admin', ratios: [2.0, 2.0, 1.2, 1.2] },
        ],
        biggestSurprise: surprise,
      },
      asJson,
    );
    expect(s.loggedCount).toBe(9);
    expect(s.loggedMinutes).toBe(240);
    expect(s.accuracyLine).toBe('Your estimates got a little sharper.');
    expect(s.sharpestPhrase).toBeNull();
    expect(s.tightened).toHaveLength(1);
    expect(s.biggestSurprise).toEqual(surprise);
  });

  it('is deterministic for a fixed input + period (same reflection)', () => {
    const input = { ...emptyInput, loggedCount: 3, loggedMinutes: 50 };
    expect(buildReviewSummary(input, asJson).reflection).toBe(
      buildReviewSummary(input, asJson).reflection,
    );
  });

  it('rotates the question index by period id', () => {
    const week2 = resolveWeekPeriod(new Date(2026, 5, 24, 14, 0, 0).getTime());
    const base = { ...emptyInput, loggedCount: 3, loggedMinutes: 50 };
    const seen: ReviewReflection[] = [];
    buildReviewSummary({ ...base, period: fixedPeriod }, (r) => {
      seen.push(r);
      return '';
    });
    buildReviewSummary({ ...base, period: week2 }, (r) => {
      seen.push(r);
      return '';
    });
    for (const r of seen) {
      expect(r.kind).toBe('question');
      if (r.kind !== 'question') throw new Error('unreachable');
      expect(r.index).toBeLessThan(REVIEW_REFLECTION_QUESTION_COUNT);
    }
  });

  it('hands the strongest tightening to the formatter (data-specific)', () => {
    const seen: ReviewReflection[] = [];
    buildReviewSummary(
      {
        ...emptyInput,
        loggedCount: 9,
        loggedMinutes: 240,
        tightenedEntries: [
          { categoryId: 'admin', categoryName: 'Admin', ratios: [2.0, 2.0, 1.1, 1.1] },
        ],
        biggestSurprise: surprise,
      },
      (r) => {
        seen.push(r);
        return '';
      },
    );
    expect(seen[0]).toEqual({ kind: 'tightened', categoryName: 'Admin' });
  });

  it('falls back to the biggest surprise when nothing tightened', () => {
    const seen: ReviewReflection[] = [];
    buildReviewSummary(
      { ...emptyInput, loggedCount: 9, loggedMinutes: 240, biggestSurprise: surprise },
      (r) => {
        seen.push(r);
        return '';
      },
    );
    expect(seen[0]).toEqual({ kind: 'surprise', categoryName: 'Admin' });
  });

  it('ignores earned signals when there are no logs (stays generic)', () => {
    const seen: ReviewReflection[] = [];
    buildReviewSummary(
      {
        ...emptyInput,
        tightenedEntries: [
          { categoryId: 'admin', categoryName: 'Admin', ratios: [2.0, 2.0, 1.1, 1.1] },
        ],
        biggestSurprise: surprise,
      },
      (r) => {
        seen.push(r);
        return '';
      },
    );
    expect(seen[0]?.kind).toBe('question');
  });
});
