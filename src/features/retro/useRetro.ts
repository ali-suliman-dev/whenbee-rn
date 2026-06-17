import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useRewardStore } from '@/src/stores/rewardStore';
import { usePickerCategories, type PickerCategory } from '@/src/features/shared/CategoryChips';
import { useVocabStore } from '@/src/stores/vocabStore';
import { guessCategory } from '@/src/features/shared/categoryGuess';
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
  /** Auto-guessed category id while it's still the active pick (null after a
   *  manual override). Drives the ✦ marker on the chip. */
  guessedCategory: string | null;
  /** Per-category usage counts for the frequency-sorted picker row. */
  usage: Record<string, number>;
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

  const learned = useVocabStore((s) => s.map);
  const bank = useVocabStore((s) => s.bank);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  const [category, setCategory] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [guessMin, setGuessMin] = useState<number | null>(null);
  const [actualMin, setActualMin] = useState<number | null>(null);

  const [guessedCategory, setGuessedCategory] = useState<string | null>(null);
  const manualRef = useRef(false);

  const usage: Record<string, number> = {};
  for (const [id, s] of Object.entries(statsByCategory)) usage[id] = s.n;

  // Warm the per-category stats cache so any downstream read is instant.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const setLabelGuessed = (s: string) => {
    setLabel(s);
    if (manualRef.current) return;
    const g = guessCategory(s, {
      learned,
      namedCats: categories,
      availableIds: categories.map((c) => c.id),
    });
    setGuessedCategory(g);
    setCategory(g);
  };

  const setCategoryManual = (id: string) => {
    manualRef.current = true;
    setGuessedCategory(null);
    setCategory(id);
  };

  const canSave = category !== null && guessMin !== null && actualMin !== null;

  const onSave = async () => {
    if (category === null || guessMin === null || actualMin === null) return;

    const adaptSpeed: AdaptSpeed =
      categories.find((c) => c.id === category)?.adaptSpeed ?? 'balanced';
    const trimmedLabel = label.trim() || null;

    // No honest number was surfaced to the user in the retro flow → pass null so
    // the engine falls back to honestNumber(guess, M_before) for the reclaim anchor.
    const result = await applyLog({
      category,
      estimateMin: guessMin,
      actualMin,
      status: 'completed',
      source: 'retro',
      adaptSpeed,
      label: trimmedLabel,
      suggestedHonestMin: null,
    });

    useRewardStore.getState().setReward({
      actualMin,
      guessMin,
      category,
      label: trimmedLabel,
      result,
      source: 'retro',
    });

    if (trimmedLabel) bank(trimmedLabel, category);

    router.replace('/(modals)/reward');
  };

  return {
    categories,
    category,
    setCategory: setCategoryManual,
    label,
    setLabel: setLabelGuessed,
    guessedCategory,
    usage,
    guessMin,
    setGuessMin,
    actualMin,
    setActualMin,
    canSave,
    onSave,
  };
}
