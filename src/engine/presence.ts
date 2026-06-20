// Pure presentation helper for the persistent-presence surfaces (widget +
// Live Activity ring). No calibration math here — this only turns the three
// epochs in the App-Group snapshot into a [0,1] arc fraction. The SAME formula
// is mirrored in targets/widget/SharedStore.swift (`arcFraction`) so the static
// widget arc and the live ring agree. Keep the two in sync.

/**
 * Fraction of the way from `updatedAtEpoch` to `honestFinishEpoch` at `nowSec`.
 * Clamped to [0,1]. Returns 1 for a degenerate/zero or negative span so the ring
 * never divides by zero and never reads as "less than done" once finished.
 */
export function arcFraction(
  updatedAtEpoch: number,
  honestFinishEpoch: number,
  nowSec: number,
): number {
  const span = honestFinishEpoch - updatedAtEpoch;
  if (span < 0) return 0; // finish before start → show nothing
  if (span === 0) return 1; // degenerate → treat as complete (no divide-by-zero)
  const elapsed = nowSec - updatedAtEpoch;
  if (elapsed <= 0) return 0;
  if (elapsed >= span) return 1;
  return elapsed / span;
}
