import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCalibrationStore, type CategoryDetail } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { REASON_NOTE_MIN_SHARE, reasonPhrase } from '@/src/engine';
import type { AdaptSpeed } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// useCategoryDetail — assembles the Category Detail / Tune screen view-model.
//
// Reads through the calibration store (never src/db directly, per the layer rule).
// Owns: loading the detail snapshot, exposing the current adapt speed, and
// wiring tune + reset back through the stores with a refresh afterwards.
// ──────────────────────────────────────────────────────────────────────────────

interface UseCategoryDetailResult {
  detail: CategoryDetail | null;
  loading: boolean;
  adaptSpeed: AdaptSpeed;
  setAdaptSpeed: (speed: AdaptSpeed) => void;
  resetCategory: () => Promise<void>;
  /** True for the single render after this category first reaches 'honest'
   *  confidence and hasn't graduated before. Drives the one-time GraduationMoment. */
  justGraduated: boolean;
  /** Dismiss the graduation moment — the screen calls this from onDone. */
  clearJustGraduated: () => void;
  /** Pro-only, display-only B15 note naming the dominant over-run cause for this
   *  category, when one clearly dominates. `undefined` for non-Pro, no dominant
   *  cause, or before the async read lands. NEVER affects the honest number. */
  reasonNote?: string;
}

export function useCategoryDetail(categoryId: string): UseCategoryDetailResult {
  const loadCategoryDetail = useCalibrationStore((s) => s.loadCategoryDetail);
  const resetCategoryAction = useCalibrationStore((s) => s.resetCategory);
  const isGraduated = useCalibrationStore((s) => s.isGraduated);
  const markGraduated = useCalibrationStore((s) => s.markGraduated);
  const loadReasonInsights = useCalibrationStore((s) => s.loadReasonInsights);
  const setAdaptSpeedAction = useCategoriesStore((s) => s.setAdaptSpeed);
  const isPro = useEntitlement((s) => s.isPro);

  // The chosen learning mode lives in the categories store; default Balanced.
  const adaptSpeed = useCategoriesStore(
    (s) => s.categories.find((c) => c.id === categoryId)?.adaptSpeed ?? 'balanced',
  );

  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [justGraduated, setJustGraduated] = useState(false);
  const [reasonNote, setReasonNote] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    const next = await loadCategoryDetail(categoryId);
    setDetail(next);
    setLoading(false);

    // Graduation: the first time this category reads 'honest' and isn't already
    // in the kv ledger, latch the moment and mark it (idempotent → fires once ever).
    if (next.confidence === 'honest' && !isGraduated(categoryId)) {
      markGraduated(categoryId);
      setJustGraduated(true);
    }

    // B15 reason note — Pro-only, display-only, and OFF the critical path: the
    // detail render above never waits on this. We resolve it after, so the note
    // simply appears once ready. A dominant cause (share ≥ threshold) yields a
    // quiet provenance line; anything else clears it. It NEVER feeds the number.
    if (!isPro) {
      setReasonNote(undefined);
      return;
    }
    const insights = await loadReasonInsights();
    const dominant = insights.find(
      (i) => i.categoryId === categoryId && i.share >= REASON_NOTE_MIN_SHARE,
    );
    setReasonNote(
      dominant ? `Most overruns here trace back to ${reasonPhrase(dominant.reason)}.` : undefined,
    );
  }, [categoryId, loadCategoryDetail, isGraduated, markGraduated, isPro, loadReasonInsights]);

  const clearJustGraduated = useCallback(() => setJustGraduated(false), []);

  // Refresh on focus — returning here after logging a task for this category
  // (timer/retro elsewhere) must re-read the snapshot, not show the mount-time one.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const setAdaptSpeed = useCallback(
    (speed: AdaptSpeed) => {
      setAdaptSpeedAction(categoryId, speed);
      // α only affects future logs; no need to re-read the detail snapshot here.
    },
    [categoryId, setAdaptSpeedAction],
  );

  const resetCategory = useCallback(async () => {
    await resetCategoryAction(categoryId);
    await refresh();
  }, [categoryId, resetCategoryAction, refresh]);

  return {
    detail,
    loading,
    adaptSpeed,
    setAdaptSpeed,
    resetCategory,
    justGraduated,
    clearJustGraduated,
    reasonNote,
  };
}
