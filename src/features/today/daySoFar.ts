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

/** "One honest log in." / "{n} honest logs in." */
export function countLine(completedCount: number): string {
  return completedCount === 1 ? 'One honest log in.' : `${completedCount} honest logs in.`;
}

/** "1 real minute" / "{n} real minutes" (0 and 2+ both pluralize). */
export function minutesPhrase(totalMin: number): string {
  return totalMin === 1 ? '1 real minute' : `${totalMin} real minutes`;
}

export interface MilestoneCopy {
  /** Full milestone line. */
  text: string;
  /** The leading bold span within `text` ("~{k} more logs"), or null at the top tier. */
  boldPrefix: string | null;
}

/**
 * "~{k} more logs and {category} settles in." when a next tier exists, or the
 * top-tier fallback "Every log keeps {category} sharp." when it doesn't
 * (k <= 0 — no next tier to count down to).
 */
export function milestoneText(category: string, logsToNextTier: number): MilestoneCopy {
  if (logsToNextTier <= 0) {
    return { text: `Every log keeps ${category} sharp.`, boldPrefix: null };
  }
  const boldPrefix = `~${logsToNextTier} more logs`;
  return { text: `${boldPrefix} and ${category} settles in.`, boldPrefix };
}
