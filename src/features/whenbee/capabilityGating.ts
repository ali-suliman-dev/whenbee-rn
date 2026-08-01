import type { CompanionCapability } from '@/src/engine';
import type { ProFeatureKey } from '@/src/features/paywall/proFeatures';

// ──────────────────────────────────────────────────────────────────────────────
// capabilityGating — which unlock-ladder rungs land behind the Pro paywall.
//
// The ladder tells a user what their logs buy. Two of the six capabilities are
// Pro features, so promising them as a logging reward would walk a free user
// into a paywall for something the app said they earned. This map is the single
// place that records which ones, so `UnlockLadder` and `NextUnlock` can be
// honest about it.
//
// The engine can't hold this: `src/engine/**` is pure and knows nothing about
// entitlements. The `ProFeatureKey` value ties each claim back to the paywall
// registry (`src/features/paywall/proFeatures.ts`) rather than a loose boolean.
//
// Traced against the real gating code (2026-08-01):
//   running-finish-time  FREE  — timer.tsx renders the point finish for everyone;
//                                only the confidence RANGE is Pro
//                                (FinishTime.tsx: `showRange = isPro && …`).
//   today-done-time      FREE  — HonestLandingCard / HonestSuggestionCard render
//                                ungated; Pro only folds calendar minutes in.
//   start-by-anchor      PRO   — Today's `handlePlanMyDay` routes a non-Pro user
//                                to the paywall, and DayTimeline returns null
//                                for `!isPro`. Paywall bundle key: 'capacity'.
//   honest-day-forecast  PRO   — `openDayHonest` sends non-Pro to the paywall and
//                                `(modals)/honest-day` is wrapped in <ProGate>;
//                                the widget's filled arc is the 'presence'
//                                feature. Bundle key: 'calendar'.
//   drift-recalibration  FREE  — hubGates gates it on companion stage + drift
//                                health only; LifeDriftCard has no entitlement read.
//   keeper-standing      FREE  — a standing, not a feature (gatesNewFeature: false).
// ──────────────────────────────────────────────────────────────────────────────

/** Paywall bundle key for a Pro-gated capability; null when the rung is free. */
export const CAPABILITY_PRO_FEATURE: Record<CompanionCapability['id'], ProFeatureKey | null> = {
  'running-finish-time': null,
  'today-done-time': null,
  'start-by-anchor': 'capacity',
  'honest-day-forecast': 'calendar',
  'drift-recalibration': null,
  'keeper-standing': null,
};

/** True when a free user hits the paywall on this capability. */
export function isCapabilityPro(id: CompanionCapability['id']): boolean {
  return CAPABILITY_PRO_FEATURE[id] !== null;
}
