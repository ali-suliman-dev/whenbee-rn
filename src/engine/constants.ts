// Calibration engine constants. PURE TS — no RN/Expo/clock.
import type { AdaptSpeed, GuardrailMultiple, Tier } from '../domain/types';

export const RATIO_FLOOR = 1 / 6; // clamp so one disaster can't poison the model
export const RATIO_CEIL = 6;

export const BLEND_PSEUDO_COUNT = 4; // k pseudo-observations of the prior
export const GLOBAL_PRIOR = 1.8; // fallback multiplier for new custom categories
export const RECURRING_MIN_LOGS = 3; // below this, fall back to the category's M
export const PERSONAL_MIN_LOGS = 3; // below this, label is "typical patterns"

/** adapt_speed → base EWMA learning rate α. Retro logs use half of this. */
export const ALPHA_BY_SPEED: Record<AdaptSpeed, number> = {
  steady: 0.18, // history-weighted, slow to move
  balanced: 0.3, // the spec default
  reactive: 0.45, // adapts fast when pace changes (meds, sleep, life)
};
export const RETRO_ALPHA_FACTOR = 0.5; // memory is noisier → half weight

/** Affine regression forgetting factor — DECOUPLED from adapt_speed for a longer
 *  memory window (~33/20/11 logs). Retro entries use half (RETRO_ALPHA_FACTOR). */
export const ALPHA_REG_BY_SPEED: Record<AdaptSpeed, number> = {
  steady: 0.03,
  balanced: 0.05,
  reactive: 0.09,
};

/** Sharpness window + tiers. Thresholds match the prototype (THRESH=[0,40,64,82,93]). */
export const SHARPNESS_WINDOW = 8; // last N completed logs feed the accuracy number
export const TIERS: readonly Tier[] = ['Raw', 'Setting', 'Ripening', 'Thickening', 'Honest'];
export const TIER_THRESHOLDS: readonly number[] = [0, 40, 64, 82, 93];
export const SHARPNESS_PER_LOG = 4; // assumed gain/log when estimating "logs to next tier"

// ── Honey as calibration maturity (replaces pure-accuracy sharpness) ─────────────
/** Effort-floor asymptote — pure showing-up tops out at Thickening, never seals.
 *  Equals TIER_THRESHOLDS[3] (Thickening) on purpose. */
export const HONEY_FLOOR_CAP = 82;
/** Effort-floor curvature: floor(n) = HONEY_FLOOR_CAP · n/(n+HONEY_FLOOR_K).
 *  K=2 → floor(1)≈27, floor(2)≈41, floor(3)≈49, approaching 82. */
export const HONEY_FLOOR_K = 2;
/** Trust weight on the accuracy term: t(n) = n/(n+HONEY_TRUST_K). Small early so
 *  one lucky guess can't seal; →1 as data accumulates. Mirrors GLOBAL_PRIOR_K. */
export const HONEY_TRUST_K = 6;
/** Honey cannot reach this (the Honest threshold) unless the seal is EARNED
 *  (high accuracy AND confidence==='honest'). Equals TIER_THRESHOLDS[4]. */
export const HONEY_SEAL_GATE = 93;

/** Insight (Aha) gates. */
export const INSIGHT_MIN_LOGS = 5;
export const INSIGHT_MIN_GAP = 0.4; // |M - 1| ≥ 0.4 is a surprising deviation
export const INSIGHT_VARIANCE_HALF = 4; // compare var(last 4 lnr) vs var(first 4 lnr)

/** Trend "stabilizing" caption threshold. */
export const TREND_STABILIZING_DROP = 0.2;

/** Sub-1-minute deposits are stored but never rendered (no "+0m"). */
export const RECLAIM_MIN_DISPLAY = 1;

// ── Reason correlations ("what steals your time", Pro) ───────────────────────
export const REASON_MIN_OVER_SAMPLES = 4; // gate: need ≥4 over-runs in a category
export const REASON_DOMINANCE_SHARE = 0.5; // a cause must be a strict majority
export const REASON_TIME_SHARE = 0.6; // ≥60% in one half-day → a time skew
export const REASON_AFTERNOON_HOUR = 16; // hour ≥16 counts as afternoon
export const REASON_WEEKDAY_SHARE = 0.5; // ≥50% on one weekday → a weekday skew
export const REASON_NOTE_MIN_SHARE = 0.6; // B15 note needs a clearer majority

// ── Between-task breather gaps (Start-By planner) ────────────────────────────
/** Selectable pause durations between tasks. Off / +5 / +10 / +20 minutes. */
export const BREATHER_CHIPS = [0, 5, 10, 20] as const;
/** Default gap between tasks: none. */
export const DEFAULT_BREATHER_MIN = 0;

// ── Accuracy correlations (S3 — "when are you sharpest") ─────────────────────
export const ACCURACY_MIN_BUCKET = 4; // a time/weekday bucket needs ≥4 logs to count
export const ACCURACY_MIN_GAP = 12; // ≥12 accuracy points between buckets to surface
export const ACCURACY_MIDDAY_HOUR = 12; // hour <12 = morning, ≥12 = afternoon

// ── Calibration Confidence (Earned-Readiness, Phase 4.5) ─────────────────────
export const CONFIDENCE_SETTING_MIN_LOGS = 3;
export const CONFIDENCE_HONEST_MIN_LOGS = 6;
export const CONFIDENCE_HONEST_MAX_CV = 0.35;
export const RANGE_MIN_HALF_WIDTH = 0.18;
export const RANGE_MAX_HALF_WIDTH = 0.5;
/** Below this many logs, blend the empirical band toward the prior band (§8.2). */
export const QUANTILE_MIN_N = 4;
/** Log-space half-width of the n=0 prior band (≈ ÷1.5…×1.5 spread) (§8.5). */
export const PRIOR_BAND_HALF_WIDTH = 0.4;

// ── Regularized affine calibration (replaces the single-scalar multiplier) ───
/** Prior strength as a pseudo-observation count, mirroring the old k=4 blend:
 *  conservative early, washes out as real logs accumulate. The slope anchor is
 *  scaled by the canonical guess² inside solveAffine so it lives in the same
 *  units as the data's slope information. */
export const AFFINE_PRIOR_PSEUDO = 4;

// ── Cold-start global-personal prior (new/thin categories start from YOUR bias) ─
export const GLOBAL_PRIOR_MIN_LOGS = 4; // below this, use the population prior unchanged
export const GLOBAL_PRIOR_K = 6; // pseudo-count: personal weight = n/(n+k)
export const GLOBAL_PRIOR_MAX_WEIGHT = 0.6; // cap so a new category keeps its own identity

// ── End-of-day preference ─────────────────────────────────────────────────────
/** Default end-of-day, minutes after local midnight. 21:00 = a sane "I stop by 9pm". */
export const DEFAULT_DAY_END_MIN = 21 * 60; // 1260
// ── Accuracy trend series (ProgressChart — "you, then vs now") ────────────────
export const ACCURACY_TREND_MIN_LOGS = 12; // below this, UI falls back to 2-point — each of 6 buckets needs ≥2 logs
export const ACCURACY_TREND_BUCKETS = 6; // max ordered windows in the series

// ── Archetype quiz seed (provisional time-personality before data) ───────────
/** Seed multiplier per Q1 pace answer (self-perceived bias, NOT a duration). */
export const ARCHETYPE_SEED_PACE = { about: 1.15, bit: 1.5, lot: 2.1, lose: 3.0 } as const;
/** Q2 'rabbit holes' multiplies the seed by this (capped at RATIO_CEIL). */
export const ARCHETYPE_SEED_RABBIT_BUMP = 1.15;
/** Seed acts as a prior worth this many pseudo-logs; real logs wash it out. */
export const ARCHETYPE_SEED_PSEUDO = 5;
// ── Per-category goals (Pro, no-guilt) ───────────────────────────────────────
/** Need at least this many counted logs before a category can have a goal. */
export const GOAL_MIN_LOGS = 5;
/** Offered "within X%" targets, loosest → tightest (displayed as error bands). */
export const GOAL_PRESETS = [40, 25, 15, 10] as const;
/** A recommended target must be at least this many points tighter than current. */
export const GOAL_RECOMMEND_STEP = 8;

// ── Hyperfocus guardrail (Pro) ───────────────────────────────────────────────
/** Setting → multiple of the honest number. 'off' has no entry. */
export const GUARDRAIL_FACTORS = { '1.5x': 1.5, '2x': 2, '3x': 3 } as const;
/** Default guardrail for a fresh install. */
export const DEFAULT_GUARDRAIL: GuardrailMultiple = 'off';
/** Never fire a nudge before this many elapsed minutes, regardless of factor. */
export const GUARDRAIL_MIN_THRESHOLD_MIN = 25;

// ── Focus-window planner (Pro) ────────────────────────────────────────────────
// No tight-ratio threshold: the verdict is binary (everything fits, or something
// spills). The window length is whatever the user set; there is no default window.
// (No tunable constants for v1 — the fit is exact. Kept as a home for future tuning.)

// ── Learned focus window (Pro) — spec 14 ──────────────────────────────────────
export const FW_WAKING_START_MIN = 300;            // 05:00
export const FW_WAKING_END_MIN = 1440;             // 24:00
export const FW_BIN_MIN = 30;
export const FW_BIN_COUNT = (FW_WAKING_END_MIN - FW_WAKING_START_MIN) / FW_BIN_MIN; // 38
export const FW_S_CLAMP = Math.log(3);
export const FW_MIN_ACTUAL_MIN = 3;
export const FW_MIN_PLAUSIBLE_RATIO = 0.1;
export const FW_FIT_B_MIN = 0.2;
export const FW_FIT_B_MAX = 5;
export const FW_RECENCY_HALFLIFE_DAYS = 35;
export const FW_DURATION_CAP_MIN = 90;
export const FW_WEIGHT_CAP = 2;
export const FW_SHRINK_KAPPA = 4;
export const FW_KERNEL = [0.25, 0.5, 0.25] as const;
export const FW_WINDOW_MIN_LEN = 90;
export const FW_WINDOW_MAX_LEN = 240;
export const FW_EDGE_SNAP_MIN = 15;
export const FW_PERM_N = 200;
export const FW_PERM_PCTL = 0.95;
export const FW_GATE_MIN_COMPLETED = 15;
export const FW_GATE_MIN_DISTINCT_DAYS = 5;
export const FW_BIN_MIN_EVENTS = 6;
export const FW_BIN_MIN_DAYS = 4;
export const FW_SD_MIN = 0.08;
export const FW_BIMODAL_RATIO = 0.85;
export const FW_BIMODAL_SEP_BINS = 2;
export const FW_HYSTERESIS_SD_FRAC = 0.5;
export const FW_DWELL_DAYS = 7;
export const FW_MOVE_OVERLAP_MAX = 0.5;
export const FW_COMPLETION_WEIGHT = 0.15;
export const FW_COMPLETION_KAPPA = 8;
export const FW_COMPLETION_DROP_CORR = 0.6;
export const FW_PRIOR_WINDOW = { startMin: 540, endMin: 690 } as const; // 09:00–11:30

// ── Routines (Pro) ───────────────────────────────────────────────────────────
/** Day-1 chain transition factor: per-step honest numbers, summed, underestimate
 *  the whole because the seams (transitions, re-starts) aren't in any single step.
 *  1.15 = +15% prior overhead; only ever replaced by the learned factor. */
export const TRANSITION_PRIOR = 1.15;
/** EWMA learning rate for the transition factor over full timed runs. */
export const TRANSITION_ALPHA = 0.3;
/** Below this many completed full runs, the routine total is prior-based
 *  ("based on typical patterns") and the transition factor stays at TRANSITION_PRIOR. */
export const ROUTINE_PERSONAL_MIN_RUNS = 3;
/** Clamp the learned transition factor so one chaotic run can't poison the chain. */
export const TRANSITION_FLOOR = 1.0;
export const TRANSITION_CEIL = 2.0;

// ── PDF report (Pro) ─────────────────────────────────────────────────────────
export const REPORT_MIN_LOGS = 6; // window minimum to allow export
export const REPORT_CATEGORY_MIN_LOGS = 4; // per-row minimum in the bias table
export const REPORT_SPARK_BUCKETS = 6; // accuracy sparkline buckets
export const REPORT_MAX_SURPRISES = 5; // biggest-surprises cap
