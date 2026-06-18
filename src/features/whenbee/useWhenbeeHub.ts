import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { CompanionPresence } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { tierFor, capabilityFor, CATEGORY_NAMES } from '@/src/engine';
import { analytics } from '@/src/services/analytics';
import { kv } from '@/src/lib/kv';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';
import type { Tier, Discovery } from '@/src/domain/types';
import { leadSharpnessOf } from './leadSharpness';

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
  /** Overall hub sharpness — the most-ripened category's sharpness (0 if none). */
  leadSharpness: number;
  /** Lead tier — tierFor of the most-ripened cell (matches HoneycombStrip). */
  tier: Tier;
  /** The companion's 6-stage presence (stage, capability copy, seed, drift, nectar). */
  companion: CompanionPresence;
  /** One cell per tracked category, ready for <Honeycomb size="hub" />. */
  cells: HoneycombCell[];
  /** Banked aha cards, newest first — the teaser into the Discoveries gallery. */
  discoveries: Discovery[];
  /** Lifetime discovery count (monotonic — only ever rises). */
  discoveryCount: number;
  /** Re-pull the async reclaim totals (call on screen focus — deposits don't push). */
  refresh: () => void;
  /** Set (or clear, when blank) the companion's display name, then refresh. */
  renameCompanion: (name: string | null) => void;
  /** True when the companion's drift register is 'curious' and the gentle re-check
   *  card hasn't been dismissed this drift cycle. */
  showDriftRecheck: boolean;
  /** Dismiss the drift re-check card for this cycle (re-arms when drift settles). */
  dismissDriftRecheck: () => void;
}

/** kv flag: set while the drift re-check card has been dismissed; cleared the
 *  moment drift returns to 'settled' so a fresh drift can surface the card again. */
const DRIFT_DISMISS_KEY = 'whenbee.driftRecheckDismissed';

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

/** Pre-load companion default — a stage-1 Raw bee, calm and ungated, so the hero
 *  renders coherently before the async summary resolves (no flash of empty bee). */
const EMPTY_COMPANION: CompanionPresence = {
  stage: 1,
  capability: capabilityFor(1),
  keeper: false,
  lifetimeNectar: 0,
  driftHealth: 'settled',
  seed: 1,
  name: null,
};

const EMPTY_RECLAIM: Pick<
  WhenbeeHubVM,
  'reclaimLifetimeMin' | 'reclaimByCategory' | 'biggestArea' | 'honestLogCount' | 'companion'
> = {
  reclaimLifetimeMin: 0,
  reclaimByCategory: [],
  biggestArea: null,
  honestLogCount: 0,
  companion: EMPTY_COMPANION,
};

const EMPTY_DISCOVERIES: Pick<WhenbeeHubVM, 'discoveries' | 'discoveryCount'> = {
  discoveries: [],
  discoveryCount: 0,
};

export function useWhenbeeHub(): WhenbeeHubVM {
  const loadReclaimSummary = useCalibrationStore((s) => s.loadReclaimSummary);
  const loadDiscoveries = useCalibrationStore((s) => s.loadDiscoveries);
  const nameCompanion = useCalibrationStore((s) => s.nameCompanion);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const categories = useCategoriesStore((s) => s.categories);

  const [reclaim, setReclaim] = useState(EMPTY_RECLAIM);
  const [discoveries, setDiscoveries] = useState(EMPTY_DISCOVERIES);
  // A bump counter the screen ticks on focus to re-pull the async totals — a
  // deposit during the live loop updates the bank but does NOT push to this hook.
  const [focusTick, setFocusTick] = useState(0);
  const refresh = useCallback(() => setFocusTick((n) => n + 1), []);
  const renameCompanion = useCallback(
    (name: string | null) => {
      void nameCompanion(name).then(refresh);
    },
    [nameCompanion, refresh],
  );
  const [driftDismissed, setDriftDismissed] = useState(() => kv.getString(DRIFT_DISMISS_KEY) === '1');

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
        companion: summary.companion,
      });
      // reclaim_total_view: the hub's Reclaim card is now showing a real total.
      analytics.capture('reclaim_total_view', { lifetime_minutes: summary.lifetimeMin });
    });
    // Banked discoveries ride the same async path — refreshed on focus so a card
    // banked during the live loop appears the next time the hub is entered.
    void loadDiscoveries().then((result) => {
      if (!active) return;
      setDiscoveries({ discoveries: result.discoveries, discoveryCount: result.discoveryCount });
    });
    return () => {
      active = false;
    };
  }, [loadReclaimSummary, loadDiscoveries, categories, focusTick]);

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
  const leadSharpness = useMemo<number>(() => leadSharpnessOf(cells), [cells]);
  const tier = useMemo<Tier>(() => tierFor(leadSharpness), [leadSharpness]);

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

  // Re-arm the drift card the moment drift settles, so a *new* drift cycle can
  // surface it again (and we never nag while it's already settled).
  const driftHealth = reclaim.companion.driftHealth;
  useEffect(() => {
    if (driftHealth === 'settled' && kv.getString(DRIFT_DISMISS_KEY) === '1') {
      kv.delete(DRIFT_DISMISS_KEY);
      setDriftDismissed(false);
    }
  }, [driftHealth]);

  const showDriftRecheck = driftHealth === 'curious' && !driftDismissed;
  useEffect(() => {
    if (showDriftRecheck) analytics.capture('drift_recheck', { action: 'shown' });
  }, [showDriftRecheck]);

  const dismissDriftRecheck = useCallback(() => {
    kv.set(DRIFT_DISMISS_KEY, '1');
    setDriftDismissed(true);
    analytics.capture('drift_recheck', { action: 'dismissed' });
  }, []);

  return {
    ...reclaim,
    ...discoveries,
    blindSpot,
    leadSharpness,
    tier,
    cells,
    refresh,
    renameCompanion,
    showDriftRecheck,
    dismissDriftRecheck,
  };
}
