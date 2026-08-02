import type { Tier } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// calibrationAggregate — the single "lead category drives the tier" rollup.
//
// One owner, one caller: `useNextUnlock` (see the plain-calibration-copy plan,
// Task 3) — which itself feeds `CalibrationCard`, `NextUnlock`, and
// `UnlockLadder`. Only the fields that caller reads are exposed here; `logs`
// (an unmodified pass-through of the argument) and a lead-category-relative
// `nextTier`/`logsToNext` (the wrong rung once the monotonic companion stage
// has run ahead of the live tier — see `useNextUnlock`'s header comment) were
// only ever consumed by the deleted `HoneycombStripPlaceholder`.
// ──────────────────────────────────────────────────────────────────────────────

export interface CalibrationAggregate {
  pct: number;
  /** Raw (unrounded) lead-category sharpness `pct` is rounded from — callers
   *  that derive a threshold distance (e.g. `useNextUnlock`'s away-count) need
   *  the exact value, not the display rounding. */
  sharpness: number;
  tier: Tier;
}

export function aggregateCalibration(
  stats: Record<string, { sharpness: number; tier: Tier }>,
): CalibrationAggregate {
  const entries = Object.values(stats);
  // Lead = the most-ripened category drives the pill + next-tier line.
  const lead = entries.reduce<{ sharpness: number; tier: Tier } | null>(
    (best, s) => (best === null || s.sharpness > best.sharpness ? s : best),
    null,
  );
  const sharpness = lead?.sharpness ?? 0;
  const tier = lead?.tier ?? 'Raw';
  return {
    pct: Math.round(sharpness),
    sharpness,
    tier,
  };
}
