import { BLEND_PSEUDO_COUNT, PERSONAL_MIN_LOGS, RECURRING_MIN_LOGS } from './constants';
import { confidenceFor, honestRangeFor } from './confidence';
import type { CalibrationSummary } from '../domain/types';

/**
 * M_effective = exp( (n·logEwma + k·ln(prior)) / (n + k) ).
 * n=0  → M = prior (smart on day 1). Personal data dominates after ~6–8 logs.
 */
export function blendWithPrior(n: number, logEwma: number, prior: number): number {
  const k = BLEND_PSEUDO_COUNT;
  const blendedLog = (n * logEwma + k * Math.log(prior)) / (n + k);
  return Math.exp(blendedLog);
}

/** honest = round_to_5(guess × M). Always ≥ 5 so the suggestion is never zero. */
export function honestNumber(guessMinutes: number, multiplier: number): number {
  const padded = guessMinutes * multiplier;
  return Math.max(5, Math.round(padded / 5) * 5);
}

/** True when a recurring task has earned its own multiplier. */
export function recurringHasEnoughData(recurringN: number): boolean {
  return recurringN >= RECURRING_MIN_LOGS;
}

/** A resolution source — the category or a recurring rolling stat. `clampedRatios`
 *  is its recent window (newest-last); when present, the resolver computes the
 *  confidence + honest range from it. */
interface ResolveSource {
  mEffective: number;
  n: number;
  /** Recent clamped ratios (newest-last). Omit to skip range/confidence. */
  clampedRatios?: number[];
}

interface ResolveInput {
  guessMinutes: number;
  category: ResolveSource;
  recurring: ResolveSource | null;
  /** Category prior multiplier. Required to populate the range; omit to skip it. */
  prior?: number;
}

/**
 * Resolution + fallback: a recurring task with ≥3 of its own logs uses its own M;
 * otherwise it inherits the category's M. Label/basis follow the n that was used.
 *
 * When the chosen source carries its `clampedRatios` window and a `prior` is
 * supplied, the summary also gets the Earned-Readiness `confidence` and the
 * honest `range` (P25–P75 band), so any decision-moment surface can show them.
 */
export function resolveSuggestion({ guessMinutes, category, recurring, prior }: ResolveInput): CalibrationSummary {
  const useRecurring = recurring !== null && recurringHasEnoughData(recurring.n);
  const source = useRecurring ? recurring : category;

  const multiplier = source.mEffective;
  const basis = source.n >= PERSONAL_MIN_LOGS ? 'personal' : 'prior';
  const label =
    basis === 'personal' ? `based on your last ${source.n} times` : 'based on typical patterns';
  const honestMinutes = honestNumber(guessMinutes, multiplier);

  const summary: CalibrationSummary = {
    multiplier,
    honestMinutes,
    guessMinutes,
    basis,
    label,
    sampleSize: source.n,
  };

  // Populate the band only when the caller passed the ratio window + prior; the
  // engine math is cheap and on-device, so it is never gated here (§9 — gating is
  // a render decision). Callers without the window keep the bare point summary.
  if (source.clampedRatios !== undefined && prior !== undefined) {
    const clampedRatios = source.clampedRatios;
    summary.confidence = confidenceFor({ n: source.n, clampedRatios });
    summary.range = honestRangeFor({ honestMinutes, guessMinutes, clampedRatios, prior });
  }

  return summary;
}
