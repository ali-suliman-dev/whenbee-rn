import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { tierFor, CATEGORY_NAMES } from '@/src/engine';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';
import type { Tier } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// useWhenbeeHub — the read-model for the Whenbee hub screen (UI lands in B.3).
//
// Composes store reads ONLY (never src/db, per the layer rule): the reclaim
// totals come from calibrationStore.loadReclaimSummary(); the live honey cells +
// lead tier + "blind spot" derive from the calibration cache + tracked list.
//
// Framing note: the blind spot is the tracked category with the LOWEST sharpness
// that has at least one log — an opportunity to calibrate next, never a "worst".
// ──────────────────────────────────────────────────────────────────────────────

/** A tracked category surfaced as the gentle next calibration opportunity. */
export interface BlindSpot {
  categoryId: string;
  name: string;
  sharpness: number;
}

export interface WhenbeeHubVM {
  reclaimLifetimeMin: number;
  reclaimByCategory: { categoryId: string; name: string; reclaimedMinutes: number }[];
  biggestArea: { categoryId: string; name: string; reclaimedMinutes: number } | null;
  honestLogCount: number;
  blindSpot: BlindSpot | null;
  /** Lead tier — tierFor of the most-ripened cell (matches HoneycombStrip). */
  tier: Tier;
  /** One cell per tracked category, ready for <Honeycomb size="hub" />. */
  cells: HoneycombCell[];
  /** Re-pull the async reclaim totals (call on screen focus — deposits don't push). */
  refresh: () => void;
}

/** Title-case a custom-category slug (e.g. "deep_work" → "Deep Work"). */
function categoryName(id: string): string {
  const seed = CATEGORY_NAMES[id];
  if (seed) return seed;
  return id
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const EMPTY_RECLAIM: Pick<
  WhenbeeHubVM,
  'reclaimLifetimeMin' | 'reclaimByCategory' | 'biggestArea' | 'honestLogCount'
> = {
  reclaimLifetimeMin: 0,
  reclaimByCategory: [],
  biggestArea: null,
  honestLogCount: 0,
};

export function useWhenbeeHub(): WhenbeeHubVM {
  const loadReclaimSummary = useCalibrationStore((s) => s.loadReclaimSummary);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const categories = useCategoriesStore((s) => s.categories);

  const [reclaim, setReclaim] = useState(EMPTY_RECLAIM);
  // A bump counter the screen ticks on focus to re-pull the async totals — a
  // deposit during the live loop updates the bank but does NOT push to this hook.
  const [focusTick, setFocusTick] = useState(0);
  const refresh = useCallback(() => setFocusTick((n) => n + 1), []);

  // Reclaim totals are an async read; refresh on tracked-set change AND on focus.
  useEffect(() => {
    let active = true;
    void loadReclaimSummary().then((summary) => {
      if (!active) return;
      setReclaim({
        reclaimLifetimeMin: summary.lifetimeMin,
        reclaimByCategory: summary.byCategory,
        biggestArea: summary.biggestArea,
        honestLogCount: summary.honestLogCount,
      });
    });
    return () => {
      active = false;
    };
  }, [loadReclaimSummary, categories, focusTick]);

  // Cells + lead tier + blind spot derive synchronously from the calibration cache.
  const cells = useMemo<HoneycombCell[]>(
    () =>
      categories.map((c) => {
        const stat = statsByCategory[c.id];
        return {
          categoryId: c.id,
          label: c.name,
          sharpness: stat?.sharpness ?? 0,
          tier: stat?.tier ?? 'Raw',
        };
      }),
    [categories, statsByCategory],
  );

  // Lead = the most-ripened cell; its sharpness sets the tier the user is chasing.
  const tier = useMemo<Tier>(() => {
    const maxSharpness = cells.reduce((max, c) => Math.max(max, c.sharpness), 0);
    return tierFor(maxSharpness);
  }, [cells]);

  // Blind spot = lowest-sharpness tracked category that has at least one log.
  const blindSpot = useMemo<BlindSpot | null>(() => {
    let lowest: BlindSpot | null = null;
    for (const c of categories) {
      const stat = statsByCategory[c.id];
      if (!stat || stat.n < 1) continue;
      if (lowest === null || stat.sharpness < lowest.sharpness) {
        lowest = { categoryId: c.id, name: categoryName(c.id), sharpness: stat.sharpness };
      }
    }
    return lowest;
  }, [categories, statsByCategory]);

  return {
    ...reclaim,
    blindSpot,
    tier,
    cells,
    refresh,
  };
}
