import { useCallback, useMemo, useState } from 'react';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { dayEndEpochFor, formatClockMeridiem, startOfLocalDay } from '@/src/lib/time';

/** View-model for the Settings "End of day" row: current label + edit lifecycle. */
export function useDayEndSetting() {
  const dayEndMin = useSettingsStore((s) => s.dayEndMin);
  const setDayEndMin = useSettingsStore((s) => s.setDayEndMin);
  const [editing, setEditing] = useState(false);

  const label = useMemo(
    () => formatClockMeridiem(dayEndEpochFor(Date.now(), dayEndMin)),
    [dayEndMin],
  );

  const commit = useCallback(
    (chosenMs: number) => {
      setDayEndMin(Math.round((chosenMs - startOfLocalDay(chosenMs)) / 60_000));
      setEditing(false);
    },
    [setDayEndMin],
  );

  const open = useCallback(() => setEditing(true), []);
  const close = useCallback(() => setEditing(false), []);

  return { dayEndMin, label, editing, open, close, commit };
}
