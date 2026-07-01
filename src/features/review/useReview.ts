import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import i18n from '@/src/i18n';
import {
  resolveWeekPeriod,
  resolveMonthPeriod,
  reviewCadenceFor,
  buildReviewSummary,
  clampRatio,
  deriveWeekRead,
  deriveForwardAction,
  deriveConfidenceBand,
  type TightenedEntry,
  type AccuracyCorrelation,
} from '@/src/engine';
import type { ReviewPeriod, ReviewSummary } from '@/src/domain/types';
import {
  useCalibrationStore,
  type PatternsData,
  type PatternLog,
} from '@/src/stores/calibrationStore';
import {
  deriveBiggestSurprise,
  deriveYouVsPast,
  deriveAccuracyCorrelations,
} from '@/src/features/patterns/usePatterns';
import { kv } from '@/src/lib/kv';

// ──────────────────────────────────────────────────────────────────────────────
// useReview — the Honest Week / Month ritual loader. The whole recap is RECOMPUTED
// LIVE from the cross-category snapshot (same store path Patterns uses); nothing is
// persisted but three KV keys. The heavy lifting is a PURE builder
// (`buildReviewFromData`) so it's exhaustively unit-testable without a render.
//
// No reclaim. No score. No guilt — a looser window is just data, framed kindly.
// ──────────────────────────────────────────────────────────────────────────────

/** Drives the envelope (fresh) vs quiet-row (seen) state for the current period. */
export const REVIEW_LAST_SEEN_KEY = 'whenbee.review.lastSeenPeriodId';

/** completed logs (with an actual) inside [startMs, endMs). */
function logsInWindow(logs: PatternLog[], period: ReviewPeriod): PatternLog[] {
  return logs.filter(
    (l) =>
      l.status === 'completed' &&
      l.actualMin !== null &&
      l.createdAt >= period.startMs &&
      l.createdAt < period.endMs,
  );
}

/** Verbal accuracy read for the window — lifts the original WeeklyReview phrasing.
 *  Looser is explicitly framed as data, never a verdict (no-guilt). */
function accuracyLineFor(windowData: PatternsData): string | null {
  const yp = deriveYouVsPast(windowData);
  if (!yp) return null;
  if (yp.delta > 2) return i18n.t('review:accuracyLine.sharper');
  if (yp.delta < -2) return i18n.t('review:accuracyLine.looser');
  return i18n.t('review:accuracyLine.steady');
}

/** A short "you're sharpest in the …" phrase from the strongest accuracy
 *  correlation in the window, or null when none clears the engine gate. */
function sharpestPhraseFor(correlations: AccuracyCorrelation[]): string | null {
  const top = correlations[0];
  if (!top) return null;
  return top.dimension === 'time'
    ? i18n.t('review:sharpestPhrase.time', { label: top.betterLabel })
    : i18n.t('review:sharpestPhrase.day', { label: top.betterLabel });
}

/** Per-category clamped ratios within the window (oldest → newest) for tightening. */
function tightenedEntriesFor(windowData: PatternsData): TightenedEntry[] {
  const byCategory = new Map<string, PatternLog[]>();
  for (const l of windowData.logs) {
    const bucket = byCategory.get(l.category) ?? [];
    bucket.push(l);
    byCategory.set(l.category, bucket);
  }
  const entries: TightenedEntry[] = [];
  for (const [categoryId, logs] of byCategory) {
    const ordered = logs.slice().sort((a, b) => a.createdAt - b.createdAt);
    const ratios = ordered.map((l) => clampRatio(l.estimateMin, l.actualMin as number));
    entries.push({ categoryId, categoryName: windowData.nameOf(categoryId), ratios });
  }
  return entries;
}

/**
 * PURE: compose a `ReviewSummary` from a full cross-category snapshot + a resolved
 * period. Counts only completed logs inside the window, then reuses the Patterns
 * derivations (biggest surprise, accuracy trend, accuracy correlations) over that
 * windowed slice. Deterministic for a fixed input.
 */
export function buildReviewFromData(data: PatternsData, period: ReviewPeriod): ReviewSummary {
  const windowLogs = logsInWindow(data.logs, period);
  const windowData: PatternsData = { ...data, logs: windowLogs };

  const loggedCount = windowLogs.length;
  const loggedMinutes = windowLogs.reduce((sum, l) => sum + (l.actualMin as number), 0);

  // The biggest surprise scans its own lookback window; pass the period end as
  // "now" and a window wide enough to cover the period (its filter is createdAt ≥
  // now − SURPRISE_WINDOW_MS; the windowed logs are already inside the period).
  const biggestSurprise = deriveBiggestSurprise(windowData, period.endMs);
  const correlations = deriveAccuracyCorrelations(windowData);
  const tightenedEntries = tightenedEntriesFor(windowData);

  const weekRead = deriveWeekRead(tightenedEntries, period, windowLogs);
  const forwardAction = deriveForwardAction(biggestSurprise);
  const confidenceBand = biggestSurprise
    ? deriveConfidenceBand(data.logs, biggestSurprise.categoryId)
    : null;

  return buildReviewSummary({
    period,
    loggedCount,
    loggedMinutes,
    accuracyLine: accuracyLineFor(windowData),
    sharpestPhrase: sharpestPhraseFor(correlations),
    tightenedEntries,
    biggestSurprise,
    weekRead,
    forwardAction,
    confidenceBand,
  });
}

/** Resolve the current review period (weekly, or monthly on the 1st). */
function resolvePeriod(nowMs: number): ReviewPeriod {
  return reviewCadenceFor(nowMs) === 'month' ? resolveMonthPeriod(nowMs) : resolveWeekPeriod(nowMs);
}

export interface UseReviewResult {
  summary: ReviewSummary | null;
  period: ReviewPeriod;
  /** True until this period has been opened (no `lastSeenPeriodId` match). */
  isFresh: boolean;
  /** Latch this period as seen — flips the Patterns card to its quiet row. */
  markSeen: () => void;
}

/**
 * Loads the cross-category snapshot through the store (the layer rule keeps db out
 * of components), resolves the period from a pinned `nowMs`, and recomputes the
 * recap on focus. `isFresh` compares the period id to the seen-latch in KV.
 */
export function useReview(nowMs: number = Date.now()): UseReviewResult {
  const loadPatternsData = useCalibrationStore((s) => s.loadPatternsData);
  // Pin "now" once so the resolved period (and every refetch dep) is stable.
  const nowRef = useRef(nowMs);
  const period = useRef(resolvePeriod(nowRef.current)).current;

  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [seenId, setSeenId] = useState<string | null>(() => kv.getString(REVIEW_LAST_SEEN_KEY));

  const refresh = useCallback(async () => {
    const data = await loadPatternsData();
    setSummary(buildReviewFromData(data, period));
  }, [loadPatternsData, period]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const markSeen = useCallback(() => {
    kv.set(REVIEW_LAST_SEEN_KEY, period.id);
    setSeenId(period.id);
  }, [period.id]);

  return { summary, period, isFresh: seenId !== period.id, markSeen };
}
