import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { TIERS, capabilityFor } from '@/src/engine';
import type { CompanionStage } from '@/src/engine';
import type { Tier } from '@/src/domain/types';
import { aggregateCalibration } from './calibrationAggregate';
import { capabilityLabel } from './capabilityCopy';

// ──────────────────────────────────────────────────────────────────────────────
// useNextUnlock — "what your next logs buy you", shared by Today, the Progress
// tab, and the reward screen (plain-calibration-copy plan, Task 3).
//
// Derives the lead tier from the same rollup as `HoneycombStripPlaceholder`
// (`aggregateCalibration`, one owner) and resolves the capability the NEXT
// stage unlocks — not the current one — through `capabilityCopy.ts`. At the
// cap (tier 'Honest') there is nothing further to unlock: `sealed` is true and
// `nextCapabilityLabel` is null.
// ──────────────────────────────────────────────────────────────────────────────

export interface NextUnlock {
  /** Current tier (engine value). */
  tier: Tier;
  /** Localised display word for the current tier. */
  tierLabel: string;
  /** Rounded calibration maturity, 0..100. */
  pct: number;
  /** Rough "N more logs" to the next tier; 0 once sealed. */
  logsToNext: number;
  /** Localised label of the capability the NEXT stage unlocks; null at the cap. */
  nextCapabilityLabel: string | null;
  /** True once the tier is 'Honest' — there is nothing further to unlock. */
  sealed: boolean;
}

const TIER_KEYS = ['raw', 'setting', 'ripening', 'thickening', 'honest'] as const;

export function useNextUnlock(): NextUnlock {
  const stats = useCalibrationStore((s) => s.statsByCategory);
  const logs = useCalibrationStore((s) => s.logs);
  const { t: tr } = useTranslation('whenbee');

  return useMemo(() => {
    const { pct, tier, logsToNext } = aggregateCalibration(stats, logs);
    const sealed = tier === 'Honest';
    const tierIdx = TIERS.indexOf(tier);
    const tierKey = TIER_KEYS[tierIdx] ?? 'raw';
    // Each tier N (index 0..3) is unlocked by companion stage N+2 — the
    // capability whose own `tier` field equals that next tier. See
    // `src/engine/companion.ts`'s CAPABILITIES table.
    const nextStage = (tierIdx + 2) as CompanionStage;
    const nextCapabilityLabel = sealed ? null : capabilityLabel(capabilityFor(nextStage).id, tr);

    return {
      tier,
      tierLabel: tr(`tiers.${tierKey}`),
      pct,
      logsToNext,
      nextCapabilityLabel,
      sealed,
    };
  }, [stats, logs, tr]);
}
