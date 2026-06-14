import { isExpoGo } from '@/src/lib/isExpoGo';

// ──────────────────────────────────────────────────────────────────────────────
// calendar — the expo-calendar house (isExpoGo-guarded, like purchases/sentry).
//
// TRUST MODEL (do not weaken): we request READ access first and show the user a
// preview. We NEVER write to the calendar except from `writeAdjustments`, and
// `writeAdjustments` is only ever called from the Honest-Day confirm handler.
// There is no auto-write, no write-on-mount, no write-on-read.
//
// Expo Go can't load the native module, so the stub returns a deterministic set
// of mock events (so the UI/tests work) and `writeAdjustments` is a no-op.
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
}

/** A single confirmed time change for one event (the ONLY thing a write applies). */
export interface CalendarAdjustment {
  id: string;
  startMs: number;
  endMs: number;
}

export interface CalendarModule {
  isStub: boolean;
  /** True once read access is granted. Asks the OS the first time. */
  requestReadAccess: () => Promise<boolean>;
  /** Today's events (local day), start/end/title. Empty when access is denied. */
  getTodaysEvents: (nowMs: number) => Promise<CalendarEvent[]>;
  /**
   * Apply confirmed time changes. CALLED ONLY FROM THE CONFIRM HANDLER. Returns
   * how many events were written.
   */
  writeAdjustments: (adjustments: CalendarAdjustment[]) => Promise<number>;
}

type NativeCalendar = typeof import('expo-calendar');

/** Local-day [start, end) bounds in epoch ms for the day containing `nowMs`. */
function localDayBounds(nowMs: number): { start: number; end: number } {
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

// ── Deterministic Expo Go / test mock ────────────────────────────────────────
// A realistic, optimistic day: three back-to-back blocks whose titles map to
// known categories, so the preview and the cascade both have something to show.
function mockTodaysEvents(nowMs: number): CalendarEvent[] {
  const { start } = localDayBounds(nowMs);
  const MIN = 60_000;
  const at = (offsetMin: number) => start + offsetMin * MIN;
  return [
    { id: 'mock-1', title: 'Reply to email', startMs: at(9 * 60), endMs: at(9 * 60 + 30) },
    { id: 'mock-2', title: 'Write the proposal', startMs: at(10 * 60), endMs: at(11 * 60) },
    { id: 'mock-3', title: 'Client call', startMs: at(14 * 60), endMs: at(14 * 60 + 30) },
  ];
}

function createStub(): CalendarModule {
  return {
    isStub: true,
    requestReadAccess: async () => true,
    getTodaysEvents: async (nowMs: number) => mockTodaysEvents(nowMs),
    // No-op: Expo Go has no calendar to write to. Reports zero written.
    writeAdjustments: async () => 0,
  };
}

function createNative(Calendar: NativeCalendar): CalendarModule {
  return {
    isStub: false,

    requestReadAccess: async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      return status === 'granted';
    },

    getTodaysEvents: async (nowMs: number) => {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const ids = calendars.map((c) => c.id);
      if (ids.length === 0) return [];

      const { start, end } = localDayBounds(nowMs);
      const events = await Calendar.getEventsAsync(ids, new Date(start), new Date(end));

      return events.map((e) => ({
        id: e.id,
        title: e.title ?? 'Untitled',
        startMs: new Date(e.startDate).getTime(),
        endMs: new Date(e.endDate).getTime(),
      }));
    },

    // ⚠️ The ONLY write path. Mutates each event's start/end to the confirmed
    // honest times. Reached exclusively from the confirm handler.
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
