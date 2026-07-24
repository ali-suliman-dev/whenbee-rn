// src/features/today/daySoFar.ts
// Pure logic for the Today "Your day so far" recap card — visibility rule +
// copy pluralization. No React, no clock, no store access: everything here is
// driven off already-resolved numbers so it stays trivially unit-testable.
//
// No guilt. This is a recap, not a score — copy never implies "should have".

import { fmtHm } from '@/src/lib/time';

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

/** "One honest log in." / "{n} honest logs in." */
export function countLine(completedCount: number): string {
  return completedCount === 1 ? 'One honest log in.' : `${completedCount} honest logs in.`;
}

export interface MilestoneCopy {
  /** Full milestone line. */
  text: string;
  /** The leading bold span within `text` (the gap phrase), or null when spot-on. */
  boldPrefix: string | null;
}

/**
 * States today's guess-vs-honest gap as a calm fact — never a scold (no guilt).
 * The gap IS the signal Whenbee learns from, so the copy frames it as progress:
 *   - over  ("+Xh Ym over"): the optimism the model is trimming.
 *   - under ("Xh Ym under"): a win — "nicely called".
 *   - equal: "Spot on your guess today." (no bold span).
 * Durations render via fmtHm so they match the stat row + capacity chip.
 */
export function gapMilestone(guessedMin: number, totalMin: number): MilestoneCopy {
  const delta = totalMin - guessedMin;
  if (delta === 0) {
    return { text: 'Spot on your guess today.', boldPrefix: null };
  }
  if (delta > 0) {
    const boldPrefix = `+${fmtHm(delta)} over`;
    return { text: `${boldPrefix} your guess today — that gap is what Whenbee's learning.`, boldPrefix };
  }
  const boldPrefix = `${fmtHm(-delta)} under`;
  return { text: `${boldPrefix} your guess today — nicely called.`, boldPrefix };
}
