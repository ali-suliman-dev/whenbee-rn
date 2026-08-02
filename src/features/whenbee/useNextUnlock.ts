import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { TIERS, TIER_THRESHOLDS, SHARPNESS_PER_LOG, capabilityFor } from '@/src/engine';
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
//   • HOW FAR ALONG THE CURRENT CLIMB IS (the percentage) comes from
//     `aggregateCalibration` — the LEAD category's live sharpness. That is a
//     rolling 8-log window and it legitimately falls after sloppy estimates; a
//     progress meter may move both ways.
//
// Deriving the reached stage from the live tier (what this hook used to do) let
// a run of bad estimates re-mark rungs 4 and 5 "not yet unlocked" and re-offer a
// capability the user already had, breaking the tier-monotonic invariant.
//
// The `Math.max` below is belt-and-braces for the cold-boot window before the
// first `loadReclaimSummary()` / `applyLog()` fills the mirror: the live tier
// already PROVES that much progress, so the stage can never read lower than it.
//
// `logsToNext` ("N more logs") is NOT `aggregateCalibration`'s own
// `logsToNext` — that measures the lead category's distance to ITS OWN next
// tier band, which is a different rung whenever the monotonic `stage` has run
// ahead of the live tier (e.g. right after a `resetCategory` on the lead
// category — the mirror stays put, the live tier drops). The capability named
// by `nextCapabilityId` is stage `stage + 1`, which requires `maxTier` to
// reach tier index `stage` — i.e. `TIER_THRESHOLDS[stage]`. So the away-count
// is computed straight from that threshold and the lead's raw sharpness, using
// the same "assumed gain per log" the engine already uses for its own
// same-shaped estimate (`SHARPNESS_PER_LOG`) — never the tier-band number.
//
// Because `stage = max(cachedStage, tierIdx + 1)` and TIER_THRESHOLDS is
// non-decreasing, `TIER_THRESHOLDS[stage] > leadSharpness` always holds inside
// the unsealed branch (stage ∈ 1..TOP_TIER_STAGE-1, so the index is always in
// bounds) — the gap is provably positive, never zero or negative. `logsToNext`
// is `null` only in the defensive, TypeScript-required branch where that
// index read comes back `undefined`; that branch is not reachable through any
// state this store can produce today, but the count is suppressed rather than
// guessed if it ever is.
//
// `sealed` (monotonic) and `visibleSealed` (live-tier) are DIFFERENT claims,
// and F3 was them getting merged into one piece of copy. `sealed` answers
// "is there still a rung logs alone can buy" — correctly monotonic, so
// `UnlockLadder` never un-lights a reached rung. `visibleSealed` answers "does
// the tier/pct actually ON SCREEN right now say Honest" — the same live-tier
// source as `tier`/`tierLabel`/`pct` themselves. They agree for the vast
// majority of users (once genuinely capped, the live tier rarely leaves
// Honest), but they can diverge right after the lead category is reset or
// deleted: `sealed` stays true (the mirror doesn't move), `visibleSealed`
// drops back to false (the lead's live tier does). Showing the "Calibrated ✦"
// line off `sealed` in that window put it directly under a card reading "Just
// started, 0%" — two claims about the same subject that contradict each
// other. `ring.sealed` copy is gated on `visibleSealed`, the same source as
// the number beside it, so the two can never disagree; see `useUnlockSentence`.
// ──────────────────────────────────────────────────────────────────────────────

export interface NextUnlock {
  /** Current tier (engine value) of the lead category — a progress read, not a gate. */
  tier: Tier;
  /** Localised display word for the current tier. */
  tierLabel: string;
  /** Rounded calibration maturity of the lead category, 0..100. */
  pct: number;
  /** Rough "N more logs" to the NEXT STAGE's threshold (not necessarily the lead
   *  category's own next tier band — see the header comment). 0 once sealed;
   *  null in the (unreached, defensive-only) case the threshold can't be read. */
  logsToNext: number | null;
  /** MONOTONIC companion stage (1..6) — how many rungs are genuinely reached. */
  stage: CompanionStage;
  /** Id of the capability the NEXT stage unlocks; null at the cap. */
  nextCapabilityId: CompanionCapability['id'] | null;
  /** Localised label of the capability the NEXT stage unlocks; null at the cap. */
  nextCapabilityLabel: string | null;
  /** True when the next capability sits behind the Pro paywall. */
  nextCapabilityIsPro: boolean;
  /** True once the monotonic stage has reached the top of the tier ladder — there
   *  is nothing further for logs alone to unlock. Gates which rungs light up;
   *  never un-sets once true (see header comment). */
  sealed: boolean;
  /** True when the LIVE tier (the same source as `tier`/`tierLabel`/`pct`) is
   *  actually Honest right now — a strict subset of `sealed`. Gates whether
   *  the "Calibrated ✦" copy may render, so that line can never sit next to a
   *  lower tier word/percentage on the same card (F3). */
  visibleSealed: boolean;
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
    const { pct, tier, sharpness } = aggregateCalibration(stats, logs);
    const tierIdx = TIERS.indexOf(tier);
    const tierKey = TIER_KEYS[tierIdx] ?? 'raw';

    // Reached rungs: monotonic, floored by what the live tier already proves.
    const stage = Math.max(cachedStage, tierIdx + 1) as CompanionStage;
    const sealed = stage >= TOP_TIER_STAGE;
    // Live-tier read, same source as tier/tierLabel/pct — see header comment.
    const visibleSealed = tierIdx + 1 >= TOP_TIER_STAGE;

    // Each stage N unlocks CAPABILITIES[N]; the one still to earn is N+1.
    const nextCapabilityId = sealed ? null : capabilityFor((stage + 1) as CompanionStage).id;
    const nextCapabilityLabel = nextCapabilityId === null ? null : capabilityLabel(nextCapabilityId, tr);

    // Away-count for the NEXT STAGE (not the lead's own next tier band — see
    // the header comment). `TIER_THRESHOLDS[stage]` is the sharpness a category
    // needs to reach for `maxTier` to rise to `stage`, which is exactly what
    // stage `stage + 1` requires.
    const logsToNext = sealed
      ? 0
      : (() => {
          const target = TIER_THRESHOLDS[stage];
          if (target === undefined) return null; // defensive only — see header comment
          return Math.max(1, Math.ceil((target - sharpness) / SHARPNESS_PER_LOG));
        })();

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
      visibleSealed,
    };
  }, [stats, logs, cachedStage, tr]);
}
