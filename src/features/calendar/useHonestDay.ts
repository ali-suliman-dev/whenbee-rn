import { useCallback, useEffect, useState } from 'react';
import { getCalendar, type CalendarAdjustment, type CalendarEvent } from '@/src/services/calendar';
import { analytics } from '@/src/services/analytics';
import { GLOBAL_PRIOR } from '@/src/engine';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { buildHonestDay, type HonestDayResult } from './buildHonestDay';

// ──────────────────────────────────────────────────────────────────────────────
// useHonestDay — the Honest-Day orchestration hook.
//
// Lifecycle: request READ access → load today's events → build the honest day
// from the live per-category multipliers. NOTHING writes to the calendar here.
// The single write is `apply()`, which the confirm button calls; it fires
// `calendar_padded` only after a successful write.
// ──────────────────────────────────────────────────────────────────────────────

/** Realistic end of a working day (local hour). Past this, the day "won't fit". */
const REALISTIC_DAY_END_HOUR = 22; // 10:00pm

export type HonestDayStatus = 'loading' | 'denied' | 'empty' | 'ready';

export interface UseHonestDay {
  status: HonestDayStatus;
  result: HonestDayResult | null;
  /** Writes the confirmed honest times. Returns the number of events written. */
  apply: () => Promise<number>;
}

/** Epoch ms for REALISTIC_DAY_END_HOUR on the day containing `nowMs`. */
function realisticDayEndMs(nowMs: number): number {
  const end = new Date(nowMs);
  end.setHours(REALISTIC_DAY_END_HOUR, 0, 0, 0);
  return end.getTime();
}

/** Build the confirmed adjustments from an honest result (the write payload). */
function adjustmentsFrom(result: HonestDayResult): CalendarAdjustment[] {
  return result.after.map((block) => ({
    id: block.id,
    startMs: block.startMs,
    endMs: block.endMs,
  }));
}

export function useHonestDay(nowMs: number = Date.now()): UseHonestDay {
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const [status, setStatus] = useState<HonestDayStatus>('loading');
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const calendar = getCalendar();
      const granted = await calendar.requestReadAccess();
      if (!active) return;
      if (!granted) {
        setStatus('denied');
        return;
      }
      const todays = await calendar.getTodaysEvents(nowMs);
      if (!active) return;
      setEvents(todays);
      setStatus(todays.length === 0 ? 'empty' : 'ready');
    })();
    return () => {
      active = false;
    };
  }, [nowMs]);

  const result =
    status === 'ready'
      ? buildHonestDay(events, statsByCategory, {
          nowMs,
          dayEndMs: realisticDayEndMs(nowMs),
          defaultMultiplier: GLOBAL_PRIOR,
        })
      : null;

  const apply = useCallback(async (): Promise<number> => {
    if (!result) return 0;
    const adjustments = adjustmentsFrom(result);
    // ⚠️ THE write. Only ever reached from the confirm button.
    const written = await getCalendar().writeAdjustments(adjustments);
    // Fire only after a confirmed, successful write.
    if (written > 0) {
      const shift =
        result.dayEndAfterMin !== null && result.dayEndBeforeMin !== null
          ? result.dayEndAfterMin - result.dayEndBeforeMin
          : 0;
      analytics.capture('calendar_padded', {
        events_count: written,
        day_end_shift_min: shift,
      });
    }
    return written;
  }, [result]);

  return { status, result, apply };
}
