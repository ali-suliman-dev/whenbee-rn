import { useEffect, useMemo, useState } from 'react';
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

  // ── Calendar async effect ─────────────────────────────────────────────────
  // Runs when Pro + showEvents. Respects the per-calendar filter (empty list =
  // all calendars; matches the settingsStore convention).
  const calendarIdsKey = enabledCalendarIds.join(',');
  useEffect(() => {
    // Free users or toggle off: short-circuit immediately (synchronous).
    if (!isPro || !showEvents) {
      setStatus('off');
      setEvents([]);
      setAllDayEvents([]);
      return;
    }

    let active = true;
    setStatus('loading');

    const calendarIdsArg = enabledCalendarIds.length > 0 ? enabledCalendarIds : undefined;

    async function fetchEvents(): Promise<void> {
      const cal = getCalendar();
      const granted = await cal.requestReadAccess();
      if (!active) return;

      if (!granted) {
        setStatus('denied');
        setEvents([]);
        setAllDayEvents([]);
        return;
      }

      const allEvents = await cal.getEventsForDay(selectedDate, calendarIdsArg);
      if (!active) return;

      const timed = allEvents.filter((e) => !e.allDay);
      const allDay = allEvents.filter((e) => e.allDay);
      setEvents(timed);
      setAllDayEvents(allDay);
      setStatus('ready');
    }

    void fetchEvents();
    return () => {
      active = false;
    };
    // calendarIdsKey is the stable join of enabledCalendarIds (avoids array ref churn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, showEvents, isPro, calendarIdsKey]);

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

  return { status, load, events, allDayEvents, isPro };
}
