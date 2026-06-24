import { useCallback, useState } from 'react';
import { analytics } from '@/src/services/analytics';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { startOfLocalDay } from '@/src/lib/time';
import type { QuietHours } from '@/src/lib/notifyTiming';

/** View-model for the Settings "Quiet hours" row: current value + update lifecycle. */
export function useQuietHours() {
  const quietHours = useSettingsStore((s) => s.quietHours);
  const setStore = useSettingsStore((s) => s.setQuietHours);

  const update = useCallback(
    (next: Partial<QuietHours>) => {
      const merged = { ...quietHours, ...next };
      setStore(merged);
      if (next.enabled !== undefined) {
        analytics.capture('quiet_hours_toggled', { enabled: merged.enabled });
      }
    },
    [quietHours, setStore],
  );

  // ── Editor state ─────────────────────────────────────────────────────────────
  // Tracks which time boundary (start or end) is currently being edited via the
  // FinishTimeWheel, mirroring the useDayEndSetting editing lifecycle pattern.
  const [editingBoundary, setEditingBoundary] = useState<'start' | 'end' | null>(null);

  const openStart = useCallback(() => setEditingBoundary('start'), []);
  const openEnd = useCallback(() => setEditingBoundary('end'), []);
  const closeEditor = useCallback(() => setEditingBoundary(null), []);

  /** Convert a wheel-chosen epoch ms to minutes-after-midnight, then write the
   *  appropriate boundary while preserving the other. The wheel fires per column
   *  change so saving live keeps both HH and MM edits in sync. */
  const saveBoundary = useCallback(
    (boundary: 'start' | 'end', chosenMs: number) => {
      const minutesAfterMidnight = Math.round((chosenMs - startOfLocalDay(chosenMs)) / 60_000);
      if (boundary === 'start') {
        setStore({ ...quietHours, startMin: minutesAfterMidnight });
      } else {
        setStore({ ...quietHours, endMin: minutesAfterMidnight });
      }
    },
    [quietHours, setStore],
  );

  return { quietHours, update, editingBoundary, openStart, openEnd, closeEditor, saveBoundary };
}
