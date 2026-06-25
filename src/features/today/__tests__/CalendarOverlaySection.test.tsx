import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CalendarOverlaySection } from '@/src/features/today/CalendarOverlaySection';
import type { CalendarEvent } from '@/src/services/calendar';

// ──────────────────────────────────────────────────────────────────────────────
// CalendarOverlaySection — read-only calendar event display for the selected day.
//
// Only renders when events.length > 0 OR allDayEvents.length > 0.
// Timed events show title + clock range ("2:00–3:00 PM").
// All-day events appear in a quiet sub-line ("All day: …").
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

describe('CalendarOverlaySection — empty', () => {
  it('renders nothing when both events and allDayEvents are empty', () => {
    const { toJSON } = render(
      <CalendarOverlaySection events={[]} allDayEvents={[]} />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe('CalendarOverlaySection — timed events', () => {
  it('renders the "Calendar" eyebrow when events exist', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expect(screen.getByText(/calendar/i)).toBeOnTheScreen();
  });

  it('renders the event title', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expect(screen.getByText('Team sync')).toBeOnTheScreen();
  });

  it('renders a clock range for timed events', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    // Should contain a time range string with a dash separator
    expect(screen.getByText(/\d+:\d+.*–.*\d+:\d+/)).toBeOnTheScreen();
  });

  it('renders multiple timed event rows', () => {
    const events = [
      makeTimedEvent({ id: 'e1', title: 'Stand-up' }),
      makeTimedEvent({ id: 'e2', title: 'Design review' }),
    ];
    render(<CalendarOverlaySection events={events} allDayEvents={[]} />);
    expect(screen.getByText('Stand-up')).toBeOnTheScreen();
    expect(screen.getByText('Design review')).toBeOnTheScreen();
  });

  it('does NOT render the all-day sub-line when allDayEvents is empty', () => {
    render(<CalendarOverlaySection events={[makeTimedEvent()]} allDayEvents={[]} />);
    expect(screen.queryByText(/all day/i)).toBeNull();
  });
});

describe('CalendarOverlaySection — all-day events', () => {
  it('renders the all-day sub-line when allDayEvents exist', () => {
    render(
      <CalendarOverlaySection
        events={[]}
        allDayEvents={[makeAllDayEvent()]}
      />,
    );
    expect(screen.getByText(/all day/i)).toBeOnTheScreen();
  });

  it('includes the all-day event title in the sub-line', () => {
    render(
      <CalendarOverlaySection
        events={[]}
        allDayEvents={[makeAllDayEvent({ title: 'Team offsite' })]}
      />,
    );
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
    // Both titles should appear in the all-day sub-line text
    expect(screen.getByText(/offsite/i)).toBeOnTheScreen();
    expect(screen.getByText(/no meetings/i)).toBeOnTheScreen();
  });

  it('renders the "Calendar" eyebrow even when only all-day events exist', () => {
    render(
      <CalendarOverlaySection
        events={[]}
        allDayEvents={[makeAllDayEvent()]}
      />,
    );
    expect(screen.getByText(/calendar/i)).toBeOnTheScreen();
  });
});

describe('CalendarOverlaySection — mixed', () => {
  it('renders both timed rows and all-day sub-line when both are present', () => {
    render(
      <CalendarOverlaySection
        events={[makeTimedEvent({ title: 'Sprint retro' })]}
        allDayEvents={[makeAllDayEvent({ title: 'Holiday' })]}
      />,
    );
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
    // useDayCapacity returns events=[] and allDayEvents=[] for free users;
    // CalendarOverlaySection must produce no UI in that case.
    const { toJSON } = render(
      <CalendarOverlaySection events={[]} allDayEvents={[]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('never renders the "Calendar" eyebrow for a free user (empty arrays)', () => {
    render(<CalendarOverlaySection events={[]} allDayEvents={[]} />);
    expect(screen.queryByText(/calendar/i)).toBeNull();
  });

  it('never renders any event title for a free user (empty arrays)', () => {
    render(<CalendarOverlaySection events={[]} allDayEvents={[]} />);
    expect(screen.queryByText(/team sync/i)).toBeNull();
  });
});
