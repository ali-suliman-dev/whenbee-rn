import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useCalibrationStore, type GoalCoachInfo } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useVocabStore } from '@/src/stores/vocabStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { resolveSuggestion, seededPriorFor } from '@/src/engine';
import { usePickerCategories, type PickerCategory } from '@/src/features/shared/CategoryChips';
import { guessCategory } from '@/src/features/shared/categoryGuess';
import { shouldShowAntiChase } from '@/src/features/add-task/antiChase';
import { analytics } from '@/src/services/analytics';
import { kv } from '@/src/lib/kv';
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
  /** Read-only goal-coach status for the current category (or null). Depends
   *  only on the category — never the live guess (spec 2026-07-13). */
  goalCoach: GoalCoachInfo | null;
  /** True while the once-ever anti-chase coach is showing (user raised the guess
   *  toward/past the honest number). Dismissible; never fires again once seen. */
  antiChaseVisible: boolean;
  /** Dismiss the anti-chase coach for this session. */
  dismissAntiChase: () => void;
  canSubmit: boolean;
  /** Adds the task and navigates to the timer.
   *  @param date - override the target date (default: store selectedDate). */
  onAddAndStart: (date?: string | null) => Promise<void>;
  /** Queues the task on the selected day (or the optionally provided date)
   *  without navigating; returns true on success so the screen can show
   *  the "Added to today" toast before dismissing.
   *  @param date - override the target date (default: store selectedDate). */
  addToToday: (date?: string | null) => Promise<boolean>;
  /** True when this hook instance is editing an existing queued task
   *  (a valid `editId` was passed in). */
  isEditing: boolean;
  /** The edited task's `plannedDate` once loaded — `undefined` until the
   *  prefill read completes, `null` when the task is on the shelf. */
  loadedDate: string | null | undefined;
  /** Patches the edited task in place. Returns true on success so the screen
   *  can show a toast and dismiss.
   *  @param date - override the target date (default: the loaded plannedDate). */
  save: (date?: string | null) => Promise<boolean>;
  /** Patches the edited task, then routes to the timer with it pre-filled.
   *  @param date - override the target date (default: the loaded plannedDate). */
  saveAndStart: (date?: string | null) => Promise<void>;
}

const DEFAULT_GUESS = 15;
/** Once-ever flag: the anti-chase coach has been shown. */
const ANTI_CHASE_SEEN_KEY = 'coach.antiChase.seen';

export function useAddTask(initialTitle?: string, editId?: string): UseAddTaskResult {
  const hydrate = useCalibrationStore((s) => s.hydrate);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const loadGoalCoach = useCalibrationStore((s) => s.loadGoalCoach);
  const addTask = useDayTasksStore((s) => s.addTask);
  const updateTask = useDayTasksStore((s) => s.updateTask);
  const addCategoryToStore = useCategoriesStore((s) => s.addCategory);
  const categories = usePickerCategories();
  const learned = useVocabStore((s) => s.map);
  const bank = useVocabStore((s) => s.bank);
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);

  const [title, setTitleState] = useState('');
  const [category, setCategoryState] = useState<string | null>(null);
  const [guessedCategory, setGuessedCategory] = useState<string | null>(null);
  const [guessMin, setGuessMinState] = useState<number>(DEFAULT_GUESS);
  const [antiChaseVisible, setAntiChaseVisible] = useState(false);
  const [isEditing] = useState(() => typeof editId === 'string' && editId.length > 0);
  const [loadedDate, setLoadedDate] = useState<string | null | undefined>(undefined);
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

  // Edit mode: hydrate the fields from the stored task exactly once. Sets manualRef
  // so the title-driven category auto-guess never overwrites the stored category.
  const editSeededRef = useRef(false);
  useEffect(() => {
    if (!isEditing || !editId || editSeededRef.current) return;
    editSeededRef.current = true;
    void useDayTasksStore.getState().getTaskById(editId).then((task) => {
      if (!task) return;
      manualRef.current = true;
      setTitleState(task.label);
      setGuessedCategory(null);
      setCategoryState(task.category);
      setGuessMinState(task.guessMin);
      setLoadedDate(task.plannedDate);
    });
  }, [isEditing, editId]);

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
    const prior = cached?.priorMult ?? seededPriorFor(category, archetypeSeed);
    const cat = cached
      ? { fit: cached.fit, n: cached.n, clampedRatios: cached.clampedRatios ?? [] }
      : { fit: { a: 0, b: prior }, n: 0, clampedRatios: [] };
    return resolveSuggestion({ guessMinutes: guessMin, category: cat, recurring: null, prior });
  }, [category, guessMin, statsByCategory, archetypeSeed]);

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

  // Goal coach for the active category — a bounded read on category change (NOT
  // per keystroke). Null whenever the category has no active, un-met goal.
  const [goalCoach, setGoalCoach] = useState<GoalCoachInfo | null>(null);
  const goalCoachSeen = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (category === null) {
      setGoalCoach(null);
      return;
    }
    let alive = true;
    void loadGoalCoach(category).then((res) => {
      if (!alive) return;
      setGoalCoach(res);
      if (res && !goalCoachSeen.current.has(category)) {
        goalCoachSeen.current.add(category);
        analytics.capture('goal_coach_shown', {
          category,
          target_band: res.targetBand,
          best_band: res.bestBand,
          has_lever: res.lever !== null,
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [category, loadGoalCoach]);

  // Wrapped guess setter — before applying the new value, check whether the user
  // just raised their guess to/past the honest number (the chase move). If so, and
  // they've never seen it, surface the one-time anti-chase coach and persist the
  // once-ever flag.
  const setGuessMin = (next: number) => {
    const honest = suggestion?.honestMinutes ?? null;
    if (honest !== null && !antiChaseVisible) {
      const seen = kv.getString(ANTI_CHASE_SEEN_KEY) === '1';
      if (shouldShowAntiChase({ prevGuess: guessMin, nextGuess: next, honestMinutes: honest, seen })) {
        setAntiChaseVisible(true);
        kv.set(ANTI_CHASE_SEEN_KEY, '1');
      }
    }
    setGuessMinState(next);
  };
  const dismissAntiChase = () => setAntiChaseVisible(false);

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

  const onAddAndStart = async (date?: string | null): Promise<void> => {
    if (!canSubmit || category === null || suggestion === null) return;
    const resolvedDate = date === undefined ? useDayTasksStore.getState().selectedDate : date;
    const task = await addTask({
      label: title.trim(),
      category,
      guessMin,
      date: resolvedDate,
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

  const save = async (date?: string | null): Promise<boolean> => {
    if (!isEditing || !editId || !canSubmit || category === null) return false;
    const resolvedDate = date === undefined ? loadedDate ?? null : date;
    await updateTask(editId, { label: title.trim(), category, guessMin, plannedDate: resolvedDate });
    bank(title.trim(), category);
    return true;
  };

  const saveAndStart = async (date?: string | null): Promise<void> => {
    const ok = await save(date);
    if (!ok || editId === undefined || suggestion === null) return;
    router.replace({
      pathname: '/(modals)/timer',
      params: {
        taskId: editId,
        label: title.trim(),
        category: category as string,
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
    goalCoach,
    antiChaseVisible,
    dismissAntiChase,
    canSubmit,
    onAddAndStart,
    addToToday,
    isEditing,
    loadedDate,
    save,
    saveAndStart,
  };
}
