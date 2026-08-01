import type { TFunction } from 'i18next';

// ──────────────────────────────────────────────────────────────────────────────
// paywallCopy — the adaptive top map. Pure data + pure functions (no React/RN).
// The paywall arrives from ~15 different gates; the eyebrow/title/sub key off the
// `trigger`, so the pitch is always relevant to what the user tapped. The feature
// section below the header is fixed (proFeatures.ts) — only the headline adapts.
// No guilt language, no fabricated proof.
// ──────────────────────────────────────────────────────────────────────────────

export type Trigger =
  | 'make_day_honest'
  | 'settings_upgrade'
  | 'steals_your_time'
  | 'pro_reveal'
  | 'pro_preview'
  | 'goals'
  | 'focus_window'
  | 'hyperfocus_guard'
  | 'pdf_export'
  | 'routines'
  | 'review_ritual'
  | 'calendar_export'
  | 'persistent_presence'
  | 'day_capacity'
  | 'honest_range';

const TRIGGERS: readonly Trigger[] = [
  'make_day_honest', 'settings_upgrade', 'steals_your_time', 'pro_reveal', 'pro_preview',
  'goals', 'focus_window', 'hyperfocus_guard', 'pdf_export', 'routines', 'review_ritual',
  'calendar_export', 'persistent_presence', 'day_capacity', 'honest_range',
];

export function isTrigger(v: unknown): v is Trigger {
  return typeof v === 'string' && (TRIGGERS as readonly string[]).includes(v);
}

/** Snake-case trigger → the `triggers.*` key that carries its copy. */
const TRIGGER_KEYS = {
  make_day_honest: 'makeDayHonest',
  calendar_export: 'calendarExport',
  day_capacity: 'dayCapacity',
  goals: 'goals',
  routines: 'routines',
  steals_your_time: 'stealsYourTime',
  focus_window: 'focusWindow',
  honest_range: 'honestRange',
  review_ritual: 'reviewRitual',
  pdf_export: 'pdfExport',
  hyperfocus_guard: 'hyperfocusGuard',
  persistent_presence: 'persistentPresence',
  settings_upgrade: 'settingsUpgrade',
  pro_reveal: 'proReveal',
  pro_preview: 'proPreview',
} as const satisfies Record<Trigger, string>;

/**
 * The free-tier promise. Rendered as an emphasised sentence right after the sub
 * (Paywall.tsx) rather than baked into all 15 trigger subs — and deliberately at
 * the TOP, not in the footer: "am I losing what I already have?" is the doubt
 * that forms in the first seconds, so answering it under the CTA answers it too
 * late.
 */
export function freePromise(t: TFunction<'paywall'>): string {
  return t('plans.freeStripBold');
}

export function copyFor(
  t: TFunction<'paywall'>,
  trigger: Trigger,
  readiness: 'pre' | 'honest',
): { eyebrow: string; title: string; sub: string } {
  const eyebrow = t('eyebrow');
  if (readiness === 'honest') {
    return { eyebrow, title: t('honest.title'), sub: t('honest.sub') };
  }
  const key = TRIGGER_KEYS[trigger];
  return { eyebrow, title: t(`triggers.${key}.title`), sub: t(`triggers.${key}.sub`) };
}
