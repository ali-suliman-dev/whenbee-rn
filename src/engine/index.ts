// Public barrel for the pure calibration engine.
export * from './constants';
export { CATEGORY_PRIORS, CATEGORY_NAMES, priorFor } from './priors';
export { clampRatio } from './ratio';
export { alphaFor, updateEwma } from './ewma';
export { blendWithPrior, honestNumber, recurringHasEnoughData, resolveSuggestion } from './multiplier';
export { sharpnessFromWindow, tierFor, logsToNextTier, tierBandProgress } from './sharpness';
export type { TierBandProgress } from './sharpness';
export { detectInsight } from './insight';
export { shouldBankDiscovery } from './discovery';
export { buildTrendSeries } from './trend';
export { applyLog } from './update';
export type { ApplyLogInput, ApplyLogResult } from './update';
export { planBackward, DEFAULT_BUFFER_MIN } from './planner';
export { reclaimDividendMinutes, formatReclaim } from './reclaim';
export { correlateReasons, reasonNoteFor, reasonPhrase } from './reasons';
export { confidenceFor, honestRangeFor, reservePriceVisible } from './confidence';
export {
  companionStageFor, capabilityFor, keeperReached, driftHealthFromRecent, COMPANION_KEEPER_QUOTA,
} from './companion';
export type { CompanionStage, CompanionCapability, DriftHealth } from './companion';
