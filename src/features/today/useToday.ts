import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore, type TodayTask } from '@/src/stores/tasksStore';
import { resolveSuggestion, priorFor, CATEGORY_NAMES } from '@/src/engine';
import { analytics } from '@/src/services/analytics';
import type { CalibrationSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// useToday — resolves the focus task + its honest-number suggestion.
//
// The honest number is the decision-moment value: guess × M_effective, rounded
// to 5. When the category has < 3 personal logs the engine falls back to the
// population prior (basis 'prior', label "based on typical patterns"); with
// personal evidence it reads "based on your last N times".
// ──────────────────────────────────────────────────────────────────────────────

interface UseTodayResult {
  focus: TodayTask | null;
  summary: CalibrationSummary | null;
  categoryName: (id: string) => string;
  /** Minutes Today has handed back so far (local-day reclaim). 0 → the line hides. */
  todayReclaimMin: number;
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
  const loadTodayReclaimMin = useCalibrationStore((s) => s.loadTodayReclaimMin);
  const focus = useTasksStore((s) => s.tasks[0] ?? null);

  const [todayReclaimMin, setTodayReclaimMin] = useState(0);

  // Warm the per-category stats cache on mount (instant once hydrated).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Re-read the day's reclaim every time Today regains focus, so a fresh deposit
  // from the Reward flow shows the moment the user lands back here.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadTodayReclaimMin().then((min) => {
        if (active) setTodayReclaimMin(min);
      });
      return () => {
        active = false;
      };
    }, [loadTodayReclaimMin]),
  );

  let summary: CalibrationSummary | null = null;
  if (focus) {
    const cached = statsByCategory[focus.category];
    const category = cached
      ? { mEffective: cached.mEffective, n: cached.n }
      : { mEffective: priorFor(focus.category), n: 0 };

    summary = resolveSuggestion({
      guessMinutes: focus.guessMin,
      category,
      recurring: null,
    });
  }

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

  return { focus, summary, categoryName, todayReclaimMin };
}
