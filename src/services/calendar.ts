import { isExpoGo } from '@/src/lib/isExpoGo';
import { toLocalDayKey } from '@/src/lib/day';

// ──────────────────────────────────────────────────────────────────────────────
// calendar — the expo-calendar house (isExpoGo-guarded, like purchases).
//
// TRUST MODEL (do not weaken):
//
// READ path:
//   We request READ access first and show the user a preview. There is no
//   auto-read, no read-on-mount beyond the user-triggered day view.
//
// HONEST-DAY write path (existing):
//   `writeAdjustments` is the ONLY place we edit existing user calendar events.
//   It is called exclusively from the Honest-Day confirm handler and touches
//   only the event ids passed to it.
//
// APP-OWNED WRITE path (Phase 7 addition):
//   The methods below (`requestWriteAccess`, `ensureWhenbeeCalendar`,
//   `createWhenbeeEvent`, `updateWhenbeeEvent`, `deleteWhenbeeEvent`,
//   `deleteAllWhenbeeEvents`, `deleteWhenbeeCalendar`) operate EXCLUSIVELY on
//   the app-owned "Whenbee" calendar (identified by the calendarId passed in
//   from settings.calendar.whenbeeCalendarId). They NEVER write to, read from,
//   or delete any event or calendar that the user owns. The calendarId
//   parameter is the single gate — callers must pass only the Whenbee id.
//
// Expo Go can't load the native module, so the stub returns a deterministic set
// of mock events (so the UI/tests work) and all writes are no-ops.
// ──────────────────────────────────────────────────────────────────────────────

/** One calendar event, reduced to what the honest-day builder needs. */
export interface CalendarEvent {
  /** Native event id — the handle a write uses to update the same row. */
  id: string;
  title: string;
  /** epoch ms */
  startMs: number;
  /** epoch ms */
  endMs: number;
  /** True for all-day events. Excluded from capacity math; shown separately. */
  allDay: boolean;
  /** The source calendar's id. Used for per-calendar visibility filtering. */
  calendarId: string;
}

/** A single confirmed time change for one event (the ONLY thing a write applies). */
export interface CalendarAdjustment {
  id: string;
  startMs: number;
  endMs: number;
}

/** Input shape for creating or updating a Whenbee-owned event. */
export interface WhenbeeEventInput {
  title: string;
  startMs: number;
  endMs: number;
}

/** Input shape for updating a Whenbee-owned event (title is optional). */
export interface WhenbeeEventUpdate {
  startMs: number;
  endMs: number;
  title?: string;
}

export interface CalendarModule {
  isStub: boolean;
  /** True once read access is granted. Asks the OS the first time. */
  requestReadAccess: () => Promise<boolean>;
  /** Request WRITE permission for the calendar. Required before any write op. */
  requestWriteAccess: () => Promise<boolean>;
  /**
   * Events for a specific local day (YYYY-MM-DD). If `calendarIds` is provided
   * and non-empty, only events from those calendars are returned.
   */
  getEventsForDay: (
    dayKey: string,
    calendarIds?: readonly string[],
  ) => Promise<CalendarEvent[]>;
  /** Today's events (local day). Delegates to getEventsForDay. */
  getTodaysEvents: (nowMs: number) => Promise<CalendarEvent[]>;
  /** All calendars visible to the app. Used for per-calendar settings UI. */
  listCalendars: () => Promise<{ id: string; title: string }[]>;
  /**
   * Apply confirmed time changes. CALLED ONLY FROM THE CONFIRM HANDLER. Returns
   * how many events were written.
   */
  writeAdjustments: (adjustments: CalendarAdjustment[]) => Promise<number>;

  // ── App-owned Whenbee-calendar write ops ────────────────────────────────────
  // These methods operate ONLY on the app-owned "Whenbee" calendar.
  // The calendarId / eventId they receive MUST be the Whenbee one — never a
  // user calendar. No write path touches any other calendar.

  /**
   * Return a valid app-owned "Whenbee" calendar id. Creates the calendar if
   * `existingId` is null or no longer exists on-device. The new calendar is
   * titled "Whenbee" and is attached to the default modifiable local source.
   */
  ensureWhenbeeCalendar: (existingId: string | null) => Promise<string>;

  /**
   * Create an event in the Whenbee calendar. Returns the native event id.
   * ONLY called with the Whenbee calendarId from settings.
   */
  createWhenbeeEvent: (calendarId: string, event: WhenbeeEventInput) => Promise<string>;

  /**
   * Update an existing Whenbee-owned event's times (and optionally title).
   * ONLY called with event ids created by `createWhenbeeEvent`.
   */
  updateWhenbeeEvent: (eventId: string, update: WhenbeeEventUpdate) => Promise<void>;

  /**
   * Delete a single Whenbee-owned event.
   * ONLY called with event ids created by `createWhenbeeEvent`.
   */
  deleteWhenbeeEvent: (eventId: string) => Promise<void>;

  /**
   * Delete ALL events in the Whenbee calendar (used on export disable).
   * Scans a wide window (~10 years) and deletes every event found.
   * Returns the count of deleted events.
   * ONLY ever called with the Whenbee calendarId.
   */
  deleteAllWhenbeeEvents: (calendarId: string) => Promise<number>;

  /**
   * Remove the app-owned Whenbee calendar entirely (optional, on full disable).
   * ONLY called with the Whenbee calendarId.
   */
  deleteWhenbeeCalendar: (calendarId: string) => Promise<void>;
}

type NativeCalendar = typeof import('expo-calendar');

/** Local-day [start, end) bounds in epoch ms for a 'YYYY-MM-DD' key. */
function dayKeyBounds(dayKey: string): { start: number; end: number } {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 1);
  return { start: start.getTime(), end: end.getTime() };
}

// ── Deterministic Expo Go / test mock ────────────────────────────────────────
// A realistic, optimistic day: three back-to-back blocks whose titles map to
// known categories, so the preview and the cascade both have something to show.
const MOCK_CALENDAR_ID = 'mock-cal';
const STUB_WHENBEE_CALENDAR_ID = 'whenbee-cal-stub';

function mockEventsForDay(dayKey: string): CalendarEvent[] {
  const { start } = dayKeyBounds(dayKey);
  const MIN = 60_000;
  const at = (offsetMin: number) => start + offsetMin * MIN;
  return [
    {
      id: 'mock-1',
      title: 'Reply to email',
      startMs: at(9 * 60),
      endMs: at(9 * 60 + 30),
      allDay: false,
      calendarId: MOCK_CALENDAR_ID,
    },
    {
      id: 'mock-2',
      title: 'Write the proposal',
      startMs: at(10 * 60),
      endMs: at(11 * 60),
      allDay: false,
      calendarId: MOCK_CALENDAR_ID,
    },
    {
      id: 'mock-3',
      title: 'Client call',
      startMs: at(14 * 60),
      endMs: at(14 * 60 + 30),
      allDay: false,
      calendarId: MOCK_CALENDAR_ID,
    },
  ];
}

function createStub(): CalendarModule {
  return {
    isStub: true,

    requestReadAccess: async () => true,

    requestWriteAccess: async () => true,

    getEventsForDay: async (
      dayKey: string,
      calendarIds?: readonly string[],
    ): Promise<CalendarEvent[]> => {
      const events = mockEventsForDay(dayKey);
      if (calendarIds !== undefined && calendarIds.length > 0) {
        return events.filter((e) => calendarIds.includes(e.calendarId));
      }
      return events;
    },

    getTodaysEvents: async (nowMs: number): Promise<CalendarEvent[]> => {
      const dayKey = toLocalDayKey(nowMs);
      const events = mockEventsForDay(dayKey);
      return events;
    },

    listCalendars: async () => [{ id: MOCK_CALENDAR_ID, title: 'Calendar' }],

    // No-op: Expo Go has no calendar to write to. Reports zero written.
    writeAdjustments: async () => 0,

    // ── App-owned write ops — stub implementations ───────────────────────────

    ensureWhenbeeCalendar: async (_existingId) => STUB_WHENBEE_CALENDAR_ID,

    createWhenbeeEvent: async (_calendarId, _event) => 'whenbee-event-stub',

    updateWhenbeeEvent: async (_eventId, _update) => undefined,

    deleteWhenbeeEvent: async (_eventId) => undefined,

    deleteAllWhenbeeEvents: async (_calendarId) => 0,

    deleteWhenbeeCalendar: async (_calendarId) => undefined,
  };
}

/** Wide window for delete-all: 5 years back to 5 years forward. */
const DELETE_ALL_PAST_MS = 5 * 365 * 24 * 60 * 60_000;
const DELETE_ALL_FUTURE_MS = 5 * 365 * 24 * 60 * 60_000;

function createNative(Calendar: NativeCalendar): CalendarModule {
  return {
    isStub: false,

    requestReadAccess: async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      return status === 'granted';
    },

    requestWriteAccess: async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      return status === 'granted';
    },

    getEventsForDay: async (
      dayKey: string,
      calendarIds?: readonly string[],
    ): Promise<CalendarEvent[]> => {
      const { start, end } = dayKeyBounds(dayKey);

      // Resolve which calendar ids to query.
      let ids: string[];
      if (calendarIds !== undefined && calendarIds.length > 0) {
        ids = [...calendarIds];
      } else {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        ids = calendars.map((c) => c.id);
      }
      if (ids.length === 0) return [];

      const events = await Calendar.getEventsAsync(ids, new Date(start), new Date(end));

      return events.map((e) => ({
        id: e.id,
        title: e.title ?? 'Untitled',
        startMs: new Date(e.startDate).getTime(),
        endMs: new Date(e.endDate).getTime(),
        allDay: e.allDay ?? false,
        calendarId: e.calendarId,
      }));
    },

    getTodaysEvents: async (nowMs: number): Promise<CalendarEvent[]> => {
      const dayKey = toLocalDayKey(nowMs);
      // Delegate — avoids duplicating the bounds + mapping logic.
      return createNative(Calendar).getEventsForDay(dayKey);
    },

    listCalendars: async () => {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      return calendars.map((c) => ({ id: c.id, title: c.title }));
    },

    // ⚠️ The ONLY path for editing user-owned calendar events. Mutates each
    // event's start/end to the confirmed honest times. Reached exclusively from
    // the confirm handler.
    writeAdjustments: async (adjustments) => {
      let written = 0;
      for (const adj of adjustments) {
        await Calendar.updateEventAsync(adj.id, {
          startDate: new Date(adj.startMs),
          endDate: new Date(adj.endMs),
        });
        written += 1;
      }
      return written;
    },

    // ── App-owned write ops — native implementations ─────────────────────────
    // SAFETY: every method below accepts a calendarId / eventId that MUST be
    // the app-owned Whenbee calendar — callers are responsible for passing only
    // that id. These methods never look up, enumerate, or touch any other
    // calendar or event.

    ensureWhenbeeCalendar: async (existingId) => {
      // If we have a stored id, verify it still exists.
      if (existingId !== null) {
        try {
          const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
          const found = calendars.find((c) => c.id === existingId);
          if (found !== undefined) return existingId;
        } catch {
          // Fall through to create a new one.
        }
      }

      // Pick a modifiable local source (prefer the default calendar's source).
      let sourceId: string | undefined;
      try {
        const defaultCal = await Calendar.getDefaultCalendarAsync();
        sourceId = defaultCal.source?.id;
      } catch {
        // getDefaultCalendarAsync may not be available on all platforms.
      }

      if (sourceId === undefined) {
        // Fall back: find a local/modifiable source.
        const sources = await Calendar.getSourcesAsync();
        const local = sources.find(
          (s) => s.type === Calendar.SourceType.LOCAL || s.isLocalAccount,
        );
        sourceId = local?.id ?? sources[0]?.id;
      }

      const newId = await Calendar.createCalendarAsync({
        title: 'Whenbee',
        color: '#F5A623',
        entityType: Calendar.EntityTypes.EVENT,
        sourceId,
        name: 'whenbee',
        ownerAccount: 'whenbee',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });

      return newId;
    },

    createWhenbeeEvent: async (calendarId, event) => {
      const id = await Calendar.createEventAsync(calendarId, {
        title: event.title,
        startDate: new Date(event.startMs),
        endDate: new Date(event.endMs),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      return id;
    },

    updateWhenbeeEvent: async (eventId, update) => {
      await Calendar.updateEventAsync(eventId, {
        startDate: new Date(update.startMs),
        endDate: new Date(update.endMs),
        ...(update.title !== undefined ? { title: update.title } : {}),
      });
    },

    deleteWhenbeeEvent: async (eventId) => {
      await Calendar.deleteEventAsync(eventId);
    },

    deleteAllWhenbeeEvents: async (calendarId) => {
      const now = Date.now();
      const rangeStart = new Date(now - DELETE_ALL_PAST_MS);
      const rangeEnd = new Date(now + DELETE_ALL_FUTURE_MS);
      const events = await Calendar.getEventsAsync(
        [calendarId],
        rangeStart,
        rangeEnd,
      );
      let count = 0;
      for (const event of events) {
        await Calendar.deleteEventAsync(event.id);
        count += 1;
      }
      return count;
    },

    deleteWhenbeeCalendar: async (calendarId) => {
      await Calendar.deleteCalendarAsync(calendarId);
    },
  };
}

export function resolveCalendarModule(
  expoGo: boolean,
  loadNative: () => NativeCalendar,
): CalendarModule {
  return expoGo ? createStub() : createNative(loadNative());
}

const loadNativeCalendar = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('expo-calendar') as NativeCalendar;

let cached: CalendarModule | null = null;
export function getCalendar(): CalendarModule {
  if (!cached) cached = resolveCalendarModule(isExpoGo, loadNativeCalendar);
  return cached;
}
