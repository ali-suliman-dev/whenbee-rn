import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore, selectFocus, type TodayTask } from '@/src/stores/tasksStore';
import { resolveSuggestion, priorFor, CATEGORY_NAMES, type CompanionStage } from '@/src/engine';
import { analytics } from '@/src/services/analytics';
import { formatClock, projectedFinish } from '@/src/lib/time';
import { publishWidgetSnapshot, clearWidgetSnapshot } from '@/src/services/liveActivity';
import type { CalibrationSummary } from '@/src/domain/types';

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
}

interface UseTodayResult {
  focus: TodayTask | null;
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
  /** Lifetime minutes reclaimed — the daily-empty proof line (hidden when < 1). */
  reclaimLifetimeMin: number;
  /** True once the user has ever logged — picks first-run vs daily empty copy. */
  hasEverLogged: boolean;
}

/** Title-case a custom-category slug (e.g. "deep_work" → "Deep Work"). */
function titleCaseSlug(slug: string): string {
  return slug
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function categoryName(id: string): string {
  return CATEGORY_NAMES[id] ?? titleCaseSlug(id);
}

export function useToday(): UseTodayResult {
  const hydrate = useCalibrationStore((s) => s.hydrate);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const loadReclaimSummary = useCalibrationStore((s) => s.loadReclaimSummary);
  const tasks = useTasksStore((s) => s.tasks);

  const [companionStage, setCompanionStage] = useState<CompanionStage>(1);
  const [companionSeed, setCompanionSeed] = useState(1);
  const [reclaimLifetimeMin, setReclaimLifetimeMin] = useState(0);
  const [lifetimeNectar, setLifetimeNectar] = useState(0);

  // Warm the per-category stats cache on mount (instant once hydrated).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Companion presence + lifetime reclaim drive the HUD bee and the daily-empty
  // proof line. Re-read on focus so a fresh deposit / tier-up shows on return.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadReclaimSummary().then((s) => {
        if (!active) return;
        setCompanionStage(s.companion.stage);
        setCompanionSeed(s.companion.seed);
        setReclaimLifetimeMin(s.lifetimeMin);
        setLifetimeNectar(s.companion.lifetimeNectar);
      });
      return () => {
        active = false;
      };
    }, [loadReclaimSummary]),
  );

  // Resolve a task's honest suggestion from its category's learned bias (or the
  // population prior for a cold category). Shared by the focus card + list rows.
  const honestFor = (task: TodayTask): CalibrationSummary => {
    const cached = statsByCategory[task.category];
    const category = cached
      ? { mEffective: cached.mEffective, n: cached.n }
      : { mEffective: priorFor(task.category), n: 0 };
    return resolveSuggestion({ guessMinutes: task.guessMin, category, recurring: null });
  };

  const toRow = (task: TodayTask): TodayRow => ({
    id: task.id,
    label: task.label,
    category: task.category,
    categoryLabel: categoryName(task.category),
    guessMin: task.guessMin,
    honestMin: honestFor(task).honestMinutes,
    done: task.status === 'done',
    actualMin: task.actualMin,
  });

  // Focus = oldest queued task. up-next = the remaining queued ones; done stays
  // checked-off (most-recent first) so the day reads as progress, not a vanish.
  const focus = selectFocus(tasks);
  const upNext = tasks
    .filter((task) => task.status === 'queued' && task.id !== focus?.id)
    .map(toRow);
  const done = tasks
    .filter((task) => task.status === 'done')
    .reverse()
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
  // started now (the same number Today shows). No-op in Expo Go / tests.
  const honestMin = summary?.honestMinutes ?? null;
  useEffect(() => {
    const now = Date.now();
    const epoch = Math.round(now / 1000);
    // No next task: clear to the quiet empty widget.
    if (!focus || honestMin === null) {
      clearWidgetSnapshot();
      return;
    }
    publishWidgetSnapshot({
      nextTaskLabel: focus.label,
      category: categoryName(focus.category),
      honestFinishClock: formatClock(projectedFinish(now, honestMin)),
      startDeepLink: `whenbee://timer?taskId=${focus.id}`,
      reclaimTodayMin: 0,
      updatedAtEpoch: epoch,
    });
  }, [focus, honestMin]);

  return {
    focus,
    summary,
    upNext,
    done,
    totalCount: tasks.length,
    categoryName,
    companionStage,
    companionSeed,
    reclaimLifetimeMin,
    hasEverLogged: lifetimeNectar > 0,
  };
}
