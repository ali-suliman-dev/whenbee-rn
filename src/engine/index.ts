// Public barrel for the pure calibration engine.
export * from './constants';
export { CATEGORY_PRIORS, CATEGORY_NAMES, priorFor } from './priors';
export { clampRatio } from './ratio';
export { alphaFor, updateEwma } from './ewma';
export { blendWithPrior, honestNumber, recurringHasEnoughData, resolveSuggestion } from './multiplier';
export { sharpnessFromWindow, tierFor, logsToNextTier } from './sharpness';
export { detectInsight } from './insight';
export { buildTrendSeries } from './trend';
export { applyLog } from './update';
export type { ApplyLogInput, ApplyLogResult } from './update';
