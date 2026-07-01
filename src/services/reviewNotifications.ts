import { requireOptionalNativeModule } from 'expo-modules-core';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { kv } from '@/src/lib/kv';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { CAT, THREAD, resolveNotificationSound } from '@/src/services/notificationCategories';
import i18n from '@/src/i18n';
import type { NotificationContentInput } from 'expo-notifications';

/** expo-notifications' types omit threadIdentifier (iOS grouping) even though the
 *  runtime accepts it. Extend locally so we can pass it without casting each call. */
type NotificationContentInputWithThread = NotificationContentInput & {
  threadIdentifier?: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// reviewNotifications — the opt-in Monday "your honest week is ready" nudge for
// the review ritual (Pro). One calm, recurring local notification. All on-device
// (no network → the core-loop invariant holds). Default OFF.
//
// Mirrors timerNotifications' guarded pattern exactly: expo-notifications is a
// native module (absent in Expo Go and in unit tests), so it's loaded lazily +
// probed before use — a missing module makes every call a clean no-op. No-guilt:
// the copy never references a missed week; it's an open invitation, not a streak.
// ──────────────────────────────────────────────────────────────────────────────

/** Opt-in flag (default OFF). Read/written by the settings hook + this service. */
export const REVIEW_NOTIFY_ENABLED_KEY = 'whenbee.review.notifyEnabled';
/** The scheduled notification id, so we can cancel/replace it. */
const REVIEW_NOTIF_ID_KEY = 'whenbee.review.notifId';
/** The last period id we scheduled from — at-most-one active schedule per period. */
const REVIEW_LAST_NOTIFIED_KEY = 'whenbee.review.lastNotifiedPeriodId';

/** iOS weekday: 1 = Sunday … 2 = Monday. The ritual lands Monday morning. */
const MONDAY = 2;
const REVIEW_HOUR = 9;
const REVIEW_MINUTE = 0;

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

/** Ask for permission gently (when the user flips the toggle on). No-op without
 *  the module. Shared shape with the timer reminder so behavior is consistent.
 *  Pass `{ provisional: true }` for a quiet, no-prompt iOS provisional grant
 *  when the status is undetermined; omit for the standard full-permission prompt. */
export async function ensureReviewNotificationPermission(opts?: { provisional?: boolean }): Promise<boolean> {
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
 * Schedule the recurring Monday-morning review nudge, replacing any prior one.
 * `periodId` records which period the active schedule was set from (kept under
 * `lastNotifiedPeriodId` so we never stack duplicate weekly schedules). No-op
 * without the native module.
 */
export async function scheduleWeeklyReview(periodId: string): Promise<void> {
  const N = getModule();
  if (!N) return;
  try {
    await cancelWeeklyReview();
    const notifContent: NotificationContentInputWithThread = {
      title: i18n.t('notifications:review.title'),
      body: i18n.t('notifications:review.body'),
      sound: resolveNotificationSound(useSettingsStore.getState().notificationSound),
      categoryIdentifier: CAT.REVIEW,
      threadIdentifier: THREAD.REVIEW,
      data: { kind: 'review' },
    };
    const id = await N.scheduleNotificationAsync({
      content: notifContent,
      trigger: {
        type: N.SchedulableTriggerInputTypes.WEEKLY,
        weekday: MONDAY,
        hour: REVIEW_HOUR,
        minute: REVIEW_MINUTE,
      },
    });
    kv.set(REVIEW_NOTIF_ID_KEY, id);
    kv.set(REVIEW_LAST_NOTIFIED_KEY, periodId);
  } catch {
    // best-effort; a failed schedule must never block the toggle.
  }
}

/** Cancel the scheduled Monday review nudge, if any. */
export async function cancelWeeklyReview(): Promise<void> {
  const N = getModule();
  if (!N) return;
  try {
    const id = kv.getString(REVIEW_NOTIF_ID_KEY);
    if (id) {
      await N.cancelScheduledNotificationAsync(id);
      kv.delete(REVIEW_NOTIF_ID_KEY);
    }
  } catch {
    // best-effort
  }
}
