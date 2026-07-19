// ──────────────────────────────────────────────────────────────────────────────
// trialReminder — keeps the paywall's "Day 5 — we remind you" promise. Pure date
// math up top (unit-tested); the scheduling half is guarded the same way as
// notificationSetup (no-op in Expo Go / when the native module is absent).
// Spec: docs/product/specs/2026-07-19-paywall-redesign.md §6
// ──────────────────────────────────────────────────────────────────────────────

import { requireOptionalNativeModule } from 'expo-modules-core';
import { isExpoGo } from '@/src/lib/isExpoGo';

type NotificationsModule = typeof import('expo-notifications');

const REMINDER_DAY_OFFSET = 5;
const CHARGE_DAY_OFFSET = 7;
const REMINDER_HOUR_LOCAL = 10;
const REMINDER_IDENTIFIER = 'trial-reminder-day5';

/** Day-5 reminder moment: five days after purchase, 10:00 local. */
export function trialReminderDate(purchasedAt: Date): Date {
  const d = new Date(purchasedAt);
  d.setDate(d.getDate() + REMINDER_DAY_OFFSET);
  d.setHours(REMINDER_HOUR_LOCAL, 0, 0, 0);
  return d;
}

/** First-charge moment: seven days after purchase (trial end). */
export function trialChargeDate(purchasedAt: Date): Date {
  const d = new Date(purchasedAt);
  d.setDate(d.getDate() + CHARGE_DAY_OFFSET);
  return d;
}

function getModule(): NotificationsModule | null {
  if (isExpoGo) return null;
  if (!requireOptionalNativeModule('ExpoNotificationScheduler')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

export type TrialReminderResult =
  | 'scheduled'
  | 'skipped-no-module'
  | 'skipped-permission'
  | 'skipped-error';

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** Current permission state, without ever prompting. */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const N = getModule();
  if (!N) return 'unavailable';
  try {
    const { status, canAskAgain } = await N.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'undetermined' || canAskAgain) return 'undetermined';
    return 'denied';
  } catch {
    return 'unavailable';
  }
}

/** True when notification permission is already granted (never prompts). */
export async function hasNotificationPermission(): Promise<boolean> {
  return (await getNotificationPermissionState()) === 'granted';
}

/** Fires the system permission prompt; true when the user grants. */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = getModule();
  if (!N) return false;
  try {
    const { status } = await N.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Schedule the Day-5 trial reminder. Idempotent: an earlier trial reminder is
 * cancelled first. Assumes permission was checked by the caller (success
 * screen owns the honest ask) but re-verifies to stay safe.
 */
export async function scheduleTrialReminder(purchasedAt: Date): Promise<TrialReminderResult> {
  const N = getModule();
  if (!N) return 'skipped-no-module';
  try {
    const { status } = await N.getPermissionsAsync();
    if (status !== 'granted') return 'skipped-permission';
    await N.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER).catch(() => {});
    await N.scheduleNotificationAsync({
      identifier: REMINDER_IDENTIFIER,
      content: {
        title: 'Your Pro trial ends in 2 days',
        body: 'Keep it or cancel in Settings. Either way, your calibration stays.',
        data: { url: 'whenbee:///settings' },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: trialReminderDate(purchasedAt) },
    });
    return 'scheduled';
  } catch {
    return 'skipped-error';
  }
}
