/**
 * B-Task 2 / B-Task 3 — the running timer's finish surface (Surface C).
 *
 * FinishTime renders the STARTED + FINISH ledger rows. The "~" lives in the
 * "Finish ~" row label, so the value is a bare clock ("9:48"). Pro + still-
 * learning + a range → the FINISH value is "{low}–{high}" + the slim HonestBand,
 * and a single honest_range_shown { surface: 'timer' }. Free users, a settled
 * ('honest') category, or a missing range keep the point value "{finish}". The
 * overrun reprojection is untouched by this surface.
 */

import { render, screen } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { FinishTime } from '@/src/features/timer/FinishTime';
import { formatClock } from '@/src/lib/time';

const mockCapture = jest.fn();
jest.mock('@/src/services/analytics', () => ({
  analytics: { capture: (...a: unknown[]) => mockCapture(...a) },
}));

// A bare fake shared value — useAnimatedReaction is a jest no-op, so `over` stays
// false and the pre-overrun branch renders (what Surface C cares about).
const elapsed = { value: 0 } as unknown as SharedValue<number>;

const base = {
  elapsedSec: elapsed,
  estimateSec: 48 * 60,
  startedAt: 1_700_000_000_000,
  startedClock: '9:00',
  finishClock: '9:48',
};

beforeEach(() => mockCapture.mockClear());

describe('FinishTime — Surface C (Pro honest range)', () => {
  it('renders the point finish for free users even with a learning range', () => {
    render(
      <FinishTime
        {...base}
        isPro={false}
        confidence="setting"
        range={{ lowMinutes: 42, highMinutes: 57 }}
      />,
    );
    expect(screen.getByText('9:48')).toBeOnTheScreen();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('renders the finish RANGE (clock low–high, no ~) for Pro while learning', () => {
    render(
      <FinishTime
        {...base}
        isPro
        confidence="setting"
        range={{ lowMinutes: 42, highMinutes: 57 }}
      />,
    );
    // The range is anchored on startedAt + low/high minutes (TZ-relative, so derive
    // the expected clocks the same way the component does instead of hardcoding).
    const low = formatClock(base.startedAt + 42 * 60_000);
    const high = formatClock(base.startedAt + 57 * 60_000);
    // a11y carries the whole range as one string → robust across split Text nodes.
    expect(
      screen.getByLabelText(`Honest finish range ${low} to ${high}, still learning.`),
    ).toBeOnTheScreen();
    // The point finish clock is gone (the range replaced it).
    expect(screen.queryByText('9:48')).toBeNull();
  });

  it('fires honest_range_shown { surface: timer } once for a Pro learning session', () => {
    render(
      <FinishTime
        {...base}
        isPro
        confidence="setting"
        range={{ lowMinutes: 42, highMinutes: 57 }}
      />,
    );
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith('honest_range_shown', {
      surface: 'timer',
      confidence: 'setting',
      width_min: 15,
      is_pro: true,
    });
  });

  it('keeps the point finish once the category has SETTLED (honest)', () => {
    render(
      <FinishTime
        {...base}
        isPro
        confidence="honest"
        range={{ lowMinutes: 42, highMinutes: 57 }}
      />,
    );
    expect(screen.getByText('9:48')).toBeOnTheScreen();
    // No range shown once settled → its a11y label is absent.
    expect(screen.queryByLabelText(/Honest finish range/)).toBeNull();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('keeps the point finish when there is no range (cold/unknown category)', () => {
    render(<FinishTime {...base} isPro confidence="raw" range={null} />);
    expect(screen.getByText('9:48')).toBeOnTheScreen();
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
