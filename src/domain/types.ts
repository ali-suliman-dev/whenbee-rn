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
  reclaimedMinutes: number;
}

/** Single-row monotonic companion aggregates (the Reclaim bank lives here). */
export interface Companion {
  reclaimedMinutesLifetime: number; // += deposit per counted log; never decremented
  lifetimeDataPoints: number; // Layer 1 fuel — total counted logs; only ever bumped up
  maxTier: number; // Layer 2 fuel — high-water sharpness tier; max(prev, next)
  keeper: boolean; // Layer 3 fuel — latches true once earned; never cleared
  seed: number; // procedural seed for the companion's appearance; set once, then frozen
  driftHealth?: 'settled' | 'curious'; // positive-only drift register (never a guilt signal)
  discoveryCount: number; // banked aha cards — append-only, only ever rises
  name?: string | null; // optional user-set display name; null/undefined = unnamed
}

/** Capture-only reason slug for a reclaim or context event. */
export type ContextReason = string;

/** One captured over/under reason tag, normalized for the correlation engine. */
export interface ReasonSample {
  category: Category;
  reason: ContextReason;
  direction: 'over' | 'under';
  hour: number; // local 0–23
  weekday: number; // local 0–6 (0 = Sunday)
}

/** A deterministic per-category dominant-cause correlation (over-runs only). */
export interface ReasonCorrelation {
  categoryId: string;
  reason: ContextReason;
  share: number;
  sampleCount: number;
  totalOver: number;
  timeSkew: 'afternoon' | 'morning' | null;
  weekdaySkew: number | null;
}

/** A correlation enriched with the display name for the insight surface. */
export interface ReasonInsight extends ReasonCorrelation {
  categoryName: string;
}

/**
 * Earned-Readiness axis, SEPARATE from the monotonic honey `Tier`.
 * Derived from sample size + coefficient of variation of clamped ratios.
 */
export type CalibrationConfidence = 'raw' | 'setting' | 'honest';

/** A honest-number band (low/high in minutes) for a noisy-vs-settled category. */
export interface HonestRange {
  lowMinutes: number;
  highMinutes: number;
}

/** The honest-number suggestion resolved for a decision moment. */
export interface CalibrationSummary {
  multiplier: number;
  honestMinutes: number;
  guessMinutes: number;
  basis: 'personal' | 'prior';
  label: string;
  sampleSize: number;
  // Optional until Step 6 wires clampedRatios through the store/resolveSuggestion.
  confidence?: CalibrationConfidence;
  range?: HonestRange | null;
}

/** A surfaced aha/discovery card. */
export interface Insight {
  categoryId: string;
  multiplier: number;
  honestForFifteen: number;
  headline: string;
}

/** A banked aha — one distinct, never-expiring discovery card. Append-only. */
export interface Discovery {
  id: string;
  categoryId: string;
  multiplier: number;
  honestForFifteen: number;
  headline: string;
  discoveredAt: number;
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
  suggestedHonestMin: number | null;
  reclaimDividendMin: number;
}

// ── Reverse Start-By planner ────────────────────────────────────────────────
// The planner is a PURE, read-only consumer of the engine: a deterministic
// backward pass from a finish-by deadline plus a "cut one" feasibility verdict.

/** Lifecycle status of a plan task while the plan is being run. */
export type PlanTaskStatus = 'upcoming' | 'running' | 'done';

/**
 * Run-mode overlay for a plan task (store/UI concern — not written to the engine).
 * - `status`: where the task sits in the run lifecycle.
 * - `completedAt`: epoch ms when the timer logged the task as done.
 * - `actualMin`: real logged minutes (display only; never fed back to the model here).
 * - `suggestedHonestMin`: frozen honest suggestion captured at plan-creation time.
 */
export interface PlanTaskRunState {
  status: PlanTaskStatus;
  completedAt?: number;
  actualMin?: number;
  suggestedHonestMin: number;
}

/** Discriminates between a scheduled task block and a between-task breather gap. */
export type PlanTimelineKind = 'task' | 'breather';

/** One ordered task fed to the backward pass. `durationMin` is the honest block. */
export interface PlanTaskInput {
  id: string;
  label: string;
  category: string;
  durationMin: number;
  /** Optional gap appended after this task before the next block begins (minutes). */
  breatherMin?: number;
}

/** A placed block on the rendered timeline (epoch ms). */
export interface PlanTimelineItem {
  id: string;
  label: string;
  startAt: number;
  endAt: number;
  /** Whether this block is a scheduled task or a between-task breather gap. */
  kind: PlanTimelineKind;
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
