import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CalendarOverlaySection } from '@/src/features/today/CalendarOverlaySection';
import type { CalendarEvent } from '@/src/services/calendar';

// ──────────────────────────────────────────────────────────────────────────────
// CalendarOverlaySection — read-only calendar event display for the selected day.
//
// Collapsed by default (mirrors DoneSection): only the "CALENDAR · N" header shows
// until tapped. Once expanded, timed events render as agenda rows (start clock +
// AM/PM + "1h · until 3:00 PM" duration) and all-day events as an "All day · …"
// sub-line. The section renders nothing when both arrays are empty.
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

  it('renders the start clock and meridiem in the time-column', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expandSection();
    expect(screen.getByText('2:00')).toBeOnTheScreen();
    expect(screen.getByText('PM')).toBeOnTheScreen();
  });

  it('renders a duration + end time line', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expandSection();
    // 14:00 → 15:00 is one hour, ending 3:00 PM
    expect(screen.getByText('1h · until 3:00 PM')).toBeOnTheScreen();
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
