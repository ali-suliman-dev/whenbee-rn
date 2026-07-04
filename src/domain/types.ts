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
  /** The honest range captured the first time this category's confidence reached
   *  'setting' (the first time a band is meaningful). Frozen thereafter — the
   *  "from" anchor for the category-detail "tightened from X to Y" caption. Null
   *  until that first meaningful band. */
  firstHonestRange?: HonestRange | null;
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
  /** Local minute-of-day (0–1439) at the moment work STARTED, captured at log
   *  time. null = no trustworthy start time (retroactive/backfilled) → excluded
   *  from focus-window learning. Never recomputed from createdAt, never trained. */
  startLocalMinute: number | null;
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

/** Discriminates between a scheduled task block, a between-task breather gap, or a fixed calendar event anchor. */
export type PlanTimelineKind = 'task' | 'breather' | 'event';

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

// ── Per-category goals (Pro, no-guilt) ────────────────────────────────────────

/** A per-category, no-guilt accuracy goal (Pro). Loss-proof: `bestAccuracy` only
 *  ever rises (max-latched); the target is the only thing that changes when a goal
 *  is met and replaced. Never a streak, never a deadline. */
export interface CategoryGoal {
  categoryId: string;
  /** Target accuracy 0..100 (engine sharpness scale; higher = tighter). */
  targetAccuracy: number;
  /** Best accuracy reached since this goal began — MONOTONIC. Drives progress. */
  bestAccuracy: number;
  /** Accuracy when the goal was set — the baseline the progress fills from. */
  baselineAccuracy: number;
  /** epoch ms the goal was set (display only, never a countdown). */
  setAt: number;
  /** True once bestAccuracy >= targetAccuracy has ever held (latched). */
  met: boolean;
}

// ── Hyperfocus guardrail (Pro) ────────────────────────────────────────────────

/** Hyperfocus guardrail trigger multiple of the honest number, or off. */
export type GuardrailMultiple = 'off' | '1.5x' | '2x' | '3x';

/** Free forgot-to-stop protection preset — how soon Whenbee steps in past the
 *  honest number. Maps to a multiple in the engine. Default 'balanced'. */
export type ForgotStepIn = 'room' | 'balanced' | 'early';

// ── Voice intake ────────────────────────────────────────────────────────────

/** Where a spoken task's structuring came from. */
export type VoiceStructuringSource = 'appleLLM' | 'rules';

/**
 * One draft task produced from a voice utterance. Free flow yields exactly one.
 * The draft carries only a cleaned title + provenance; category + honest estimate
 * are derived downstream by the field's existing onChangeText cascade (guessCategory
 * + honest suggestion), so nothing here duplicates the engine.
 */
export interface ParsedTaskDraft {
  /** Cleaned, imperative task title, e.g. "Write email to Frederick". */
  title: string;
  /** The raw STT transcript, always kept so the draft stays editable/inspectable. */
  rawTranscript: string;
  source: VoiceStructuringSource;
}

// ── Learned focus window inputs/outputs (Pro) — spec 14 ──────────────────────

export interface FocusEventInput {
  category: string;
  estimateMin: number;
  actualMin: number;
  status: LogStatus;
  startLocalMinute: number | null;
  /** (nowMs − startedAt)/86_400_000 — computed by the caller (engine is clock-free). */
  ageDays: number;
  /** floor(startedAt / 86_400_000) — stable integer day index for distinct-day counts. */
  dayKey: number;
}

export interface LearnFocusInput {
  events: readonly FocusEventInput[];
  fitByCategory: Record<string, { a: number; b: number }>;
  shown: { startMin: number; endMin: number; lastMoveAtDays: number } | null;
  /** Stable seed for the permutation test (caller derives from data; defaults inside if 0). */
  seed?: number;
}

export interface LearnedFocusWindow {
  startMin: number;
  endMin: number;
  basis: 'personal' | 'prior';
  confidence: number;                 // 0–1, for wording only (never shown as %)
  scoreByBin: number[];               // 38 bins, normalised [0,1] for the curve
  sampleCount: number;
  distinctDays: number;
  held: boolean;                      // true → hysteresis kept the shown window
}

// ── Focus-window planner (Pro) ────────────────────────────────────────────────

/** The focus-window fit verdict. Amber-never-red by construction. */
export type FocusWindowVerdict = 'fits' | 'spills';

/** One task placed by the focus-window fit (in-window or spilled). */
export interface FocusWindowPlacement {
  id: string;
  label: string;
  honestMin: number;
  /** true = fits inside the window; false = spilled past it. */
  inWindow: boolean;
}

/** Pure result of the focus-window fit (minutes; clock/time-of-day supplied by caller). */
export interface FocusWindowResult {
  /** Fixed window length = windowEndMin − windowStartMin, floored at 0. */
  windowMin: number;
  /** Sum of honestMin of in-window tasks. */
  packedMin: number;
  /** In-window placements in priority order. */
  inWindow: FocusWindowPlacement[];
  /** Spilled placements in priority order. */
  spilled: FocusWindowPlacement[];
  verdict: FocusWindowVerdict;
  /** inWindow.length */
  fitCount: number;
  /** inWindow.length + spilled.length */
  totalCount: number;
  /** 'prior' if every task fell back to priors; else 'personal'. */
  basis: 'personal' | 'prior';
}

// ── Routines (Pro) ────────────────────────────────────────────────────────────

/** A saved, reusable, learned multi-step sequence (Pro). */
export interface Routine {
  id: string;
  name: string;
  /** Optional local be-done-by minute-of-day (0–1439), or null for no anchor. */
  doneByMinuteOfDay: number | null;
  /** Learned chain-level transition factor (≥1). Captures the seam time between
   *  steps that per-step estimates miss. Defaults to TRANSITION_PRIOR until runs
   *  exist; only ever moves via EWMA over full timed runs. */
  transitionFactor: number;
  /** Count of completed full runs that have trained the routine. Monotonic. */
  runCount: number;
  /** Weekdays on which this routine is scheduled (0 = Sunday … 6 = Saturday).
   *  Empty array means unscheduled (runs on-demand only). */
  scheduleDays: number[];
  /** Whether a start-by alert should fire before the routine begins. */
  alertEnabled: boolean;
  /** How many minutes before the routine's start-by time to fire the alert. */
  alertLeadMin: number;
  createdAt: number;
  updatedAt: number;
}

/** One ordered step within a routine. Order is `position` (0-based, contiguous). */
export interface RoutineStep {
  id: string;
  routineId: string;
  position: number;
  label: string;
  category: Category;
  /** The user's guess for this step (minutes). The learned per-step honest number
   *  is derived: round5(guessMin × M_for(category|recurringKey)). */
  guessMin: number;
}

/** Per-step recurring key, namespaced so it never collides with free recurring
 *  keys. Shape: `routine:{routineId}:{stepId}`. */
export type RoutineStepKey = `routine:${string}:${string}`;

/** The derived, display-ready honest summary of a whole routine. */
export interface RoutineSummary {
  routineId: string;
  /** round5(sum(per-step honest) × transitionFactor). */
  honestTotalMin: number;
  /** 'personal' once enough full runs exist, else 'prior'. */
  basis: 'personal' | 'prior';
  label: string; // "based on your last N runs" | "based on typical patterns"
  runCount: number;
  steps: { stepId: string; honestMin: number }[];
}

// ── Honest Week / Month review ritual (Pro) ───────────────────────────────────

/** Whether a review covers the week that just ended or the previous calendar month. */
export type ReviewPeriodKind = 'week' | 'month';


/** A closed review window, resolved from a `nowMs` against local-day boundaries. */
export interface ReviewPeriod {
  /** Stable id for the period (e.g. `2026-W25` / `2026-05`). Drives seen-state + question rotation. */
  id: string;
  kind: ReviewPeriodKind;
  /** Local-midnight start (inclusive). */
  startMs: number;
  /** Local-midnight end (exclusive — the next period's start). */
  endMs: number;
  /** Human label for the cover card (e.g. `Jun 9 – Jun 15` / `May`). */
  label: string;
}

/** One category whose multiplier moved toward 1.0 over the review window. */
export interface TightenedRow {
  categoryId: string;
  categoryName: string;
  /** Geometric-mean multiplier over the earliest half of the window's logs. */
  earlyMultiplier: number;
  /** Geometric-mean multiplier over the most recent half. */
  recentMultiplier: number;
}

/** The single most surprising log in a window — reused from the Patterns
 *  biggest-surprise derivation (`BiggestSurpriseCard` references this shape). */
export interface ReviewBiggestSurprise {
  categoryId: string;
  categoryName: string;
  estimateMin: number;
  actualMin: number;
  /** clamped ratio actual/estimate. */
  ratio: number;
}

/** Verbal verdict + activity heat for the review week. */
export interface WeekRead {
  verdict: string;
  areasClose: number;
  areasTotal: number;
  /** Log counts per weekday: index 0 = Monday … 6 = Sunday of the review period. */
  dailyLogCounts: [number, number, number, number, number, number, number];
}

/** One-thing forward nudge derived from the biggest-surprise category. */
export interface ForwardAction {
  categoryName: string;
  plannedMin: number;
  overflowMin: number;
  recommendedMin: number;
}

/** 80% confidence band (10th–90th percentile) for a category's actual durations. */
export interface ConfidenceBand {
  lowMin: number;
  highMin: number;
}

/** A calm, recomputed-live recap of a closed period. No reclaim, no score, no
 *  guilt — every card field is null/empty when the data hasn't earned it. */
export interface ReviewSummary {
  period: ReviewPeriod;
  loggedCount: number;
  loggedMinutes: number;
  /** Verbal accuracy read (sharper / looser-is-data / steady); null below the gate. */
  accuracyLine: string | null;
  /** Optional "you're sharpest in the …" phrase from the accuracy correlations. */
  sharpestPhrase: string | null;
  tightened: TightenedRow[];
  biggestSurprise: ReviewBiggestSurprise | null;
  /** A rotating reflective question, deterministic by period id. Always present. */
  reflection: string;
  weekRead: WeekRead | null;
  forwardAction: ForwardAction | null;
  confidenceBand: ConfidenceBand | null;
}

// ── Day-planned tasks (planning expansion, spec 2026-06-24) ───────────────────

/** A task lives on a day (or the "No day yet" shelf when plannedDate is null). */
export type TaskStatus = 'queued' | 'done';

export interface Task {
  id: string;
  label: string;
  category: Category;
  guessMin: number;
  /** Local 'YYYY-MM-DD' the task is planned for; null = "No day yet" shelf. */
  plannedDate: string | null;
  status: TaskStatus;
  /** Manual order within a (plannedDate) bucket; lower = earlier. */
  orderIndex: number;
  /** Optional per-task hard deadline, minute-of-day 0–1439; null = none. */
  doneByMin: number | null;
  createdAt: number;
  /** epoch ms when marked done; null while queued. Done bucketing uses this. */
  completedAt: number | null;
  actualMin: number | null;
  /** Set when this task is a materialized routine instance. */
  fromRoutineId: string | null;
  /** Set when exported to the device calendar (links for update/delete). */
  calendarEventId: string | null;
}

/** Day-level planning attributes (the "I want to be done by" target lives here). */
export interface DayMeta {
  date: string; // local 'YYYY-MM-DD'
  doneByMin: number | null;
  planComputedAt: number | null;
}
