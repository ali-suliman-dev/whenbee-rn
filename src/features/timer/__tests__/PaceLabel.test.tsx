/**
 * PaceLabel — pace pill + the "Forgot to stop?" affordance folded into it.
 *
 * useAnimatedReaction is a jest no-op (see FinishTime.test.tsx), so the
 * phase can't be driven by a live reaction under test. PaceLabel's state is
 * lazily initialized straight from elapsedSec/estimateSec instead, so a bare
 * fake shared value (matching the FinishTime.test.tsx pattern) is enough to
 * exercise both the under-guess and overrun branches on mount.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { PaceLabel } from '@/src/features/timer/PaceLabel';

const fakeElapsed = (seconds: number) => ({ value: seconds }) as unknown as SharedValue<number>;

describe('PaceLabel', () => {
  it('renders the pill alone under guess, with no forgot affordance', () => {
    render(<PaceLabel elapsedSec={fakeElapsed(5 * 60)} estimateSec={25 * 60} onForgotPress={jest.fn()} />);
    expect(screen.getByText('You’ve got time')).toBeOnTheScreen();
    expect(screen.queryByText('Forgot to stop?')).toBeNull();
  });

  it('keeps the forgot affordance absent on overrun when no handler is given', () => {
    render(<PaceLabel elapsedSec={fakeElapsed(30 * 60)} estimateSec={25 * 60} />);
    expect(screen.queryByText('Forgot to stop?')).toBeNull();
  });

  it('shows the pill + forgot control on one row once past the guess', () => {
    const onForgotPress = jest.fn();
    render(<PaceLabel elapsedSec={fakeElapsed(30 * 60)} estimateSec={25 * 60} onForgotPress={onForgotPress} />);
    expect(screen.getByText(/over your guess/)).toBeOnTheScreen();
    const link = screen.getByText('Forgot to stop?');
    expect(link).toBeOnTheScreen();
    fireEvent.press(link);
    expect(onForgotPress).toHaveBeenCalledTimes(1);
  });

  // The recovery link is keyed to the GUESS, not the honest number. Waiting for
  // the honest number means a user who walked away at minute 21 of a 20-minute
  // guess has no way back until the honest 45 is up — long past useful.
  describe('the forgot link is gated on the guess, not the honest estimate', () => {
    it('offers it once the guess is spent, while the pill still reads under', () => {
      render(
        <PaceLabel
          elapsedSec={fakeElapsed(22 * 60)}
          estimateSec={45 * 60}
          guessSec={20 * 60}
          onForgotPress={jest.fn()}
        />,
      );
      // The pill is untouched: still the calm under-honest copy.
      expect(screen.getByText('You’ve got time')).toBeOnTheScreen();
      expect(screen.getByText('Forgot to stop?')).toBeOnTheScreen();
    });

    it('withholds it while the guess still has time on it', () => {
      render(
        <PaceLabel
          elapsedSec={fakeElapsed(12 * 60)}
          estimateSec={45 * 60}
          guessSec={20 * 60}
          onForgotPress={jest.fn()}
        />,
      );
      expect(screen.queryByText('Forgot to stop?')).toBeNull();
    });

    it('falls back to the honest estimate when no guess is given', () => {
      render(
        <PaceLabel elapsedSec={fakeElapsed(22 * 60)} estimateSec={45 * 60} onForgotPress={jest.fn()} />,
      );
      expect(screen.queryByText('Forgot to stop?')).toBeNull();
    });
  });
});
