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
  /** Shown when the model is mid-calibration within this tier (RipeningBand, reveal state). */
  settling: 'Still settling…',
  /** Ticket-strip title — the calm ownership frame, not a pitch. */
  ticketTitle: 'Own Pro from day one',
  /** Ticket-strip sub — states the mechanism plainly (opens, never "unlocks"). */
  ticketSub: "Everything here lights up the moment it's ready.",
  /** Honey chip label. No price text — RevenueCat owns that, on the paywall. */
  chipLabel: 'Get Pro',
  /**
   * Footer under the ripening card. No imperative, no urgency.
   * Each log naturally sharpens the model; nothing for the user to "do".
   */
  footer: 'No streak, no rush. Logging normally gets you there.',
} as const;

/**
 * Header title + sub for the ripening state, keyed off how many Pro features
 * are already ready out of the total shown. Pure — no store/hook access —
 * so the three count bands are exhaustively unit-tested.
 */
export function ripeningHeaderCopy(
  readyCount: number,
  total: number,
): { title: string; sub: string } {
  if (readyCount === 0) {
    return {
      title: 'Your Pro features are on the way.',
      sub: 'Each one opens once your logs can back it up.',
    };
  }
  if (readyCount === 1) {
    return {
      title: 'Your first Pro feature is ready.',
      sub: 'The rest open as you log more tasks.',
    };
  }
  return {
    title: `${readyCount} of ${total} Pro features are ready.`,
    sub: 'The rest open as you log more tasks.',
  };
}

/**
 * "{k} logs to go" — the register shared by the next-up feature's pip number
 * and status label. Singular-aware so "1 log to go" never reads as a typo.
 */
export function logsToGoLabel(remaining: number): string {
  return `${remaining} log${remaining === 1 ? '' : 's'} to go`;
}

/**
 * Status label for a not-yet-ready, not-next-up feature row. The two review
 * features read in a calendar register ("about a week/month") since that is
 * how the user thinks about them; every other log-gated feature reads in the
 * same "N logs to go" register as the next-up pip, just with its own count.
 */
export function waitLabelFor(id: ProFeatureId, remainingLogs: number): string {
  if (id === 'honest-week') return 'about a week';
  if (id === 'honest-month') return 'about a month';
  return logsToGoLabel(remainingLogs);
}

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
