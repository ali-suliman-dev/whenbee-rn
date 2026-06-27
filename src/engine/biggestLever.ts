// Goal-coach mechanic 2 — "your biggest lever". PURE TS: no React/RN, no clock.
// Runs the read-only context correlation over several dimensions and returns the
// single strongest real pattern (largest accuracy gap that clears the gates), or
// null when nothing is statistically real — we never invent a lever.
import { correlateContext, type ContextSample, type ContextCorrelation } from './context';

export interface LeverDim {
  /** Dimension key passed through for the caller to phrase (e.g. 'timeOfDay'). */
  key: string;
  /** Samples for this dimension, already reduced to { value, clamped ratio }. */
  samples: ContextSample[];
}

/**
 * The single strongest context lever across `dims`, by accuracy gap. Each
 * dimension is gated by `correlateContext` (bucket size + min gap), so a returned
 * lever is always a real pattern. Deterministic: strict `>` keeps the earlier
 * dimension on an equal gap, so callers order `dims` by priority.
 */
export function biggestLever(dims: LeverDim[]): ContextCorrelation | null {
  let best: ContextCorrelation | null = null;
  for (const dim of dims) {
    const correlation = correlateContext(dim.key, dim.samples);
    if (correlation !== null && (best === null || correlation.gap > best.gap)) {
      best = correlation;
    }
  }
  return best;
}
