// Honest Week / Month review ritual — pure period + summary math (Pro).
//
// PURE TS, clock-free: every function takes `nowMs` (or pre-derived inputs) and
// reads local-day boundaries from it, exactly like the rest of the engine. No
// reclaim, no score, no guilt. The hook layer does the db reads + the
// feature-level derivations (biggest surprise, accuracy line) and feeds them in.
//
// NOTHING HERE IS USER-FACING COPY. The engine emits ids and structured data;
// the UI turns them into sentences in the user's language. That includes the
// period label: `ReviewPeriod.label` carries the locale-free period id as a
// fallback, and the screens format the real one from `startMs`/`endMs` via
// `src/features/review/periodLabel.ts` (month names come from `Intl`, never a
// hardcoded table).
import {
  REVIEW_TIGHTEN_GAP,
  REVIEW_MAX_TIGHTENED,
  REVIEW_TIGHTEN_MIN_HALF,
} from './constants';
import type {
  ReviewPeriod,
  ReviewPeriodKind,
  TightenedRow,
  ReviewSummary,
  ReviewBiggestSurprise,
  WeekRead,
  ForwardAction,
  ConfidenceBand,
} from '../domain/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many generic reflective questions the rotation picks from. The wording
 * lives in the locale bundles (`review:reflection.questions`), NOT here — the
 * engine only decides WHICH one. Keep this in sync with the bundle array; an
 * i18n test asserts both languages carry exactly this many questions.
 */
export const REVIEW_REFLECTION_QUESTION_COUNT = 4;

/**
 * What the closing reflection should say, as structured data. The engine picks
 * the ANGLE (a quiet win, the week's drift, or a generic question by stable
 * rotation); the UI owns the sentence in the user's language.
 */
export type ReviewReflection =
  | { kind: 'tightened'; categoryName: string }
  | { kind: 'surprise'; categoryName: string }
  /** Index into `review:reflection.questions`, 0 … COUNT-1. */
  | { kind: 'question'; index: number };

/** How tight the window read, as an id. The UI picks the sentence. */
export type WeekReadVerdict = 'tight' | 'loose' | 'mixed';

/**
 * Geometric-mean multiplier from clamped ratios (matches the EWMA's log-space).
 * Shared with the Patterns drift derivation — a tightening is the same half-split
 * geometric mean, just read as a drop toward 1.0.
 */
function multiplierFromRatios(ratios: number[]): number {
  if (ratios.length === 0) return 1;
  const meanLog = ratios.reduce((sum, r) => sum + Math.log(r), 0) / ratios.length;
  return Math.exp(meanLog);
}

/** Two-digit zero-pad for stable period ids. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** ISO-ish week number from a date's day-of-year, for a stable `{year}-W{nn}` id. */
function weekNumber(d: Date): number {
  const jan1 = new Date(d.getFullYear(), 0, 1).getTime();
  return Math.floor((d.getTime() - jan1) / (7 * DAY_MS)) + 1;
}

/** Local-midnight of the day containing `ms`. */
function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * The week that just ended: the prior Monday (inclusive) → this Monday (exclusive).
 * Built by adding whole calendar days from a local-midnight Monday, so a DST
 * transition inside the window can't shorten it below 7 calendar days.
 */
export function resolveWeekPeriod(nowMs: number): ReviewPeriod {
  const today = new Date(startOfLocalDay(nowMs));
  // Days since Monday (Mon=0 … Sun=6). getDay(): Sun=0 … Sat=6.
  const sinceMonday = (today.getDay() + 6) % 7;
  // This week's Monday, then step back one week for the week that just ended.
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - sinceMonday);
  const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
  const end = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate());
  const id = `${start.getFullYear()}-W${pad2(weekNumber(start))}`;
  return { id, kind: 'week', startMs: start.getTime(), endMs: end.getTime(), label: id };
}

/** The previous calendar month: its 1st (inclusive) → this month's 1st (exclusive). */
export function resolveMonthPeriod(nowMs: number): ReviewPeriod {
  const now = new Date(nowMs);
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const id = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}`;
  return { id, kind: 'month', startMs: start.getTime(), endMs: end.getTime(), label: id };
}

/** `'month'` on day-of-month 1 (the monthly recap lands), `'week'` otherwise. */
export function reviewCadenceFor(nowMs: number): ReviewPeriodKind {
  return new Date(nowMs).getDate() === 1 ? 'month' : 'week';
}

/** Per-category clamped ratios within the window (oldest → newest). */
export interface TightenedEntry {
  categoryId: string;
  categoryName: string;
  ratios: number[];
}

/**
 * Categories whose multiplier moved toward 1.0 over the window. Each entry's
 * clamped ratios are half-split (early vs recent); a category surfaces only when
 * `recent < early − REVIEW_TIGHTEN_GAP` (a real drop), is never a loosened
 * category, and ignores any half too thin to read. Sorted by largest drop, capped.
 */
export function deriveTightened(entries: TightenedEntry[]): TightenedRow[] {
  const rows: (TightenedRow & { drop: number })[] = [];
  for (const entry of entries) {
    const half = Math.floor(entry.ratios.length / 2);
    if (half < REVIEW_TIGHTEN_MIN_HALF) continue;
    const early = entry.ratios.slice(0, half);
    const recent = entry.ratios.slice(entry.ratios.length - half);
    const earlyMultiplier = multiplierFromRatios(early);
    const recentMultiplier = multiplierFromRatios(recent);
    const drop = earlyMultiplier - recentMultiplier;
    if (drop < REVIEW_TIGHTEN_GAP) continue; // too small, or loosened (drop ≤ 0)
    rows.push({
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      earlyMultiplier,
      recentMultiplier,
      drop,
    });
  }
  return rows
    .sort((a, b) => b.drop - a.drop)
    .slice(0, REVIEW_MAX_TIGHTENED)
    .map(({ drop: _drop, ...row }) => row);
}

/** Tiny stable hash → deterministic question rotation by period id. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Which reflection a period has earned. Data-specific when the window carried a
 * signal: the strongest tightening (a quiet win) leads, else the biggest
 * surprise, so the recap closes on THIS period's own story rather than a generic
 * prompt. Falls back to a deterministic question index when the period earned
 * nothing to name (thin/zero history), stable for a given period id.
 */
export function deriveReflection(
  period: ReviewPeriod,
  tightened: TightenedRow[],
  biggestSurprise: ReviewBiggestSurprise | null,
): ReviewReflection {
  const win = tightened[0];
  if (win) return { kind: 'tightened', categoryName: win.categoryName };
  if (biggestSurprise) {
    return { kind: 'surprise', categoryName: biggestSurprise.categoryName };
  }
  return { kind: 'question', index: hashId(period.id) % REVIEW_REFLECTION_QUESTION_COUNT };
}

/**
 * "Close" = ratio between 0.77 and 1.30
 * ≥ 60% → 'tight'
 * ≤ 30% → 'loose'
 * else  → 'mixed'
 */
export function deriveWeekRead(
  entries: TightenedEntry[],
  _period: ReviewPeriod,
  windowLogs: { createdAt: number }[],
): WeekRead {
  const closeEntries = entries.filter((e) => {
    const avg = e.ratios.length > 0 ? e.ratios.reduce((a, b) => a + b, 0) / e.ratios.length : 1;
    return avg >= 0.77 && avg <= 1.3;
  });
  const areasClose = closeEntries.length;
  const areasTotal = entries.length;
  const fraction = areasTotal > 0 ? areasClose / areasTotal : 0;
  const verdict: WeekReadVerdict = fraction >= 0.6 ? 'tight' : fraction <= 0.3 ? 'loose' : 'mixed';

  const dailyLogCounts: [number, number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 0, 0,
  ];
  for (const log of windowLogs) {
    const d = new Date(log.createdAt);
    // getDay() returns 0=Sun...6=Sat; we want Mon=0...Sun=6
    const dow = (d.getDay() + 6) % 7;
    if (dow >= 0 && dow <= 6) {
      dailyLogCounts[dow] = (dailyLogCounts[dow] ?? 0) + 1;
    }
  }

  return { verdict, areasClose, areasTotal, dailyLogCounts };
}

/**
 * Returns null if biggestSurprise is null or overflowMin ≤ 0.
 */
export function deriveForwardAction(
  biggestSurprise: ReviewBiggestSurprise | null,
): ForwardAction | null {
  if (!biggestSurprise) return null;
  const overflowMin = biggestSurprise.actualMin - biggestSurprise.estimateMin;
  if (overflowMin <= 0) return null;
  const recommendedMin = Math.round(biggestSurprise.actualMin / 5) * 5;
  return {
    categoryName: biggestSurprise.categoryName,
    plannedMin: biggestSurprise.estimateMin,
    overflowMin,
    recommendedMin,
  };
}

/**
 * 80% confidence band (10th–90th percentile). Returns null if < 5 logs.
 */
export function deriveConfidenceBand(
  allLogs: { actualMin: number | null; category: string }[],
  categoryId: string,
): ConfidenceBand | null {
  const actuals = allLogs
    .filter((l) => l.category === categoryId && l.actualMin !== null)
    .map((l) => l.actualMin as number)
    .sort((a, b) => a - b);
  if (actuals.length < 5) return null;
  const p10 = actuals[Math.floor(actuals.length * 0.1)] ?? actuals[0];
  const p90 = actuals[Math.ceil(actuals.length * 0.9) - 1] ?? actuals[actuals.length - 1];
  if (p10 === undefined || p90 === undefined) return null;
  return { lowMin: p10, highMin: p90 };
}

/** Everything `buildReviewSummary` needs — the hook assembles it from the db
 *  snapshot (counts, window ratios) plus its own feature-level derivations
 *  (accuracy line, sharpest phrase, biggest surprise). */
export interface BuildReviewSummaryInput {
  period: ReviewPeriod;
  loggedCount: number;
  loggedMinutes: number;
  accuracyLine: string | null;
  sharpestPhrase: string | null;
  tightenedEntries: TightenedEntry[];
  biggestSurprise: ReviewBiggestSurprise | null;
  weekRead: WeekRead | null;
  forwardAction: ForwardAction | null;
  confidenceBand: ConfidenceBand | null;
}

/**
 * Compose a calm recap from a closed period. Degrades gracefully: zero logs gives
 * a present reflection but null/empty card fields; partial data passes through only
 * the cards that were earned. Deterministic for a fixed input + period.
 *
 * `formatReflection` is the UI's translator: the engine decides the reflection's
 * ANGLE and hands the descriptor back out so the caller can word it. Keeping it
 * an injected port is what lets this file stay free of copy in any language.
 */
export function buildReviewSummary(
  input: BuildReviewSummaryInput,
  formatReflection: (reflection: ReviewReflection) => string,
): ReviewSummary {
  const hasLogs = input.loggedCount > 0;
  const tightened = hasLogs ? deriveTightened(input.tightenedEntries) : [];
  const biggestSurprise = hasLogs ? input.biggestSurprise : null;
  return {
    period: input.period,
    loggedCount: input.loggedCount,
    loggedMinutes: input.loggedMinutes,
    accuracyLine: hasLogs ? input.accuracyLine : null,
    sharpestPhrase: hasLogs ? input.sharpestPhrase : null,
    tightened,
    biggestSurprise,
    reflection: formatReflection(deriveReflection(input.period, tightened, biggestSurprise)),
    weekRead: hasLogs ? input.weekRead : null,
    forwardAction: hasLogs ? input.forwardAction : null,
    confidenceBand: hasLogs ? input.confidenceBand : null,
  };
}
