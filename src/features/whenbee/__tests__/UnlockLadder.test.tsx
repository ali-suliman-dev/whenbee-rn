import { render, screen } from '@testing-library/react-native';
import { UnlockLadder } from '../UnlockLadder';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { CachedStat } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';

// ──────────────────────────────────────────────────────────────────────────────
// UnlockLadder — the Progress tab's six-stage capability list. Reads
// useNextUnlock() straight off the calibration store, so these fixtures mirror
// useNextUnlock.test.ts's cases for a deterministic ladder. Assertions bind the
// away-count / keeper-progress line to the SPECIFIC rung it belongs to via the
// composed accessibility label (`ladder.rungCurrentA11y` /
// `ladder.rungReachedA11y` / `ladder.rungUpcomingA11y` /
// `ladder.rungKeeperProgressA11y`) — a loose "this text is somewhere on
// screen" check can't tell an off-by-one rung from the right one; the a11y
// label, which encodes rung label + state + count in one string, can.
// ──────────────────────────────────────────────────────────────────────────────

function statFor(sharpness: number, tier: CachedStat['tier']): CachedStat {
  return { mEffective: 1, n: 1, sharpness, tier, fit: { a: 0, b: 1 } };
}

const ALL_CAPABILITY_LABELS = [
  'Live finish-time on your timer',
  'Done-time on Today and Add task',
  'Reverse start-by anchor',
  'Honest-Day forecast on the widget',
  'Drift re-check when life shifts',
  'Keeper – every area calibrated',
];

beforeEach(() => {
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCategoriesStore.setState({ categories: [] });
});

describe('UnlockLadder', () => {
  it('renders all six stages', () => {
    render(<UnlockLadder keeper={false} />);

    for (const label of ALL_CAPABILITY_LABELS) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it('shows the tier word AND the percentage together in the header', () => {
    // Zero logs → Raw tier, 0%.
    render(<UnlockLadder keeper={false} />);

    expect(screen.getByText('Just started · 0%')).toBeOnTheScreen();
  });

  it('binds the away-count to the CURRENT rung specifically, not just anywhere on screen', () => {
    // Zero logs → Raw tier: stage 1 (running-finish-time) reached, stage 2
    // (today-done-time) is current, logsToNextTier(0) = 10.
    render(<UnlockLadder keeper={false} />);

    // The composed a11y label proves the away-count is attached to THIS
    // rung's capability, not just floating somewhere in the tree — an
    // off-by-one that put the count under the wrong rung fails this.
    expect(
      screen.getByLabelText('Done-time on Today and Add task, current stage, 10 logs away'),
    ).toBeOnTheScreen();
    // The reached rung directly below it carries no away-count.
    expect(screen.getByLabelText('Live finish-time on your timer, unlocked')).toBeOnTheScreen();
    // A later, unreached rung also carries no away-count.
    expect(
      screen.getByLabelText('Honest-Day forecast on the widget, not yet unlocked'),
    ).toBeOnTheScreen();
    // Exactly one away-count line exists anywhere in the ladder.
    expect(screen.queryAllByText(/logs? away/)).toHaveLength(1);
  });

  it('moves the away-count to the new current rung at mid-tier', () => {
    useCalibrationStore.setState({
      logs: 12,
      statsByCategory: {
        cleaning: statFor(50, 'Setting'),
        admin: statFor(10, 'Raw'),
      },
    });

    render(<UnlockLadder keeper={false} />);

    // Setting tier: stage 2 (today-done-time) now reached, stage 3
    // (start-by-anchor) is current, logsToNextTier(50) = 4.
    expect(
      screen.getByLabelText('Reverse start-by anchor, current stage, 4 logs away'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Done-time on Today and Add task, unlocked')).toBeOnTheScreen();
    expect(screen.getByText('Learning · 50%')).toBeOnTheScreen();
    expect(screen.queryAllByText(/logs? away/)).toHaveLength(1);
  });

  it('at the cap, renders the sealed state with no tier-ladder away-count anywhere', () => {
    useCalibrationStore.setState({
      logs: 40,
      statsByCategory: { cleaning: statFor(95, 'Honest') },
    });

    render(<UnlockLadder keeper={false} />);

    for (const label of ALL_CAPABILITY_LABELS) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.getByText('Honest · 95%')).toBeOnTheScreen();
    expect(screen.queryAllByText(/\d+ logs? away/)).toHaveLength(0);
  });

  it('at the cap without keeper, rung 6 shows a countable "N of M areas sealed" milestone, never an unexplained dead end', () => {
    useCategoriesStore.setState({
      categories: [
        { id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' },
        { id: 'admin', name: 'Admin', adaptSpeed: 'balanced' },
      ],
    });
    useCalibrationStore.setState({
      logs: 40,
      statsByCategory: {
        cleaning: statFor(95, 'Honest'),
        admin: statFor(50, 'Setting'),
      },
    });

    render(<UnlockLadder keeper={false} />);

    // 1 of 2 tracked categories capped; the quota floors the denominator at 3.
    expect(screen.getByText('1 of 3 areas sealed')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Keeper – every area calibrated, 1 of 3 areas sealed'),
    ).toBeOnTheScreen();
  });

  it('once keeper is reached, rung 6 is marked reached and drops the progress line', () => {
    useCalibrationStore.setState({
      logs: 40,
      statsByCategory: { cleaning: statFor(95, 'Honest') },
    });

    render(<UnlockLadder keeper />);

    expect(screen.queryByText(/areas sealed/)).toBeNull();
    expect(screen.getByLabelText('Keeper – every area calibrated, unlocked')).toBeOnTheScreen();
  });
});
