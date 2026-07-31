// src/features/today/__tests__/DaySoFarCard.test.tsx
// Render tests for DaySoFarCard — headline copy, stat values, milestone copy.

import { render, screen } from '@testing-library/react-native';
import { DaySoFarCard } from '@/src/features/today/DaySoFarCard';
import type { DaySoFar } from '@/src/features/today/useDaySoFar';

function makeRecap(overrides: Partial<DaySoFar> = {}): DaySoFar {
  return {
    completedCount: 1,
    guessedMin: 25,
    totalMin: 35,
    ...overrides,
  };
}

describe('DaySoFarCard', () => {
  it('renders the singular count line + guessed/honest headline', () => {
    render(<DaySoFarCard recap={makeRecap({ completedCount: 1, guessedMin: 1, totalMin: 1 })} />);
    expect(screen.getByText(/One honest log in\./)).toBeOnTheScreen();
    expect(screen.getByText(/Guessed 1m, really took/)).toBeOnTheScreen();
  });

  it('renders the plural count line + h/m totals in the headline', () => {
    render(<DaySoFarCard recap={makeRecap({ completedCount: 3, guessedMin: 100, totalMin: 130 })} />);
    expect(screen.getByText(/3 honest logs in\./)).toBeOnTheScreen();
    expect(screen.getByText(/Guessed 1h 40m, really took/)).toBeOnTheScreen();
  });

  it('renders the LOGGED / GUESSED / HONEST stat values in h/m', () => {
    render(<DaySoFarCard recap={makeRecap({ completedCount: 2, guessedMin: 100, totalMin: 130 })} />);
    expect(screen.getByText('LOGGED')).toBeOnTheScreen();
    expect(screen.getByText('GUESSED')).toBeOnTheScreen();
    expect(screen.getByText('HONEST')).toBeOnTheScreen();
    expect(screen.getByText('2')).toBeOnTheScreen();
    // "1h 40m" (GUESSED stat) and "2h 10m" (HONEST stat + the accent headline
    // span) — the latter renders twice, so assert at least one of each.
    expect(screen.getAllByText('1h 40m').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2h 10m').length).toBeGreaterThanOrEqual(1);
  });

  it('uses singular "task" unit at count 1 and "tasks" otherwise', () => {
    const { rerender } = render(<DaySoFarCard recap={makeRecap({ completedCount: 1 })} />);
    expect(screen.getByText('task')).toBeOnTheScreen();
    rerender(<DaySoFarCard recap={makeRecap({ completedCount: 4 })} />);
    expect(screen.getByText('tasks')).toBeOnTheScreen();
  });

  it('states the over-guess gap milestone', () => {
    render(<DaySoFarCard recap={makeRecap({ guessedMin: 100, totalMin: 130 })} />);
    // The "+30m over" prefix is a separate bold Text node; assert the remainder.
    expect(screen.getByText(/your guess today — that gap is what Whenbee's learning\./)).toBeOnTheScreen();
    expect(screen.getByText('+30m over')).toBeOnTheScreen();
  });

  it('celebrates an under-guess day', () => {
    render(<DaySoFarCard recap={makeRecap({ guessedMin: 120, totalMin: 90 })} />);
    expect(screen.getByText(/your guess today — nicely called\./)).toBeOnTheScreen();
    expect(screen.getByText('30m under')).toBeOnTheScreen();
  });

  it('renders the eyebrow', () => {
    render(<DaySoFarCard recap={makeRecap()} />);
    expect(screen.getByText('YOUR DAY SO FAR')).toBeOnTheScreen();
  });
});
