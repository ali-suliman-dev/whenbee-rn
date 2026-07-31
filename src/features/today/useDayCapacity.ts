import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { getCalendar, type CalendarEvent } from '@/src/services/calendar';
import { honestDayLoad, type DayLoadResult } from '@/src/engine/honestDayLoad';
import { WAKING_WINDOW_MIN } from '@/src/engine/constants';
import { resolveSuggestion, seededPriorFor } from '@/src/engine';
import { useScheduledRoutines } from './useScheduledRoutines';

// ──────────────────────────────────────────────────────────────────────────────
// useDayCapacity — combines the selected day's queued tasks (honest minutes via
// calibration) + device-calendar timed events (Pro, opt-in) into a honestDayLoad
// result. Calendar events are read-only; all-day events are excluded from the
// capacity math and surfaced separately. Pro-gated: free users get status 'off'
// with a task-only load (calendar is never fetched).
//
// Layer rule: hooks are the right place for this — they can read multiple stores
// and call a service, but the actual computation stays in the pure engine.
//
// Freshness: the device calendar is edited outside Whenbee, so a read goes stale
// the moment the user leaves. The read is repeated on screen focus, on app
// foreground, and on an explicit refresh() (pull-to-refresh / the header glyph).
// Repeat reads are SILENT — status never drops back to 'loading', so the section
// never flashes empty while re-reading.
// ──────────────────────────────────────────────────────────────────────────────

export type DayCapacityStatus = 'loading' | 'denied' | 'off' | 'ready';

export interface DayCapacityResult {
  status: DayCapacityStatus;
  load: DayLoadResult | null;
  /** Timed (non-all-day) calendar events for the selected day. Empty when off/denied. */
  events: CalendarEvent[];
  /** All-day events for the selected day — excluded from load.eventMin. */
  allDayEvents: CalendarEvent[];
  isPro: boolean;
  /** Epoch ms of the last successful read. `null` when the calendar was never read. */
  lastFetchedAtMs: number | null;
  /** Re-reads the device calendar. No-op for free users / when the toggle is off. */
  refresh: () => Promise<void>;
  /** True while a user-initiated refresh is in flight (drives RefreshControl). */
  refreshing: boolean;
}

/**
 * Calendar data older than this reads as stale: the header glyph lights up and
 * the "updated Nm ago" stamp appears. Below it, both stay silent — the stamp is
 * meant to show up exactly when a tap is worth it, not to nag on every render.
 */
export const CALENDAR_STALE_AFTER_MS = 2 * 60_000;

/**
 * Heartbeat for the freshness stamp. The stamp reads in whole minutes, so half a
 * minute is fine enough to cross the threshold promptly without re-rendering the
 * header on a tighter loop than the text can express.
 */
export const CALENDAR_AGE_TICK_MS = 30_000;

/**
 * The quiet freshness stamp, e.g. `updated 6m ago`. Returns `null` while the read
 * is still fresh, was never made, or the clock moved backwards — callers render
 * nothing in that case.
 */
export function formatCalendarAge(
  lastFetchedAtMs: number | null,
  nowMs: number,
): string | null {
  if (lastFetchedAtMs === null) return null;

  const ageMs = nowMs - lastFetchedAtMs;
  if (ageMs < CALENDAR_STALE_AFTER_MS) return null;

  const ageMin = Math.floor(ageMs / 60_000);
  if (ageMin < 60) return `updated ${ageMin}m ago`;
  return `updated ${Math.floor(ageMin / 60)}h ago`;
}

export function useDayCapacity(_nowMs?: number): DayCapacityResult {
  const selectedDate = useDayTasksStore((s) => s.selectedDate);
  const dayTasks = useDayTasksStore((s) => s.dayTasks);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const showEvents = useSettingsStore((s) => s.calendar.showEvents);
  const enabledCalendarIds = useSettingsStore((s) => s.calendar.enabledCalendarIds);
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);
  const isPro = useEntitlement((s) => s.isPro);

  const [status, setStatus] = useState<DayCapacityStatus>('loading');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [allDayEvents, setAllDayEvents] = useState<CalendarEvent[]>([]);
  const [lastFetchedAtMs, setLastFetchedAtMs] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Scheduled routines for the selected day ────────────────────────────────
  // Derived read — no DB writes. Each scheduled routine counts toward capacity
  // as a single block (honestTotalMin). Pro-only: routines are a Pro feature,
  // so their minutes must not enter the load for free users (Pro-gate invariant:
  // free users must not see gated values or their position).
  const { blocks: routineBlocks } = useScheduledRoutines(selectedDate);

  // ── Honest minutes for queued tasks + scheduled routines ─────────────────
  // Mirrors the resolver used by useToday / resolveHonestTasks: guess × M_eff,
  // rounded to 5. Only 'queued' tasks feed the capacity read. Scheduled routine
  // blocks are appended only for Pro users — excludes them from the free-user
  // load so routine minutes can never be inferred from the teaser UI.
  const taskHonestMins = useMemo((): readonly number[] => {
    const taskMins = dayTasks
      .filter((t) => t.status === 'queued')
      .map((t) => {
        const cached = statsByCategory[t.category];
        const cat = cached
          ? { fit: cached.fit, n: cached.n }
          : { fit: { a: 0, b: seededPriorFor(t.category, archetypeSeed) }, n: 0 };
        return resolveSuggestion({ guessMinutes: t.guessMin, category: cat, recurring: null })
          .honestMinutes;
      });
    // Each scheduled routine counts as one block (its honest total) — Pro only.
    const routineMins = isPro ? routineBlocks.map((b) => b.honestTotalMin) : [];
    return [...taskMins, ...routineMins];
  }, [dayTasks, statsByCategory, routineBlocks, isPro, archetypeSeed]);

  // ── The calendar read ─────────────────────────────────────────────────────
  // Runs when Pro + showEvents. Respects the per-calendar filter (empty list =
  // all calendars; matches the settingsStore convention).
  //
  // `fetchIdRef` is a monotonic token: every read claims the next id and only
  // commits if it is still the newest. That covers both unmount and two reads
  // racing (focus + foreground can land together) — last read started wins,
  // never last resolved.
  const calendarIdsKey = enabledCalendarIds.join(',');
  const fetchIdRef = useRef(0);

  const readCalendar = useCallback(
    async (mode: 'initial' | 'silent'): Promise<void> => {
      // Free users or toggle off: short-circuit immediately (synchronous).
      if (!isPro || !showEvents) {
        setStatus('off');
        setEvents([]);
        setAllDayEvents([]);
        setLastFetchedAtMs(null);
        return;
      }

      const fetchId = ++fetchIdRef.current;
      // A repeat read stays on the last-known events — dropping to 'loading'
      // would blank the section on every foreground.
      if (mode === 'initial') setStatus('loading');

      const cal = getCalendar();
      const granted = await cal.requestReadAccess();
      if (fetchId !== fetchIdRef.current) return;

      if (!granted) {
        setStatus('denied');
        setEvents([]);
        setAllDayEvents([]);
        setLastFetchedAtMs(null);
        return;
      }

      const calendarIdsArg = calendarIdsKey.length > 0 ? calendarIdsKey.split(',') : undefined;
      const allEvents = await cal.getEventsForDay(selectedDate, calendarIdsArg);
      if (fetchId !== fetchIdRef.current) return;

      setEvents(allEvents.filter((e) => !e.allDay));
      setAllDayEvents(allEvents.filter((e) => e.allDay));
      setLastFetchedAtMs(Date.now());
      setStatus('ready');
    },
    [isPro, showEvents, selectedDate, calendarIdsKey],
  );

  // Read whenever the inputs change (selected day, Pro state, toggle, filter).
  useEffect(() => {
    void readCalendar('initial');
    // Invalidate any in-flight read so a late resolve can't clobber newer state.
    return () => {
      fetchIdRef.current += 1;
    };
  }, [readCalendar]);

  // The focus/foreground triggers read through a ref so their effects register
  // once and never re-subscribe when `readCalendar`'s identity changes.
  const readCalendarRef = useRef(readCalendar);
  useEffect(() => {
    readCalendarRef.current = readCalendar;
  }, [readCalendar]);

  // Re-read when the user comes back to this screen. The first focus is skipped:
  // the mount read above already covered it. `blurred` flips in the cleanup that
  // navigation runs on blur, so only a genuine leave-and-return re-reads.
  const blurredRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (blurredRef.current) {
        blurredRef.current = false;
        void readCalendarRef.current('silent');
      }
      return () => {
        blurredRef.current = true;
      };
    }, []),
  );

  // Re-read when the app returns to the foreground — the most common way the OS
  // calendar changes behind Whenbee's back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void readCalendarRef.current('silent');
    });
    return () => sub.remove();
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      await readCalendarRef.current('silent');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── Event timed minutes (only timed events count toward capacity) ─────────
  const eventTimedMins = useMemo((): readonly number[] => {
    return events.map((e) => Math.max(0, (e.endMs - e.startMs) / 60_000));
  }, [events]);

  // ── Compute honestDayLoad synchronously (always available, even before the
  //    calendar resolves — during 'loading' the event contribution is 0). ────
  const load = useMemo(
    (): DayLoadResult =>
      honestDayLoad({
        taskHonestMins,
        eventTimedMins,
        wakingWindowMin: WAKING_WINDOW_MIN,
      }),
    [taskHonestMins, eventTimedMins],
  );

  return { status, load, events, allDayEvents, isPro, lastFetchedAtMs, refresh, refreshing };
}
