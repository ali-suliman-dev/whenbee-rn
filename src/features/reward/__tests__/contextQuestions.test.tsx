import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ContextQuestions } from '@/src/features/reward/ContextQuestions';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { analytics } from '@/src/services/analytics';

jest.mock('@/src/services/analytics', () => ({ analytics: { capture: jest.fn() } }));
// ReasonGlyph's ambient-motion hook reaches expo-router's useFocusEffect even
// while inactive — stub navigation like rewardScreen.test.tsx does.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

const mockCapture = analytics.capture as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  mockCapture.mockClear();
  jest.spyOn(useCalibrationStore.getState(), 'setReason').mockResolvedValue(undefined);
  jest.spyOn(useCalibrationStore.getState(), 'setContext').mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const REVEAL_MS = 600;

describe('ContextQuestions', () => {
  it('shows the over-run reason question first, with the 2-question counter', () => {
    render(<ContextQuestions eventId="evt-1" category="cleaning" reasonDirection="over" />);
    expect(screen.getByText('Where did the time go?')).toBeOnTheScreen();
    expect(screen.getByText('Paused')).toBeOnTheScreen();
    expect(screen.getByText('Grew')).toBeOnTheScreen();
    expect(screen.getByText('Pulled')).toBeOnTheScreen();
    expect(screen.getByText('1 of 2 · one tap, or skip')).toBeOnTheScreen();
    // fires the shown analytics exactly once on appear
    expect(mockCapture).toHaveBeenCalledWith('overrun_reason_shown', {
      category: 'cleaning',
      direction: 'over',
    });
  });

  it('shows the under-run reason question copy', () => {
    render(<ContextQuestions eventId="evt-1" category="email" reasonDirection="under" />);
    expect(screen.getByText('What made it quick?')).toBeOnTheScreen();
    expect(screen.getByText('Flow')).toBeOnTheScreen();
    expect(screen.getByText('Fast')).toBeOnTheScreen();
  });

  it('answering Q1 persists + tags analytics, shows a receipt, then advances to Q2 with no counter regression', () => {
    render(<ContextQuestions eventId="evt-1" category="cleaning" reasonDirection="over" />);

    fireEvent.press(screen.getByText('Paused'));

    expect(useCalibrationStore.getState().setReason).toHaveBeenCalledWith(
      'evt-1',
      'interrupted',
      'manual',
    );
    expect(mockCapture).toHaveBeenCalledWith('overrun_reason_tagged', {
      category: 'cleaning',
      direction: 'over',
      reason: 'interrupted',
      source: 'manual',
    });

    act(() => {
      jest.advanceTimersByTime(REVEAL_MS);
    });

    expect(screen.getByText(/Paused along the way\. Good to know\./)).toBeOnTheScreen();
    expect(screen.getByText('How was your energy?')).toBeOnTheScreen();
    expect(screen.getByText('2 of 2 · one tap, or skip')).toBeOnTheScreen();
  });

  it('skipping Q1 fires overrun_reason_skipped, renders no receipt, and advances immediately', () => {
    render(<ContextQuestions eventId="evt-1" category="cleaning" reasonDirection="over" />);
    mockCapture.mockClear();

    fireEvent.press(screen.getByText('Skip'));

    expect(mockCapture).toHaveBeenCalledWith('overrun_reason_skipped', {
      category: 'cleaning',
      direction: 'over',
    });
    expect(useCalibrationStore.getState().setReason).not.toHaveBeenCalled();
    expect(screen.queryByText(/Good to know\./)).toBeNull();
    expect(screen.getByText('How was your energy?')).toBeOnTheScreen();
  });

  it('never double-fires overrun_reason_skipped after an explicit skip + unmount', () => {
    const { unmount } = render(
      <ContextQuestions eventId="evt-1" category="cleaning" reasonDirection="over" />,
    );
    fireEvent.press(screen.getByText('Skip'));
    expect(mockCapture).toHaveBeenCalledTimes(2); // shown + skipped
    unmount();
    expect(mockCapture).toHaveBeenCalledTimes(2); // no extra skipped fire
  });

  it('fires overrun_reason_skipped on unmount when the user leaves without tagging or skipping', () => {
    const { unmount } = render(
      <ContextQuestions eventId="evt-1" category="cleaning" reasonDirection="over" />,
    );
    mockCapture.mockClear();
    unmount();
    expect(mockCapture).toHaveBeenCalledWith('overrun_reason_skipped', {
      category: 'cleaning',
      direction: 'over',
    });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('never fires overrun_reason_skipped on unmount after Q1 was tagged', () => {
    const { unmount } = render(
      <ContextQuestions eventId="evt-1" category="cleaning" reasonDirection="over" />,
    );
    fireEvent.press(screen.getByText('Paused'));
    mockCapture.mockClear();
    unmount();
    expect(mockCapture).not.toHaveBeenCalledWith(
      'overrun_reason_skipped',
      expect.anything(),
    );
  });

  it('with no direction, renders only the energy question and omits the counter', () => {
    render(<ContextQuestions eventId="evt-1" category="email" reasonDirection={null} />);
    expect(screen.queryByText('Where did the time go?')).toBeNull();
    expect(screen.queryByText('What made it quick?')).toBeNull();
    expect(screen.getByText('How was your energy?')).toBeOnTheScreen();
    expect(screen.queryByText(/of 2 · one tap, or skip/)).toBeNull();
    // energy carries no shown/skipped funnel — only the shared "tagged" event on select
    expect(mockCapture).not.toHaveBeenCalledWith('overrun_reason_shown', expect.anything());
  });

  it('answering the energy question persists a context tag and shows its receipt', () => {
    render(<ContextQuestions eventId="evt-1" category="email" reasonDirection={null} />);

    fireEvent.press(screen.getByText('OK'));

    expect(useCalibrationStore.getState().setContext).toHaveBeenCalledWith(
      'evt-1',
      'energy',
      'ok',
      'manual',
    );
    expect(mockCapture).toHaveBeenCalledWith('context_tagged', { key: 'energy', value: 'ok' });

    act(() => {
      jest.advanceTimersByTime(REVEAL_MS);
    });

    expect(screen.getByText(/Energy: OK\. Noted\./)).toBeOnTheScreen();
  });

  it('skipping the only (energy) question renders no receipt and fires no extra analytics', () => {
    render(<ContextQuestions eventId="evt-1" category="email" reasonDirection={null} />);
    mockCapture.mockClear();

    fireEvent.press(screen.getByText('Skip'));

    expect(useCalibrationStore.getState().setContext).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
    expect(screen.queryByText(/Noted\./)).toBeNull();
  });
});
