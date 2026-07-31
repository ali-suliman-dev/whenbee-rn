import type { TFunction } from 'i18next';

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
