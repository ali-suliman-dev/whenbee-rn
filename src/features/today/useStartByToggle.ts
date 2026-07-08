import { useCallback } from 'react';
import { analytics } from '@/src/services/analytics';
import { ensureNotificationPermission, cancelStartBy } from '@/src/services/timerNotifications';
import { useSettingsStore } from '@/src/stores/settingsStore';

/**
 * The start-by nudge setting, owned by the plan surface. Turning it on asks for
 * notification permission first — if declined (or on a build without the native
 * module) the flag stays off and `toggle` reports false. Turning it off cancels
 * any pending start-by. Independent of the global reminders master.
 */
export function useStartByToggle() {
  const enabled = useSettingsStore((s) => s.startByEnabled);
  const setEnabled = useSettingsStore((s) => s.setStartByEnabled);

  const toggle = useCallback(
    async (next: boolean): Promise<boolean> => {
      if (next) {
        const granted = await ensureNotificationPermission();
        analytics.capture('notification_permission', { tier: granted ? 'full' : 'denied' });
        if (!granted) return false;
        setEnabled(true);
        analytics.capture('startby_reminder_enabled', {});
        return true;
      }
      setEnabled(false);
      analytics.capture('startby_reminder_disabled', {});
      await cancelStartBy();
      return false;
    },
    [setEnabled],
  );

  return { enabled, toggle };
}
