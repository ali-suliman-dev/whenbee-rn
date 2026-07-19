// ──────────────────────────────────────────────────────────────────────────────
// proFeatures — the single registry of everything in the Pro bundle. Both paywall
// feature-section variants (DayWithPro / FeatureGroups) render from this list, so
// the 12 features can never drift between layouts. Pure data, no React.
// Spec: docs/product/specs/2026-07-19-paywall-redesign.md §3.0
// ──────────────────────────────────────────────────────────────────────────────

export type ProFeatureKey =
  | 'calendar'
  | 'capacity'
  | 'focusWindows'
  | 'routines'
  | 'goalCoach'
  | 'confidenceBand'
  | 'stealsTime'
  | 'weeklyReview'
  | 'pdfExport'
  | 'history'
  | 'presence'
  | 'hyperfocusGuard';

/** H3 grouping: what the feature does for you. */
export type ProFeatureGroup = 'plan' | 'run' | 'learn';

/** G5 grouping: the moment of day the feature helps. */
export type ProFeatureMoment = 'morning' | 'deepwork' | 'midday' | 'evening' | 'week';

export interface ProFeature {
  key: ProFeatureKey;
  label: string;
  group: ProFeatureGroup;
  moment: ProFeatureMoment;
  /** Ionicons glyph name; kept as a string so this module stays UI-free. */
  icon: string;
}

export const PRO_FEATURES: readonly ProFeature[] = [
  { key: 'calendar', label: 'Honest calendar', group: 'plan', moment: 'evening', icon: 'calendar-outline' },
  { key: 'capacity', label: 'Day capacity', group: 'plan', moment: 'midday', icon: 'battery-half-outline' },
  { key: 'focusWindows', label: 'Focus windows', group: 'plan', moment: 'deepwork', icon: 'sunny-outline' },
  { key: 'confidenceBand', label: 'Confidence band', group: 'plan', moment: 'midday', icon: 'pulse-outline' },
  { key: 'routines', label: 'Routines', group: 'run', moment: 'morning', icon: 'repeat-outline' },
  { key: 'goalCoach', label: 'Goal coach', group: 'run', moment: 'morning', icon: 'flag-outline' },
  { key: 'presence', label: 'Lock-screen timer', group: 'run', moment: 'deepwork', icon: 'notifications-outline' },
  { key: 'hyperfocusGuard', label: 'Hyperfocus guard', group: 'run', moment: 'deepwork', icon: 'shield-outline' },
  { key: 'stealsTime', label: 'What steals your time', group: 'learn', moment: 'week', icon: 'hourglass-outline' },
  { key: 'weeklyReview', label: 'Weekly review', group: 'learn', moment: 'week', icon: 'document-text-outline' },
  { key: 'pdfExport', label: 'PDF export', group: 'learn', moment: 'week', icon: 'share-outline' },
  { key: 'history', label: 'Full history', group: 'learn', moment: 'week', icon: 'time-outline' },
] as const;

export function featuresByGroup(group: ProFeatureGroup): ProFeature[] {
  return PRO_FEATURES.filter((f) => f.group === group);
}

export function featuresByMoment(moment: ProFeatureMoment): ProFeature[] {
  return PRO_FEATURES.filter((f) => f.moment === moment);
}
