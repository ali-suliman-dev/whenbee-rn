import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { resolveSuggestion, priorFor } from '@/src/engine';
import { makeTaskEventsRepo } from '@/src/db/repositories/taskEventsRepo';
import type { FrequentTask } from '@/src/db/queries/frequentTasks';

export interface QuickTaskChip {
  id: string;
  label: string;
  category: string;
  /** Resolved honest estimate — what the timer is set to. */
  honestMin: number;
  /** The user's own last guess — what the timer ticks against for learning. */
  guessMin: number;
}

export function useQuickTasks(): {
  chips: QuickTaskChip[];
  startQuickTask: (chip: QuickTaskChip) => void;
} {
  const db = useCalibrationStore((s) => s.db);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const [chips, setChips] = useState<QuickTaskChip[]>([]);

  useEffect(() => {
    if (db === null) return;
    let alive = true;

    void (async () => {
      const repo = makeTaskEventsRepo(db);
      const frequent: FrequentTask[] = await repo.listFrequentTasks(4);

      const mapped: QuickTaskChip[] = frequent.map((t) => {
        const cached = statsByCategory[t.category];
        const prior = cached?.priorMult ?? priorFor(t.category);
        const cat = cached
          ? { fit: cached.fit, n: cached.n, clampedRatios: cached.clampedRatios ?? [] }
          : { fit: { a: 0, b: prior }, n: 0, clampedRatios: [] };

        const { honestMinutes } = resolveSuggestion({
          guessMinutes: t.lastGuessMin,
          category: cat,
          recurring: null,
          prior,
        });

        return {
          id: `${t.category}|${t.label}`,
          label: t.label,
          category: t.category,
          honestMin: honestMinutes,
          guessMin: t.lastGuessMin,
        };
      });

      if (alive) setChips(mapped);
    })();

    return () => {
      alive = false;
    };
  }, [db, statsByCategory]);

  const startQuickTask = useCallback((chip: QuickTaskChip) => {
    useTimerStore.getState().start({
      label: chip.label,
      category: chip.category,
      estimateMin: chip.honestMin,
      guessMin: chip.guessMin,
      suggestedHonestMin: chip.honestMin,
    });
    router.push('/(modals)/timer');
  }, []);

  return { chips, startQuickTask };
}
