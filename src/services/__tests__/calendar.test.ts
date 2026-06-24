// src/services/__tests__/calendar.test.ts
// Test the calendar stub (resolveCalendarModule(true, ...)) — expo-calendar is NOT
// imported here; the stub path is exercised so these tests run in jest without native modules.

import { resolveCalendarModule } from '../calendar';

const stub = resolveCalendarModule(true, () => ({}) as never);

describe('stub — CalendarEvent shape (new fields)', () => {
  it('getTodaysEvents returns events with allDay:false and a calendarId', async () => {
    const events = await stub.getTodaysEvents(Date.now());
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e).toHaveProperty('allDay', false);
      expect(typeof e.calendarId).toBe('string');
      expect(e.calendarId.length).toBeGreaterThan(0);
    }
  });

  it('getTodaysEvents still returns id, title, startMs, endMs', async () => {
    const events = await stub.getTodaysEvents(Date.now());
    for (const e of events) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.title).toBe('string');
      expect(typeof e.startMs).toBe('number');
      expect(typeof e.endMs).toBe('number');
    }
  });
});

describe('stub — getEventsForDay', () => {
  it('returns events with allDay:false and calendarId for a given dayKey', async () => {
    const dayKey = '2026-06-24';
    const events = await stub.getEventsForDay(dayKey);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e).toHaveProperty('allDay', false);
      expect(typeof e.calendarId).toBe('string');
      expect(e.calendarId.length).toBeGreaterThan(0);
    }
  });

  it('returns events anchored to the requested day (startMs within that local day)', async () => {
    const dayKey = '2026-06-24';
    const events = await stub.getEventsForDay(dayKey);
    const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
    const dayStart = new Date(y, m - 1, d).getTime();
    const dayEnd = new Date(y, m - 1, d + 1).getTime();
    for (const e of events) {
      expect(e.startMs).toBeGreaterThanOrEqual(dayStart);
      expect(e.startMs).toBeLessThan(dayEnd);
    }
  });

  it('returns events for a different dayKey anchored to that day', async () => {
    const dayKey = '2025-01-15';
    const events = await stub.getEventsForDay(dayKey);
    const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
    const dayStart = new Date(y, m - 1, d).getTime();
    const dayEnd = new Date(y, m - 1, d + 1).getTime();
    for (const e of events) {
      expect(e.startMs).toBeGreaterThanOrEqual(dayStart);
      expect(e.startMs).toBeLessThan(dayEnd);
    }
  });

  it('accepts optional calendarIds filter and still returns events', async () => {
    const events = await stub.getEventsForDay('2026-06-24', ['mock-cal']);
    expect(events.length).toBeGreaterThan(0);
  });

  it('returns empty array when calendarIds filter has no matches', async () => {
    const events = await stub.getEventsForDay('2026-06-24', ['nonexistent-cal']);
    expect(events).toEqual([]);
  });
});

describe('stub — listCalendars', () => {
  it('returns at least one calendar with id and title', async () => {
    const calendars = await stub.listCalendars();
    expect(calendars.length).toBeGreaterThan(0);
    for (const cal of calendars) {
      expect(typeof cal.id).toBe('string');
      expect(cal.id.length).toBeGreaterThan(0);
      expect(typeof cal.title).toBe('string');
      expect(cal.title.length).toBeGreaterThan(0);
    }
  });

  it('returns a calendar with id matching mock-cal', async () => {
    const calendars = await stub.listCalendars();
    const ids = calendars.map((c) => c.id);
    expect(ids).toContain('mock-cal');
  });
});

describe('stub — getTodaysEvents delegates to getEventsForDay', () => {
  it('returns same event ids as getEventsForDay for today', async () => {
    const nowMs = new Date('2026-06-24T10:00:00').getTime();
    const todayKey = '2026-06-24';
    const fromToday = await stub.getTodaysEvents(nowMs);
    const fromDay = await stub.getEventsForDay(todayKey);
    const todayIds = fromToday.map((e) => e.id).sort();
    const dayIds = fromDay.map((e) => e.id).sort();
    expect(todayIds).toEqual(dayIds);
  });
});

// ── A2: app-owned Whenbee-calendar write ops (stub path) ─────────────────────

describe('stub — requestWriteAccess (A2)', () => {
  it('resolves to true in the stub', async () => {
    const result = await stub.requestWriteAccess();
    expect(result).toBe(true);
  });
});

describe('stub — ensureWhenbeeCalendar (A2)', () => {
  it('returns a non-empty string id', async () => {
    const id = await stub.ensureWhenbeeCalendar(null);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns the same stub id regardless of existingId', async () => {
    const id1 = await stub.ensureWhenbeeCalendar(null);
    const id2 = await stub.ensureWhenbeeCalendar('some-existing-id');
    expect(id1).toBe(id2);
  });
});

describe('stub — createWhenbeeEvent (A2)', () => {
  it('returns a non-empty string event id', async () => {
    const calendarId = await stub.ensureWhenbeeCalendar(null);
    const eventId = await stub.createWhenbeeEvent(calendarId, {
      title: 'Deep work',
      startMs: Date.now(),
      endMs: Date.now() + 60 * 60_000,
    });
    expect(typeof eventId).toBe('string');
    expect(eventId.length).toBeGreaterThan(0);
  });
});

describe('stub — updateWhenbeeEvent (A2)', () => {
  it('resolves without error (stub no-op)', async () => {
    await expect(
      stub.updateWhenbeeEvent('fake-event-id', {
        startMs: Date.now(),
        endMs: Date.now() + 30 * 60_000,
        title: 'Updated',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('stub — deleteWhenbeeEvent (A2)', () => {
  it('resolves without error (stub no-op)', async () => {
    await expect(stub.deleteWhenbeeEvent('fake-event-id')).resolves.toBeUndefined();
  });
});

describe('stub — deleteAllWhenbeeEvents (A2)', () => {
  it('returns 0 (stub no-op)', async () => {
    const calendarId = await stub.ensureWhenbeeCalendar(null);
    const count = await stub.deleteAllWhenbeeEvents(calendarId);
    expect(count).toBe(0);
  });
});

describe('stub — deleteWhenbeeCalendar (A2)', () => {
  it('resolves without error (stub no-op)', async () => {
    const calendarId = await stub.ensureWhenbeeCalendar(null);
    await expect(stub.deleteWhenbeeCalendar(calendarId)).resolves.toBeUndefined();
  });
});

describe('stub — existing read ops + writeAdjustments still work after A2 (regression)', () => {
  it('requestReadAccess still returns true', async () => {
    expect(await stub.requestReadAccess()).toBe(true);
  });

  it('writeAdjustments still returns 0 (no-op in stub)', async () => {
    const written = await stub.writeAdjustments([
      { id: 'e1', startMs: Date.now(), endMs: Date.now() + 3600_000 },
    ]);
    expect(written).toBe(0);
  });

  it('listCalendars still returns mock-cal', async () => {
    const cals = await stub.listCalendars();
    expect(cals.map((c) => c.id)).toContain('mock-cal');
  });
});
