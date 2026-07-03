// ──────────────────────────────────────────────────────────────────────────────
// widgetData — generic keyed widget-write bridge. A thin wrapper over the same
// `getNativePresence()` resolver liveActivity.ts uses (writeWidgetData /
// clearWidgetData were added to NativePresenceModule for exactly this: each
// widget owns its own keyed slice instead of the single "snapshot" shape).
// Guarded + best-effort like every other presence call — a widget write must
// never throw into the caller (the guess → timer → learn loop keeps going).
// ──────────────────────────────────────────────────────────────────────────────

import { getNativePresence } from '@/src/services/liveActivity';

/**
 * "Does Today Fit?" widget payload — Pro. Mapped 1:1 from the engine's
 * `DayLoadResult` (see `src/engine/honestDayLoad.ts`), never recomputed here.
 * `slackMin`/`overByMin` are mutually exclusive: `slackMin` is the leftover
 * shown when the day fits ('comfortable'/'snug'), `overByMin` is set when it
 * doesn't ('over') — the other is 0 in each case.
 */
export interface CapacityWidgetData {
  verdict: 'comfortable' | 'snug' | 'over';
  /** Leftover minutes (load.openMin) when verdict is 'comfortable'/'snug'; 0 when 'over'. */
  slackMin: number;
  /** Minutes over the waking window when verdict is 'over'; 0 otherwise. */
  overByMin: number;
  updatedAtEpoch: number;
  isPro: true;
}

/**
 * Locked sentinel published for free users — the ONLY shape a non-Pro payload
 * may take. Pro-gate-at-source: no verdict, no minutes, nothing that reveals
 * the user's real day-load position. The native widget renders its own
 * locked/teaser state off `isPro: false` alone.
 */
export interface LockedCapacityWidgetData {
  isPro: false;
}

/** Publish a JSON-serializable payload under `key` for a Home-screen widget to read. */
export function publishWidgetData(key: string, payload: unknown): void {
  try {
    getNativePresence().writeWidgetData(key, JSON.stringify(payload));
  } catch {
    // best-effort; a widget write must never block the core loop
  }
}

/** Clear the widget payload stored under `key` (e.g. nothing left to show). */
export function clearWidgetData(key: string): void {
  try {
    getNativePresence().clearWidgetData(key);
  } catch {
    // best-effort
  }
}
