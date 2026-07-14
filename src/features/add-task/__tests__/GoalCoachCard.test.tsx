import { render, screen } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { GoalCoachCard } from '../GoalCoachCard';
import type { GoalCoachInfo } from '@/src/stores/calibrationStore';

// Read-only card contract (spec 2026-07-13-goal-lever-coach §2): status + lever,
// no interaction, no minutes value, and — the point of the redesign — NO apply button.

const full: GoalCoachInfo = {
  targetBand: 10,
  bestBand: 14,
  progress: 0.64,
  insideCount: 3,
  windowCount: 7,
  lever: { bestValue: 'mornings', worstValue: 'afternoons', bestBand: 18, worstBand: 42 },
};

it('renders bands, count line and the strength-first lever sentence', () => {
  render(<GoalCoachCard categoryName="Focused work" info={full} />);
  expect(screen.getByText('±14%')).toBeTruthy();
  expect(screen.getByText('±10%')).toBeTruthy();
  expect(screen.getByText('goal ±10%')).toBeTruthy();
  expect(screen.getByText('3 of your last 7 logs landed inside the band')).toBeTruthy();
  expect(screen.getByText(/closest to your guess in the mornings/)).toBeTruthy();
  expect(screen.getByText(/±42% in the afternoons/)).toBeTruthy();
});

it('omits the lever row when no lever is real', () => {
  render(<GoalCoachCard categoryName="Focused work" info={{ ...full, lever: null }} />);
  expect(screen.queryByText(/closest to your guess/)).toBeNull();
});

it('omits the count line when there is no log window', () => {
  render(
    <GoalCoachCard categoryName="Focused work" info={{ ...full, insideCount: 0, windowCount: 0 }} />,
  );
  expect(screen.queryByText(/landed inside the band/)).toBeNull();
});

it('pluralizes a single-log window', () => {
  render(
    <GoalCoachCard categoryName="Focused work" info={{ ...full, insideCount: 1, windowCount: 1 }} />,
  );
  expect(screen.getByText('1 of your last 1 log landed inside the band')).toBeTruthy();
});

it('is completely non-interactive — no button, no apply affordance', () => {
  render(<GoalCoachCard categoryName="Focused work" info={full} />);
  expect(screen.queryByText(/Use \d/)).toBeNull();
  expect(screen.queryByText(/or keep/)).toBeNull();
  expect(screen.UNSAFE_queryAllByType(Pressable)).toHaveLength(0);
});

it('exposes the full status as one accessibility label', () => {
  render(<GoalCoachCard categoryName="Focused work" info={full} />);
  expect(
    screen.getByLabelText(
      'Goal for Focused work: best within 14 percent, target 10 percent. 3 of your last 7 logs inside the band. You land closest to your guess in the mornings, within 18 percent, versus 42 percent in the afternoons.',
    ),
  ).toBeTruthy();
});
