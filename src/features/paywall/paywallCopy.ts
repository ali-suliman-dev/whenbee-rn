import type { TFunction } from 'i18next';

// ──────────────────────────────────────────────────────────────────────────────
// paywallCopy — the adaptive top map. Pure data + pure functions (no React/RN).
// The paywall arrives from ~15 different gates; the eyebrow/title/sub + which proof
// visual shows + which bundle row leads all key off the `trigger`, so the pitch is
// always relevant to what the user tapped — never a generic calendar pitch for a
// goals gate. The 5-row bundle stack itself is fixed (STACK_ROWS); only its lead
// row floats. No guilt language, no fabricated proof.
//
// Copy is localized: both `copyFor` and `getStackRows` are built from a `t`
// function rather than hardcoded strings, since this module has no React context
// of its own. Call sites hold a `useTranslation('paywall')` instance and pass its
// `t` through (see `quizQuestions.ts` for the same pattern in onboarding).
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

/** Fixed bundle — five grouped rows covering all of Pro. Default order; the lead row floats up. */
export function getStackRows(t: TFunction<'paywall'>): readonly StackRow[] {
  return [
    { key: 'calendar', title: t('stack.calendar.title'), desc: t('stack.calendar.desc') },
    { key: 'coach', title: t('stack.coach.title'), desc: t('stack.coach.desc') },
    { key: 'insight', title: t('stack.insight.title'), desc: t('stack.insight.desc') },
    { key: 'review', title: t('stack.review.title'), desc: t('stack.review.desc') },
    { key: 'presence', title: t('stack.presence.title'), desc: t('stack.presence.desc') },
  ] as const;
}

interface TriggerCopy {
  title: string;
  sub: string;
  proof: ProofKind;
  lead: StackKey;
}

function triggerMap(t: TFunction<'paywall'>): Record<Trigger, TriggerCopy> {
  return {
    make_day_honest: {
      title: t('triggers.makeDayHonest.title'), sub: t('triggers.makeDayHonest.sub'),
      proof: 'calendar', lead: 'calendar',
    },
    calendar_export: {
      title: t('triggers.calendarExport.title'), sub: t('triggers.calendarExport.sub'),
      proof: 'calendar', lead: 'calendar',
    },
    day_capacity: {
      title: t('triggers.dayCapacity.title'), sub: t('triggers.dayCapacity.sub'),
      proof: 'calendar', lead: 'calendar',
    },
    goals: {
      title: t('triggers.goals.title'), sub: t('triggers.goals.sub'),
      proof: 'coach', lead: 'coach',
    },
    routines: {
      title: t('triggers.routines.title'), sub: t('triggers.routines.sub'),
      proof: 'coach', lead: 'coach',
    },
    steals_your_time: {
      title: t('triggers.stealsYourTime.title'), sub: t('triggers.stealsYourTime.sub'),
      proof: 'insight', lead: 'insight',
    },
    focus_window: {
      title: t('triggers.focusWindow.title'), sub: t('triggers.focusWindow.sub'),
      proof: 'insight', lead: 'insight',
    },
    honest_range: {
      title: t('triggers.honestRange.title'), sub: t('triggers.honestRange.sub'),
      proof: 'insight', lead: 'insight',
    },
    review_ritual: {
      title: t('triggers.reviewRitual.title'), sub: t('triggers.reviewRitual.sub'),
      proof: 'insight', lead: 'review',
    },
    pdf_export: {
      title: t('triggers.pdfExport.title'), sub: t('triggers.pdfExport.sub'),
      proof: 'none', lead: 'review',
    },
    hyperfocus_guard: {
      title: t('triggers.hyperfocusGuard.title'), sub: t('triggers.hyperfocusGuard.sub'),
      proof: 'none', lead: 'presence',
    },
    persistent_presence: {
      title: t('triggers.persistentPresence.title'), sub: t('triggers.persistentPresence.sub'),
      proof: 'none', lead: 'presence',
    },
    settings_upgrade: {
      title: t('triggers.settingsUpgrade.title'), sub: t('triggers.settingsUpgrade.sub'),
      proof: 'calendar', lead: 'calendar',
    },
    pro_reveal: {
      title: t('triggers.proReveal.title'), sub: t('triggers.proReveal.sub'),
      proof: 'calendar', lead: 'calendar',
    },
    pro_preview: {
      title: t('triggers.proPreview.title'), sub: t('triggers.proPreview.sub'),
      proof: 'calendar', lead: 'calendar',
    },
  };
}

export function copyFor(
  t: TFunction<'paywall'>,
  trigger: Trigger,
  readiness: 'pre' | 'honest',
): { eyebrow: string; title: string; sub: string; proof: ProofKind; lead: StackKey } {
  const base = triggerMap(t)[trigger];
  const eyebrow = t('eyebrow');
  if (readiness === 'honest') {
    return { eyebrow, title: t('honest.title'), sub: t('honest.sub'), proof: base.proof, lead: base.lead };
  }
  return { eyebrow, title: base.title, sub: base.sub, proof: base.proof, lead: base.lead };
}
