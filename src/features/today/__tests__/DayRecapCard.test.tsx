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
    render(<DayRecapCard recap={makeRecap({ doneCount: 0, guessedMin: 0, honestMin: 0, vsGuessMin: 0 })} rows={[]} />);
    expect(screen.getByText('Nothing logged that day.')).toBeTruthy();
    expect(screen.queryByText('LOGGED')).toBeNull();
    expect(screen.queryByTestId('recap-bar')).toBeNull();
  });

  it('renders no overhang segment when the day came in under', () => {
    render(<DayRecapCard recap={makeRecap({ guessedMin: 120, honestMin: 100, vsGuessMin: -20 })} rows={[makeRow()]} />);
    expect(screen.getByText('20m under')).toBeTruthy();
    expect(screen.queryByTestId('recap-seg-over')).toBeNull();
  });

  it('on an over day, the bar segments sum to the honest minutes — the primary segment is the full guess', () => {
    // guessed 130, honest 165: primary = min(130,165) = 130, overhang = 35.
    // Total flex = 165 = honestMin, so primary's share (130/165 ≈ 79%) matches
    // the "guessed 2h 10m" / "real 2h 45m" scale row underneath it.
    render(
      <DayRecapCard
        recap={makeRecap({ guessedMin: 130, honestMin: 165, vsGuessMin: 35 })}
        rows={[makeRow()]}
      />,
    );
    const primary = screen.getByTestId('recap-seg-guessed').props.style.flex as number;
    const over = screen.getByTestId('recap-seg-over').props.style.flex as number;
    expect(primary).toBe(130);
    expect(over).toBe(35);
    expect(primary / (primary + over)).toBeCloseTo(130 / 165, 5);
  });

  it('on an under day, the bar segments sum to the guessed minutes — the primary segment shows only the honest minutes, never the full guess', () => {
    // guessed 120, honest 10: the old model rendered the primary segment at the
    // FULL guess (120) plus a 110 remainder on top, drawing a track that totals
    // 230 — a quantity that corresponds to nothing. The fix: primary =
    // min(120,10) = 10, remainder = 110, total flex = 120 = guessedMin, so the
    // primary segment's share (10/120 ≈ 8%) matches "real 10m" against
    // "guessed 2h", not the 52% the bug used to draw.
    render(
      <DayRecapCard
        recap={makeRecap({ guessedMin: 120, honestMin: 10, vsGuessMin: -110 })}
        rows={[makeRow()]}
      />,
    );
    const primary = screen.getByTestId('recap-seg-guessed').props.style.flex as number;
    const remainder = screen.getByTestId('recap-seg-remainder').props.style.flex as number;
    expect(primary).toBe(10);
    expect(remainder).toBe(110);
    expect(primary / (primary + remainder)).toBeCloseTo(10 / 120, 5);
  });

  it('treats the day as empty when nothing is done, even with leftover queued rows', () => {
    // A past day can carry queued (not-done) rows in `rows` — a leftover task
    // never logged that day. The empty gate must key on doneCount, not on
    // whether `rows` happens to be non-empty.
    render(
      <DayRecapCard
        recap={makeRecap({ doneCount: 0, guessedMin: 0, honestMin: 0, vsGuessMin: 0 })}
        rows={[makeRow({ done: false })]}
      />,
    );
    expect(screen.getByText('Nothing logged that day.')).toBeTruthy();
    expect(screen.queryByTestId('recap-bar')).toBeNull();
    expect(screen.queryByText('LOGGED')).toBeNull();
    expect(screen.queryByText('GUESSED')).toBeNull();
    expect(screen.queryByText('HONEST')).toBeNull();
    expect(screen.queryByRole('button', { name: /all tasks/i })).toBeNull();
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
    render(<DayRecapCard recap={makeRecap({ doneCount: 0, guessedMin: 0, honestMin: 0, vsGuessMin: 0 })} rows={[]} />);
    expect(screen.getByText('Nothing logged that day.')).toBeOnTheScreen();
  });

  it('does not show the empty message when tasks are present', () => {
    render(<DayRecapCard recap={makeRecap()} rows={[makeRow()]} />);
    expect(screen.queryByText('Nothing logged that day.')).toBeNull();
  });
});
