import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
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
//
// The read repeats on sheet focus, on app foreground, and on `refresh()`
// (pull-to-refresh) — the OS calendar is edited outside Whenbee, so a single
// mount read goes stale as soon as the user leaves. Every one of those paths is
// read-only; the write stays behind `apply()` alone.
// ──────────────────────────────────────────────────────────────────────────────

/** Realistic end of a working day (local hour). Past this, the day "won't fit". */
const REALISTIC_DAY_END_HOUR = 22; // 10:00pm

export type HonestDayStatus = 'loading' | 'denied' | 'empty' | 'ready';

export interface UseHonestDay {
  status: HonestDayStatus;
  result: HonestDayResult | null;
  /** Writes the confirmed honest times. Returns the number of events written. */
  apply: () => Promise<number>;
  /** Re-reads today's events and re-anchors to the current clock. Never writes. */
  refresh: () => Promise<void>;
  /** True while a user-initiated refresh is in flight (drives RefreshControl). */
  refreshing: boolean;
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

/**
 * @param nowMs Anchor for "today" at first render. The default `Date.now()` is
 *   pinned once (the `usePatterns` nowRef pattern) — threading a fresh clock
 *   through the effect deps would re-read the calendar on every render. A reload
 *   re-anchors to the real clock so a sheet left open overnight stays honest.
 */
export function useHonestDay(nowMs: number = Date.now()): UseHonestDay {
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const [status, setStatus] = useState<HonestDayStatus>('loading');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const anchorMsRef = useRef(nowMs);
  // Monotonic token — a read commits only if it is still the newest one started.
  const fetchIdRef = useRef(0);

  const readEvents = useCallback(async (atMs: number): Promise<void> => {
    const fetchId = ++fetchIdRef.current;
    const calendar = getCalendar();
    const granted = await calendar.requestReadAccess();
    if (fetchId !== fetchIdRef.current) return;
    if (!granted) {
      setStatus('denied');
      return;
    }
    const todays = await calendar.getTodaysEvents(atMs);
    if (fetchId !== fetchIdRef.current) return;
    setEvents(todays);
    setStatus(todays.length === 0 ? 'empty' : 'ready');
  }, []);

  /** Re-anchor to the current clock and read again. The shared reload path. */
  const reload = useCallback(async (): Promise<void> => {
    anchorMsRef.current = Date.now();
    await readEvents(anchorMsRef.current);
  }, [readEvents]);

  useEffect(() => {
    void readEvents(anchorMsRef.current);
    // Invalidate any in-flight read so a late resolve can't clobber newer state.
    return () => {
      fetchIdRef.current += 1;
    };
  }, [readEvents]);

  // Re-read on a genuine leave-and-return. The first focus is skipped — the
  // mount read above already covered it.
  const blurredRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (blurredRef.current) {
        blurredRef.current = false;
        void reload();
      }
      return () => {
        blurredRef.current = true;
      };
    }, [reload]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const result =
    status === 'ready'
      ? buildHonestDay(events, statsByCategory, {
          nowMs: anchorMsRef.current,
          dayEndMs: realisticDayEndMs(anchorMsRef.current),
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

  return { status, result, apply, refresh, refreshing };
}
