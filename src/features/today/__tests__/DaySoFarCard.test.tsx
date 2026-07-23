// src/features/today/__tests__/DaySoFarCard.test.tsx
// Render tests for DaySoFarCard — headline copy, stat values, milestone copy.

import { render, screen } from '@testing-library/react-native';
import { DaySoFarCard } from '@/src/features/today/DaySoFarCard';
import type { DaySoFar } from '@/src/features/today/useDaySoFar';

function makeRecap(overrides: Partial<DaySoFar> = {}): DaySoFar {
  return {
    completedCount: 1,
    totalMin: 35,
    honeyPct: 62,
    leadCategoryLabel: 'Deep Work',
    logsToNextTier: 3,
    ...overrides,
  };
}

describe('DaySoFarCard', () => {
  it('renders the singular count line + real-minutes phrase', () => {
    render(<DaySoFarCard recap={makeRecap({ completedCount: 1, totalMin: 1 })} />);
    expect(screen.getByText(/One honest log in\./)).toBeOnTheScreen();
    expect(screen.getByText('1 real minute')).toBeOnTheScreen();
  });

  it('renders the plural count line + real-minutes phrase', () => {
    render(<DaySoFarCard recap={makeRecap({ completedCount: 3, totalMin: 90 })} />);
    expect(screen.getByText(/3 honest logs in\./)).toBeOnTheScreen();
    expect(screen.getByText('90 real minutes')).toBeOnTheScreen();
  });

  it('renders the LOGGED / REALLY TOOK / HONEY stat values', () => {
    render(<DaySoFarCard recap={makeRecap({ completedCount: 2, totalMin: 50, honeyPct: 40 })} />);
    expect(screen.getByText('LOGGED')).toBeOnTheScreen();
    expect(screen.getByText('REALLY TOOK')).toBeOnTheScreen();
    expect(screen.getByText('HONEY')).toBeOnTheScreen();
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(screen.getByText('50')).toBeOnTheScreen();
    expect(screen.getByText('40')).toBeOnTheScreen();
  });

  it('uses singular "task" unit at count 1 and "tasks" otherwise', () => {
    const { rerender } = render(<DaySoFarCard recap={makeRecap({ completedCount: 1 })} />);
    expect(screen.getByText('task')).toBeOnTheScreen();
    rerender(<DaySoFarCard recap={makeRecap({ completedCount: 4 })} />);
    expect(screen.getByText('tasks')).toBeOnTheScreen();
  });

  it('renders the countdown milestone line when a next tier exists', () => {
    render(<DaySoFarCard recap={makeRecap({ leadCategoryLabel: 'Deep Work', logsToNextTier: 3 })} />);
    expect(screen.getByText(/~3 more logs and Deep Work settles in\./)).toBeOnTheScreen();
  });

  it('renders the top-tier fallback line when there is no next tier', () => {
    render(<DaySoFarCard recap={makeRecap({ leadCategoryLabel: 'Deep Work', logsToNextTier: 0 })} />);
    expect(screen.getByText('Every log keeps Deep Work sharp.')).toBeOnTheScreen();
  });

  it('renders the eyebrow', () => {
    render(<DaySoFarCard recap={makeRecap()} />);
    expect(screen.getByText('YOUR DAY SO FAR')).toBeOnTheScreen();
  });
});
