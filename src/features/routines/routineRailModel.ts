import { stepHonestMinutes, routineHonestTotal } from '@/src/engine';

export type RailRow =
  | { kind: 'start'; clockMin: number | null }
  | {
      kind: 'step';
      id: string;
      label: string;
      category: string;
      guessMin: number;
      honestMin: number;
      clockMin: number | null;
    }
  | { kind: 'breather'; min: number }
  | { kind: 'finish'; clockMin: number | null };

export interface RoutineRailModel {
  rows: RailRow[];
  honestTotalMin: number;
  /** Minute-of-day to start so the routine finishes by doneBy; null when unset. */
  startByMin: number | null;
}

const round5 = (n: number): number => Math.round(n / 5) * 5;

export interface BuildRoutineRailInput {
  steps: { id: string; label: string; category: string; guessMin: number }[];
  /** Effective multiplier for a category (learned or prior). */
  mFor: (category: string) => number;
  transitionFactor: number;
  doneByMinuteOfDay: number | null;
}

export function buildRoutineRail(input: BuildRoutineRailInput): RoutineRailModel {
  const { steps, mFor, transitionFactor, doneByMinuteOfDay } = input;

  if (steps.length === 0) {
    return { rows: [], honestTotalMin: 0, startByMin: null };
  }

  const perStep = steps.map((s) => stepHonestMinutes(s.guessMin, mFor(s.category)));
  const honestTotalMin = routineHonestTotal(perStep, transitionFactor);
  const sumSteps = perStep.reduce((a, b) => a + b, 0);
  const nGaps = Math.max(0, steps.length - 1);
  const totalBreather = Math.max(0, honestTotalMin - sumSteps);
  const breatherEach = nGaps > 0 ? totalBreather / nGaps : 0;

  const startByMin =
    doneByMinuteOfDay === null ? null : Math.max(0, doneByMinuteOfDay - honestTotalMin);

  const rows: RailRow[] = [{ kind: 'start', clockMin: startByMin }];
  let cursor = startByMin; // running minute-of-day, or null

  steps.forEach((step, i) => {
    const honestMin = perStep[i] ?? 0;
    rows.push({
      kind: 'step',
      id: step.id,
      label: step.label,
      category: step.category,
      guessMin: step.guessMin,
      honestMin,
      clockMin: cursor,
    });
    if (cursor !== null) cursor += honestMin;

    if (i < steps.length - 1) {
      // Always advance the clock by the exact (unrounded) breather gap so that
      // subsequent step clockMin values stay anchored to the finish-by time, even
      // when the gap is too small to merit a visible breather row (< 2.5 min).
      if (round5(breatherEach) > 0) {
        rows.push({ kind: 'breather', min: round5(breatherEach) });
      }
      if (cursor !== null) cursor += breatherEach;
    }
  });

  rows.push({ kind: 'finish', clockMin: doneByMinuteOfDay });
  return { rows, honestTotalMin, startByMin };
}
