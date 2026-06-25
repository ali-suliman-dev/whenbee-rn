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
  it('renders the done/planned stat line', () => {
    render(<DayRecapCard recap={makeRecap()} rows={[makeRow()]} />);
    // The stat renders value + label as nested Text — RTLN matches the full string.
    expect(screen.getByText('3 of 4 done')).toBeOnTheScreen();
  });

  it('renders real focus minutes', () => {
    render(<DayRecapCard recap={makeRecap({ realFocusMin: 90 })} rows={[makeRow()]} />);
    expect(screen.getByText('90m focus')).toBeOnTheScreen();
  });

  it('renders positive vsGuessMin with + prefix', () => {
    render(<DayRecapCard recap={makeRecap({ vsGuessMin: 15 })} rows={[makeRow()]} />);
    expect(screen.getByText('+15m vs guess')).toBeOnTheScreen();
  });

  it('renders negative vsGuessMin without + prefix', () => {
    render(<DayRecapCard recap={makeRecap({ vsGuessMin: -10 })} rows={[makeRow()]} />);
    expect(screen.getByText('-10m vs guess')).toBeOnTheScreen();
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

  it('shows "Nothing logged that day" when rows is empty', () => {
    render(<DayRecapCard recap={makeRecap({ doneCount: 0, plannedCount: 0 })} rows={[]} />);
    expect(screen.getByText('Nothing logged that day')).toBeOnTheScreen();
  });

  it('does not show the empty message when tasks are present', () => {
    render(<DayRecapCard recap={makeRecap()} rows={[makeRow()]} />);
    expect(screen.queryByText('Nothing logged that day')).toBeNull();
  });
});
