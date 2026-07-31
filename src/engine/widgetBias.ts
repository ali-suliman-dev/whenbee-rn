// Top-bias selector for the "Your Bias" Home-screen widget. PURE TS — no
// stores, no RN/Expo. Callers pass the already-hydrated `statsByCategory` map
// (e.g. from `calibrationStore`); this module never reaches into a store.
import { PERSONAL_MIN_LOGS } from './constants';
import { tierFor } from './sharpness';
import type { Tier } from '../domain/types';

/** The slice of `CachedStat` this selector needs — kept minimal so callers
 *  don't have to construct a full `CachedStat` in tests. */
export interface BiasStat {
  mEffective: number;
  n: number;
  sharpness: number;
}

export interface TopBias {
  categoryId: string;
  multiplier: number;
  tier: Tier;
}

/**
 * Picks the single most-notable personal bias to surface on the widget: the
 * category with the largest `|mEffective - 1|` among those with enough
 * personal data (`n >= PERSONAL_MIN_LOGS` — the same threshold `resolveSuggestion`
 * uses to call a source "personal" vs. "typical patterns"). Prior-only /
 * under-data categories never qualify, so the widget never shows a number
 * that isn't backed by the user's own logs. Ties (equal gap) go to the
 * category with more samples (higher `n`) — the more confidently-known bias.
 * Returns `null` when nothing qualifies.
 */
export function pickTopBias(statsByCategory: Record<string, BiasStat>): TopBias | null {
  let best: { categoryId: string; stat: BiasStat; gap: number } | null = null;

  for (const [categoryId, stat] of Object.entries(statsByCategory)) {
    if (stat.n < PERSONAL_MIN_LOGS) continue;
    const gap = Math.abs(stat.mEffective - 1);
    if (
      best === null ||
      gap > best.gap ||
      (gap === best.gap && stat.n > best.stat.n)
    ) {
      best = { categoryId, stat, gap };
    }
  }

  if (best === null) return null;

  return {
    categoryId: best.categoryId,
    multiplier: best.stat.mEffective,
    tier: tierFor(best.stat.sharpness),
  };
}
