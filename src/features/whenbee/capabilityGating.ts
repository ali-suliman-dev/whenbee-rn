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

// ──────────────────────────────────────────────────────────────────────────────
// CAPABILITY_STAGE_GATED — which rungs a log genuinely UNLOCKS, as opposed to
// merely sharpens (F1, 2026-08-02 audit).
//
// `src/engine/companion.ts` marks `gatesNewFeature: true` on stages 1-5, but
// tracing every one against the real gating code (2026-08-01, same pass as
// `CAPABILITY_PRO_FEATURE` above) found only ONE capability actually reads the
// companion stage anywhere in the app:
//
//   running-finish-time  NOT stage-gated — timer.tsx renders the point finish
//                        for every user from day one, at any stage.
//   today-done-time      NOT stage-gated — HonestLandingCard/HonestSuggestionCard
//                        render ungated regardless of stage.
//   start-by-anchor      NOT stage-gated — gated on Pro entitlement only
//                        (`handlePlanMyDay`/DayTimeline), never on stage.
//   honest-day-forecast  NOT stage-gated — gated on Pro entitlement only
//                        (`openDayHonest`/<ProGate>), never on stage.
//   drift-recalibration  STAGE-GATED — `DRIFT_RECHECK_MIN_STAGE = 5` in
//                        `src/features/whenbee/hubGates.ts` is a real,
//                        load-bearing stage check; nothing else in the app
//                        reads companion stage as a gate.
//   keeper-standing      NOT in this record's scope — it's a standing tied to
//                        `keeperReached`'s own quota, not the tier ladder's
//                        stage progression; `UnlockLadder` special-cases it.
//
// So a day-one user was being told "10 more logs and Done-time on Today and
// Add task" while Add task already showed a done-time — the ladder claimed
// logs unlock things they don't. The founder's call (2026-08-02): reword to
// what logs actually do (sharpen accuracy) everywhere except the one rung
// that's for real gated by stage.
// ──────────────────────────────────────────────────────────────────────────────

/** True only for the one capability a companion-stage crossing genuinely gates. */
export const CAPABILITY_STAGE_GATED: Record<CompanionCapability['id'], boolean> = {
  'running-finish-time': false,
  'today-done-time': false,
  'start-by-anchor': false,
  'honest-day-forecast': false,
  'drift-recalibration': true,
  'keeper-standing': false,
};

/** True when reaching this capability's stage is a real feature gate — the
 *  ladder should say "unlocks", not "sharpens". */
export function isCapabilityStageGated(id: CompanionCapability['id']): boolean {
  return CAPABILITY_STAGE_GATED[id];
}
