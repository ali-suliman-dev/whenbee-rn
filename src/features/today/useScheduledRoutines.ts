import { useMemo } from 'react';
import { useRoutinesStore, routineStepKey } from '@/src/stores/routinesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { weekdayOf } from '@/src/lib/day';
import { stepHonestMinutes, routineHonestTotal, seededPriorFor } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// useScheduledRoutines — derived read hook (NO db writes, NO duplicate task rows)
//
// For a given selectedDate (YYYY-MM-DD), returns the set of routines that are
// scheduled to run on that weekday. Each appears as ONE block with:
//   • honestTotalMin — the routine's honest total via the engine (uses the same
//                      per-step M resolution as useRoutines: earned recurring M
//                      from the store cache → category M → prior).
//   • startByMin     — minute-of-day to start (doneByMinuteOfDay − honestTotalMin),
//                      or null when the routine has no doneBy anchor or no steps.
//   • steps          — step label + per-step honest minutes (same resolution).
//
// Layer rule: reads routinesStore + calibrationStore; never touches db or services.
// ──────────────────────────────────────────────────────────────────────────────

/** One scheduled routine block for the Today list. */
export interface ScheduledRoutineBlock {
  routineId: string;
  name: string;
  /** Engine-computed honest total for all steps in the chain (includes transition factor). */
  honestTotalMin: number;
  /** Minute-of-day to start (doneByMinuteOfDay − honestTotalMin). null = no anchor. */
  startByMin: number | null;
  /** Per-step summary for the expandable panel. */
  steps: { stepId: string; label: string; honestMin: number }[];
}

export interface UseScheduledRoutinesResult {
  blocks: ScheduledRoutineBlock[];
}

export function useScheduledRoutines(selectedDate: string): UseScheduledRoutinesResult {
  const routines = useRoutinesStore((s) => s.routines);
  const stepMByKey = useRoutinesStore((s) => s.stepMByKey);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);

  const blocks = useMemo((): ScheduledRoutineBlock[] => {
    const targetWeekday = weekdayOf(selectedDate);

    return routines
      .filter(({ routine }) => routine.scheduleDays.includes(targetWeekday))
      .map(({ routine, steps }) => {
        // Resolve per-step honest minutes using the same fallback chain as useRoutines:
        // 1. earned recurring M from the store cache (fast, no async)
        // 2. category M from calibrationStore
        // 3. prior for the category
        const perStepHonest = steps.map((step) => {
          const key = routineStepKey(routine.id, step.id);
          const recurringM = stepMByKey[key];
          let m: number;
          if (recurringM !== undefined) {
            m = recurringM;
          } else {
            const cat = statsByCategory[step.category];
            m = cat?.mEffective ?? seededPriorFor(step.category, archetypeSeed);
          }
          return {
            stepId: step.id,
            label: step.label,
            honestMin: stepHonestMinutes(step.guessMin, m),
          };
        });

        const honestTotalMin = routineHonestTotal(
          perStepHonest.map((p) => p.honestMin),
          routine.transitionFactor,
        );

        // startByMin: only defined when there's a doneBy anchor AND at least one step
        let startByMin: number | null = null;
        if (routine.doneByMinuteOfDay !== null && steps.length > 0) {
          startByMin = Math.max(0, routine.doneByMinuteOfDay - honestTotalMin);
        }

        return {
          routineId: routine.id,
          name: routine.name,
          honestTotalMin,
          startByMin,
          steps: perStepHonest,
        };
      });
  }, [routines, stepMByKey, statsByCategory, archetypeSeed, selectedDate]);

  return { blocks };
}
