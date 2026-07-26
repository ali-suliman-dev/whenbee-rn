// src/features/today/dayRecapCopy.ts
// Pure copy for the past-day recap card. No React, no clock, no store access.
//
// No guilt: running over is a fact the model learns from, running under is not
// a prize. Neither branch praises or scolds — "the day you pictured" is what
// they're measured against, because a picture is something you had, not a
// target you missed.

import { fmtDelta, fmtHm } from '@/src/lib/time';

export interface RecapHeadline {
  /** Text before the gap span. Carries the whole line when `gap` is null. */
  lead: string;
  /** The emphasised gap phrase ("35m over"), or null when there isn't one. */
  gap: string | null;
  /** Text after the gap span. Empty when `gap` is null. */
  trail: string;
  direction: 'over' | 'under' | 'even' | 'empty';
}

export function recapHeadline(recap: { doneCount: number; vsGuessMin: number }): RecapHeadline {
  if (recap.doneCount === 0) {
    return { lead: 'Nothing logged that day.', gap: null, trail: '', direction: 'empty' };
  }
  const delta = fmtDelta(recap.vsGuessMin);
  if (delta.direction === 'even') {
    return { lead: 'Landed right on the day you pictured.', gap: null, trail: '', direction: 'even' };
  }
  return {
    lead: delta.direction === 'over' ? 'Ran ' : 'Came in ',
    gap: delta.text,
    trail: ' the day you pictured.',
    direction: delta.direction,
  };
}

/** The two ends of the gap bar, named so the bar needs no legend. */
export function recapScale(guessedMin: number, honestMin: number): { left: string; right: string } {
  return { left: `guessed ${fmtHm(guessedMin)}`, right: `real ${fmtHm(honestMin)}` };
}
