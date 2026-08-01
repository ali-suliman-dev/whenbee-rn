import { TIERS, logsToNextTier } from '@/src/engine';
import type { Tier } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// calibrationAggregate — the single "lead category drives the tier" rollup.
//
// Pulled out of `HoneycombStripPlaceholder.tsx` so it has exactly one owner.
// `useNextUnlock` and `HoneycombStripPlaceholder` both import this rather than
// each keeping their own copy — see the plain-calibration-copy plan, Task 3.
// ──────────────────────────────────────────────────────────────────────────────

export interface CalibrationAggregate {
  pct: number;
  logs: number;
  tier: Tier;
  nextTier: Tier | null;
  logsToNext: number;
}

export function aggregateCalibration(
  stats: Record<string, { sharpness: number; tier: Tier }>,
  logs: number,
): CalibrationAggregate {
  const entries = Object.values(stats);
  // Lead = the most-ripened category drives the pill + next-tier line.
  const lead = entries.reduce<{ sharpness: number; tier: Tier } | null>(
    (best, s) => (best === null || s.sharpness > best.sharpness ? s : best),
    null,
  );
  const sharpness = lead?.sharpness ?? 0;
  const tier = lead?.tier ?? 'Raw';
  const tierIdx = TIERS.indexOf(tier);
  const nextTier = tierIdx >= 0 && tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1]! : null;
  return {
    pct: Math.round(sharpness),
    logs,
    tier,
    nextTier,
    logsToNext: logsToNextTier(sharpness),
  };
}
