import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HonestDayRoute from '@/src/app/(modals)/honest-day';
import { getCalendar, type CalendarEvent } from '@/src/services/calendar';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// The trust test: rendering the Honest-Day preview NEVER writes the calendar.
// Only the explicit "Apply to my calendar" confirm writes, exactly once. "Not
// now" writes never. The calendar service is fully mocked so we observe the
// write spy directly.
// ──────────────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));

const writeAdjustments = jest.fn(async () => 2);
const requestReadAccess = jest.fn(async () => true);

const DAY = new Date('2026-06-13T08:00:00').getTime();
const MIN = 60_000;
const mockEvents: CalendarEvent[] = [
  { id: 'e1', title: 'Write report', startMs: DAY, endMs: DAY + 30 * MIN, allDay: false, calendarId: 'test-cal' },
  { id: 'e2', title: 'Client call', startMs: DAY + 120 * MIN, endMs: DAY + 150 * MIN, allDay: false, calendarId: 'test-cal' },
];
const getTodaysEvents = jest.fn(async () => mockEvents);

jest.mock('@/src/services/calendar', () => ({
  getCalendar: jest.fn(),
}));

const mockGetCalendar = getCalendar as jest.MockedFunction<typeof getCalendar>;

function setCalendar() {
  mockGetCalendar.mockReturnValue({
    isStub: true,
    requestReadAccess,
    getTodaysEvents,
    getEventsForDay: jest.fn(async () => mockEvents),
    listCalendars: jest.fn(async () => [{ id: 'test-cal', title: 'Calendar' }]),
    writeAdjustments,
    requestWriteAccess: jest.fn(async () => true),
    ensureWhenbeeCalendar: jest.fn(async () => 'whenbee-cal-stub'),
    createWhenbeeEvent: jest.fn(async () => 'stub-event'),
    updateWhenbeeEvent: jest.fn(async () => undefined),
    deleteWhenbeeEvent: jest.fn(async () => undefined),
    deleteAllWhenbeeEvents: jest.fn(async () => 0),
    deleteWhenbeeCalendar: jest.fn(async () => undefined),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setCalendar();
  // Pro + a learned 'writing' multiplier so the preview renders with content.
  useEntitlement.setState({ isPro: true, ready: true });
  useCalibrationStore.setState({
    statsByCategory: {
      writing: { mEffective: 2, n: 8, sharpness: 50, tier: 'Setting', fit: { a: 0, b: 2 } },
      calls: { mEffective: 1, n: 8, sharpness: 50, tier: 'Setting', fit: { a: 0, b: 1 } },
    },
  });
});

describe('Honest-Day confirmed-write-only', () => {
  it('renders the preview WITHOUT writing the calendar', async () => {
    render(<HonestDayRoute />);

    await screen.findByText('Apply to my calendar');
    expect(requestReadAccess).toHaveBeenCalled();
    expect(getTodaysEvents).toHaveBeenCalled();
    // The critical invariant: read happened, NO write.
    expect(writeAdjustments).not.toHaveBeenCalled();
  });

  it('writes exactly once, only when "Apply to my calendar" is pressed', async () => {
    render(<HonestDayRoute />);

    const apply = await screen.findByText('Apply to my calendar');
    fireEvent.press(apply);

    await waitFor(() => expect(writeAdjustments).toHaveBeenCalledTimes(1));
    // The write payload is the confirmed honest blocks (both events).
    expect(writeAdjustments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'e1' }),
        expect.objectContaining({ id: 'e2' }),
      ]),
    );
  });

  it('never writes when "Not now" is pressed', async () => {
    render(<HonestDayRoute />);

    const cancel = await screen.findByText('Not now');
    fireEvent.press(cancel);

    // Give any stray async a tick — still no write.
    await waitFor(() => expect(getTodaysEvents).toHaveBeenCalled());
    expect(writeAdjustments).not.toHaveBeenCalled();
  });

  it('sends a non-Pro user to the paywall fallback instead of the writeable screen', async () => {
    useEntitlement.setState({ isPro: false, ready: true });

    render(<HonestDayRoute />);

    expect(screen.getByText('Padding your calendar is a Pro feature')).toBeOnTheScreen();
    expect(screen.queryByText('Apply to my calendar')).toBeNull();
    expect(writeAdjustments).not.toHaveBeenCalled();
  });
});
