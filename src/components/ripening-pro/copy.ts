import type { TFunction } from 'i18next';
import type { ProFeatureId } from '@/src/engine';

/**
 * Copy for the ripening state: Pro features are teased but not yet ready.
 * Tone: calm, encouraging, zero guilt. The user is doing fine; the model
 * just needs more data to be honest.
 *
 * Every string is resolved through the `patterns` namespace — nothing here is
 * hardcoded English, so a new locale is a JSON drop-in with no code change.
 */
export function RIPENING_COPY(t: TFunction<'patterns'>) {
  return {
    /** Small eyebrow badge above the card. */
    eyebrow: t('ripeningPro.ripening.eyebrow'),
    /** Prefix shown before the tier name in the pill, e.g. "Ripens at Sharpening". */
    pillPrefix: t('ripeningPro.ripening.pillPrefix'),
    /** Shown when the model is mid-calibration within this tier (RipeningBand, reveal state). */
    settling: t('ripeningPro.ripening.settling'),
    /** Ticket-strip title — the calm ownership frame, not a pitch. */
    ticketTitle: t('ripeningPro.ripening.ticketTitle'),
    /** Ticket-strip sub — states the mechanism plainly (opens, never "unlocks"). */
    ticketSub: t('ripeningPro.ripening.ticketSub'),
    /** Honey chip label. No price text — RevenueCat owns that, on the paywall. */
    chipLabel: t('ripeningPro.ripening.chipLabel'),
    /**
     * Footer under the ripening card. No imperative, no urgency.
     * Each log naturally sharpens the model; nothing for the user to "do".
     */
    footer: t('ripeningPro.ripening.footer'),
  } as const;
}

/**
 * Header title + sub for the ripening state, keyed off how many Pro features
 * are already ready out of the total shown. Pure apart from the translator it
 * is handed, so the three count bands stay exhaustively unit-testable.
 */
export function ripeningHeaderCopy(
  t: TFunction<'patterns'>,
  readyCount: number,
  total: number,
): { title: string; sub: string } {
  if (readyCount === 0) {
    return {
      title: t('ripeningPro.header.none.title'),
      sub: t('ripeningPro.header.none.sub'),
    };
  }
  if (readyCount === 1) {
    return {
      title: t('ripeningPro.header.first.title'),
      sub: t('ripeningPro.header.first.sub'),
    };
  }
  return {
    title: t('ripeningPro.header.some.title', { ready: readyCount, total }),
    sub: t('ripeningPro.header.some.sub'),
  };
}

/**
 * "{k} logs to go" — the register shared by the next-up feature's pip number
 * and status label. Plural handling belongs to the translator ({{count}}), so
 * a language with more than two plural forms needs no code change here.
 */
export function logsToGoLabel(t: TFunction<'patterns'>, remaining: number): string {
  return t('ripeningPro.logsToGo', { count: remaining });
}

/**
 * Status label for a not-yet-ready, not-next-up feature row. The two review
 * features read in a calendar register ("about a week/month") since that is
 * how the user thinks about them; every other log-gated feature reads in the
 * same "N logs to go" register as the next-up pip, just with its own count.
 */
export function waitLabelFor(
  t: TFunction<'patterns'>,
  id: ProFeatureId,
  remainingLogs: number,
): string {
  if (id === 'honest-week') return t('ripeningPro.wait.aboutAWeek');
  if (id === 'honest-month') return t('ripeningPro.wait.aboutAMonth');
  return logsToGoLabel(t, remainingLogs);
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
