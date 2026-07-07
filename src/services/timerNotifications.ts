import { requireOptionalNativeModule } from 'expo-modules-core';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { withLock } from '@/src/lib/asyncLock';
import { kv } from '@/src/lib/kv';
import { formatClock } from '@/src/lib/time';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { honestReachedFireMs, nextAllowedFireMs } from '@/src/lib/notifyTiming';
import { CAT, THREAD, resolveNotificationSound } from '@/src/services/notificationCategories';
import type { NotificationContentInput } from 'expo-notifications';

/** expo-notifications' types omit threadIdentifier (iOS grouping) even though the
 *  runtime accepts it. Extend locally so we can pass it without casting each call. */
type NotificationContentInputWithThread = NotificationContentInput & {
  threadIdentifier?: string;
};

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

/** Read-only permission status — does NOT prompt. Returns 'undetermined' when the
 *  native module is absent (Expo Go / unit tests) so callers treat it as promptable.
 *  Use this to decide whether a soft-ask card should appear before committing to
 *  ensureNotificationPermission which fires the real OS prompt. */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const N = getModule();
  if (!N) return 'undetermined';
  try {
    const { granted, canAskAgain } = await N.getPermissionsAsync();
    if (granted) return 'granted';
    if (!canAskAgain) return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/** Ask for permission gently (first timer start). No-op without the module.
 *  Pass `{ provisional: true }` for a quiet, no-prompt iOS provisional grant
 *  when the status is undetermined; omit for the standard full-permission prompt. */
export async function ensureNotificationPermission(opts?: { provisional?: boolean }): Promise<boolean> {
  const N = getModule();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = opts?.provisional
      ? await N.requestPermissionsAsync({ ios: { allowProvisional: true } })
      : await N.requestPermissionsAsync();
    return next.granted;
  } catch {
    return false;
  }
}

/**
 * Honest-reached ping: fires at start + honestMin (the learned, realistic finish),
 * framed as calm data. timeSensitive so it surfaces through Focus. Actionable via
 * the WB_HONEST_REACHED category. Cancels any prior one; skips if already past.
 */
export function scheduleTimerDone(opts: {
  label: string;
  startedAt: number;
  honestMin: number;
  hasCalibration?: boolean;
}): Promise<void> {
  return withLock(NOTIF_ID_KEY, async () => {
    const N = getModule();
    if (!N) return;
    try {
      await cancelTimerDoneInner();
      const fireMs = honestReachedFireMs(opts.startedAt, opts.honestMin);
      const secondsFromNow = Math.round((fireMs - Date.now()) / 1000);
      if (secondsFromNow <= 0) return;
      const calibrated = opts.hasCalibration ?? true;
      const content = calibrated
        ? {
            title: "You're near the finish",
            body: `This is about when ${opts.label} usually wraps. Log it when you're done.`,
          }
        : {
            title: `Time check for ${opts.label}`,
            body: `This was your estimate for ${opts.label}. Log it whenever you wrap.`,
          };
      const sound = resolveNotificationSound(useSettingsStore.getState().notificationSound);
      const notifContent: NotificationContentInputWithThread = {
        ...content,
        sound,
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: CAT.HONEST,
        threadIdentifier: THREAD.TIMER,
        data: { kind: 'honest', label: opts.label, startedAt: opts.startedAt, honestMin: opts.honestMin },
      };
      const id = await N.scheduleNotificationAsync({
        content: notifContent,
        trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow },
      });
      kv.set(NOTIF_ID_KEY, id);
    } catch {
      // best-effort; a failed schedule must never block the timer
    }
  });
}

async function cancelTimerDoneInner(): Promise<void> {
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

/** Cancel the scheduled "estimate is up" notification, if any. */
export function cancelTimerDone(): Promise<void> {
  return withLock(NOTIF_ID_KEY, cancelTimerDoneInner);
}

/**
 * G17 — schedule the "start by" nudge for an active Start-By plan: fires at the
 * plan's start-by time so the user starts getting ready in time to hit the
 * deadline honestly. Cancels any prior one first; skips silently if start-by is
 * already past. No-op without the native module.
 */
export function scheduleStartBy(opts: {
  startByMs: number;
  firstTaskLabel: string;
  deadlineMs: number;
  taskId?: string | null;
  category?: string;
  guessMin?: number;
  honestMin?: number;
}): Promise<void> {
  return withLock(STARTBY_ID_KEY, async () => {
    const N = getModule();
    if (!N) return;
    try {
      await cancelStartByInner();
      const secondsFromNow = Math.round((opts.startByMs - Date.now()) / 1000);
      if (secondsFromNow <= 0) return;
      const sound = resolveNotificationSound(useSettingsStore.getState().notificationSound);
      const notifContent: NotificationContentInputWithThread = {
        title: `Start by ${formatClock(opts.startByMs)}`,
        body: `Start ${opts.firstTaskLabel} now and you'll finish by ${formatClock(opts.deadlineMs)}.`,
        sound,
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: CAT.START_BY,
        threadIdentifier: THREAD.PLAN,
        data: {
          kind: 'startBy',
          startByMs: opts.startByMs,
          firstTaskLabel: opts.firstTaskLabel,
          deadlineMs: opts.deadlineMs,
          taskId: opts.taskId ?? null,
          category: opts.category ?? null,
          guessMin: opts.guessMin ?? null,
          honestMin: opts.honestMin ?? null,
        },
      };
      const id = await N.scheduleNotificationAsync({
        content: notifContent,
        trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow },
      });
      kv.set(STARTBY_ID_KEY, id);
    } catch {
      // best-effort; a failed schedule must never block saving a plan
    }
  });
}

async function cancelStartByInner(): Promise<void> {
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

/** Cancel the scheduled "start by" notification, if any. */
export function cancelStartBy(): Promise<void> {
  return withLock(STARTBY_ID_KEY, cancelStartByInner);
}

/**
 * Hyperfocus guardrail (Pro) — schedule one soft "still on this?" check-in at
 * start + thresholdMin, so a backgrounded/closed session still gets the single,
 * gentle nudge. Cancels any prior guard ping first. Skips silently if the fire
 * time is already past. No-op without the native module. No-guilt: amber tone in
 * copy only, never a countdown, fires once per session. Quiet-hours aware.
 */
export function scheduleGuardCheckIn(opts: {
  label: string;
  startedAt: number;
  thresholdMin: number;
}): Promise<void> {
  return withLock(GUARD_ID_KEY, async () => {
    const N = getModule();
    if (!N) return;
    try {
      await cancelGuardCheckInInner();
      const desiredMs = opts.startedAt + opts.thresholdMin * 60_000;
      const quiet = useSettingsStore.getState().quietHours;
      const fireMs = nextAllowedFireMs(desiredMs, quiet, Date.now());
      const secondsFromNow = Math.round((fireMs - Date.now()) / 1000);
      if (secondsFromNow <= 0) return;
      const sound = resolveNotificationSound(useSettingsStore.getState().notificationSound);
      const notifContent: NotificationContentInputWithThread = {
        title: `Still on ${opts.label}?`,
        body: `You've been at it about ${opts.thresholdMin} minutes. No pressure, just a nudge.`,
        sound,
        categoryIdentifier: CAT.GUARD,
        threadIdentifier: THREAD.GUARD,
        data: { kind: 'guard', label: opts.label, thresholdMin: opts.thresholdMin },
      };
      const id = await N.scheduleNotificationAsync({
        content: notifContent,
        trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow },
      });
      kv.set(GUARD_ID_KEY, id);
    } catch {
      // best-effort; a failed schedule must never block the timer
    }
  });
}

async function cancelGuardCheckInInner(): Promise<void> {
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

/** Cancel the scheduled guardrail check-in notification, if any. */
export function cancelGuardCheckIn(): Promise<void> {
  return withLock(GUARD_ID_KEY, cancelGuardCheckInInner);
}
