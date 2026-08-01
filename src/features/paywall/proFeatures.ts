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
  /** `paywall` namespace key carrying the visible label, never English text: the
   *  registry stays pure data, so translation happens at the render site. The
   *  template-literal type keeps the key in lockstep with `key`, so i18next's
   *  typed lookup fails the build if a `features.*` entry is ever missing. */
  labelKey: `features.${ProFeatureKey}`;
  group: ProFeatureGroup;
  moment: ProFeatureMoment;
  /** Ionicons glyph name; kept as a string so this module stays UI-free. */
  icon: string;
}

export const PRO_FEATURES: readonly ProFeature[] = [
  { key: 'calendar', labelKey: 'features.calendar', group: 'plan', moment: 'evening', icon: 'calendar-outline' },
  { key: 'capacity', labelKey: 'features.capacity', group: 'plan', moment: 'midday', icon: 'battery-half-outline' },
  { key: 'focusWindows', labelKey: 'features.focusWindows', group: 'plan', moment: 'deepwork', icon: 'sunny-outline' },
  { key: 'confidenceBand', labelKey: 'features.confidenceBand', group: 'plan', moment: 'midday', icon: 'pulse-outline' },
  { key: 'routines', labelKey: 'features.routines', group: 'run', moment: 'morning', icon: 'repeat-outline' },
  { key: 'goalCoach', labelKey: 'features.goalCoach', group: 'run', moment: 'morning', icon: 'flag-outline' },
  { key: 'presence', labelKey: 'features.presence', group: 'run', moment: 'deepwork', icon: 'notifications-outline' },
  { key: 'hyperfocusGuard', labelKey: 'features.hyperfocusGuard', group: 'run', moment: 'deepwork', icon: 'shield-outline' },
  { key: 'stealsTime', labelKey: 'features.stealsTime', group: 'learn', moment: 'week', icon: 'hourglass-outline' },
  { key: 'weeklyReview', labelKey: 'features.weeklyReview', group: 'learn', moment: 'week', icon: 'document-text-outline' },
  { key: 'pdfExport', labelKey: 'features.pdfExport', group: 'learn', moment: 'week', icon: 'share-outline' },
  { key: 'history', labelKey: 'features.history', group: 'learn', moment: 'week', icon: 'time-outline' },
] as const;

export function featuresByGroup(group: ProFeatureGroup): ProFeature[] {
  return PRO_FEATURES.filter((f) => f.group === group);
}

export function featuresByMoment(moment: ProFeatureMoment): ProFeature[] {
  return PRO_FEATURES.filter((f) => f.moment === moment);
}
