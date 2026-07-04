import type { TFunction } from 'i18next';
import { TIERS, TIER_THRESHOLDS, tierFor, logsToNextTier } from '@/src/engine';
import type { Tier } from '@/src/domain/types';

// Per-stage human line shown under the ring (plain English, no jargon stranding).
// Kept here as the locale-independent fallback used when `tr` is omitted (pure
// unit tests) — the translated copy lives in i18n/locales/*/whenbee.json.
const STAGE_LINE_EN: Record<Tier, string> = {
  Raw: 'Just getting started',
  Setting: 'Getting sharper',
  Ripening: 'Landing closer',
  Thickening: 'You know your timing',
  Honest: 'Plans match reality',
};

type TierKey = 'raw' | 'setting' | 'ripening' | 'thickening' | 'honest';

/** Maps an engine Tier to its lowercase i18n key segment. */
function tierKey(tier: Tier): TierKey {
  return tier.toLowerCase() as TierKey;
}

export interface RingCopy {
  tier: Tier;
  pct: number;
  line: string;
  next: string;
  sealed: boolean;
}

/** Pure copy for the ring badge from an overall sharpness 0–100.
 *  `tr` is the whenbee-namespace translator (from `useTranslation('whenbee')`).
 *  When omitted — pure unit tests calling this directly — falls back to the
 *  canonical English copy so the function stays locale-independent there. */
export function ringCopy(sharpness: number, tr?: TFunction<'whenbee'>): RingCopy {
  const tier = tierFor(sharpness);
  const sealed = sharpness >= TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1]!; // >= 93
  const idx = TIERS.indexOf(tier);
  const nextTier = TIERS[idx + 1];
  const logs = logsToNextTier(sharpness);
  const line = tr ? tr(`ring.stage.${tierKey(tier)}`) : STAGE_LINE_EN[tier];
  const next =
    sealed || !nextTier
      ? tr
        ? tr('ring.sealed')
        : 'Honeycomb sealed ✦'
      : tr
        ? tr('ring.logsToNext', { count: logs, tier: tr(`tiers.${tierKey(nextTier)}`) })
        : `~${logs} ${logs === 1 ? 'log' : 'logs'} to ${nextTier}`;
  return { tier, pct: Math.round(sharpness), line, next, sealed };
}
