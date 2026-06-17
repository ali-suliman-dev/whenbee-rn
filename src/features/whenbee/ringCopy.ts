import { TIERS, TIER_THRESHOLDS, tierFor, logsToNextTier } from '@/src/engine';
import type { Tier } from '@/src/domain/types';

// Per-stage human line shown under the ring (plain English, no jargon stranding).
const STAGE_LINE: Record<Tier, string> = {
  Raw: 'Just getting started',
  Setting: 'Getting sharper',
  Ripening: 'Landing closer',
  Thickening: 'You know your timing',
  Honest: 'Plans match reality',
};

export interface RingCopy {
  tier: Tier;
  pct: number;
  line: string;
  next: string;
  sealed: boolean;
}

/** Pure copy for the ring badge from an overall sharpness 0–100. */
export function ringCopy(sharpness: number): RingCopy {
  const tier = tierFor(sharpness);
  const sealed = sharpness >= TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1]!; // >= 93
  const idx = TIERS.indexOf(tier);
  const nextTier = TIERS[idx + 1];
  const logs = logsToNextTier(sharpness);
  const next =
    sealed || !nextTier
      ? 'Honeycomb sealed ✦'
      : `~${logs} ${logs === 1 ? 'log' : 'logs'} to ${nextTier}`;
  return { tier, pct: Math.round(sharpness), line: STAGE_LINE[tier], next, sealed };
}
