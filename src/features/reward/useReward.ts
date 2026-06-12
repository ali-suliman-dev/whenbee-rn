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

export interface RewardView {
  hasReward: boolean;
  headline: string;
  actualMin: number;
  guessMin: number;
  categoryLabel: string;
  honeyPct: number;
  multiplier: number;
  sealed: boolean;
  capEyebrow: string | null;
  ritualLine: string;
  result: LogResult | null;
  onSeeWhenbee: () => void;
  onBackToToday: () => void;
}

const RITUAL_DEFAULT = 'One honest thing a day — no streak to break.';
const RITUAL_SEAL = "New honest cell — and there's no streak to lose it.";

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
      categoryLabel: '',
      honeyPct: 0,
      multiplier: 0,
      sealed: false,
      capEyebrow: null,
      ritualLine: RITUAL_DEFAULT,
      result: null,
      onSeeWhenbee,
      onBackToToday,
    };
  }

  // Retro logs flow through the same reward; the headline rotates for timed logs
  // (deterministically by the running log count) and reads the dedicated
  // "Caught up. Thank you." line for retro (the rewardStore carries the source).
  const headline = rewardHeadline(source, logs);

  return {
    hasReward: true,
    headline,
    actualMin,
    guessMin,
    categoryLabel: categoryName(category),
    honeyPct: result.sharpness,
    multiplier: result.multiplier,
    sealed,
    capEyebrow: result.leveledUp ? `Honey ripened · this cell's now ${result.tierAfter}` : null,
    ritualLine: sealed ? RITUAL_SEAL : RITUAL_DEFAULT,
    result,
    onSeeWhenbee,
    onBackToToday,
  };
}
