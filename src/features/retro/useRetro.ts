import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import { usePickerCategories, type PickerCategory } from '@/src/features/shared/CategoryChips';
import type { AdaptSpeed } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// useRetro — forgiving catch-up logging for something already finished. Feeds
// applyLog with source:'retro' (the engine halves the EWMA alpha automatically,
// so a remembered number is trusted less than a live timer). Same reward payoff.
//
// No guilt anywhere: "Caught up. Thank you." — a rough number is plenty.
// ──────────────────────────────────────────────────────────────────────────────

export interface UseRetroResult {
  categories: PickerCategory[];
  category: string | null;
  setCategory: (id: string) => void;
  label: string;
  setLabel: (s: string) => void;
  guessMin: number | null;
  setGuessMin: (m: number) => void;
  actualMin: number | null;
  setActualMin: (m: number) => void;
  canSave: boolean;
  onSave: () => Promise<void>;
}

export function useRetro(): UseRetroResult {
  const hydrate = useCalibrationStore((s) => s.hydrate);
  const applyLog = useCalibrationStore((s) => s.applyLog);
  const categories = usePickerCategories();

  const [category, setCategory] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [guessMin, setGuessMin] = useState<number | null>(null);
  const [actualMin, setActualMin] = useState<number | null>(null);

  // Warm the per-category stats cache so any downstream read is instant.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const canSave = category !== null && guessMin !== null && actualMin !== null;

  const onSave = async () => {
    if (category === null || guessMin === null || actualMin === null) return;

    const adaptSpeed: AdaptSpeed =
      categories.find((c) => c.id === category)?.adaptSpeed ?? 'balanced';
    const trimmedLabel = label.trim() || null;

    const result = await applyLog({
      category,
      estimateMin: guessMin,
      actualMin,
      status: 'completed',
      source: 'retro',
      adaptSpeed,
      label: trimmedLabel,
    });

    useRewardStore.getState().setReward({
      actualMin,
      guessMin,
      category,
      label: trimmedLabel,
      result,
      source: 'retro',
    });

    router.replace('/(modals)/reward');
  };

  return {
    categories,
    category,
    setCategory,
    label,
    setLabel,
    guessMin,
    setGuessMin,
    actualMin,
    setActualMin,
    canSave,
    onSave,
  };
}
