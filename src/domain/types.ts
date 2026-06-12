// Shared domain contracts. PURE TypeScript — no RN/Expo imports.
// These types are the interface between the calibration engine (src/engine),
// the data layer (src/db), the stores, and the UI.

/** Honey/ripeness tier, mapped from sharpness thresholds [0,40,64,82,93]. */
export type Tier = 'Raw' | 'Setting' | 'Ripening' | 'Thickening' | 'Honest';

/** Per-category learning speed; maps ONLY to the EWMA alpha. */
export type AdaptSpeed = 'steady' | 'balanced' | 'reactive';

/** How a log was captured. Retro logs are down-weighted (half alpha). */
export type LogSource = 'timed' | 'retro';

/** Completion status. Only 'completed' trains the model. */
export type LogStatus = 'completed' | 'abandoned' | 'partial';

/** Normalized category identifier (e.g. 'getting-ready'). */
export type Category = string;

/** Denormalized per-category rolling stats — the engine's mutable state. */
export interface CategoryStats {
  categoryId: string;
  n: number;
  logEwma: number;
  mEffective: number;
  sharpness: number;
}

/** The honest-number suggestion resolved for a decision moment. */
export interface CalibrationSummary {
  multiplier: number;
  honestMinutes: number;
  guessMinutes: number;
  basis: 'personal' | 'prior';
  label: string;
  sampleSize: number;
}

/** A surfaced aha/discovery card. */
export interface Insight {
  categoryId: string;
  multiplier: number;
  honestForFifteen: number;
  headline: string;
}

/** Rolling-multiplier series for the category-detail trend chart. */
export interface TrendSeries {
  points: { loggedAt: number; multiplier: number }[];
  caption: 'stabilizing' | 'steady';
}

/** A single raw log row (system of record). */
export interface TaskEvent {
  id: string;
  category: Category;
  label: string | null;
  estimateMin: number;
  actualMin: number | null;
  status: LogStatus;
  source: LogSource;
  startedAt: number | null;
  endedAt: number | null;
  createdAt: number;
}

// ── Reverse Start-By planner ────────────────────────────────────────────────
// The planner is a PURE, read-only consumer of the engine: a deterministic
// backward pass from a finish-by deadline plus a "cut one" feasibility verdict.

/** One ordered task fed to the backward pass. `durationMin` is the honest block. */
export interface PlanTaskInput {
  id: string;
  label: string;
  category: string;
  durationMin: number;
}

/** A placed block on the rendered timeline (epoch ms). */
export interface PlanTimelineItem {
  id: string;
  label: string;
  startAt: number;
  endAt: number;
}

/**
 * The feasibility verdict, framed as a deterministic ladder. The amber/kind
 * wording is a UI concern; the engine returns only the structured choice.
 */
export type PlanVerdict =
  /** Start by `startBy` and everything fits before the deadline. */
  | { kind: 'fits'; startBy: number }
  /** Dropping ONE task (the largest) makes the plan fit. */
  | { kind: 'cut-one'; startBy: number; cut: { id: string; label: string }; savedMin: number }
  /** Need to drop SEVERAL tasks (largest-first) to fit. */
  | { kind: 'multi-cut'; startBy: number; cuts: { id: string; label: string }[]; savedMin: number }
  /** Even keeping only the single smallest task won't fit → push the deadline. */
  | { kind: 'push-deadline'; feasibleDeadline: number; overshootMin: number };

/** The full result of one backward pass. Never mutates the inputs. */
export interface PlanResult {
  startBy: number;
  timeline: PlanTimelineItem[];
  verdict: PlanVerdict;
  totalMin: number;
}
