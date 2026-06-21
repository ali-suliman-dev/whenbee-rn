import { useCallback, useMemo, useState } from 'react';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { dayEndEpochFor, formatClockMeridiem, startOfLocalDay } from '@/src/lib/time';

/** View-model for the Settings "End of day" row: current label + edit lifecycle. */
export function useDayEndSetting() {
  const dayEndMin = useSettingsStore((s) => s.dayEndMin);
  const setDayEndMin = useSettingsStore((s) => s.setDayEndMin);
  const dayEndEnabled = useSettingsStore((s) => s.dayEndEnabled);
  const setDayEndEnabled = useSettingsStore((s) => s.setDayEndEnabled);
  const [editing, setEditing] = useState(false);

  const label = useMemo(
    () => formatClockMeridiem(dayEndEpochFor(Date.now(), dayEndMin)),
    [dayEndMin],
  );

  /** Persist an epoch-on-today as minutes-after-midnight without closing the editor.
   *  The wheel fires per column change, so saving live keeps both HH and MM edits. */
  const save = useCallback(
    (chosenMs: number) => {
      setDayEndMin(Math.round((chosenMs - startOfLocalDay(chosenMs)) / 60_000));
    },
    [setDayEndMin],
  );

  /** Persist the chosen time and close the editor (single-shot commit). */
  const commit = useCallback(
    (chosenMs: number) => {
      save(chosenMs);
      setEditing(false);
    },
    [save],
  );

  const open = useCallback(() => setEditing(true), []);
  const close = useCallback(() => setEditing(false), []);

  return { dayEndMin, label, editing, open, close, save, commit, dayEndEnabled, setDayEndEnabled };
}
