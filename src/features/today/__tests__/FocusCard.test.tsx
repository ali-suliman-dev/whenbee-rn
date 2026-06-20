import { render, screen, fireEvent } from '@testing-library/react-native';
import { FocusCard } from '@/src/features/today/FocusCard';
import type { CalibrationSummary } from '@/src/domain/types';

const summary: CalibrationSummary = {
  guessMinutes: 15,
  honestMinutes: 30,
  multiplier: 2,
  basis: 'personal',
  rangeLabel: '',
  confidence: 'medium',
} as unknown as CalibrationSummary;

describe('FocusCard', () => {
  it('renders the hero number, gap, finish projection, and Start', () => {
    const onStart = jest.fn();
    render(
      <FocusCard category="cleaning" categoryLabel="Cleaning" taskTitle="Clean the kitchen"
        summary={summary} finishClock="4:11pm" onStart={onStart} />,
    );
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('+15 learned')).toBeOnTheScreen();
    expect(screen.getByText('done 4:11pm')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Start'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('renders the pre-estimate line for an uncalibrated focus task', () => {
    render(
      <FocusCard category="cleaning" categoryLabel="Cleaning" taskTitle="Clean the kitchen"
        summary={summary} finishClock="4:11pm" preEstimate onStart={jest.fn()} />,
    );
    expect(screen.getByText('Starting estimate · sharpens as you log')).toBeOnTheScreen();
  });
});
