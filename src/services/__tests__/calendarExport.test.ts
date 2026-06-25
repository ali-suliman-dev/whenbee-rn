// src/services/__tests__/calendarExport.test.ts
//
// TDD tests for the day-plan export sync service.
// The calendar module is mocked entirely — expo-calendar never loads.
// WRITE-SAFETY: assertions verify that create/update/delete are NEVER called
// with a foreign calendar id.

import { getCalendar } from '../calendar';
import { syncDayPlanToCalendar, disableExport } from '../calendarExport';

// jest.mock is hoisted by babel-jest at compile time, so this runs before the
// module import regardless of source order.
jest.mock('../calendar', () => ({ getCalendar: jest.fn() }));

const WHENBEE_CALENDAR_ID = 'whenbee-cal-abc123';
const FOREIGN_CALENDAR_ID = 'user-primary-cal';

// ── Fake calendar module ──────────────────────────────────────────────────────

let nextEventId = 1;

function makeCalendarMock() {
  const createWhenbeeEvent = jest.fn(async (_calId: string, _e: unknown) => {
    return `whenbee-event-${nextEventId++}`;
  });
  const updateWhenbeeEvent = jest.fn(async () => undefined);
  const deleteWhenbeeEvent = jest.fn(async () => undefined);
  const deleteAllWhenbeeEvents = jest.fn(async (_calId: string) => 5);

  return {
    createWhenbeeEvent,
    updateWhenbeeEvent,
    deleteWhenbeeEvent,
    deleteAllWhenbeeEvents,
    // Unused methods — present to satisfy the CalendarModule interface shape
    isStub: true,
    requestReadAccess: jest.fn(),
    requestWriteAccess: jest.fn(),
    getEventsForDay: jest.fn(),
    getTodaysEvents: jest.fn(),
    listCalendars: jest.fn(),
    writeAdjustments: jest.fn(),
    ensureWhenbeeCalendar: jest.fn(),
    deleteWhenbeeCalendar: jest.fn(),
  };
}

const mockedGetCalendar = getCalendar as jest.MockedFunction<typeof getCalendar>;

beforeEach(() => {
  nextEventId = 1;
  jest.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(
  id: string,
  label: string,
  calendarEventId: string | null = null,
  offsetHrs = 9,
): { id: string; label: string; startMs: number; endMs: number; calendarEventId: string | null } {
  const base = new Date('2026-06-24T00:00:00.000Z').getTime();
  const startMs = base + offsetHrs * 60 * 60 * 1000;
  const endMs = startMs + 30 * 60 * 1000;
  return { id, label, startMs, endMs, calendarEventId };
}

/** Safely extract the first argument of a mock call (noUncheckedIndexedAccess-safe). */
function firstArg(call: unknown[]): unknown {
  if (call.length === 0) throw new Error('mock call has no arguments');
  return call[0];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('syncDayPlanToCalendar', () => {
  it('creates events for 2 timed tasks that have no calendarEventId', async () => {
    const mock = makeCalendarMock();
    mockedGetCalendar.mockReturnValue(mock as ReturnType<typeof getCalendar>);

    const result = await syncDayPlanToCalendar({
      date: '2026-06-24',
      calendarId: WHENBEE_CALENDAR_ID,
      plannedTasks: [makeTask('t1', 'Deep work', null, 9), makeTask('t2', 'Review', null, 10)],
      priorLinks: [],
    });

    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.links).toHaveLength(2);
    expect(result.links.map((l) => l.taskId).sort()).toEqual(['t1', 't2'].sort());
    // Each link must carry a real event id
    for (const link of result.links) {
      expect(link.eventId).toMatch(/^whenbee-event-/);
    }
    expect(mock.createWhenbeeEvent).toHaveBeenCalledTimes(2);
  });

  it('updates event when task already has a calendarEventId (re-sync with changed times)', async () => {
    const mock = makeCalendarMock();
    mockedGetCalendar.mockReturnValue(mock as ReturnType<typeof getCalendar>);

    const existingEventId = 'whenbee-event-existing-99';
    const task = makeTask('t1', 'Deep work', existingEventId, 9);

    const result = await syncDayPlanToCalendar({
      date: '2026-06-24',
      calendarId: WHENBEE_CALENDAR_ID,
      plannedTasks: [task],
      priorLinks: [],
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.deleted).toBe(0);
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toEqual({ taskId: 't1', eventId: existingEventId });
    expect(mock.updateWhenbeeEvent).toHaveBeenCalledTimes(1);
    expect(mock.updateWhenbeeEvent).toHaveBeenCalledWith(existingEventId, {
      startMs: task.startMs,
      endMs: task.endMs,
      title: task.label,
    });
    expect(mock.createWhenbeeEvent).not.toHaveBeenCalled();
  });

  it('deletes events for priorLinks whose task is no longer in plannedTasks', async () => {
    const mock = makeCalendarMock();
    mockedGetCalendar.mockReturnValue(mock as ReturnType<typeof getCalendar>);

    const result = await syncDayPlanToCalendar({
      date: '2026-06-24',
      calendarId: WHENBEE_CALENDAR_ID,
      // Only t1 is still planned; t2 was previously exported but removed
      plannedTasks: [makeTask('t1', 'Deep work', 'whenbee-event-1', 9)],
      priorLinks: [
        { taskId: 't1', eventId: 'whenbee-event-1' },
        { taskId: 't2', eventId: 'whenbee-event-2' },
      ],
    });

    expect(result.deleted).toBe(1);
    expect(mock.deleteWhenbeeEvent).toHaveBeenCalledTimes(1);
    expect(mock.deleteWhenbeeEvent).toHaveBeenCalledWith('whenbee-event-2');
    // t1 should have been updated (it had a calendarEventId)
    expect(result.updated).toBe(1);
    // links should only include t1
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toEqual({ taskId: 't1', eventId: 'whenbee-event-1' });
  });

  it('handles mix: one new task (create) + one existing (update) + one removed (delete)', async () => {
    const mock = makeCalendarMock();
    mockedGetCalendar.mockReturnValue(mock as ReturnType<typeof getCalendar>);

    const result = await syncDayPlanToCalendar({
      date: '2026-06-24',
      calendarId: WHENBEE_CALENDAR_ID,
      plannedTasks: [
        makeTask('t1', 'Deep work', null, 9),            // new → create
        makeTask('t2', 'Review', 'whenbee-event-2', 10), // existing → update
      ],
      priorLinks: [
        { taskId: 't2', eventId: 'whenbee-event-2' },
        { taskId: 't3', eventId: 'whenbee-event-3' }, // removed → delete
      ],
    });

    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.deleted).toBe(1);
    expect(result.links).toHaveLength(2);
    expect(mock.deleteWhenbeeEvent).toHaveBeenCalledWith('whenbee-event-3');
  });

  // ── WRITE SAFETY ─────────────────────────────────────────────────────────────

  it('[WRITE-SAFETY] create/update/delete are never called with a foreign calendar id', async () => {
    const mock = makeCalendarMock();
    mockedGetCalendar.mockReturnValue(mock as ReturnType<typeof getCalendar>);

    await syncDayPlanToCalendar({
      date: '2026-06-24',
      calendarId: WHENBEE_CALENDAR_ID,
      plannedTasks: [
        makeTask('t1', 'Deep work', null, 9),
        makeTask('t2', 'Review', 'whenbee-event-existing', 10),
      ],
      priorLinks: [{ taskId: 't3', eventId: 'whenbee-event-old' }],
    });

    // createWhenbeeEvent's first arg must always be WHENBEE_CALENDAR_ID
    for (const call of mock.createWhenbeeEvent.mock.calls) {
      const calId = firstArg(call);
      expect(calId).toBe(WHENBEE_CALENDAR_ID);
      expect(calId).not.toBe(FOREIGN_CALENDAR_ID);
    }

    // updateWhenbeeEvent must only be called with known Whenbee event ids
    for (const call of mock.updateWhenbeeEvent.mock.calls) {
      const eventId = firstArg(call) as string;
      expect(eventId).not.toBe(FOREIGN_CALENDAR_ID);
      expect(eventId).toMatch(/whenbee-event/);
    }

    // deleteWhenbeeEvent must only be called with known Whenbee event ids
    for (const call of mock.deleteWhenbeeEvent.mock.calls) {
      const eventId = firstArg(call) as string;
      expect(eventId).not.toBe(FOREIGN_CALENDAR_ID);
      expect(eventId).toMatch(/whenbee-event/);
    }
  });

  it('[WRITE-SAFETY] falsy calendarId → no calendar ops, zeros returned', async () => {
    const mock = makeCalendarMock();
    mockedGetCalendar.mockReturnValue(mock as ReturnType<typeof getCalendar>);

    const result = await syncDayPlanToCalendar({
      date: '2026-06-24',
      calendarId: '',
      plannedTasks: [makeTask('t1', 'Deep work', null, 9)],
      priorLinks: [{ taskId: 't2', eventId: 'whenbee-event-2' }],
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.links).toEqual([]);
    expect(mock.createWhenbeeEvent).not.toHaveBeenCalled();
    expect(mock.updateWhenbeeEvent).not.toHaveBeenCalled();
    expect(mock.deleteWhenbeeEvent).not.toHaveBeenCalled();
  });
});

describe('disableExport', () => {
  it('calls deleteAllWhenbeeEvents with the given calendar id and returns count', async () => {
    const mock = makeCalendarMock();
    mockedGetCalendar.mockReturnValue(mock as ReturnType<typeof getCalendar>);

    const count = await disableExport(WHENBEE_CALENDAR_ID);

    expect(mock.deleteAllWhenbeeEvents).toHaveBeenCalledTimes(1);
    expect(mock.deleteAllWhenbeeEvents).toHaveBeenCalledWith(WHENBEE_CALENDAR_ID);
    expect(count).toBe(5); // the mock returns 5
  });

  it('returns 0 and never calls calendar ops when calendarId is falsy', async () => {
    const mock = makeCalendarMock();
    mockedGetCalendar.mockReturnValue(mock as ReturnType<typeof getCalendar>);

    const count = await disableExport('');

    expect(count).toBe(0);
    expect(mock.deleteAllWhenbeeEvents).not.toHaveBeenCalled();
  });

  it('[WRITE-SAFETY] deleteAllWhenbeeEvents never called with a foreign calendar id', async () => {
    const mock = makeCalendarMock();
    mockedGetCalendar.mockReturnValue(mock as ReturnType<typeof getCalendar>);

    await disableExport(WHENBEE_CALENDAR_ID);

    for (const call of mock.deleteAllWhenbeeEvents.mock.calls) {
      const calId = firstArg(call);
      expect(calId).toBe(WHENBEE_CALENDAR_ID);
      expect(calId).not.toBe(FOREIGN_CALENDAR_ID);
    }
  });
});
