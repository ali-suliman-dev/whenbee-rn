// Global cross-category bias: a single EWMA of ln(actual/guess) across ALL
// counted logs, used only to make a brand-new/thin category start near the
// user's own pace instead of a generic population number. PURE TS.
import { GLOBAL_PRIOR_K, GLOBAL_PRIOR_MAX_WEIGHT, GLOBAL_PRIOR_MIN_LOGS } from './constants';

export interface GlobalBias {
  lnEwma: number;
  n: number;
}

export const emptyGlobalBias = (): GlobalBias => ({ lnEwma: 0, n: 0 });

/** One EWMA step over ln(clampedRatio), mirroring the category EWMA. */
export const updateGlobalBias = (prev: GlobalBias, clampedRatio: number, alpha: number): GlobalBias => ({
  lnEwma: alpha * Math.log(clampedRatio) + (1 - alpha) * prev.lnEwma,
  n: prev.n + 1,
});

/**
 * Cold-start anchor for a category: its population prior, geometrically nudged
 * toward the user's global bias once there's enough global data. Personal weight
 * grows with n and is capped so a new category never fully loses its identity.
 */
export const coldStartAnchor = (populationPrior: number, global: GlobalBias): number => {
  if (global.n < GLOBAL_PRIOR_MIN_LOGS) return populationPrior;
  const wPers = Math.min(global.n / (global.n + GLOBAL_PRIOR_K), GLOBAL_PRIOR_MAX_WEIGHT);
  return Math.exp((1 - wPers) * Math.log(populationPrior) + wPers * global.lnEwma);
};
