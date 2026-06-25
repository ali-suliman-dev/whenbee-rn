import { useCallback } from 'react';
import { analytics } from '@/src/services/analytics';
import { ensureNotificationPermission, cancelTimerDone } from '@/src/services/timerNotifications';
import { useSettingsStore } from '@/src/stores/settingsStore';

/**
 * The "time-up reminder" setting. Turning it on asks for notification permission
 * first — if the user (or a build without the native module) declines, the
 * setting stays off and `toggle` reports false so the UI can say so. Turning it
 * off cancels any pending ping. Keeps the service + analytics out of the route.
 */
export function useReminderSetting() {
  const enabled = useSettingsStore((s) => s.remindersEnabled);
  const setEnabled = useSettingsStore((s) => s.setRemindersEnabled);

  const toggle = useCallback(
    async (next: boolean): Promise<boolean> => {
      if (next) {
        const granted = await ensureNotificationPermission();
        analytics.capture('notification_permission', { tier: granted ? 'full' : 'denied' });
        if (!granted) return false;
        setEnabled(true);
        analytics.capture('reminder_enabled', {});
        return true;
      }
      setEnabled(false);
      analytics.capture('reminder_disabled', {});
      await cancelTimerDone();
      return true;
    },
    [setEnabled],
  );

  return { enabled, toggle };
}
