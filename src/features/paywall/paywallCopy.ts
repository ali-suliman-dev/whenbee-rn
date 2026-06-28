// ──────────────────────────────────────────────────────────────────────────────
// paywallCopy — the adaptive top map. Pure data + pure functions (no React/RN).
// The paywall arrives from ~15 different gates; the eyebrow/title/sub + which proof
// visual shows + which bundle row leads all key off the `trigger`, so the pitch is
// always relevant to what the user tapped — never a generic calendar pitch for a
// goals gate. The 5-row bundle stack itself is fixed (STACK_ROWS); only its lead
// row floats. No guilt language, no fabricated proof.
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

export type ProofKind = 'calendar' | 'coach' | 'insight' | 'none';
export type StackKey = 'calendar' | 'coach' | 'insight' | 'review' | 'presence';

const TRIGGERS: readonly Trigger[] = [
  'make_day_honest', 'settings_upgrade', 'steals_your_time', 'pro_reveal', 'pro_preview',
  'goals', 'focus_window', 'hyperfocus_guard', 'pdf_export', 'routines', 'review_ritual',
  'calendar_export', 'persistent_presence', 'day_capacity', 'honest_range',
];

export function isTrigger(v: unknown): v is Trigger {
  return typeof v === 'string' && (TRIGGERS as readonly string[]).includes(v);
}

/** Ionicons name kept out of UI; ValueStack maps key → icon. */
export interface StackRow {
  key: StackKey;
  title: string;
  desc: string;
}

// Fixed bundle — five grouped rows covering all of Pro. Default order; the lead row floats up.
export const STACK_ROWS: readonly StackRow[] = [
  {
    key: 'calendar',
    title: 'Honest calendar & capacity',
    desc: 'Every event padded with your real buffers. See what the day can actually hold — and plan around your sharpest hours.',
  },
  {
    key: 'coach',
    title: 'Routines & goal coach',
    desc: 'Recurring chains learn their honest length. Set an accuracy aim per category and get help at guess-time, with an ETA to your goal.',
  },
  {
    key: 'insight',
    title: 'Sharper self-insight',
    desc: "What steals your time, when you're most accurate, and what context costs you — the patterns your logs already hold.",
  },
  {
    key: 'review',
    title: 'Your week, reviewed',
    desc: 'A calm weekly & monthly recap, long-range history, and a clean PDF or one-tap share — made on your phone, never sent without you.',
  },
  {
    key: 'presence',
    title: 'Always there',
    desc: "Live timer and finish-time on your lock screen, plus a gentle nudge when you've run well past your guess.",
  },
] as const;

const EYEBROW = 'WHENBEE PRO';
const HONEST_TITLE = 'Your numbers are real now.';

interface TriggerCopy {
  title: string;
  sub: string;
  proof: ProofKind;
  lead: StackKey;
}

const MAP: Record<Trigger, TriggerCopy> = {
  make_day_honest: {
    title: 'Your real day, before you live it.',
    sub: 'You did the logging — Whenbee knows how your days actually run. Pro carries those real numbers into everything you plan.',
    proof: 'calendar', lead: 'calendar',
  },
  calendar_export: {
    title: 'Your real day, before you live it.',
    sub: 'You did the logging — Whenbee knows how your days actually run. Pro carries those real numbers into everything you plan.',
    proof: 'calendar', lead: 'calendar',
  },
  day_capacity: {
    title: 'Know what the day can hold.',
    sub: 'Before you say yes to one more thing, see whether it actually fits your real hours.',
    proof: 'calendar', lead: 'calendar',
  },
  goals: {
    title: 'You set the aim. Now get a coach.',
    sub: 'Pick an accuracy goal for any category. Whenbee coaches you at guess-time and shows your ETA to hitting it.',
    proof: 'coach', lead: 'coach',
  },
  routines: {
    title: 'Set it once. It remembers the honest length.',
    sub: 'Your morning routine takes 50 minutes, not 20. Pro learns the whole chain and tells you when to actually start.',
    proof: 'coach', lead: 'coach',
  },
  steals_your_time: {
    title: 'See exactly what steals your time.',
    sub: "Your logs already hold the pattern — when you slip, what context costs you, and the hours you're sharpest. Pro reads it back.",
    proof: 'insight', lead: 'insight',
  },
  focus_window: {
    title: 'Plan around your sharpest hours.',
    sub: 'Whenbee learns when your estimates land tight and when they slip — so you can put the hard work where it fits.',
    proof: 'insight', lead: 'insight',
  },
  honest_range: {
    title: 'How sure is that number?',
    sub: 'Pro shows the confidence band around your honest estimate — and watches it narrow as you calibrate.',
    proof: 'insight', lead: 'insight',
  },
  review_ritual: {
    title: 'See exactly what steals your time.',
    sub: "Your logs already hold the pattern — when you slip, what context costs you, and the hours you're sharpest. Pro reads it back.",
    proof: 'insight', lead: 'review',
  },
  pdf_export: {
    title: 'Hand someone your honest numbers.',
    sub: 'A clean weekly or monthly report — made on your phone, shared only when you choose.',
    proof: 'none', lead: 'review',
  },
  hyperfocus_guard: {
    title: 'Whenbee stays with you while you work.',
    sub: "Your live timer and honest finish-time on the lock screen, plus a gentle nudge when you've run well past your guess.",
    proof: 'none', lead: 'presence',
  },
  persistent_presence: {
    title: 'Whenbee stays with you while you work.',
    sub: "Your live timer and honest finish-time on the lock screen, plus a gentle nudge when you've run well past your guess.",
    proof: 'none', lead: 'presence',
  },
  settings_upgrade: {
    title: 'Everything your honest numbers can do.',
    sub: 'You did the logging. Pro puts those real numbers to work everywhere you plan.',
    proof: 'calendar', lead: 'calendar',
  },
  pro_reveal: {
    title: 'Everything your honest numbers can do.',
    sub: 'You did the logging. Pro puts those real numbers to work everywhere you plan.',
    proof: 'calendar', lead: 'calendar',
  },
  pro_preview: {
    title: 'Everything your honest numbers can do.',
    sub: 'You did the logging. Pro puts those real numbers to work everywhere you plan.',
    proof: 'calendar', lead: 'calendar',
  },
};

const HONEST_SUB =
  'You did the logging — Whenbee knows how your days actually run. Now let Pro put those real numbers to work everywhere you plan.';

export function copyFor(
  trigger: Trigger,
  readiness: 'pre' | 'honest',
): { eyebrow: string; title: string; sub: string; proof: ProofKind; lead: StackKey } {
  const base = MAP[trigger];
  if (readiness === 'honest') {
    return { eyebrow: EYEBROW, title: HONEST_TITLE, sub: HONEST_SUB, proof: base.proof, lead: base.lead };
  }
  return { eyebrow: EYEBROW, title: base.title, sub: base.sub, proof: base.proof, lead: base.lead };
}
