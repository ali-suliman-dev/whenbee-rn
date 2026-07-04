import type { TFunction } from 'i18next';
import type { ProFeatureId } from '@/src/engine';

/**
 * Copy for the ripening state: Pro features are teased but not yet ready.
 * Tone: calm, encouraging, zero guilt. The user is doing fine; the model
 * just needs more data to be honest.
 */
export function RIPENING_COPY(t: TFunction<'patterns'>) {
  return {
    /** Small eyebrow badge above the card. */
    eyebrow: t('ripeningPro.ripening.eyebrow'),
    /** Prefix shown before the tier name in the pill, e.g. "Ripens at Sharpening". */
    pillPrefix: t('ripeningPro.ripening.pillPrefix'),
    /** Card headline. */
    title: t('ripeningPro.ripening.title'),
    /** One-line description of what the feature does once ready. */
    sub: t('ripeningPro.ripening.sub'),
    /** Shown when the model is mid-calibration within this tier. */
    settling: t('ripeningPro.ripening.settling'),
    /**
     * Footer under the ripening card. No imperative, no urgency.
     * Each log naturally sharpens the model; nothing for the user to "do".
     */
    footer: t('ripeningPro.ripening.footer'),
  } as const;
}

/**
 * Copy for the reveal state: calibration has crossed the threshold and
 * Pro features now have enough data to be genuinely useful.
 * Tone: warm payoff, soft CTA — not hype, not pressure.
 */
export function REVEAL_COPY(t: TFunction<'patterns'>) {
  return {
    /** Small eyebrow badge. */
    eyebrow: t('ripeningPro.reveal.eyebrow'),
    /** Pill label replacing the ripening tier name. */
    pill: t('ripeningPro.reveal.pill'),
    /** Main headline. Specific about what changed — not vague celebration. */
    headline: t('ripeningPro.reveal.headline'),
    /** Sub-copy. Explains the payoff without overselling. */
    sub: t('ripeningPro.reveal.sub'),
    /** Primary CTA. Warm, not pushy. */
    cta: t('ripeningPro.reveal.cta'),
    /** Escape hatch for users who want to look before committing. */
    escape: t('ripeningPro.reveal.escape'),
  } as const;
}

/**
 * Short, specific labels for each Pro feature.
 * Used in ripening previews, reveal lists, and paywall callouts.
 * Deliberately brief — context lives in the feature screen itself.
 */
const FEATURE_LABEL_KEYS = {
  'confidence-band': 'ripeningPro.featureLabel.confidenceBand',
  'steals-your-time': 'ripeningPro.featureLabel.stealsYourTime',
  'accuracy-correlations': 'ripeningPro.featureLabel.accuracyCorrelations',
  'context-correlations': 'ripeningPro.featureLabel.contextCorrelations',
  'day-capacity': 'ripeningPro.featureLabel.dayCapacity',
  'honest-week': 'ripeningPro.featureLabel.honestWeek',
  'honest-month': 'ripeningPro.featureLabel.honestMonth',
} as const satisfies Record<ProFeatureId, string>;

/** Returns the short display label for a given Pro feature. */
export function featureLabel(t: TFunction<'patterns'>, id: ProFeatureId): string {
  return t(FEATURE_LABEL_KEYS[id]);
}
