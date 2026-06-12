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
