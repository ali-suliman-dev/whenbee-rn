import { requireOptionalNativeModule } from 'expo-modules-core';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { kv } from '@/src/lib/kv';
import i18n from '@/src/i18n';

// ──────────────────────────────────────────────────────────────────────────────
// routineNotifications — start-by alerts for scheduled routines (Pro).
//
// For each scheduled weekday a routine carries, one WEEKLY local notification is
// scheduled at (startBy − alertLeadMin) so the user starts at the right time to
// hit their done-by target honestly. All on-device (no network → core-loop
// invariant). Default OFF — alertEnabled gates everything.
//
// Mirrors timerNotifications / reviewNotifications exactly: expo-notifications is
// a native module (absent in Expo Go + tests) loaded lazily + probed before use;
// a missing module makes every call a clean no-op. No-guilt: copy is a calm
// nudge, never a nag. Ids are stored in kv so cancel is always safe.
// ──────────────────────────────────────────────────────────────────────────────

/** kv key holding a JSON array of scheduled notification ids for a routine. */
const routineAlertsKey = (routineId: string) => `routine-alerts:${routineId}`;

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null = null;
let triedRequire = false;

function getModule(): NotificationsModule | null {
  if (isExpoGo) return null;
  if (cached) return cached;
  if (triedRequire) return null;
  triedRequire = true;
  // Probe the native side FIRST — importing expo-notifications on a binary built
  // before the module was linked throws async native errors a try/catch can't stop.
  if (!requireOptionalNativeModule('ExpoNotificationScheduler')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
    return cached;
  } catch {
    return null;
  }
}

/** Ask for permission gently (when the user enables alerts). No-op without the module. */
export async function ensureRoutineNotificationPermission(): Promise<boolean> {
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

/** Routine fields relevant to scheduling (matches the Routine domain type). */
export interface RoutineAlertArgs {
  id: string;
  name: string;
  /** Weekdays on which this routine is scheduled (0–6, Sun=0). */
  scheduleDays: number[];
  alertEnabled: boolean;
  /** Minutes before startByMinuteOfDay to fire the alert. */
  alertLeadMin: number;
  /** Minute of day by which the routine should be done (null = no anchor). */
  doneByMinuteOfDay: number | null;
}

/**
 * Schedule one WEEKLY local notification per scheduleDays entry, firing at
 * `max(0, startByMinuteOfDay − alertLeadMin)` each week.
 *
 * Cancels any prior alerts for this routine first (safe replace). No-op when
 * `alertEnabled=false`, `scheduleDays` is empty, or the native module is absent.
 * The scheduled notification ids are stored in kv for later cancellation.
 *
 * Weekday mapping: 0–6 (Sun=0) → 1–7 (Sun=1), matching the expo-notifications
 * WEEKLY trigger convention (iOS-compatible).
 */
export async function scheduleRoutineAlerts(
  routine: RoutineAlertArgs,
  startByMinuteOfDay: number,
): Promise<void> {
  // Always cancel stale alerts first (even if we won't reschedule), so a user
  // who disables alerts doesn't keep receiving stale ones.
  await cancelRoutineAlerts(routine.id);

  const N = getModule();
  if (!N) return;
  if (!routine.alertEnabled || routine.scheduleDays.length === 0) return;

  try {
    const alertMinute = Math.max(0, startByMinuteOfDay - routine.alertLeadMin);
    const hour = Math.floor(alertMinute / 60);
    const minute = alertMinute % 60;

    const ids: string[] = [];
    for (const day of routine.scheduleDays) {
      // expo-notifications WEEKLY trigger: weekday 1 = Sunday … 7 = Saturday
      const weekday = day + 1;
      const id = await N.scheduleNotificationAsync({
        content: {
          title: routine.name,
          body: i18n.t('notifications:routine.body', { name: routine.name }),
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
        },
      });
      ids.push(id);
    }

    kv.set(routineAlertsKey(routine.id), JSON.stringify(ids));
  } catch {
    // best-effort; a failed schedule must never block saving a routine
  }
}

/**
 * Cancel all scheduled alerts for a routine (reads ids from kv then cancels each).
 * No-op without the native module or when no ids are stored.
 */
export async function cancelRoutineAlerts(routineId: string): Promise<void> {
  const N = getModule();
  if (!N) return;
  try {
    const raw = kv.getString(routineAlertsKey(routineId));
    if (!raw) return;
    const ids = JSON.parse(raw) as string[];
    for (const id of ids) {
      await N.cancelScheduledNotificationAsync(id);
    }
    kv.delete(routineAlertsKey(routineId));
  } catch {
    // best-effort
  }
}
