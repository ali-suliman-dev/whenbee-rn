// Goal-coach mechanic 4 — post-log feedback. PURE TS: no React/RN, no clock.
// A self-relative, never-negative verdict on the latest log vs the recent window.
// Worst case is "typical", never "behind" — honors the no-guilt invariant.

export type PostLogQuality = 'tightest_week' | 'tighter_than_usual' | 'typical';

export interface PostLogInput {
  /** This log's error (0..1), e.g. min(1, |1 − 1/ratio|) — lower is tighter. */
  thisError: number;
  /** Recent-window errors (e.g. last 7 days), excluding this log. */
  recentErrors: number[];
}

/** Compare this log to the recent window. Only ever neutral-or-better. */
export function postLogQuality({ thisError, recentErrors }: PostLogInput): PostLogQuality {
  if (recentErrors.length === 0) return 'typical';
  const min = Math.min(...recentErrors);
  if (thisError <= min) return 'tightest_week';
  const mean = recentErrors.reduce((sum, e) => sum + e, 0) / recentErrors.length;
  if (thisError < mean) return 'tighter_than_usual';
  return 'typical';
}
