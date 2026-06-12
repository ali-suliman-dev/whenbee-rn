import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';
import { resolveSuggestion, priorFor } from '@/src/engine';
import { usePickerCategories, type PickerCategory } from '@/src/features/shared/CategoryChips';
import type { CalibrationSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// useAddTask — add an ad-hoc task and surface the honest suggestion LIVE
// (guess × learned multiplier) at the decision moment. Reads the cached
// per-category stat from calibrationStore (falls back to the population prior
// for a cold category). Two exits:
//   • Add & start timer → create the task, open the Timer with the honest
//     estimate pre-filled AND the original guess threaded through (calibration
//     ratio = actual / guess).
//   • Add to today → queue the task, dismiss with a toast.
// ──────────────────────────────────────────────────────────────────────────────

export interface UseAddTaskResult {
  categories: PickerCategory[];
  title: string;
  setTitle: (s: string) => void;
  category: string | null;
  setCategory: (id: string) => void;
  guessMin: number;
  setGuessMin: (m: number) => void;
  /** Live honest suggestion for the current category + guess (null until a category is picked). */
  suggestion: CalibrationSummary | null;
  canSubmit: boolean;
  onAddAndStart: () => void;
  /** Queues the task without navigating; returns true on success so the screen
   *  can show the "Added to today" toast before dismissing. */
  addToToday: () => boolean;
}

const DEFAULT_GUESS = 15;

export function useAddTask(): UseAddTaskResult {
  const hydrate = useCalibrationStore((s) => s.hydrate);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const addTask = useTasksStore((s) => s.addTask);
  const categories = usePickerCategories();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [guessMin, setGuessMin] = useState<number>(DEFAULT_GUESS);

  // Warm the per-category stats cache so the suggestion reflects learned data.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Live honest suggestion — recomputed on every category/guess change.
  const suggestion = useMemo<CalibrationSummary | null>(() => {
    if (category === null) return null;
    const cached = statsByCategory[category];
    const cat = cached
      ? { mEffective: cached.mEffective, n: cached.n }
      : { mEffective: priorFor(category), n: 0 };
    return resolveSuggestion({ guessMinutes: guessMin, category: cat, recurring: null });
  }, [category, guessMin, statsByCategory]);

  const canSubmit = title.trim().length > 0 && category !== null;

  const addToToday = (): boolean => {
    if (!canSubmit || category === null) return false;
    addTask({ label: title.trim(), category, guessMin });
    return true;
  };

  const onAddAndStart = () => {
    if (!canSubmit || category === null || suggestion === null) return;
    const task = addTask({ label: title.trim(), category, guessMin });
    router.replace({
      pathname: '/(modals)/timer',
      params: {
        taskId: task.id,
        label: task.label,
        category,
        estimateMin: String(suggestion.honestMinutes),
        guessMin: String(guessMin),
      },
    });
  };

  return {
    categories,
    title,
    setTitle,
    category,
    setCategory,
    guessMin,
    setGuessMin,
    suggestion,
    canSubmit,
    onAddAndStart,
    addToToday,
  };
}
