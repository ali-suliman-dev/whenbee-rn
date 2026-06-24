// PURE. The day-capacity read: Σ task honest minutes + Σ timed event minutes vs the
// waking window. Amber-only verdict — 'over' is a calm fact (offer to move), never red.
import { DAY_LOAD } from './constants';

export interface DayLoadInput {
  taskHonestMins: readonly number[];
  eventTimedMins: readonly number[]; // all-day events excluded by the caller
  wakingWindowMin: number;
}
export interface DayLoadResult {
  taskMin: number;
  eventMin: number;
  committedMin: number;
  freeMin: number;
  verdict: 'comfortable' | 'snug' | 'over';
  overByMin: number;
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export function honestDayLoad({ taskHonestMins, eventTimedMins, wakingWindowMin }: DayLoadInput): DayLoadResult {
  const taskMin = sum(taskHonestMins);
  const eventMin = sum(eventTimedMins);
  const committedMin = taskMin + eventMin;
  const freeMin = Math.max(0, wakingWindowMin - eventMin);
  let verdict: DayLoadResult['verdict'];
  if (committedMin > wakingWindowMin) verdict = 'over';
  else if (committedMin > DAY_LOAD.snugFrac * freeMin) verdict = 'snug';
  else verdict = 'comfortable';
  const overByMin = Math.max(0, committedMin - wakingWindowMin);
  return { taskMin, eventMin, committedMin, freeMin, verdict, overByMin };
}
