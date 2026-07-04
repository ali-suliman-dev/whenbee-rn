// src/services/notificationCategories.ts
// Notification categories (interactive buttons) + sound resolution. Registered
// once at launch. Pure config + one async register call; no scheduling here.

import i18n from '@/src/i18n';

type NotificationsModule = typeof import('expo-notifications');

export const CAT = {
  HONEST: 'WB_HONEST_REACHED',
  START_BY: 'WB_START_BY',
  GUARD: 'WB_GUARD',
  REVIEW: 'WB_REVIEW',
} as const;

export const ACTION = {
  LOG: 'LOG',
  EXTEND_10: 'EXTEND_10',
  SNOOZE_15: 'SNOOZE_15',
  START: 'START',
  SNOOZE_5: 'SNOOZE_5',
  GUARD_OK: 'GUARD_OK',
  WRAP: 'WRAP',
  REVIEW_OPEN: 'REVIEW_OPEN',
  REVIEW_EVENING: 'REVIEW_EVENING',
} as const;

export const THREAD = {
  TIMER: 'wb-timer',
  PLAN: 'wb-plan',
  GUARD: 'wb-guard',
  REVIEW: 'wb-review',
} as const;

/** Honey maps to the system sound until the bundled asset ships (see plan note). */
export function resolveNotificationSound(pref: 'honey' | 'default' | 'none'): string | undefined {
  if (pref === 'none') return undefined; // omitting sound = silent on iOS
  // When src/assets/sounds/honey.wav is bundled, return 'honey.wav' for 'honey'.
  return 'default';
}

/** Register all four interactive categories. Safe to call repeatedly. */
export async function registerNotificationCategories(N: NotificationsModule): Promise<void> {
  const fg = { opensAppToForeground: true };
  const bg = { opensAppToForeground: false };
  await Promise.all([
    N.setNotificationCategoryAsync(CAT.HONEST, [
      { identifier: ACTION.LOG, buttonTitle: i18n.t('notifications:categories.honest.log'), options: fg },
      { identifier: ACTION.EXTEND_10, buttonTitle: i18n.t('notifications:categories.honest.extend10'), options: bg },
      { identifier: ACTION.SNOOZE_15, buttonTitle: i18n.t('notifications:categories.honest.snooze15'), options: bg },
    ]),
    N.setNotificationCategoryAsync(CAT.START_BY, [
      { identifier: ACTION.START, buttonTitle: i18n.t('notifications:categories.startBy.start'), options: fg },
      { identifier: ACTION.SNOOZE_5, buttonTitle: i18n.t('notifications:categories.startBy.snooze5'), options: bg },
    ]),
    N.setNotificationCategoryAsync(CAT.GUARD, [
      { identifier: ACTION.GUARD_OK, buttonTitle: i18n.t('notifications:categories.guard.ok'), options: bg },
      { identifier: ACTION.WRAP, buttonTitle: i18n.t('notifications:categories.guard.wrap'), options: fg },
    ]),
    N.setNotificationCategoryAsync(CAT.REVIEW, [
      { identifier: ACTION.REVIEW_OPEN, buttonTitle: i18n.t('notifications:categories.review.open'), options: fg },
      { identifier: ACTION.REVIEW_EVENING, buttonTitle: i18n.t('notifications:categories.review.evening'), options: bg },
    ]),
  ]);
}
