import { useEffect } from 'react';
import { router } from 'expo-router';
import { useRewardStore } from '@/src/stores/rewardStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { haptics } from '@/src/services/haptics';
import { rewardHeadline, isCapSeal } from './headline';
import { categoryName } from '@/src/features/shared/categoryName';
import type { LogResult } from '@/src/stores/calibrationStore';

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

export interface RewardView {
  hasReward: boolean;
  headline: string;
  actualMin: number;
  guessMin: number;
  category: string;
  categoryLabel: string;
  honeyPct: number;
  multiplier: number;
  sealed: boolean;
  capEyebrow: string | null;
  ritualLine: string;
  /** Minutes this log just banked. The deposit beat renders only when >= 1. */
  reclaimDeltaMin: number;
  /** Count-up bounds: from the pre-deposit total up to the new lifetime total. */
  reclaimFrom: number;
  reclaimTo: number;
  /** The just-logged event's id — the row a captured reason is tagged against. */
  eventId: string | null;
  /** 'over' / 'under' when the run diverged from the guess past the gate; else null. */
  reasonDirection: RunDirection | null;
  result: LogResult | null;
  onSeeWhenbee: () => void;
  onBackToToday: () => void;
}

const RITUAL_DEFAULT = 'One honest thing a day — no streak to break.';
const RITUAL_SEAL = "New honest cell — and there's no streak to lose it.";

// The reason chips appear only when the run diverged from the guess enough to be
// worth a why. |ratio − 1| > 0.25 → roughly a quarter over or under. Below that,
// the gap is noise and the chips would just nag, so they stay hidden.
const REASON_GATE = 0.25;

/** 'over' / 'under' when actual diverged from the guess past REASON_GATE; else null. */
function reasonDirectionFor(actualMin: number, guessMin: number): RunDirection | null {
  if (guessMin <= 0 || actualMin <= 0) return null;
  const ratio = actualMin / guessMin;
  if (Math.abs(ratio - 1) <= REASON_GATE) return null;
  return ratio > 1 ? 'over' : 'under';
}

export function useReward(): RewardView {
  const actualMin = useRewardStore((s) => s.actualMin);
  const guessMin = useRewardStore((s) => s.guessMin);
  const category = useRewardStore((s) => s.category);
  const source = useRewardStore((s) => s.source);
  const result = useRewardStore((s) => s.result);
  const clear = useRewardStore((s) => s.clear);
  const logs = useCalibrationStore((s) => s.logs);

  const hasReward = result !== null;

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
      category: '',
      categoryLabel: '',
      honeyPct: 0,
      multiplier: 0,
      sealed: false,
      capEyebrow: null,
      ritualLine: RITUAL_DEFAULT,
      reclaimDeltaMin: 0,
      reclaimFrom: 0,
      reclaimTo: 0,
      eventId: null,
      reasonDirection: null,
      result: null,
      onSeeWhenbee,
      onBackToToday,
    };
  }

  // Retro logs flow through the same reward; the headline rotates for timed logs
  // (deterministically by the running log count) and reads the dedicated
  // "Caught up. Thank you." line for retro (the rewardStore carries the source).
  const headline = rewardHeadline(source, logs);

  // Reclaim count-up bounds. `reclaimTo` is the post-deposit lifetime total; the
  // bar counts up from the pre-deposit total so the deposit reads as a deposit.
  const reclaimDeltaMin = result.reclaimDeltaMin;
  const reclaimTo = result.reclaimLifetimeMin;
  const reclaimFrom = reclaimTo - reclaimDeltaMin;

  return {
    hasReward: true,
    headline,
    actualMin,
    guessMin,
    category,
    categoryLabel: categoryName(category),
    honeyPct: result.sharpness,
    multiplier: result.multiplier,
    sealed,
    capEyebrow: result.leveledUp ? `Honey ripened · this cell's now ${result.tierAfter}` : null,
    ritualLine: sealed ? RITUAL_SEAL : RITUAL_DEFAULT,
    reclaimDeltaMin,
    reclaimFrom,
    reclaimTo,
    eventId: result.eventId,
    reasonDirection: reasonDirectionFor(actualMin, guessMin),
    result,
    onSeeWhenbee,
    onBackToToday,
  };
}
