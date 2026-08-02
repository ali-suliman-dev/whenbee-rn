import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRewardStore } from '@/src/stores/rewardStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { haptics } from '@/src/services/haptics';
import { rewardHeadline, isCapSeal } from './headline';
import { categoryName } from '@/src/features/shared/categoryName';
import { TIERS, capabilityFor } from '@/src/engine';
import type { LogResult } from '@/src/stores/calibrationStore';
import type { CompanionCapability, CompanionStage, PostLogQuality } from '@/src/engine';

/** Reward-screen goal feedback: this log's band, a never-negative verdict, target. */
export interface GoalLogFeedback {
  thisBand: number;
  quality: PostLogQuality;
  targetBand: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// useReward — reads the ephemeral rewardStore hand-off, derives all display
// strings, fires the landing haptic once, and clears the store on the way out.
//
// The producer (Timer / Retro) set the payload immediately before navigating;
// the Reward screen is a pure consumer. We deliberately do NOT re-derive from
// the engine here — the multiplier/sharpness already came back from applyLog.
// ──────────────────────────────────────────────────────────────────────────────

/** Whether the run came in over or under the user's guess — drives which
 *  reason chips show. Only set when the over/under is meaningful (gated). */
export type RunDirection = 'over' | 'under';

/** Over / under / equal vs the guess — drives the hero delta chip. Unlike
 *  RunDirection this is ungated (every log gets a delta line) and includes the
 *  spot-on case. Curiosity, never blame. */
export type DeltaDirection = 'over' | 'under' | 'equal';

export interface RewardView {
  hasReward: boolean;
  headline: string;
  actualMin: number;
  guessMin: number;
  /** Absolute minutes between the run and the guess (always >= 0). */
  deltaMin: number;
  /** Which side of the guess the run landed on (or 'equal' for spot-on). */
  deltaDirection: DeltaDirection;
  category: string;
  categoryLabel: string;
  honeyPct: number;
  multiplier: number;
  sealed: boolean;
  capEyebrow: string | null;
  ritualLine: string;
  /** The just-logged event's id — the row a captured reason is tagged against. */
  eventId: string | null;
  /** 'over' / 'under' when the run diverged from the guess past the gate; else null. */
  reasonDirection: RunDirection | null;
  result: LogResult | null;
  /** The capability this exact log unlocked, or null when it crossed no new rung.
   *  Lets the payoff screen say what was just earned instead of only ever handing
   *  the user the next demand. */
  justUnlockedId: CompanionCapability['id'] | null;
  /** Goal coach feedback for this log (goaled category only); null otherwise. */
  goalFeedback: GoalLogFeedback | null;
  onSeeWhenbee: () => void;
  onBackToToday: () => void;
}

// The reason chips appear only when the run diverged from the guess enough to be
// worth a why. |ratio − 1| > 0.25 → roughly a quarter over or under. Below that,
// the gap is noise and the chips would just nag, so they stay hidden.
const REASON_GATE = 0.25;

/**
 * The capability THIS log just bought, or null when it bought no new rung.
 *
 * Uses only what `LogResult` already carries (`tierBefore` / `tierAfter` — the
 * same pair that drives the `tier_up` analytics event — plus `stageJustRose`,
 * the store's own before-vs-after read of the monotonic companion stage). No
 * new plumbing, no new persistence.
 *
 * Three conditions, all required:
 *   1. the tier moved UP (`leveledUp` alone also fires on a tier that fell);
 *   2. the log was counted, i.e. it trained the model;
 *   3. `stageJustRose` — THIS log's fuel update is what raised the monotonic
 *      stage. Comparing the crossed stage against the CURRENT companionStage
 *      (the old approach) compares after-with-after once the store's mirror
 *      has already advanced inside `applyLog`, so a second category catching
 *      up to a rung a different category earned weeks ago would re-announce
 *      it as newly earned (F4). `stageJustRose` is captured at the moment of
 *      the write and can't be fooled by that.
 */
function justUnlockedBy(result: LogResult): CompanionCapability['id'] | null {
  if (!result.counted || !result.leveledUp || !result.stageJustRose) return null;
  const afterIdx = TIERS.indexOf(result.tierAfter);
  if (afterIdx <= TIERS.indexOf(result.tierBefore)) return null;
  const crossedStage = afterIdx + 1;
  return capabilityFor(crossedStage as CompanionStage).id;
}

/** 'over' / 'under' when actual diverged from the guess past REASON_GATE; else null. */
function reasonDirectionFor(actualMin: number, guessMin: number): RunDirection | null {
  if (guessMin <= 0 || actualMin <= 0) return null;
  const ratio = actualMin / guessMin;
  if (Math.abs(ratio - 1) <= REASON_GATE) return null;
  return ratio > 1 ? 'over' : 'under';
}

export function useReward(): RewardView {
  const { t } = useTranslation('reward');
  const actualMin = useRewardStore((s) => s.actualMin);
  const guessMin = useRewardStore((s) => s.guessMin);
  const category = useRewardStore((s) => s.category);
  const source = useRewardStore((s) => s.source);
  const result = useRewardStore((s) => s.result);
  const clear = useRewardStore((s) => s.clear);
  const logs = useCalibrationStore((s) => s.logs);
  const loadGoalLogFeedback = useCalibrationStore((s) => s.loadGoalLogFeedback);

  const hasReward = result !== null;

  // Goal feedback — a bounded read once the celebration lands, for a goaled
  // category. Null otherwise; the line simply doesn't render.
  const [goalFeedback, setGoalFeedback] = useState<GoalLogFeedback | null>(null);
  useEffect(() => {
    let alive = true;
    if (!hasReward || category === '') {
      setGoalFeedback(null);
      return;
    }
    void loadGoalLogFeedback(category).then((res) => {
      if (alive) setGoalFeedback(res);
    });
    return () => {
      alive = false;
    };
  }, [hasReward, category, loadGoalLogFeedback]);

  // Land the celebration once with a success haptic (reduce-motion safe — haptic
  // is independent of the visual reveal).
  useEffect(() => {
    if (hasReward) haptics.success();
  }, [hasReward]);

  // Clear the ephemeral hand-off when the screen leaves so a re-entry (e.g. a
  // deep-link) doesn't resurrect a stale celebration.
  useEffect(() => {
    return () => clear();
  }, [clear]);

  const sealed = isCapSeal(result);

  const onSeeWhenbee = () => {
    router.dismiss();
    router.push('/(tabs)/whenbee');
  };
  const onBackToToday = () => {
    router.dismiss();
  };

  if (!hasReward || !result) {
    return {
      hasReward: false,
      headline: '',
      actualMin: 0,
      guessMin: 0,
      deltaMin: 0,
      deltaDirection: 'equal',
      category: '',
      categoryLabel: '',
      honeyPct: 0,
      multiplier: 0,
      sealed: false,
      capEyebrow: null,
      ritualLine: t('ritual.default'),
      eventId: null,
      reasonDirection: null,
      result: null,
      justUnlockedId: null,
      goalFeedback: null,
      onSeeWhenbee,
      onBackToToday,
    };
  }

  // Retro logs flow through the same reward; the headline rotates for timed logs
  // (deterministically by the running log count) and reads the dedicated
  // "Caught up. Thank you." line for retro (the rewardStore carries the source).
  const headline = rewardHeadline(source, logs);

  // Hero delta vs the guess — a glanceable "5 min over" beats the old gray
  // sentence. Ungated and neutral: every log gets one, spot-on included.
  const deltaMin = Math.abs(actualMin - guessMin);
  const deltaDirection: DeltaDirection =
    actualMin > guessMin ? 'over' : actualMin < guessMin ? 'under' : 'equal';

  return {
    hasReward: true,
    headline,
    actualMin,
    guessMin,
    deltaMin,
    deltaDirection,
    category,
    categoryLabel: categoryName(category),
    honeyPct: Math.round(result.sharpness),
    multiplier: result.multiplier,
    sealed,
    capEyebrow: result.leveledUp ? t('capSealed', { tier: result.tierAfter }) : null,
    ritualLine: sealed ? t('ritual.sealed') : t('ritual.default'),
    eventId: result.eventId,
    reasonDirection: reasonDirectionFor(actualMin, guessMin),
    result,
    justUnlockedId: justUnlockedBy(result),
    goalFeedback,
    onSeeWhenbee,
    onBackToToday,
  };
}
