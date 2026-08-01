// src/features/today/daySoFar.ts
// Pure logic for the Today "Your day so far" recap card — visibility rule +
// copy pluralization. No React, no clock, no store access: everything here is
// driven off already-resolved numbers so it stays trivially unit-testable.
//
// No guilt. This is a recap, not a score — copy never implies "should have".


/**
 * Visible only on a sparse-done day: nothing running, nothing still queued,
 * and at least one thing already logged. A timer start or a newly-added task
 * flips `unfinishedCount` above 0 and the card unmounts (plain unmount, no
 * exit animation — see global animation rule).
 */
export function daySoFarVisible(
  isTimerRunning: boolean,
  unfinishedCount: number,
  completedCount: number,
): boolean {
  return !isTimerRunning && unfinishedCount === 0 && completedCount >= 1;
}

export interface MilestoneCopy {
  /** Which milestone sentence to render. */
  direction: 'over' | 'under' | 'equal';
  /** Absolute size of the gap in minutes; 0 when spot-on. */
  gapMin: number;
}

/**
 * States today's guess-vs-honest gap as a calm fact — never a scold (no guilt).
 * The gap IS the signal Whenbee learns from, so the copy frames it as progress:
 *   - over:  the optimism the model is trimming.
 *   - under: a win — "nicely called".
 *   - equal: spot on.
 *
 * Returns the DECISION, not the sentence. The card renders it through i18next so
 * the bold gap phrase is a `<strong>` component inside the translated string —
 * the old version pre-baked an English sentence and the card sliced it by index
 * to bold the prefix, which cannot survive a language with different word order.
 */
export function gapMilestone(guessedMin: number, totalMin: number): MilestoneCopy {
  const delta = totalMin - guessedMin;
  if (delta === 0) return { direction: 'equal', gapMin: 0 };
  if (delta > 0) return { direction: 'over', gapMin: delta };
  return { direction: 'under', gapMin: -delta };
}
