import type { ProFeatureId } from '@/src/engine';

/**
 * Copy for the ripening state: Pro features are teased but not yet ready.
 * Tone: calm, encouraging, zero guilt. The user is doing fine; the model
 * just needs more data to be honest.
 */
export const RIPENING_COPY = {
  /** Small eyebrow badge above the card. */
  eyebrow: 'Pro · ripening',
  /** Prefix shown before the tier name in the pill, e.g. "Ripens at Sharpening". */
  pillPrefix: 'Ripens at',
  /** Card headline. */
  title: 'Your honest range',
  /** One-line description of what the feature does once ready. */
  sub: 'The range Whenbee will show you — once it has seen enough of your timing to mean something.',
  /** Shown when the model is mid-calibration within this tier. */
  settling: 'Still settling…',
  /**
   * Footer under the ripening card. No imperative, no urgency.
   * Each log naturally sharpens the model; nothing for the user to "do".
   */
  footer: 'Each task you log quietly sharpens the range. Nothing to keep up with.',
} as const;

/**
 * Copy for the reveal state: calibration has crossed the threshold and
 * Pro features now have enough data to be genuinely useful.
 * Tone: warm payoff, soft CTA — not hype, not pressure.
 */
export const REVEAL_COPY = {
  /** Small eyebrow badge. */
  eyebrow: 'Pro · ready',
  /** Pill label replacing the ripening tier name. */
  pill: 'Ready',
  /** Main headline. Specific about what changed — not vague celebration. */
  headline: 'Your range just got honest.',
  /** Sub-copy. Explains the payoff without overselling. */
  sub: "Whenbee has seen enough of your timing. The Pro features below now have real data to work with — not guesses.",
  /** Primary CTA. Warm, not pushy. */
  cta: 'See what Pro adds',
  /** Escape hatch for users who want to look before committing. */
  escape: 'Take a quick look first',
} as const;

/**
 * Short, specific labels for each Pro feature.
 * Used in ripening previews, reveal lists, and paywall callouts.
 * Deliberately brief — context lives in the feature screen itself.
 */
const FEATURE_LABELS: Record<ProFeatureId, string> = {
  'confidence-band': 'Honest range',
  'steals-your-time': 'What steals your time',
  'accuracy-correlations': 'When you are sharpest',
  'context-correlations': 'What shifts your accuracy',
  'day-capacity': 'Day capacity check',
  'honest-week': 'Honest week review',
  'honest-month': 'Honest month review',
};

/** Returns the short display label for a given Pro feature. */
export function featureLabel(id: ProFeatureId): string {
  return FEATURE_LABELS[id];
}
