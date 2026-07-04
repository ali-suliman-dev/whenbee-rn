import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import i18n from '@/src/i18n';
import {
  clampRatio,
  PERSONAL_MIN_LOGS,
  honestNumber,
  confidenceFor,
  correlateAccuracy,
  buildAccuracySeries,
  provisionalArchetypeMultiplier,
} from '@/src/engine';
import type { AccuracyCorrelation, AccuracySample, AccuracyTrend } from '@/src/engine';
import type { CalibrationConfidence, ReviewBiggestSurprise } from '@/src/domain/types';
import { useCalibrationStore, type PatternsData, type PatternLog } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';

// ──────────────────────────────────────────────────────────────────────────────
// usePatterns — the free self-insight surface (read-only over the engine).
//
// Everything here is a PURE function over the cross-category snapshot the
// calibration store hands back (`PatternsData`). Each derivation answers one card
// and returns `null` when the data hasn't earned that card yet — the screen hides
// it. No db access here (the store owns that, per the layer rule); no guilt, no
// streaks, no red. The hook is a thin loader that runs the pure derivations.
//
// Min-sample gates (sensible, documented — tune in one place):
//   ARCHETYPE_MIN_LOGS / ARCHETYPE_MIN_CATEGORIES — need a real spread to type you
//   EXPERIMENT_MIN_PER_ARM — timed vs retro, both arms must clear this
//   COMPARE_MIN_LOGS / COMPARE_HALF — split early vs recent, each half ≥ COMPARE_HALF
//   SURPRISE_WINDOW_MS — "this week" lookback for the biggest surprise
//   DRIFT_MIN_GAP — how far a category's M must move (early→recent) to be "drift"
// ──────────────────────────────────────────────────────────────────────────────

export const ARCHETYPE_MIN_LOGS = 12;
export const ARCHETYPE_MIN_CATEGORIES = 2;
export const EXPERIMENT_MIN_PER_ARM = 3;
export const COMPARE_HALF = 3;
export const COMPARE_MIN_LOGS = COMPARE_HALF * 2; // 6 — split into two halves
export const SURPRISE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const DRIFT_MIN_GAP = 0.4;

// ── card view-models ────────────────────────────────────────────────────────

export interface ArchetypeCard {
  /** Short, flattering-but-honest name (e.g. "The Sprint Optimist"). */
  title: string;
  /** One plain sentence describing the pattern, no diagnosis. */
  blurb: string;
  /** Average personal multiplier across categories, for the supporting line. */
  averageMultiplier: number;
  /** True when this is a seed-based estimate rather than an earned personality. */
  provisional: boolean;
}

export interface PlanExperimentCard {
  /** True when running the timer (a plan) beat winging it on accuracy. */
  planWins: boolean;
  /** Mean absolute miss while timed (0 = perfect). Lower is sharper. */
  timedError: number;
  /** Mean absolute miss while logged after the fact. */
  retroError: number;
  /** Counts behind each arm, for an honest "based on N" line. */
  timedCount: number;
  retroCount: number;
}

export interface YouVsPastCard {
  /** Sharpness-style accuracy (0–100) over the earliest half of logs. */
  earlyAccuracy: number;
  /** Accuracy over the most recent half. */
  recentAccuracy: number;
  /** recent − early (can be 0; never framed as loss). */
  delta: number;
}

/** The biggest-surprise card. Shares the domain `ReviewBiggestSurprise` shape so
 *  the review ritual can reuse this exact derivation without re-declaring it. */
export type BiggestSurpriseCard = ReviewBiggestSurprise;

export interface PredictionCard {
  categoryId: string;
  categoryName: string;
  /** Honest minutes for a typical 15-min guess in this category. */
  honestForFifteen: number;
  multiplier: number;
  sampleSize: number;
}

export interface DriftAlertCard {
  categoryId: string;
  categoryName: string;
  /** Multiplier over the earliest half. */
  earlyMultiplier: number;
  /** Multiplier over the recent half. */
  recentMultiplier: number;
  /** True when recent > early (running longer lately), else faster. */
  slowerLately: boolean;
}

export interface CalibrationMapRow {
  categoryId: string;
  categoryName: string;
  /** Typical guess anchor (15) and the honest number it resolves to. */
  guessMin: number;
  honestMin: number;
  multiplier: number;
  sampleSize: number;
  /** Earned-readiness (raw→setting→honest) for this category — drives the dial.
   *  Derived from sample size + spread of THIS category's clamped ratios; SEPARATE
   *  from the monotonic honey tier, so it can move either way. */
  confidence: CalibrationConfidence;
}

export interface PatternsView {
  /** True when no completed log exists anywhere — render the calm empty state. */
  empty: boolean;
  archetype: ArchetypeCard | null;
  planExperiment: PlanExperimentCard | null;
  youVsPast: YouVsPastCard | null;
  biggestSurprise: BiggestSurpriseCard | null;
  prediction: PredictionCard | null;
  driftAlert: DriftAlertCard | null;
  calibrationMap: CalibrationMapRow[];
  /** S3 — when you're sharpest (time-of-day / weekday). Pro-gated at the screen. */
  accuracyCorrelations: AccuracyCorrelation[];
  /** Short accuracy series for the free progress chart; null below the min-log gate. */
  accuracyTrend: AccuracyTrend | null;
}

// ── shared helpers ────────────────────────────────────────────────────────────

/** completed logs only (oldest → newest), the analyzable set. */
function completedLogs(logs: PatternLog[]): PatternLog[] {
  return logs
    .filter((l) => l.status === 'completed' && l.actualMin !== null)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Accuracy over a set of clamped ratios — same shape as engine sharpness
 *  (100·(1 − mean(|1 − estimate/actual|))), so the number reads consistently. */
function accuracyFromRatios(ratios: number[]): number {
  if (ratios.length === 0) return 0;
  const meanError =
    ratios.reduce((sum, r) => sum + Math.min(1, Math.abs(1 - 1 / r)), 0) / ratios.length;
  return Math.round(100 * (1 - meanError));
}

/** Geometric-mean multiplier from clamped ratios (matches the EWMA's log-space). */
function multiplierFromRatios(ratios: number[]): number {
  if (ratios.length === 0) return 1;
  const meanLog = ratios.reduce((sum, r) => sum + Math.log(r), 0) / ratios.length;
  return Math.exp(meanLog);
}

function ratiosOf(logs: PatternLog[]): number[] {
  return logs.map((l) => clampRatio(l.estimateMin, l.actualMin as number));
}

// ── pure derivations (each unit-tested) ───────────────────────────────────────

/**
 * Maps a multiplier to a flattering-but-honest archetype card.
 * Wording stays curious and kind — a self-portrait, not a label.
 * Thresholds and titles MUST stay in sync with `rungFor` in usePersonalize.ts.
 */
function archetypeFor(avg: number, provisional: boolean): ArchetypeCard {
  let key: 'steadyReader' | 'gentleOptimist' | 'sprintOptimist' | 'dreamer';
  if (avg < 1.3) key = 'steadyReader';
  else if (avg < 1.8) key = 'gentleOptimist';
  else if (avg < 2.6) key = 'sprintOptimist';
  else key = 'dreamer';

  const title = i18n.t(`patterns:archetype.${key}.title`);
  const blurb = i18n.t(`patterns:archetype.${key}.blurb`);
  return { title, blurb, averageMultiplier: avg, provisional };
}

/**
 * One shareable time-personality from the per-category multiplier spread.
 * Deterministic: the average personal M places you on a calm ladder, never a
 * diagnosis. Needs a real history across categories before it speaks.
 *
 * When the earned gate hasn't been cleared yet, a quiz seed can produce a
 * provisional archetype — blended from the seed with whatever completed-log
 * ratios exist. Without a seed, returns null (placeholder territory).
 */
export function deriveArchetype(data: PatternsData, seed?: { m0: number }): ArchetypeCard | null {
  const personal = data.categories.filter((c) => c.n >= PERSONAL_MIN_LOGS);
  const totalLogs = personal.reduce((sum, c) => sum + c.n, 0);
  const earned = personal.length >= ARCHETYPE_MIN_CATEGORIES && totalLogs >= ARCHETYPE_MIN_LOGS;

  if (!earned) {
    if (!seed) return null;
    // Provisional: blend the quiz seed with whatever completed-log ratios exist.
    const ratios = ratiosOf(completedLogs(data.logs));
    return archetypeFor(provisionalArchetypeMultiplier(seed.m0, ratios), true);
  }

  const avg = personal.reduce((sum, c) => sum + c.mEffective, 0) / personal.length;
  return archetypeFor(avg, false);
}

/**
 * With-a-plan vs winging-it. The honest proxy available today: a `timed` log means
 * you ran the one-tap timer (committed in the moment); a `retro` log was filled in
 * after the fact (winged it). We compare accuracy across the two. If winging it is
 * sharper, we SAY so — no spin. Both arms must clear the min-sample gate.
 */
export function derivePlanExperiment(data: PatternsData): PlanExperimentCard | null {
  const logs = completedLogs(data.logs);
  const timed = logs.filter((l) => l.source === 'timed');
  const retro = logs.filter((l) => l.source === 'retro');
  if (timed.length < EXPERIMENT_MIN_PER_ARM || retro.length < EXPERIMENT_MIN_PER_ARM) return null;

  const timedError = 1 - accuracyFromRatios(ratiosOf(timed)) / 100;
  const retroError = 1 - accuracyFromRatios(ratiosOf(retro)) / 100;

  return {
    planWins: timedError <= retroError,
    timedError,
    retroError,
    timedCount: timed.length,
    retroCount: retro.length,
  };
}

/** Recent calibration vs the earliest logs — growth, framed kindly (never loss). */
export function deriveYouVsPast(data: PatternsData): YouVsPastCard | null {
  const logs = completedLogs(data.logs);
  if (logs.length < COMPARE_MIN_LOGS) return null;

  const half = Math.floor(logs.length / 2);
  const early = logs.slice(0, half);
  const recent = logs.slice(logs.length - half);
  const earlyAccuracy = accuracyFromRatios(ratiosOf(early));
  const recentAccuracy = accuracyFromRatios(ratiosOf(recent));

  return { earlyAccuracy, recentAccuracy, delta: recentAccuracy - earlyAccuracy };
}

/** The single log with the largest |ratio − 1| within the lookback window. */
export function deriveBiggestSurprise(data: PatternsData, nowMs: number): BiggestSurpriseCard | null {
  const cutoff = nowMs - SURPRISE_WINDOW_MS;
  const recent = completedLogs(data.logs).filter((l) => l.createdAt >= cutoff);
  if (recent.length === 0) return null;

  let best: PatternLog | null = null;
  let bestGap = -1;
  for (const log of recent) {
    const ratio = clampRatio(log.estimateMin, log.actualMin as number);
    const gap = Math.abs(ratio - 1);
    if (gap > bestGap) {
      bestGap = gap;
      best = log;
    }
  }
  if (best === null) return null;

  const ratio = clampRatio(best.estimateMin, best.actualMin as number);
  return {
    categoryId: best.category,
    categoryName: data.nameOf(best.category),
    estimateMin: best.estimateMin,
    actualMin: best.actualMin as number,
    ratio,
  };
}

/**
 * "X usually runs ~Nm." Pick the personal category with the most evidence and
 * surface its honest number for a typical 15-min guess.
 */
export function derivePrediction(data: PatternsData): PredictionCard | null {
  const personal = data.categories
    .filter((c) => c.n >= PERSONAL_MIN_LOGS)
    .slice()
    .sort((a, b) => b.n - a.n);
  const top = personal[0];
  if (!top) return null;

  return {
    categoryId: top.categoryId,
    categoryName: data.nameOf(top.categoryId),
    honestForFifteen: honestNumber(15, top.mEffective),
    multiplier: top.mEffective,
    sampleSize: top.n,
  };
}

/**
 * "What changed?" — the category whose multiplier moved most between its earliest
 * and most recent half, when that move clears DRIFT_MIN_GAP. Neutral framing: it
 * reports a shift in pace, never a verdict.
 */
export function deriveDriftAlert(data: PatternsData): DriftAlertCard | null {
  let best: DriftAlertCard | null = null;
  let bestGap = DRIFT_MIN_GAP;

  for (const cat of data.categories) {
    const logs = completedLogs(data.logs.filter((l) => l.category === cat.categoryId));
    if (logs.length < COMPARE_MIN_LOGS) continue;

    const half = Math.floor(logs.length / 2);
    const early = logs.slice(0, half);
    const recent = logs.slice(logs.length - half);
    const earlyMultiplier = multiplierFromRatios(ratiosOf(early));
    const recentMultiplier = multiplierFromRatios(ratiosOf(recent));
    const gap = Math.abs(recentMultiplier - earlyMultiplier);
    if (gap > bestGap) {
      bestGap = gap;
      best = {
        categoryId: cat.categoryId,
        categoryName: data.nameOf(cat.categoryId),
        earlyMultiplier,
        recentMultiplier,
        slowerLately: recentMultiplier > earlyMultiplier,
      };
    }
  }

  return best;
}

/** Per-category honest-vs-guess overview (every category with any completed log). */
export function deriveCalibrationMap(data: PatternsData): CalibrationMapRow[] {
  return data.categories
    .filter((c) => c.n > 0)
    .slice()
    .sort((a, b) => b.n - a.n)
    .map((c) => {
      // Confidence reads THIS category's completed-log spread, not the aggregate —
      // same clamped ratios the engine trains on (actualMin present & > 0).
      const clampedRatios = ratiosOf(
        completedLogs(data.logs.filter((l) => l.category === c.categoryId && (l.actualMin ?? 0) > 0)),
      );
      return {
        categoryId: c.categoryId,
        categoryName: data.nameOf(c.categoryId),
        guessMin: 15,
        honestMin: honestNumber(15, c.mEffective),
        multiplier: c.mEffective,
        sampleSize: c.n,
        confidence: confidenceFor({ n: c.n, clampedRatios }),
      };
    });
}

/**
 * S3 — accuracy by time-of-day and weekday. The pure math lives in the engine
 * (`correlateAccuracy`); here we only bucket each completed log's local hour +
 * weekday from its timestamp (the one place a clock is unavoidable), exactly as
 * the store does for reason samples.
 */
export function deriveAccuracyCorrelations(data: PatternsData): AccuracyCorrelation[] {
  const samples: AccuracySample[] = completedLogs(data.logs).map((l) => {
    const d = new Date(l.createdAt);
    return {
      hour: d.getHours(),
      weekday: d.getDay(),
      ratio: clampRatio(l.estimateMin, l.actualMin as number),
    };
  });
  return correlateAccuracy(samples);
}

/** Ordered accuracy series for the progress chart, over all completed logs. */
export function deriveAccuracyTrend(data: PatternsData): AccuracyTrend | null {
  return buildAccuracySeries(ratiosOf(completedLogs(data.logs)));
}

/** Run every derivation over one snapshot — the whole tab's view-model. */
export function derivePatterns(data: PatternsData, nowMs: number, seed?: { m0: number }): PatternsView {
  const anyCompleted = completedLogs(data.logs).length > 0;
  return {
    empty: !anyCompleted,
    archetype: deriveArchetype(data, seed),
    planExperiment: derivePlanExperiment(data),
    youVsPast: deriveYouVsPast(data),
    biggestSurprise: deriveBiggestSurprise(data, nowMs),
    prediction: derivePrediction(data),
    driftAlert: deriveDriftAlert(data),
    calibrationMap: deriveCalibrationMap(data),
    accuracyCorrelations: deriveAccuracyCorrelations(data),
    accuracyTrend: deriveAccuracyTrend(data),
  };
}

// ── the hook ──────────────────────────────────────────────────────────────────

interface UsePatternsResult {
  view: PatternsView | null;
  loading: boolean;
}

/** Loads the cross-category snapshot through the store, then derives the view. */
export function usePatterns(nowMs: number = Date.now()): UsePatternsResult {
  const loadPatternsData = useCalibrationStore((s) => s.loadPatternsData);
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);
  const [view, setView] = useState<PatternsView | null>(null);
  const [loading, setLoading] = useState(true);
  // Freeze "now" at first render. The default `Date.now()` is recomputed every
  // render; threading it through the refresh/effect deps would re-query the DB on
  // every render (a self-perpetuating refetch loop). A ref pins it once.
  const nowRef = useRef(nowMs);

  const refresh = useCallback(async () => {
    const data = await loadPatternsData();
    setView(derivePatterns(data, nowRef.current, archetypeSeed ? { m0: archetypeSeed.m0 } : undefined));
    setLoading(false);
  }, [loadPatternsData, archetypeSeed]);

  // Re-derive on tab focus — a log in another tab won't push to this hook, so the
  // insight cards are recomputed every time the user enters Patterns.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { view, loading };
}
