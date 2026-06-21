import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  clampRatio,
  honestNumber,
  honestRangeFor,
  confidenceFor,
  priorFor,
  correlateAccuracy,
  reportAccuracy,
  reportAccuracySpark,
  topSurprises,
  steadiestCategory,
  REPORT_MIN_LOGS,
  REPORT_CATEGORY_MIN_LOGS,
  REPORT_SPARK_BUCKETS,
  REPORT_MAX_SURPRISES,
  type AccuracySample,
  type ReportEventInput,
} from '@/src/engine';
import { makeTaskEventsRepo } from '@/src/db/repositories/taskEventsRepo';
import { makeCategoryStatsRepo } from '@/src/db/repositories/categoryStatsRepo';
import { makeCompanionRepo } from '@/src/db/repositories/companionRepo';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { CATEGORY_NAMES } from '@/src/engine/priors';
import type {
  ReportModel,
  ReportStatus,
  ReportWindow,
  ReportCategoryRow,
} from './reportModel';

// ──────────────────────────────────────────────────────────────────────────────
// useReportModel — assembles the Pro PDF report's view-model from the user's
// completed logs. `buildReportModel` is the PURE, fully-injectable core (no db, no
// React, no clock beyond the `nowMs` you pass) so it unit-tests cleanly; the hook
// is a thin loader that reads repos (the feature layer may, per the boundary rule)
// and calls it.
//
// NO reclaim / "time saved": that projection was removed from the product. The
// report leads with calibration — accuracy, per-category bias, biggest surprises,
// and when estimates land closest.
// ──────────────────────────────────────────────────────────────────────────────

/** A windowed completed log handed to the model builder. */
export interface ReportEventRow {
  category: string;
  label: string | null;
  estimateMin: number;
  actualMin: number | null;
  status: string;
  endedAt: number | null;
}

/** The per-category rolling stat the builder needs (n + effective multiplier). */
export interface ReportCategoryStat {
  n: number;
  mEffective: number;
}

/** The typical-guess anchor the bias table resolves the honest number against. */
const TYPICAL_GUESS_MIN = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BuildReportModelDeps {
  windowKind: ReportWindow['kind'];
  nowMs: number;
  events: ReportEventRow[];
  statsByCategory: Record<string, ReportCategoryStat>;
  companionName: string | null;
  nameOf: (categoryId: string) => string;
}

export interface BuildReportModelResult {
  model: ReportModel | null;
  status: ReportStatus;
}

function windowFor(kind: ReportWindow['kind'], nowMs: number): ReportWindow {
  switch (kind) {
    case '30d':
      return { kind, sinceMs: nowMs - 30 * DAY_MS, label: 'Last 30 days' };
    case '90d':
      return { kind, sinceMs: nowMs - 90 * DAY_MS, label: 'Last 90 days' };
    case 'all':
      return { kind, sinceMs: null, label: 'All time' };
  }
}

function isCompleted(e: ReportEventRow): e is ReportEventRow & { actualMin: number } {
  return e.status === 'completed' && e.actualMin !== null && e.actualMin > 0;
}

/** "When your estimates land closest" — the strongest accuracy correlation, or null. */
function sharpestNoteFrom(samples: AccuracySample[]): string | null {
  const correlations = correlateAccuracy(samples);
  const top = correlations[0];
  if (!top) return null;
  return `Your estimates land closest on ${top.betterLabel}.`;
}

/**
 * PURE: build the report view-model. Returns `status:'thin'` (and a null model)
 * when the window holds fewer than REPORT_MIN_LOGS completed logs.
 */
export function buildReportModel(deps: BuildReportModelDeps): BuildReportModelResult {
  const { windowKind, nowMs, events, statsByCategory, companionName, nameOf } = deps;
  const window = windowFor(windowKind, nowMs);

  const completed = events
    .filter(isCompleted)
    .filter((e) => window.sinceMs === null || (e.endedAt ?? 0) >= window.sinceMs);

  if (completed.length < REPORT_MIN_LOGS) {
    return { model: null, status: 'thin' };
  }

  // Engine inputs (shared shape).
  const engineEvents: ReportEventInput[] = completed.map((e) => ({
    category: e.category,
    label: e.label,
    estimateMin: e.estimateMin,
    actualMin: e.actualMin,
    endedAt: e.endedAt,
  }));

  const allRatios = completed.map((e) => clampRatio(e.estimateMin, e.actualMin));
  const accuracyPct = reportAccuracy(allRatios);
  const accuracySpark = reportAccuracySpark(engineEvents, REPORT_SPARK_BUCKETS);

  // Group windowed logs by category.
  const byCategory = new Map<string, (ReportEventRow & { actualMin: number })[]>();
  for (const e of completed) {
    const list = byCategory.get(e.category);
    if (list) list.push(e);
    else byCategory.set(e.category, [e]);
  }

  // Per-category clamped ratios (for steadiest + range).
  const ratiosByCategory: Record<string, number[]> = {};
  for (const [category, list] of byCategory) {
    ratiosByCategory[category] = list.map((e) => clampRatio(e.estimateMin, e.actualMin));
  }

  // Bias-table rows: only categories clearing the per-row minimum, most biased first.
  const rows: ReportCategoryRow[] = [];
  let omittedCategoryCount = 0;
  for (const [category, list] of byCategory) {
    if (list.length < REPORT_CATEGORY_MIN_LOGS) {
      omittedCategoryCount += 1;
      continue;
    }
    const stat = statsByCategory[category];
    const multiplier = stat?.mEffective ?? priorFor(category);
    const honestMin = honestNumber(TYPICAL_GUESS_MIN, multiplier);
    const clampedRatios = ratiosByCategory[category] ?? [];
    const confidence = confidenceFor({ n: stat?.n ?? list.length, clampedRatios });
    const range =
      confidence === 'raw'
        ? null
        : honestRangeFor({
            honestMinutes: honestMin,
            guessMinutes: TYPICAL_GUESS_MIN,
            clampedRatios,
            prior: priorFor(category),
          });
    rows.push({
      categoryId: category,
      categoryName: nameOf(category),
      logs: list.length,
      typicalGuessMin: TYPICAL_GUESS_MIN,
      honestMin,
      range,
      multiplier,
    });
  }
  rows.sort((a, b) => b.multiplier - a.multiplier || a.categoryName.localeCompare(b.categoryName));

  // Steadiest category (most consistent), among those clearing the per-row minimum.
  const steadiestId = steadiestCategory(ratiosByCategory);
  const steadiestCategoryName = steadiestId ? nameOf(steadiestId) : null;

  // Biggest surprises (mapped to display names).
  const surprises = topSurprises(engineEvents, REPORT_MAX_SURPRISES).map((s) => ({
    categoryName: nameOf(s.category),
    label: s.label,
    estimateMin: s.estimateMin,
    actualMin: s.actualMin,
  }));

  // Sharpest note from time-of-day / weekday accuracy correlations.
  const samples: AccuracySample[] = completed.map((e) => {
    const d = new Date(e.endedAt ?? nowMs);
    return { hour: d.getHours(), weekday: d.getDay(), ratio: clampRatio(e.estimateMin, e.actualMin) };
  });

  const model: ReportModel = {
    window,
    generatedAtMs: nowMs,
    companionName,
    accuracyPct,
    accuracySpark,
    totalLogs: completed.length,
    categoryCount: rows.length,
    steadiestCategoryName,
    categories: rows,
    surprises,
    sharpestNote: sharpestNoteFrom(samples),
    omittedCategoryCount,
  };

  return { model, status: 'ready' };
}

/** Resolve a friendly category name (user rename → engine seed → titleized id). */
function makeNameResolver(): (id: string) => string {
  const entries = useCategoriesStore.getState().categories;
  const byId = new Map(entries.map((c) => [c.id, c.name]));
  return (id: string) => {
    const userName = byId.get(id);
    if (userName && userName.trim().length > 0) return userName;
    const seed = CATEGORY_NAMES[id];
    if (seed) return seed;
    return id
      .split(/[_\-\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };
}

export interface UseReportModelResult {
  model: ReportModel | null;
  status: ReportStatus;
}

/** Loads windowed logs + per-category stats + the companion name, then builds the model. */
export function useReportModel(
  windowKind: ReportWindow['kind'],
  nowMs: number = Date.now(),
): UseReportModelResult {
  const db = useCalibrationStore((s) => s.db);
  const [result, setResult] = useState<UseReportModelResult>({ model: null, status: 'loading' });
  const nowRef = useRef(nowMs);

  const refresh = useCallback(async () => {
    if (db === null) return;
    try {
      const taskEventsRepo = makeTaskEventsRepo(db);
      const categoryStatsRepo = makeCategoryStatsRepo(db);
      const companionRepo = makeCompanionRepo(db);

      const rows = await taskEventsRepo.listRecent(500);
      const events: ReportEventRow[] = rows.map((e) => ({
        category: e.category,
        label: e.label,
        estimateMin: e.estimateMin,
        actualMin: e.actualMin,
        status: e.status,
        endedAt: e.endedAt,
      }));

      const tracked = useCategoriesStore.getState().categories;
      const statsByCategory: Record<string, ReportCategoryStat> = {};
      await Promise.all(
        tracked.map(async (cat) => {
          const stat = await categoryStatsRepo.get(cat.id);
          statsByCategory[cat.id] = { n: stat.n, mEffective: stat.mEffective };
        }),
      );

      const companionName = (await companionRepo.get()).name ?? null;

      setResult(
        buildReportModel({
          windowKind,
          nowMs: nowRef.current,
          events,
          statsByCategory,
          companionName,
          nameOf: makeNameResolver(),
        }),
      );
    } catch {
      setResult({ model: null, status: 'error' });
    }
  }, [db, windowKind]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return result;
}
