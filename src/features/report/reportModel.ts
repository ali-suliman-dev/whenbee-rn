// Presentation DTOs for the PDF report (Pro). These are view-model shapes — NOT
// domain types (they don't belong in src/domain/types.ts). NO reclaim / "time
// saved" field anywhere: reclaim was removed from the product and is off-thesis.
import type { HonestRange } from '@/src/domain/types';

/** Which slice of history the report covers. */
export interface ReportWindow {
  kind: '30d' | '90d' | 'all';
  /** Lower bound (ms) for the window, or null for "all time". */
  sinceMs: number | null;
  /** Human label for the subline, e.g. "Last 30 days". */
  label: string;
}

/** One row of the per-category bias table. */
export interface ReportCategoryRow {
  categoryId: string;
  categoryName: string;
  /** Completed logs in this category within the window. */
  logs: number;
  /** The user's typical guess anchor (a steady 15-min reference). */
  typicalGuessMin: number;
  /** What it really takes (honest minutes for the typical guess). */
  honestMin: number;
  /** Confidence band around the honest number, when the category has earned one. */
  range: HonestRange | null;
  /** Personal multiplier (the bias) — `honestMin / typicalGuessMin` in spirit. */
  multiplier: number;
}

/** One "this took much longer/shorter than you guessed" line. */
export interface ReportSurprise {
  categoryName: string;
  label: string | null;
  estimateMin: number;
  actualMin: number;
}

/** The whole report, ready for the HTML builder and the in-app preview. */
export interface ReportModel {
  window: ReportWindow;
  /** When the report was generated (ms) — printed in the subline. */
  generatedAtMs: number;
  /** The companion's name, when the user set one (for "Prepared by …"). */
  companionName: string | null;
  /** Overall accuracy 0–100 (reuses the shipped sharpness formula). */
  accuracyPct: number;
  /** Short accuracy sparkline series for the hero. */
  accuracySpark: number[];
  /** Completed logs across all categories in the window. */
  totalLogs: number;
  /** Number of categories that appear in the table. */
  categoryCount: number;
  /** The most consistent category's name, when one clears the minimum. */
  steadiestCategoryName: string | null;
  /** Bias-table rows, sorted by multiplier descending (most biased first). */
  categories: ReportCategoryRow[];
  /** Up to REPORT_MAX_SURPRISES biggest surprises. */
  surprises: ReportSurprise[];
  /** "When your estimates land closest" note, or null when no clear pattern. */
  sharpestNote: string | null;
  /** Categories below the per-row minimum, summarized in a quiet line. */
  omittedCategoryCount: number;
}

/** Loading/readiness status for the report hook. */
export type ReportStatus = 'ready' | 'thin' | 'loading' | 'error';
