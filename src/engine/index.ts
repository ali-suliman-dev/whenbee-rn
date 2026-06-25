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
export { arcFraction } from './presence';
export { correlateReasons, reasonNoteFor, reasonPhrase } from './reasons';
export { correlateAccuracy } from './accuracy';
export type { AccuracySample, AccuracyCorrelation } from './accuracy';
export { buildAccuracySeries } from './accuracyTrend';
export type { AccuracyTrend } from './accuracyTrend';
export { correlateContext } from './context';
export type { ContextSample, ContextCorrelation } from './context';
export { confidenceFor, honestRangeFor, quantile, reservePriceVisible } from './confidence';
export {
  companionStageFor, capabilityFor, keeperReached, driftHealthFromRecent, COMPANION_KEEPER_QUOTA,
} from './companion';
export type { CompanionStage, CompanionCapability, DriftHealth } from './companion';
export { seedMultiplierFor, provisionalArchetypeMultiplier } from './archetypeSeed';
export type { QuizAnswers } from './archetypeSeed';
export { greetingFor } from './greeting';
export {
  accuracyToErrorBand, errorBandToAccuracy, goalProgress, isGoalMet,
  reconcileGoal, canSetGoal, presetsForAccuracy, recommendedPreset,
} from './goals';
export { focusWindowMinutes, fitFocusWindow, promoteIntoWindow } from './focusWindow';
export type { FocusWindowTask, FocusWindowInput } from './focusWindow';
export { guardrailFactor, guardrailThresholdMin } from './guardrail';
export { reportAccuracy, reportAccuracySpark, topSurprises, steadiestCategory } from './report';
export type { ReportEventInput, ReportSurprise } from './report';
export { stepHonestMinutes, routineHonestTotal, routineBasis, distributeRoutineRun } from './routine';
export {
  resolveWeekPeriod,
  resolveMonthPeriod,
  reviewCadenceFor,
  deriveTightened,
  buildReviewSummary,
  REVIEW_REFLECTION_QUESTIONS,
} from './review';
export type { TightenedEntry, BuildReviewSummaryInput } from './review';
export { learnFocusWindow } from './focusWindowLearn';
export type { LearnFocusInput, LearnedFocusWindow, FocusEventInput } from '@/src/domain/types';
export { tasksForSelectedDay, type DayTask, type DaySelectorInput } from './daySelectors';
export { honestDayLoad, type DayLoadInput, type DayLoadResult } from './honestDayLoad';
