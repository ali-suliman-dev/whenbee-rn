import { BLEND_PSEUDO_COUNT, PERSONAL_MIN_LOGS, RECURRING_MIN_LOGS } from './constants';
import { affineHonestExact, type AffineFit } from './affine';
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

/** round_to_5, floored at 5 so a suggestion is never zero. */
export const roundHonest = (exactMinutes: number): number =>
  Math.max(5, Math.round(exactMinutes / 5) * 5);

/** True when a recurring task has earned its own fit. */
export const recurringHasEnoughData = (recurringN: number): boolean => recurringN >= RECURRING_MIN_LOGS;

/** A resolution source — the category or a recurring rolling stat. The affine
 *  `fit` is the point source; `clampedRatios` is its recent window (newest-last),
 *  which (with a `prior`) lets the resolver also compute confidence + honest range. */
interface SourceFit {
  fit: AffineFit;
  n: number;
  /** Recent clamped ratios (newest-last). Omit to skip range/confidence. */
  clampedRatios?: number[];
}

interface ResolveInput {
  guessMinutes: number;
  category: SourceFit;
  recurring: SourceFit | null;
  /** Category prior multiplier. Required to populate the range; omit to skip it. */
  prior?: number;
}

/**
 * Resolution + fallback: a recurring task with ≥3 of its own logs uses its own
 * fit; otherwise it inherits the category's fit. `multiplier` is the EFFECTIVE
 * multiplier at this guess (honest/guess) so every existing "×M" display keeps
 * working under the affine model.
 *
 * When the chosen source carries its `clampedRatios` window and a `prior` is
 * supplied, the summary also gets the Earned-Readiness `confidence` and the
 * honest `range` (P25–P75 band), so any decision-moment surface can show them.
 */
export function resolveSuggestion({ guessMinutes, category, recurring, prior }: ResolveInput): CalibrationSummary {
  const useRecurring = recurring !== null && recurringHasEnoughData(recurring.n);
  const source = useRecurring ? recurring : category;

  const exact = affineHonestExact(source.fit, guessMinutes);
  const honestMinutes = roundHonest(exact);
  const multiplier = guessMinutes > 0 ? exact / guessMinutes : source.fit.b;
  const basis = source.n >= PERSONAL_MIN_LOGS ? 'personal' : 'prior';
  const label =
    basis === 'personal' ? `based on your last ${source.n} times` : 'based on typical patterns';

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
