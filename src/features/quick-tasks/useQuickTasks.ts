import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
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

  // Navigate with params only — no store mutation here. A running session must
  // win until the gate (resolveTimerRoute + TimerGate) confirms the switch;
  // writing the store first would clobber it before the gate ever runs.
  const startQuickTask = useCallback((chip: QuickTaskChip) => {
    router.push({
      pathname: '/(modals)/timer',
      params: {
        label: chip.label,
        category: chip.category,
        estimateMin: String(chip.honestMin),
        guessMin: String(chip.guessMin),
        suggestedHonestMin: String(chip.honestMin),
      },
    });
  }, []);

  return { chips, startQuickTask };
}
