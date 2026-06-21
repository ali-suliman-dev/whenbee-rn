import { useEffect, useMemo } from 'react';
import {
  stepHonestMinutes,
  routineHonestTotal,
  routineBasis,
  planBackward,
  priorFor,
  DEFAULT_BUFFER_MIN,
} from '@/src/engine';
import { useRoutinesStore, routineStepKey } from '@/src/stores/routinesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { RoutineSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// useRoutines — composes routinesStore + the pure routine/planner engine.
//
// Read-only over the engine: derives each routine's RoutineSummary (per-step
// honest minutes × learned transition factor, basis from runCount) and, when a
// be-done-by anchor is set, the "start by" epoch via planBackward. Per-step M is
// the step's earned recurring M (from the store cache) or its category M, mirroring
// resolveSuggestion's fallback. The engine stays clock-free; nowMs is injected here.
// ──────────────────────────────────────────────────────────────────────────────

const MS_PER_MIN = 60_000;

interface UseRoutinesArgs {
  /** Inject a fixed clock for deterministic tests; defaults to Date.now(). */
  nowMs?: number;
}

/** A routine's derived summary plus its computed start-by (null with no anchor). */
export interface RoutineCardModel {
  routineId: string;
  name: string;
  stepCount: number;
  doneByMinuteOfDay: number | null;
  summary: RoutineSummary;
  /** epoch ms to start by to hit the be-done-by anchor, or null when unset. */
  startByMs: number | null;
}

/** Today's (or tomorrow's, if already past) epoch deadline for a minute-of-day. */
function deadlineEpochFor(minuteOfDay: number, nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  let deadline = d.getTime() + minuteOfDay * MS_PER_MIN;
  if (deadline <= nowMs) deadline += 24 * 60 * MS_PER_MIN; // roll to tomorrow
  return deadline;
}

export function useRoutines(args: UseRoutinesArgs = {}) {
  const now = args.nowMs ?? Date.now();

  const routines = useRoutinesStore((s) => s.routines);
  const stepMByKey = useRoutinesStore((s) => s.stepMByKey);
  const loadRoutines = useRoutinesStore((s) => s.loadRoutines);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  useEffect(() => {
    void loadRoutines();
  }, [loadRoutines]);

  /** The step's resolved multiplier: earned recurring M → category M → prior. */
  const resolveStepM = useMemo(
    () =>
      (routineId: string, stepId: string, category: string): number => {
        const recurringM = stepMByKey[routineStepKey(routineId, stepId)];
        if (recurringM !== undefined) return recurringM;
        const cat = statsByCategory[category];
        return cat?.mEffective ?? priorFor(category);
      },
    [stepMByKey, statsByCategory],
  );

  const summaries: RoutineCardModel[] = useMemo(
    () =>
      routines.map(({ routine, steps }) => {
        const perStepHonest = steps.map((step) => ({
          stepId: step.id,
          honestMin: stepHonestMinutes(step.guessMin, resolveStepM(routine.id, step.id, step.category)),
        }));
        const honestTotalMin = routineHonestTotal(
          perStepHonest.map((p) => p.honestMin),
          routine.transitionFactor,
        );
        const { basis, label } = routineBasis(routine.runCount);

        let startByMs: number | null = null;
        if (routine.doneByMinuteOfDay !== null && steps.length > 0) {
          const deadline = deadlineEpochFor(routine.doneByMinuteOfDay, now);
          // The transition factor folds into the chain before the planner sees it,
          // so the start-by is honest end-to-end: distribute the seam overhead across
          // the steps proportionally via the same ratio the total uses.
          const baseSum = perStepHonest.reduce((sum, p) => sum + p.honestMin, 0);
          const scale = baseSum > 0 ? honestTotalMin / baseSum : 1;
          const plan = planBackward({
            deadline,
            nowMs: now,
            bufferMin: DEFAULT_BUFFER_MIN,
            tasks: perStepHonest.map((p, i) => ({
              id: steps[i]!.id,
              label: steps[i]!.label,
              category: steps[i]!.category,
              durationMin: Math.max(1, Math.round(p.honestMin * scale)),
            })),
          });
          startByMs = plan.startBy;
        }

        const summary: RoutineSummary = {
          routineId: routine.id,
          honestTotalMin,
          basis,
          label,
          runCount: routine.runCount,
          steps: perStepHonest,
        };

        return {
          routineId: routine.id,
          name: routine.name,
          stepCount: steps.length,
          doneByMinuteOfDay: routine.doneByMinuteOfDay,
          summary,
          startByMs,
        };
      }),
    [routines, resolveStepM, now],
  );

  return { summaries, reload: loadRoutines };
}
