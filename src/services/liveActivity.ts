// ──────────────────────────────────────────────────────────────────────────────
// liveActivity — RN-side bridge to the native presence surfaces (Home-screen
// widget + ActivityKit Live Activity / Dynamic Island). See targets/widget/*.
//
// Mirrors the house guarded-service pattern (purchases.ts / sentry.ts /
// timerNotifications.ts): every export is a NO-OP in Expo Go and in unit tests,
// so the Expo-Go-testable JS app never depends on native presence. The core
// guess → timer → learn loop must never break for a widget write.
//
// SCAFFOLD STATUS (Task C.3): the App Group payload shape, the call sites, and
// the analytics are real and wired. The actual native writes (App Group
// UserDefaults + ActivityKit start/update/end) require a custom native module
// that is added during the device build — see docs/NATIVE-PRESENCE.md. Until that
// module is linked, `getNativePresence()` returns the stub and these calls are
// inert. The Swift side already reads exactly the keys/shape written below.
// ──────────────────────────────────────────────────────────────────────────────

import { requireOptionalNativeModule } from 'expo-modules-core';
import { analytics } from '@/src/services/analytics';
import { isExpoGo } from '@/src/lib/isExpoGo';

/** App Group id — MUST match `kAppGroupId` in targets/widget/SharedStore.swift. */
export const APP_GROUP_ID = 'group.com.whenbee.app';

/** Shared-store key — MUST match `kSnapshotKey` in SharedStore.swift. */
export const WIDGET_SNAPSHOT_KEY = 'whenbee.widgetSnapshot';

/** Name of the native module the device build links (see docs/NATIVE-PRESENCE.md). */
const NATIVE_MODULE_NAME = 'WhenbeePresence';

/**
 * Snapshot the Home-screen widget renders. Mirrors `WidgetSnapshot` in
 * SharedStore.swift — keep the two in sync. JS owns formatting (e.g. the clock
 * string) so the widget stays presentation-only and does no calibration math.
 */
export interface WidgetSnapshot {
  /** Next task label, or '' when nothing is queued (widget shows a quiet empty state). */
  nextTaskLabel: string;
  /** Category id/name for the caption. */
  category: string;
  /** Honest finish as a wall-clock string already formatted by JS, e.g. "7:10". */
  honestFinishClock: string;
  /** Deep link the widget's one-tap Start button opens, e.g. "whenbee://timer?taskId=1". */
  startDeepLink: string;
  /** Unix seconds when this was written (lets the widget detect a stale snapshot). */
  updatedAtEpoch: number;
}

/** Immutable attributes for the running-timer Live Activity (see FinishTimeActivity.swift). */
export interface LiveActivityAttributes {
  /** Task label shown on the Lock Screen / expanded island. */
  taskLabel: string;
  /** Honest finish as Unix seconds; the ring counts down to this. */
  finishEpoch: number;
}

/**
 * The native surface this bridge talks to. The device build provides a real
 * implementation; everywhere else (Expo Go, tests, a binary built before the
 * module was linked) it's a stub whose methods are no-ops.
 */
export interface NativePresenceModule {
  isStub: boolean;
  writeSnapshot: (snapshot: WidgetSnapshot) => void;
  clearSnapshot: () => void;
  startLiveActivity: (attributes: LiveActivityAttributes) => void;
  updateLiveActivity: (state: { isOverrun: boolean }) => void;
  endLiveActivity: () => void;
}

const stub: NativePresenceModule = {
  isStub: true,
  writeSnapshot: () => {},
  clearSnapshot: () => {},
  startLiveActivity: () => {},
  updateLiveActivity: () => {},
  endLiveActivity: () => {},
};

/**
 * Resolve the presence module. Pure (env + a loader are injected) so it's unit-
 * testable without touching the native side. Returns the stub in Expo Go; in a
 * dev build, returns the native module when it's actually linked, else the stub.
 */
export function resolveNativePresence(
  expoGo: boolean,
  loadNative: () => NativePresenceModule | null,
): NativePresenceModule {
  if (expoGo) return stub;
  return loadNative() ?? stub;
}

// Probe for the native module the same defensive way timerNotifications does:
// a binary built before the module was linked must degrade to a clean no-op.
function loadNativePresence(): NativePresenceModule | null {
  const native = requireOptionalNativeModule<NativePresenceModule>(NATIVE_MODULE_NAME);
  return native ?? null;
}

let cached: NativePresenceModule | null = null;
function getNativePresence(): NativePresenceModule {
  if (!cached) cached = resolveNativePresence(isExpoGo, loadNativePresence);
  return cached;
}

// ── Public API (all guarded, all fire-and-forget) ────────────────────────────

/**
 * Publish the next-task snapshot to the Home-screen widget. Call on a counted
 * log / task change so the widget shows the user's actual next task. No-op in
 * Expo Go / tests.
 */
export function publishWidgetSnapshot(snapshot: WidgetSnapshot): void {
  try {
    getNativePresence().writeSnapshot(snapshot);
  } catch {
    // best-effort; a widget write must never block the core loop
  }
}

/** Clear the widget snapshot (e.g. nothing queued). No-op in Expo Go / tests. */
export function clearWidgetSnapshot(): void {
  try {
    getNativePresence().clearSnapshot();
  } catch {
    // best-effort
  }
}

/**
 * Start the running-timer Live Activity (Lock Screen + Dynamic Island finish-time
 * ring). Call on timer start. No-op in Expo Go / tests.
 */
export function startFinishTimeActivity(attributes: LiveActivityAttributes): void {
  try {
    const presence = getNativePresence();
    presence.startLiveActivity(attributes);
    if (!presence.isStub) analytics.capture('widget_added', { surface: 'live_activity' });
  } catch {
    // best-effort
  }
}

/** Flip the Live Activity into/out of its over-the-guess state. No-op in Expo Go / tests. */
export function updateFinishTimeActivity(state: { isOverrun: boolean }): void {
  try {
    getNativePresence().updateLiveActivity(state);
  } catch {
    // best-effort
  }
}

/** End the running-timer Live Activity. Call on timer stop / cancel. No-op in Expo Go / tests. */
export function endFinishTimeActivity(): void {
  try {
    const presence = getNativePresence();
    presence.endLiveActivity();
    if (!presence.isStub) analytics.capture('widget_engaged', { surface: 'live_activity' });
  } catch {
    // best-effort
  }
}
