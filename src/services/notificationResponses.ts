// src/services/notificationResponses.ts
// Pure-ish handler for notification button taps. Background actions reschedule
// the relevant ping; foreground actions are navigated by notificationSetup and
// only logged here. No expo-notifications import — the setup module adapts the
// real NotificationResponse into this shape.

import { analytics } from '@/src/services/analytics';
import { scheduleTimerDone, scheduleStartBy } from '@/src/services/timerNotifications';
import { ACTION } from '@/src/services/notificationCategories';
import i18n from '@/src/i18n';

export interface NotificationResponseLike {
  actionIdentifier: string;
  data: Record<string, unknown>;
}

export async function handleNotificationResponse(res: NotificationResponseLike): Promise<void> {
  const kind = typeof res.data.kind === 'string' ? (res.data.kind as string) : 'unknown';
  analytics.capture('notification_action', { category: kind, action: res.actionIdentifier });

  switch (res.actionIdentifier) {
    case ACTION.EXTEND_10: {
      if (res.data.kind === 'honest') {
        const label = String(res.data.label ?? i18n.t('notifications:fallbackTaskLabel'));
        const startedAt = Number(res.data.startedAt ?? Date.now());
        const honestMin = Number(res.data.honestMin ?? 0) + 10;
        await scheduleTimerDone({ label, startedAt, honestMin });
      }
      return;
    }
    case ACTION.SNOOZE_15: {
      if (res.data.kind === 'honest') {
        const label = String(res.data.label ?? i18n.t('notifications:fallbackTaskLabel'));
        // Re-anchor so the next ping is ~15 min from now: startedAt = now, honestMin = 15.
        await scheduleTimerDone({ label, startedAt: Date.now(), honestMin: 15 });
      }
      return;
    }
    case ACTION.SNOOZE_5: {
      if (res.data.kind === 'startBy') {
        const firstTaskLabel = String(res.data.firstTaskLabel ?? i18n.t('notifications:fallbackTaskLabel'));
        const deadlineMs = Number(res.data.deadlineMs ?? Date.now());
        await scheduleStartBy({ startByMs: Date.now() + 5 * 60_000, firstTaskLabel, deadlineMs });
      }
      return;
    }
    // Foreground actions (LOG, START, WRAP, REVIEW_OPEN) + dismiss-like (GUARD_OK,
    // REVIEW_EVENING) need no rescheduling here; navigation is in notificationSetup.
    default:
      return;
  }
}
