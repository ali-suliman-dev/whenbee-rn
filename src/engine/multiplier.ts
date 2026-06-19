import { BLEND_PSEUDO_COUNT, PERSONAL_MIN_LOGS, RECURRING_MIN_LOGS } from './constants';
import { affineHonestExact, type AffineFit } from './affine';
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

interface SourceFit {
  fit: AffineFit;
  n: number;
}

interface ResolveInput {
  guessMinutes: number;
  category: SourceFit;
  recurring: SourceFit | null;
}

/**
 * Resolution + fallback: a recurring task with ≥3 of its own logs uses its own
 * fit; otherwise it inherits the category's fit. `multiplier` is the EFFECTIVE
 * multiplier at this guess (honest/guess) so every existing "×M" display keeps
 * working under the affine model.
 */
export const resolveSuggestion = ({ guessMinutes, category, recurring }: ResolveInput): CalibrationSummary => {
  const useRecurring = recurring !== null && recurringHasEnoughData(recurring.n);
  const source = useRecurring ? recurring : category;

  const exact = affineHonestExact(source.fit, guessMinutes);
  const honestMinutes = roundHonest(exact);
  const multiplier = guessMinutes > 0 ? exact / guessMinutes : source.fit.b;
  const basis = source.n >= PERSONAL_MIN_LOGS ? 'personal' : 'prior';
  const label =
    basis === 'personal' ? `based on your last ${source.n} times` : 'based on typical patterns';

  return { multiplier, honestMinutes, guessMinutes, basis, label, sampleSize: source.n };
};
