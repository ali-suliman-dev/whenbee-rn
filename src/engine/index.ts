// Public barrel for the pure calibration engine.
export * from './constants';
export { CATEGORY_PRIORS, CATEGORY_NAMES, priorFor } from './priors';
export { clampRatio } from './ratio';
export { alphaFor, alphaRegFor, updateEwma } from './ewma';
export * from './affine';
export * from './globalPrior';
export { blendWithPrior, honestNumber, roundHonest, recurringHasEnoughData, resolveSuggestion } from './multiplier';
export { sharpnessFromWindow, tierFor, logsToNextTier, tierBandProgress } from './sharpness';
export type { TierBandProgress } from './sharpness';
export { effortFloor, honeyMaturity } from './honeyMaturity';
export { proReadiness } from './proReadiness';
export type { ProFeatureId } from './proReadiness';
export { detectInsight } from './insight';
export { shouldBankDiscovery } from './discovery';
export { buildTrendSeries } from './trend';
export { applyLog } from './update';
export type { ApplyLogInput, ApplyLogResult } from './update';
export { planBackward, reproject, DEFAULT_BUFFER_MIN } from './planner';
export type { ReprojectResult } from './planner';
export { reclaimDividendMinutes, formatReclaim } from './reclaim';
export { correlateReasons, reasonNoteFor, reasonPhrase } from './reasons';
export { correlateAccuracy } from './accuracy';
export type { AccuracySample, AccuracyCorrelation } from './accuracy';
export { correlateContext } from './context';
export type { ContextSample, ContextCorrelation } from './context';
export { confidenceFor, honestRangeFor, quantile, reservePriceVisible } from './confidence';
export {
  companionStageFor, capabilityFor, keeperReached, driftHealthFromRecent, COMPANION_KEEPER_QUOTA,
} from './companion';
export type { CompanionStage, CompanionCapability, DriftHealth } from './companion';
