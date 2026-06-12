import { useEffect } from 'react';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore, type TodayTask } from '@/src/stores/tasksStore';
import { resolveSuggestion, priorFor, CATEGORY_NAMES } from '@/src/engine';
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
  const focus = useTasksStore((s) => s.tasks[0] ?? null);

  // Warm the per-category stats cache on mount (instant once hydrated).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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

  return { focus, summary, categoryName };
}
