import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { TIERS, capabilityFor } from '@/src/engine';
import type { CompanionCapability, CompanionStage } from '@/src/engine';
import type { Tier } from '@/src/domain/types';
import { aggregateCalibration } from './calibrationAggregate';
import { capabilityLabel } from './capabilityCopy';
import { isCapabilityPro } from './capabilityGating';

// ──────────────────────────────────────────────────────────────────────────────
// useNextUnlock — "what your next logs buy you", shared by Today, the Progress
// tab, and the reward screen (plain-calibration-copy plan, Task 3).
//
// TWO different numbers live here, and mixing them up is the bug this hook was
// rewritten to kill:
//
//   • WHICH RUNGS ARE REACHED comes from `companionStage` — the MONOTONIC stage
//     mirrored from the companion fuel row (`companionStageFor({ maxTier,
//     keeper })`, and `maxTier` "never lowers it"). An earned capability can
//     never un-light.
//   • HOW FAR ALONG THE CURRENT CLIMB IS (the percentage and the "N more logs"
//     estimate) comes from `aggregateCalibration` — the LEAD category's live
//     sharpness. That is a rolling 8-log window and it legitimately falls after
//     sloppy estimates; a progress meter may move both ways.
//
// Deriving the reached stage from the live tier (what this hook used to do) let
// a run of bad estimates re-mark rungs 4 and 5 "not yet unlocked" and re-offer a
// capability the user already had, breaking the tier-monotonic invariant.
//
// The `Math.max` below is belt-and-braces for the cold-boot window before the
// first `loadReclaimSummary()` / `applyLog()` fills the mirror: the live tier
// already PROVES that much progress, so the stage can never read lower than it.
// ──────────────────────────────────────────────────────────────────────────────

export interface NextUnlock {
  /** Current tier (engine value) of the lead category — a progress read, not a gate. */
  tier: Tier;
  /** Localised display word for the current tier. */
  tierLabel: string;
  /** Rounded calibration maturity of the lead category, 0..100. */
  pct: number;
  /** Rough "N more logs" to the next tier; 0 once sealed. */
  logsToNext: number;
  /** MONOTONIC companion stage (1..6) — how many rungs are genuinely reached. */
  stage: CompanionStage;
  /** Id of the capability the NEXT stage unlocks; null at the cap. */
  nextCapabilityId: CompanionCapability['id'] | null;
  /** Localised label of the capability the NEXT stage unlocks; null at the cap. */
  nextCapabilityLabel: string | null;
  /** True when the next capability sits behind the Pro paywall. */
  nextCapabilityIsPro: boolean;
  /** True once the monotonic stage has reached the top of the tier ladder — there
   *  is nothing further for logs alone to unlock. */
  sealed: boolean;
}

const TIER_KEYS = ['raw', 'setting', 'ripening', 'thickening', 'honest'] as const;

/** The tier ladder covers companion stages 1..5; stage 6 (Keeper) sits outside it
 *  behind its own all-areas-capped quota, so logs alone stop buying rungs here. */
const TOP_TIER_STAGE = TIERS.length;

export function useNextUnlock(): NextUnlock {
  const stats = useCalibrationStore((s) => s.statsByCategory);
  const logs = useCalibrationStore((s) => s.logs);
  const cachedStage = useCalibrationStore((s) => s.companionStage);
  const { t: tr } = useTranslation('whenbee');

  return useMemo(() => {
    const { pct, tier, logsToNext } = aggregateCalibration(stats, logs);
    const tierIdx = TIERS.indexOf(tier);
    const tierKey = TIER_KEYS[tierIdx] ?? 'raw';

    // Reached rungs: monotonic, floored by what the live tier already proves.
    const stage = Math.max(cachedStage, tierIdx + 1) as CompanionStage;
    const sealed = stage >= TOP_TIER_STAGE;

    // Each stage N unlocks CAPABILITIES[N]; the one still to earn is N+1.
    const nextCapabilityId = sealed ? null : capabilityFor((stage + 1) as CompanionStage).id;
    const nextCapabilityLabel = nextCapabilityId === null ? null : capabilityLabel(nextCapabilityId, tr);

    return {
      tier,
      tierLabel: tr(`tiers.${tierKey}`),
      pct,
      logsToNext,
      stage,
      nextCapabilityId,
      nextCapabilityLabel,
      nextCapabilityIsPro: nextCapabilityId !== null && isCapabilityPro(nextCapabilityId),
      sealed,
    };
  }, [stats, logs, cachedStage, tr]);
}
