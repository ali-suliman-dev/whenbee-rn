import type { TFunction } from 'i18next';
import i18n from './index';

// ──────────────────────────────────────────────────────────────────────────────
// Time-of-day bucket values are STABLE IDS, not copy.
//
// `calibrationStore.timeOfDayBucket` and the engine's `peakBucketLabel` both emit
// a fixed set of bucket values that end up persisted in context-correlation rows.
// They read like English words ('mornings'), but they are identifiers — never
// show one to a user directly. Run it through here first.
//
// Context correlations also cover dimensions the app doesn't own (freeform reason
// tags), so an unknown value falls back to itself rather than rendering a raw key.
// ──────────────────────────────────────────────────────────────────────────────

const KNOWN = ['mornings', 'midday', 'afternoons', 'evenings', 'late nights'] as const;

const KEY_FOR = {
  mornings: 'buckets.mornings',
  midday: 'buckets.midday',
  afternoons: 'buckets.afternoons',
  evenings: 'buckets.evenings',
  'late nights': 'buckets.lateNights',
} as const;

/** Display label for a time-of-day bucket id, in the active language. */
export function bucketLabel(t: TFunction<'patterns'>, value: string): string {
  const key = (KEY_FOR as Record<string, (typeof KEY_FOR)[keyof typeof KEY_FOR] | undefined>)[
    value.toLowerCase()
  ];
  return key === undefined ? value : t(key);
}

/** True when a value is one of the app's own time-of-day buckets. */
export function isBucket(value: string): boolean {
  return (KNOWN as readonly string[]).includes(value.toLowerCase());
}

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/**
 * Display label for an accuracy-correlation label. `AccuracyCorrelation.betterLabel`
 * / `worseLabel` carry either a time-of-day bucket id ('mornings') or an English
 * weekday name ('Monday') straight out of the pure engine — both are IDS, and
 * dropping one into a sentence renders English inside a Swedish screen. Anything
 * unrecognised falls back to itself.
 */
export function accuracyLabel(value: string): string {
  const lower = value.toLowerCase();
  if (isBucket(lower)) {
    return i18n.t(
      `patterns:${(KEY_FOR as Record<string, string>)[lower] ?? 'buckets.mornings'}` as never,
    );
  }
  if ((WEEKDAYS as readonly string[]).includes(lower)) {
    return i18n.t(`shared:weekdays.${lower}` as never);
  }
  return value;
}

// Over-run reason slugs (see ContextQuestions OVER_SPECS) are ids too: the engine
// counts them and names the dominant one, the UI says it out loud. Reasons are
// user-taggable, so an unknown slug renders the kind catch-all phrase rather than
// a raw key.
const REASON_KEY_FOR: Record<string, string> = {
  context_switch: 'shared:reasons.contextSwitch',
  interrupted: 'shared:reasons.interrupted',
  underestimated: 'shared:reasons.underestimated',
};

/** Blame-free phrase for an over-run reason slug, in the active language. */
export function reasonPhrase(reason: string): string {
  return i18n.t((REASON_KEY_FOR[reason] ?? 'shared:reasons.fallback') as never);
}
