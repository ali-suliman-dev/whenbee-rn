// ──────────────────────────────────────────────────────────────────────────────
// widgetData — generic keyed widget-write bridge. A thin wrapper over the same
// `getNativePresence()` resolver liveActivity.ts uses (writeWidgetData /
// clearWidgetData were added to NativePresenceModule for exactly this: each
// widget owns its own keyed slice instead of the single "snapshot" shape).
// Guarded + best-effort like every other presence call — a widget write must
// never throw into the caller (the guess → timer → learn loop keeps going).
// ──────────────────────────────────────────────────────────────────────────────

import { getNativePresence } from '@/src/services/liveActivity';

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
