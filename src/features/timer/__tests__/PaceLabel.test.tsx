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
});
