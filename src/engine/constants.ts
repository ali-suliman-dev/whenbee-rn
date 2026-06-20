// Calibration engine constants. PURE TS — no RN/Expo/clock.
import type { AdaptSpeed, Tier } from '../domain/types';

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
