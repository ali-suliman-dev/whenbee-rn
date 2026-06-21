import { requireOptionalNativeModule } from 'expo-modules-core';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { kv } from '@/src/lib/kv';
import { projectedFinish, formatClock } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// timerNotifications — a single local "your estimate is up" ping so the timer is
// useful with the app backgrounded or closed. All on-device (no network → the
// core-loop invariant holds).
//
// expo-notifications is a native module: absent in Expo Go and in unit tests.
// It's loaded lazily + guarded so neither environment crashes — a missing module
// simply makes every call a no-op (the persisted-resume + reopen bar still work).
//
// A true live countdown while fully closed would need an iOS Live Activity
// (ActivityKit native widget) — out of scope; called out for a future cut.
// ──────────────────────────────────────────────────────────────────────────────

const NOTIF_ID_KEY = 'whenbee.timerNotifId';
const STARTBY_ID_KEY = 'whenbee.startByNotifId';
const GUARD_ID_KEY = 'whenbee.guardNotifId';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null = null;
let triedRequire = false;

function getModule(): NotificationsModule | null {
  if (isExpoGo) return null;
  if (cached) return cached;
  if (triedRequire) return null;
  triedRequire = true;
  // Probe the native side FIRST. Importing expo-notifications on a binary built
  // before the module was linked throws async native errors (ExpoPushTokenManager)
  // that a try/catch around require can't stop — so don't import it at all unless
  // its scheduler module is actually present. (Also keeps unit tests a clean no-op.)
  if (!requireOptionalNativeModule('ExpoNotificationScheduler')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
    return cached;
  } catch {
    return null;
  }
}

/** Ask for permission gently (first timer start). No-op without the module. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const N = getModule();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await N.requestPermissionsAsync();
    return next.granted;
  } catch {
    return false;
  }
}

/**
 * Schedule the single "estimate is up" notification at start + estimateMin.
 * Cancels any prior one first. Skips silently if the fire time is already past.
 */
export async function scheduleTimerDone(opts: {
  label: string;
  startedAt: number;
  estimateMin: number;
}): Promise<void> {
  const N = getModule();
  if (!N) return;
  try {
    await cancelTimerDone();
    const fireMs = projectedFinish(opts.startedAt, opts.estimateMin);
    const secondsFromNow = Math.round((fireMs - Date.now()) / 1000);
    if (secondsFromNow <= 0) return;

    const id = await N.scheduleNotificationAsync({
      content: {
        title: 'Time check',
        body: `Your honest estimate for ${opts.label} is up. Log it whenever you wrap up.`,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
      },
    });
    kv.set(NOTIF_ID_KEY, id);
  } catch {
    // best-effort; a failed schedule must never block the timer
  }
}

/** Cancel the scheduled "estimate is up" notification, if any. */
export async function cancelTimerDone(): Promise<void> {
  const N = getModule();
  if (!N) return;
  try {
    const id = kv.getString(NOTIF_ID_KEY);
    if (id) {
      await N.cancelScheduledNotificationAsync(id);
      kv.delete(NOTIF_ID_KEY);
    }
  } catch {
    // best-effort
  }
}

/**
 * G17 — schedule the "start by" nudge for an active Start-By plan: fires at the
 * plan's start-by time so the user starts getting ready in time to hit the
 * deadline honestly. Cancels any prior one first; skips silently if start-by is
 * already past. No-op without the native module.
 */
export async function scheduleStartBy(opts: {
  startByMs: number;
  firstTaskLabel: string;
  deadlineMs: number;
}): Promise<void> {
  const N = getModule();
  if (!N) return;
  try {
    await cancelStartBy();
    const secondsFromNow = Math.round((opts.startByMs - Date.now()) / 1000);
    if (secondsFromNow <= 0) return;
    const id = await N.scheduleNotificationAsync({
      content: {
        title: `Start by ${formatClock(opts.startByMs)}`,
        body: `Begin ${opts.firstTaskLabel} now to finish by ${formatClock(opts.deadlineMs)}.`,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow },
    });
    kv.set(STARTBY_ID_KEY, id);
  } catch {
    // best-effort; a failed schedule must never block saving a plan
  }
}

/** Cancel the scheduled "start by" notification, if any. */
export async function cancelStartBy(): Promise<void> {
  const N = getModule();
  if (!N) return;
  try {
    const id = kv.getString(STARTBY_ID_KEY);
    if (id) {
      await N.cancelScheduledNotificationAsync(id);
      kv.delete(STARTBY_ID_KEY);
    }
  } catch {
    // best-effort
  }
}

/**
 * Hyperfocus guardrail (Pro) — schedule one soft "still on this?" check-in at
 * start + thresholdMin, so a backgrounded/closed session still gets the single,
 * gentle nudge. Cancels any prior guard ping first. Skips silently if the fire
 * time is already past. No-op without the native module. No-guilt: amber tone in
 * copy only, never a countdown, fires once per session.
 */
export async function scheduleGuardCheckIn(opts: {
  label: string;
  startedAt: number;
  thresholdMin: number;
}): Promise<void> {
  const N = getModule();
  if (!N) return;
  try {
    await cancelGuardCheckIn();
    const fireMs = opts.startedAt + opts.thresholdMin * 60_000;
    const secondsFromNow = Math.round((fireMs - Date.now()) / 1000);
    if (secondsFromNow <= 0) return;

    const id = await N.scheduleNotificationAsync({
      content: {
        title: 'Still on this?',
        body: `You've been on ${opts.label} about ${opts.thresholdMin} minutes. Surface whenever you want.`,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
      },
    });
    kv.set(GUARD_ID_KEY, id);
  } catch {
    // best-effort; a failed schedule must never block the timer
  }
}

/** Cancel the scheduled guardrail check-in notification, if any. */
export async function cancelGuardCheckIn(): Promise<void> {
  const N = getModule();
  if (!N) return;
  try {
    const id = kv.getString(GUARD_ID_KEY);
    if (id) {
      await N.cancelScheduledNotificationAsync(id);
      kv.delete(GUARD_ID_KEY);
    }
  } catch {
    // best-effort
  }
}
