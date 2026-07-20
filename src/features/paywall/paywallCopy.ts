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

const EYEBROW = 'WHENBEE PRO';
const HONEST_TITLE = 'Your numbers are real now.';

interface TriggerCopy {
  title: string;
  sub: string;
}

const MAP: Record<Trigger, TriggerCopy> = {
  make_day_honest: {
    title: 'Your real day, before you live it.',
    sub: 'You did the logging — Whenbee knows how your days actually run. Pro carries those real numbers into everything you plan.',
  },
  calendar_export: {
    title: 'Your real day, before you live it.',
    sub: 'You did the logging — Whenbee knows how your days actually run. Pro carries those real numbers into everything you plan.',
  },
  day_capacity: {
    title: 'Know what the day can hold.',
    sub: 'Before you say yes to one more thing, see whether it actually fits your real hours.',
  },
  goals: {
    title: 'You set the aim. Now get a coach.',
    sub: 'Pick an accuracy goal for any category. Whenbee coaches you at guess-time and shows your ETA to hitting it.',
  },
  routines: {
    title: 'Set it once. It remembers the honest length.',
    sub: 'Your morning routine takes 50 minutes, not 20. Pro learns the whole chain and tells you when to actually start.',
  },
  steals_your_time: {
    title: 'See exactly what steals your time.',
    sub: "Your logs already hold the pattern — when you slip, what context costs you, and the hours you're sharpest. Pro reads it back.",
  },
  focus_window: {
    title: 'Plan around your sharpest hours.',
    sub: 'Whenbee learns when your estimates land tight and when they slip — so you can put the hard work where it fits.',
  },
  honest_range: {
    title: 'How sure is that number?',
    sub: 'Pro shows the confidence band around your honest estimate — and watches it narrow as you calibrate.',
  },
  review_ritual: {
    title: 'See exactly what steals your time.',
    sub: "Your logs already hold the pattern — when you slip, what context costs you, and the hours you're sharpest. Pro reads it back.",
  },
  pdf_export: {
    title: 'Hand someone your honest numbers.',
    sub: 'A clean weekly or monthly report — made on your phone, shared only when you choose.',
  },
  hyperfocus_guard: {
    title: 'Whenbee stays with you while you work.',
    sub: "Your live timer and honest finish-time on the lock screen, plus a gentle nudge when you've run well past your guess.",
  },
  persistent_presence: {
    title: 'Whenbee stays with you while you work.',
    sub: "Your live timer and honest finish-time on the lock screen, plus a gentle nudge when you've run well past your guess.",
  },
  settings_upgrade: {
    title: 'Everything your honest numbers can do.',
    sub: 'You did the logging. Pro puts those real numbers to work everywhere you plan.',
  },
  pro_reveal: {
    title: 'Everything your honest numbers can do.',
    sub: 'You did the logging. Pro puts those real numbers to work everywhere you plan.',
  },
  pro_preview: {
    title: 'Everything your honest numbers can do.',
    sub: 'You did the logging. Pro puts those real numbers to work everywhere you plan.',
  },
};

/**
 * The free-tier promise. Rendered as an emphasised sentence right after the sub
 * (Paywall.tsx) rather than baked into all 15 trigger subs — and deliberately at
 * the TOP, not in the footer: "am I losing what I already have?" is the doubt
 * that forms in the first seconds, so answering it under the CTA answers it too
 * late.
 */
export const FREE_PROMISE = 'Calibration stays free, always.';

const HONEST_SUB =
  'You did the logging — Whenbee knows how your days actually run. Now let Pro put those real numbers to work everywhere you plan.';

export function copyFor(
  trigger: Trigger,
  readiness: 'pre' | 'honest',
): { eyebrow: string; title: string; sub: string } {
  const base = MAP[trigger];
  if (readiness === 'honest') {
    return { eyebrow: EYEBROW, title: HONEST_TITLE, sub: HONEST_SUB };
  }
  return { eyebrow: EYEBROW, title: base.title, sub: base.sub };
}
