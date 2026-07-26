// src/features/today/__tests__/DayRecapCard.test.tsx
// Render tests for DayRecapCard — stats, collapsible list, empty variant.

import { render, screen, fireEvent } from '@testing-library/react-native';
import { DayRecapCard } from '@/src/features/today/DayRecapCard';
import type { TodayRow } from '@/src/features/today/useToday';
import type { DayRecap } from '@/src/features/today/useDayRecap';

// The TaskRow inside DayRecapCard uses ReanimatedSwipeable — stub it.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const Mock = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  return { __esModule: true, default: Mock };
});

// Ionicons uses native font loading — stub to a plain text node.
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

function makeRecap(overrides: Partial<DayRecap> = {}): DayRecap {
  return {
    date: '2026-06-23',
    doneCount: 3,
    plannedCount: 4,
    realFocusMin: 90,
    vsGuessMin: 15,
    guessedMin: 75,
    honestMin: 90,
    ...overrides,
  };
}

function makeRow(overrides: Partial<TodayRow> = {}): TodayRow {
  return {
    id: 'r1',
    label: 'Write doc',
    category: 'deep-work',
    categoryLabel: 'Deep Work',
    guessMin: 30,
    honestMin: 45,
    done: true,
    actualMin: 35,
    carriedFrom: null,
    ...overrides,
  };
}

describe('DayRecapCard', () => {
  it('states the gap in words, never with a plus sign', () => {
    render(<DayRecapCard recap={makeRecap({ guessedMin: 130, honestMin: 165, vsGuessMin: 35 })} rows={[makeRow()]} />);
    expect(screen.getByText('35m over')).toBeTruthy();
    expect(screen.queryByText('+35m')).toBeNull();
  });

  it('formats durations in hours and minutes past the hour', () => {
    render(<DayRecapCard recap={makeRecap({ guessedMin: 130, honestMin: 165 })} rows={[makeRow()]} />);
    expect(screen.getByText('2h 10m')).toBeTruthy();
    expect(screen.getByText('2h 45m')).toBeTruthy();
    expect(screen.queryByText('165m')).toBeNull();
  });

  it('labels the stat columns like the day-so-far card', () => {
    render(<DayRecapCard recap={makeRecap()} rows={[makeRow()]} />);
    expect(screen.getByText('LOGGED')).toBeTruthy();
    expect(screen.getByText('GUESSED')).toBeTruthy();
    expect(screen.getByText('HONEST')).toBeTruthy();
  });

  it('renders headline only on a day with nothing logged', () => {
    render(<DayRecapCard recap={makeRecap({ doneCount: 0, plannedCount: 0, guessedMin: 0, honestMin: 0, vsGuessMin: 0 })} rows={[]} />);
    expect(screen.getByText('Nothing logged that day.')).toBeTruthy();
    expect(screen.queryByText('LOGGED')).toBeNull();
    expect(screen.queryByTestId('recap-bar')).toBeNull();
  });

  it('renders no overhang segment when the day came in under', () => {
    render(<DayRecapCard recap={makeRecap({ guessedMin: 120, honestMin: 100, vsGuessMin: -20 })} rows={[makeRow()]} />);
    expect(screen.getByText('20m under')).toBeTruthy();
    expect(screen.queryByTestId('recap-seg-over')).toBeNull();
  });

  it('starts with list collapsed and expands on tap', () => {
    render(
      <DayRecapCard
        recap={makeRecap()}
        rows={[makeRow({ label: 'Write doc' })]}
      />,
    );
    // Task row is not yet visible.
    expect(screen.queryByText('Write doc')).toBeNull();

    // Tap the disclosure header.
    fireEvent.press(screen.getByRole('button', { name: /all tasks/i }));
    // Task row is now visible.
    expect(screen.getByText('Write doc')).toBeOnTheScreen();
  });

  it('shows "Nothing logged that day." when rows is empty', () => {
    render(<DayRecapCard recap={makeRecap({ doneCount: 0, plannedCount: 0, guessedMin: 0, honestMin: 0, vsGuessMin: 0 })} rows={[]} />);
    expect(screen.getByText('Nothing logged that day.')).toBeOnTheScreen();
  });

  it('does not show the empty message when tasks are present', () => {
    render(<DayRecapCard recap={makeRecap()} rows={[makeRow()]} />);
    expect(screen.queryByText('Nothing logged that day.')).toBeNull();
  });
});
