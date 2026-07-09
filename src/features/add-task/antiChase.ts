// ──────────────────────────────────────────────────────────────────────────────
// Anti-chase — the guard against the honest number becoming a target.
//
// The honest number is a forecast, not a goal. But a user who sees "usually ~30m"
// after guessing 15 sometimes drags their OWN guess up to match it — which inflates
// the very input the model calibrates against, and the honest number chases it
// higher next time (15 → 30 → 60 …). This detects that one move — raising the guess
// TO or PAST the honest number right after it appears — so the screen can offer a
// single, calm, once-ever nudge back to guessing what it actually feels like.
//
// Pure + framework-free so it's cheaply unit-testable. Persistence (the once-ever
// flag) and wiring live in the hook that calls this.
// ──────────────────────────────────────────────────────────────────────────────

export interface AntiChaseInput {
  /** The guess value before this change. */
  prevGuess: number;
  /** The guess value after this change. */
  nextGuess: number;
  /** The honest number currently shown for the category + guess. */
  honestMinutes: number;
  /** Whether the coach has already been shown once (persisted). */
  seen: boolean;
}

/**
 * True when the user just RAISED their guess to or past the honest number and
 * hasn't been coached before. Lowering the guess, nudging it up but still below
 * the honest number, or a guess that was already shown the coach → false.
 */
export function shouldShowAntiChase({
  prevGuess,
  nextGuess,
  honestMinutes,
  seen,
}: AntiChaseInput): boolean {
  if (seen) return false;
  if (nextGuess <= prevGuess) return false;
  return nextGuess >= honestMinutes;
}
