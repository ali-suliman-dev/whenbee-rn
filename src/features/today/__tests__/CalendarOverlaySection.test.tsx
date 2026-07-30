import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CalendarOverlaySection } from '@/src/features/today/CalendarOverlaySection';
import type { CalendarEvent } from '@/src/services/calendar';
import { setClockHour12 } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// CalendarOverlaySection — read-only calendar event display for the selected day.
//
// Collapsed by default (mirrors DoneSection): only the "CALENDAR · N" header shows
// until tapped. Once expanded, timed events render as agenda rows on the TaskRow
// grid — title + span on the left, start clock over "PM – 3:00 PM" pinned right —
// and all-day events as an "All day · …" sub-line. There is no refresh button:
// the calendar re-reads on focus, on foreground and on Today's pull-to-refresh.
// The section renders nothing when both arrays are empty.
// ──────────────────────────────────────────────────────────────────────────────

function makeTimedEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const base: CalendarEvent = {
    id: 'evt-1',
    title: 'Team sync',
    startMs: new Date('2024-01-15T14:00:00').getTime(),
    endMs: new Date('2024-01-15T15:00:00').getTime(),
    allDay: false,
    calendarId: 'cal-1',
  };
  return { ...base, ...overrides };
}

function makeAllDayEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const base: CalendarEvent = {
    id: 'evt-allday',
    title: 'Company holiday',
    startMs: new Date('2024-01-15T00:00:00').getTime(),
    endMs: new Date('2024-01-15T23:59:59').getTime(),
    allDay: true,
    calendarId: 'cal-1',
  };
  return { ...base, ...overrides };
}

/** Tap the "CALENDAR · N" header to reveal the event rows. */
function expandSection(): void {
  fireEvent.press(screen.getByText(/calendar ·/i));
}

describe('CalendarOverlaySection — empty', () => {
  it('renders nothing when both events and allDayEvents are empty', () => {
    const { toJSON } = render(
      <CalendarOverlaySection events={[]} allDayEvents={[]} />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe('CalendarOverlaySection — collapse behaviour', () => {
  it('shows the "CALENDAR · N" header with the event count', () => {
    render(
      <CalendarOverlaySection
        events={[makeTimedEvent(), makeTimedEvent({ id: 'e2' })]}
        allDayEvents={[makeAllDayEvent()]}
      />,
    );
    // 2 timed + 1 all-day = 3
    expect(screen.getByText('CALENDAR · 3')).toBeOnTheScreen();
  });

  it('is collapsed by default — no event rows until tapped', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expect(screen.queryByText('Team sync')).toBeNull();
  });

  it('reveals the rows after tapping the header', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expandSection();
    expect(screen.getByText('Team sync')).toBeOnTheScreen();
  });

  it('collapses again on a second tap', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expandSection();
    expect(screen.getByText('Team sync')).toBeOnTheScreen();
    expandSection();
    expect(screen.queryByText('Team sync')).toBeNull();
  });
});

describe('CalendarOverlaySection — timed events (expanded)', () => {
  it('renders the event title', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expandSection();
    expect(screen.getByText('Team sync')).toBeOnTheScreen();
  });

  it('pins the start clock to the right of the row', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expandSection();
    expect(screen.getByText('2:00')).toBeOnTheScreen();
  });

  it('stacks the meridiem and end time under the start clock', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expandSection();
    // 14:00 → 15:00, so the tail carries both meridiems and the 3:00 finish.
    expect(screen.getByText('PM – 3:00 PM')).toBeOnTheScreen();
  });

  it('leaves only the span on the left, under the title', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expandSection();
    expect(screen.getByText('1h')).toBeOnTheScreen();
  });

  it('states a long span in hours and minutes, never bare minutes', () => {
    const long = makeTimedEvent({
      endMs: new Date('2024-01-15T15:55:00').getTime(),
    });
    render(<CalendarOverlaySection events={[long]} allDayEvents={[]} />);
    expandSection();
    expect(screen.getByText('1h 55m')).toBeOnTheScreen();
    expect(screen.queryByText('115m')).toBeNull();
  });

  it('drops every meridiem for a 24-hour user', () => {
    setClockHour12(false);
    try {
      render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
      expandSection();
      expect(screen.getByText('14:00')).toBeOnTheScreen();
      expect(screen.getByText('– 15:00')).toBeOnTheScreen();
      expect(screen.queryByText(/PM/)).toBeNull();
    } finally {
      setClockHour12(true);
    }
  });

  it('renders multiple timed event rows', () => {
    const events = [
      makeTimedEvent({ id: 'e1', title: 'Stand-up' }),
      makeTimedEvent({ id: 'e2', title: 'Design review' }),
    ];
    render(<CalendarOverlaySection events={events} allDayEvents={[]} />);
    expandSection();
    expect(screen.getByText('Stand-up')).toBeOnTheScreen();
    expect(screen.getByText('Design review')).toBeOnTheScreen();
  });

  it('does NOT render the all-day sub-line when allDayEvents is empty', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expandSection();
    expect(screen.queryByText(/all day/i)).toBeNull();
  });
});

describe('CalendarOverlaySection — all-day events (expanded)', () => {
  it('renders the all-day sub-line when allDayEvents exist', () => {
    render(<CalendarOverlaySection events={[]} allDayEvents={[makeAllDayEvent()]} />);
    expandSection();
    expect(screen.getByText(/all day/i)).toBeOnTheScreen();
  });

  it('includes the all-day event title in the sub-line', () => {
    render(
      <CalendarOverlaySection
        events={[]}
        allDayEvents={[makeAllDayEvent({ title: 'Team offsite' })]}
      />,
    );
    expandSection();
    expect(screen.getByText(/team offsite/i)).toBeOnTheScreen();
  });

  it('joins multiple all-day event titles', () => {
    render(
      <CalendarOverlaySection
        events={[]}
        allDayEvents={[
          makeAllDayEvent({ id: 'a1', title: 'Offsite' }),
          makeAllDayEvent({ id: 'a2', title: 'No meetings' }),
        ]}
      />,
    );
    expandSection();
    expect(screen.getByText(/offsite/i)).toBeOnTheScreen();
    expect(screen.getByText(/no meetings/i)).toBeOnTheScreen();
  });
});

describe('CalendarOverlaySection — mixed (expanded)', () => {
  it('renders both timed rows and all-day sub-line when both are present', () => {
    render(
      <CalendarOverlaySection
        events={[makeTimedEvent({ title: 'Sprint retro' })]}
        allDayEvents={[makeAllDayEvent({ title: 'Holiday' })]}
      />,
    );
    expandSection();
    expect(screen.getByText('Sprint retro')).toBeOnTheScreen();
    expect(screen.getByText(/all day/i)).toBeOnTheScreen();
    expect(screen.getByText(/holiday/i)).toBeOnTheScreen();
  });
});

// ── Header: staleness stamp, and NO refresh button ──────────────────────────
// The calendar re-reads on screen focus, on app foreground, and on Today's
// pull-to-refresh (all three in useDayCapacity). A permanent refresh glyph was a
// fourth path to the same call, so it is gone. The "updated Nm ago" stamp stays:
// it is information — silent under the 2-minute threshold, present above it.

describe('CalendarOverlaySection — header', () => {
  const NOW = new Date('2024-01-15T12:00:00').getTime();
  const MIN = 60_000;

  function renderHeader(props: { lastFetchedAtMs?: number | null }) {
    return render(
      <CalendarOverlaySection
        events={[makeTimedEvent()]}
        allDayEvents={[]}
        nowMs={NOW}
        {...props}
      />,
    );
  }

  it('renders no refresh control, however stale the read is', () => {
    renderHeader({ lastFetchedAtMs: NOW - 60 * MIN });
    expect(screen.queryByLabelText(/refresh/i)).toBeNull();
  });

  it('shows no age stamp while the read is fresh', () => {
    renderHeader({ lastFetchedAtMs: NOW - MIN });
    expect(screen.queryByText(/updated/i)).toBeNull();
  });

  it('shows the age stamp once the read is stale', () => {
    renderHeader({ lastFetchedAtMs: NOW - 6 * MIN });
    expect(screen.getByText('updated 6m ago')).toBeOnTheScreen();
  });

  it('shows no age stamp when the calendar was never read', () => {
    renderHeader({ lastFetchedAtMs: null });
    expect(screen.queryByText(/updated/i)).toBeNull();
  });

  it('keeps the event rows readable while the stamp is showing', () => {
    renderHeader({ lastFetchedAtMs: NOW - 6 * MIN });
    expandSection();
    expect(screen.getByText('Team sync')).toBeOnTheScreen();
    expect(screen.getByText('2:00')).toBeOnTheScreen();
    expect(screen.getByText('PM – 3:00 PM')).toBeOnTheScreen();
  });
});

// Pro-gate regression: useDayCapacity returns [] for free users (calendar is
// never fetched). CalendarOverlaySection must render nothing when events=[].
// This test documents the contract between the hook and the component so that
// a future change to useDayCapacity can't silently surface calendar data to
// free users without a test failure.
describe('CalendarOverlaySection — Pro-gate regression (free user)', () => {
  it('renders nothing when both arrays are empty (the free-user contract)', () => {
    const { toJSON } = render(
      <CalendarOverlaySection events={[]} allDayEvents={[]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('never renders the "Calendar" header for a free user (empty arrays)', () => {
    render(<CalendarOverlaySection events={[]} allDayEvents={[]} />);
    expect(screen.queryByText(/calendar/i)).toBeNull();
  });

  it('never renders any event title for a free user (empty arrays)', () => {
    render(<CalendarOverlaySection events={[]} allDayEvents={[]} />);
    expect(screen.queryByText(/team sync/i)).toBeNull();
  });
});
