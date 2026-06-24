import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useVocabStore } from '@/src/stores/vocabStore';
import { resolveSuggestion, priorFor } from '@/src/engine';
import { usePickerCategories, type PickerCategory } from '@/src/features/shared/CategoryChips';
import { guessCategory } from '@/src/features/shared/categoryGuess';
import { analytics } from '@/src/services/analytics';
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
  /** Category id auto-guessed from the title while it's still the active pick
   *  (null once the user manually overrides). Drives the ✦ marker + hint. */
  guessedCategory: string | null;
  /** Per-category usage counts for the frequency-sorted picker row. */
  usage: Record<string, number>;
  /** Create a custom category from free text and select it. Returns its id. */
  addCategory: (name: string) => string;
  guessMin: number;
  setGuessMin: (m: number) => void;
  /** Live honest suggestion for the current category + guess (null until a category is picked). */
  suggestion: CalibrationSummary | null;
  /** True when the suggestion is based on the population prior (cold category, n < 3). */
  preEstimate: boolean;
  canSubmit: boolean;
  onAddAndStart: () => Promise<void>;
  /** Queues the task on the selected day (or the optionally provided date)
   *  without navigating; returns true on success so the screen can show
   *  the "Added to today" toast before dismissing.
   *  @param date - override the target date (default: store selectedDate). */
  addToToday: (date?: string | null) => Promise<boolean>;
}

const DEFAULT_GUESS = 15;

export function useAddTask(initialTitle?: string): UseAddTaskResult {
  const hydrate = useCalibrationStore((s) => s.hydrate);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const addTask = useDayTasksStore((s) => s.addTask);
  const addCategoryToStore = useCategoriesStore((s) => s.addCategory);
  const categories = usePickerCategories();
  const learned = useVocabStore((s) => s.map);
  const bank = useVocabStore((s) => s.bank);

  const [title, setTitleState] = useState('');
  const [category, setCategoryState] = useState<string | null>(null);
  const [guessedCategory, setGuessedCategory] = useState<string | null>(null);
  const [guessMin, setGuessMin] = useState<number>(DEFAULT_GUESS);
  // Flips once the user taps a chip — from then on we stop auto-guessing so a
  // manual pick is never silently overwritten as they keep editing the title.
  const manualRef = useRef(false);

  // Typing the title re-guesses the category until the user picks one by hand.
  const setTitle = (s: string) => {
    setTitleState(s);
    if (manualRef.current) return;
    const g = guessCategory(s, {
      learned,
      namedCats: categories,
      availableIds: categories.map((c) => c.id),
    });
    setGuessedCategory(g);
    setCategoryState(g);
  };

  // Seed once from a spoken transcript (trio mic quick-add). Routes through
  // setTitle so the same category auto-guess runs as if the user had typed it.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !initialTitle) return;
    seededRef.current = true;
    setTitle(initialTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot seed; setTitle is re-created each render and the ref guards re-entry
  }, [initialTitle]);

  // Any manual pick wins and clears the ✦ guess marker.
  const setCategory = (id: string) => {
    manualRef.current = true;
    setGuessedCategory(null);
    setCategoryState(id);
  };

  // Usage counts (n per category) drive the frequency sort of the picker row.
  const usage = useMemo<Record<string, number>>(() => {
    const u: Record<string, number> = {};
    for (const [id, s] of Object.entries(statsByCategory)) u[id] = s.n;
    return u;
  }, [statsByCategory]);

  // Warm the per-category stats cache so the suggestion reflects learned data.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Live honest suggestion — recomputed on every category/guess change. The
  // cached ratio window + prior let the summary carry a honest range (Pro) at the
  // decision moment without re-reading the db per keystroke.
  const suggestion = useMemo<CalibrationSummary | null>(() => {
    if (category === null) return null;
    const cached = statsByCategory[category];
    const prior = cached?.priorMult ?? priorFor(category);
    const cat = cached
      ? { fit: cached.fit, n: cached.n, clampedRatios: cached.clampedRatios ?? [] }
      : { fit: { a: 0, b: prior }, n: 0, clampedRatios: [] };
    return resolveSuggestion({ guessMinutes: guessMin, category: cat, recurring: null, prior });
  }, [category, guessMin, statsByCategory]);

  // honest_suggestion_shown: fire once per surfacing (category+guess), not per
  // keystroke. De-duped by the value the user is currently looking at.
  const lastShownRef = useRef<string | null>(null);
  const suggestedMin = suggestion?.honestMinutes ?? null;
  useEffect(() => {
    if (category === null || suggestedMin === null) return;
    const key = `${category}|${guessMin}|${suggestedMin}`;
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;
    analytics.capture('honest_suggestion_shown', {
      category,
      guess_min: guessMin,
      suggested_min: suggestedMin,
    });
  }, [category, guessMin, suggestedMin]);

  const addCategory = (name: string): string => {
    const id = addCategoryToStore(name);
    setCategory(id); // marks manual + clears the guess marker
    return id;
  };

  const canSubmit = title.trim().length > 0 && category !== null;

  const addToToday = async (date?: string | null): Promise<boolean> => {
    if (!canSubmit || category === null) return false;
    const resolvedDate = date === undefined ? useDayTasksStore.getState().selectedDate : date;
    await addTask({ label: title.trim(), category, guessMin, date: resolvedDate });
    bank(title.trim(), category);
    return true;
  };

  const onAddAndStart = async (): Promise<void> => {
    if (!canSubmit || category === null || suggestion === null) return;
    const task = await addTask({
      label: title.trim(),
      category,
      guessMin,
      date: useDayTasksStore.getState().selectedDate,
    });
    bank(title.trim(), category);
    // suggestedHonestMin = the honest number the user SAW in the Add-Task sheet
    // (suggestion.honestMinutes). Passed explicitly so the timer's applyLog banks
    // reclaim against the number actually shown, not a re-derived fallback.
    router.replace({
      pathname: '/(modals)/timer',
      params: {
        taskId: task.id,
        label: task.label,
        category,
        estimateMin: String(suggestion.honestMinutes),
        guessMin: String(guessMin),
        suggestedHonestMin: String(suggestion.honestMinutes),
      },
    });
  };

  return {
    categories,
    title,
    setTitle,
    category,
    setCategory,
    guessedCategory,
    usage,
    addCategory,
    guessMin,
    setGuessMin,
    suggestion,
    preEstimate: suggestion?.basis === 'prior',
    canSubmit,
    onAddAndStart,
    addToToday,
  };
}
