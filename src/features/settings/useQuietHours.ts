import { useCallback } from 'react';
import { analytics } from '@/src/services/analytics';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { QuietHours } from '@/src/lib/notifyTiming';

/** View-model for the Settings "Quiet hours" row: current value + update lifecycle. */
export function useQuietHours() {
  const quietHours = useSettingsStore((s) => s.quietHours);
  const set = useSettingsStore((s) => s.setQuietHours);

  const update = useCallback(
    (next: Partial<QuietHours>) => {
      const merged = { ...quietHours, ...next };
      set(merged);
      if (next.enabled !== undefined) {
        analytics.capture('quiet_hours_toggled', { enabled: merged.enabled });
      }
    },
    [quietHours, set],
  );

  return { quietHours, update };
}
