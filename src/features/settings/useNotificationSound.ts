import { useCallback } from 'react';
import { analytics } from '@/src/services/analytics';
import { useSettingsStore } from '@/src/stores/settingsStore';

/** View-model for the Settings "Sound" row: current value + setter with analytics. */
export function useNotificationSound() {
  const value = useSettingsStore((s) => s.notificationSound);
  const setStore = useSettingsStore((s) => s.setNotificationSound);

  const set = useCallback(
    (v: 'honey' | 'default' | 'none') => {
      setStore(v);
      analytics.capture('notification_sound_set', { value: v });
    },
    [setStore],
  );

  return { value, set };
}
