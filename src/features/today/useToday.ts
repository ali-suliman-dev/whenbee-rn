import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { resolveSuggestion, seededPriorFor, type CompanionStage } from '@/src/engine';
import { analytics } from '@/src/services/analytics';
import { toLocalDayKey } from '@/src/lib/day';
import { categoryName } from '@/src/features/today/categoryName';
import { useWidgetPublisher } from '@/src/features/today/useWidgetPublisher';
import type { CalibrationSummary } from '@/src/domain/types';
import type { DayTask } from '@/src/engine/daySelectors';

// ──────────────────────────────────────────────────────────────────────────────
// useToday — resolves the focus task + its honest-number suggestion.
//
// The honest number is the decision-moment value: guess × M_effective, rounded
// to 5. When the category has < 3 personal logs the engine falls back to the
// population prior (basis 'prior', label "based on typical patterns"); with
// personal evidence it reads "based on your last N times".
// ──────────────────────────────────────────────────────────────────────────────

/** A single Today list row (up-next or done), pre-resolved for the UI. */
export interface TodayRow {
  id: string;
  label: string;
  category: string;
  categoryLabel: string;
  /** The user's original guess (minutes) — threaded to the timer for ratio calc. */
  guessMin: number;
  /** Learned honest estimate in minutes (the number we plan against). */
  honestMin: number;
  done: boolean;
  /** Actual minutes once finished (null while queued / if not timed). */
  actualMin: number | null;
  /** Original plannedDate when this task carried over onto today; null if not carried. */
  carriedFrom: string | null;
}

interface UseTodayResult {
  focus: DayTask | null;
  summary: CalibrationSummary | null;
  /** Queued tasks AFTER the focus (the up-next rows). */
  upNext: TodayRow[];
  /** Tasks finished today, kept checked-off (most-recent first). */
  done: TodayRow[];
  /** Total tasks on the day (queued + done) — drives the empty state. */
  totalCount: number;
  categoryName: (id: string) => string;
  /** The companion's current stage (1..6) — drives the HUD bee. */
  companionStage: CompanionStage;
  /** The companion's procedural seed — drives the HUD bee's stripe warmth. */
  companionSeed: number;
  /** True once the user has ever logged — picks first-run vs daily empty copy. */
  hasEverLogged: boolean;
  /** True when the focus task's honest number is based on the population prior (cold, n < 3). */
  focusPreEstimate: boolean;
}

export function useToday(): UseTodayResult {
  const hydrate = useCalibrationStore((s) => s.hydrate);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const loadReclaimSummary = useCalibrationStore((s) => s.loadReclaimSummary);
  const dayTasks = useDayTasksStore((s) => s.dayTasks);
  const selectFocusTask = useDayTasksStore((s) => s.selectFocusTask);
  const selectedDate = useDayTasksStore((s) => s.selectedDate);
  const isViewingToday = selectedDate === toLocalDayKey(Date.now());
  const isTimerRunning = useTimerStore((s) => s.isRunning);
  const runningTaskId = useTimerStore((s) => s.taskId);
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);

  const [companionStage, setCompanionStage] = useState<CompanionStage>(1);
  const [companionSeed, setCompanionSeed] = useState(1);
  const [lifetimeNectar, setLifetimeNectar] = useState(0);

  // Warm the per-category stats cache on mount (instant once hydrated).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Companion presence drives the HUD bee. Re-read on focus so a tier-up shows on return.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadReclaimSummary().then((s) => {
        if (!active) return;
        setCompanionStage(s.companion.stage);
        setCompanionSeed(s.companion.seed);
        setLifetimeNectar(s.companion.lifetimeNectar);
      });
      return () => {
        active = false;
      };
    }, [loadReclaimSummary]),
  );

  // Resolve a task's honest suggestion from its category's learned bias (or the
  // population prior for a cold category). Shared by the focus card + list rows.
  const honestFor = (task: DayTask): CalibrationSummary => {
    const cached = statsByCategory[task.category];
    const category = cached
      ? { fit: cached.fit, n: cached.n }
      : { fit: { a: 0, b: seededPriorFor(task.category, archetypeSeed) }, n: 0 };
    return resolveSuggestion({ guessMinutes: task.guessMin, category, recurring: null });
  };

  const toRow = (task: DayTask): TodayRow => ({
    id: task.id,
    label: task.label,
    category: task.category,
    categoryLabel: categoryName(task.category),
    guessMin: task.guessMin,
    honestMin: honestFor(task).honestMinutes,
    done: task.status === 'done',
    actualMin: task.actualMin,
    carriedFrom: task.status === 'done' ? null : (task.carriedFrom ?? null),
  });

  // Focus = first queued task from the selected day's tasks.
  const focus = selectFocusTask();

  // The "now" slot — the single task shown at the top of the day. While a timer
  // runs, the screen renders the RUNNING task there (from timerStore), so up-next
  // must hide THAT task, not the oldest-queued one. Keying up-next off this id
  // (instead of always off focus.id) is what stops the running task duplicating
  // into the list while the previously-focused task silently vanishes. A
  // quick-start session has no taskId → nothing is hidden, the whole queue shows.
  //
  // On a FUTURE day there is no "now" — the next task isn't a hero, it just sits
  // in the list like any other. So only carve out the focus slot when viewing
  // today (a live timer always wins, since running is inherently "now").
  const nowSlotId = isTimerRunning
    ? runningTaskId
    : isViewingToday
      ? (focus?.id ?? null)
      : null;
  const upNext = dayTasks
    .filter((task) => task.status === 'queued' && task.id !== nowSlotId)
    .map(toRow);
  const done = dayTasks
    .filter((task) => task.status === 'done')
    .slice()
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .map(toRow);

  const summary: CalibrationSummary | null = focus ? honestFor(focus) : null;

  // honest_suggestion_shown: fire once per surfacing (category+guess), not per
  // render. The ref de-dupes the value the user is currently looking at.
  const lastShownRef = useRef<string | null>(null);
  const suggestedMin = summary?.honestMinutes ?? null;
  useEffect(() => {
    if (!focus || suggestedMin === null) return;
    const key = `${focus.category}|${focus.guessMin}|${suggestedMin}`;
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;
    analytics.capture('honest_suggestion_shown', {
      category: focus.category,
      guess_min: focus.guessMin,
      suggested_min: suggestedMin,
    });
  }, [focus, suggestedMin]);

  // Publish the next-task snapshot to the Home-screen widget. The honest finish
  // is "now + honest minutes" — the time the focus task would honestly wrap if
  // started now (the same number Today shows). Reactive to timer/entitlement/
  // mEffective too, so e.g. a purchase lights the widget immediately. No-op in
  // Expo Go / tests. See useWidgetPublisher for the full trigger set.
  const honestMin = summary?.honestMinutes ?? null;
  useWidgetPublisher({ focus, honestMin });

  return {
    focus,
    summary,
    upNext,
    done,
    totalCount: dayTasks.length,
    categoryName,
    companionStage,
    companionSeed,
    hasEverLogged: lifetimeNectar > 0,
    focusPreEstimate: summary?.basis === 'prior',
  };
}
