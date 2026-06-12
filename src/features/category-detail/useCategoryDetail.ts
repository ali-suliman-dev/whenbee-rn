import { useCallback, useEffect, useState } from 'react';
import { useCalibrationStore, type CategoryDetail } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
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
}

export function useCategoryDetail(categoryId: string): UseCategoryDetailResult {
  const loadCategoryDetail = useCalibrationStore((s) => s.loadCategoryDetail);
  const resetCategoryAction = useCalibrationStore((s) => s.resetCategory);
  const setAdaptSpeedAction = useCategoriesStore((s) => s.setAdaptSpeed);

  // The chosen learning mode lives in the categories store; default Balanced.
  const adaptSpeed = useCategoriesStore(
    (s) => s.categories.find((c) => c.id === categoryId)?.adaptSpeed ?? 'balanced',
  );

  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await loadCategoryDetail(categoryId);
    setDetail(next);
    setLoading(false);
  }, [categoryId, loadCategoryDetail]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  return { detail, loading, adaptSpeed, setAdaptSpeed, resetCategory };
}
