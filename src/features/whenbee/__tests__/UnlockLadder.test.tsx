import { render, screen } from '@testing-library/react-native';
import { UnlockLadder } from '../UnlockLadder';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { CachedStat } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

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
//
// `companionStage` is set explicitly in every fixture: it is the MONOTONIC stage
// that decides which rungs are lit, and letting it default would hide exactly the
// regression the last two cases pin.
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
  useCalibrationStore.setState({ logs: 0, statsByCategory: {}, companionStage: 1 });
  useCategoriesStore.setState({ categories: [] });
  useEntitlement.setState({ isPro: false });
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
      screen.getByLabelText('Honest-Day forecast on the widget, not yet unlocked, opens with Pro'),
    ).toBeOnTheScreen();
    // Exactly one away-count line exists anywhere in the ladder.
    expect(screen.queryAllByText(/logs? away/)).toHaveLength(1);
  });

  it('moves the away-count to the new current rung at mid-tier', () => {
    useCalibrationStore.setState({
      logs: 12,
      companionStage: 2,
      statsByCategory: {
        cleaning: statFor(50, 'Setting'),
        admin: statFor(10, 'Raw'),
      },
    });

    render(<UnlockLadder keeper={false} />);

    // Setting tier: stage 2 (today-done-time) now reached, stage 3
    // (start-by-anchor) is current, logsToNextTier(50) = 4.
    expect(
      screen.getByLabelText('Reverse start-by anchor, current stage, 4 logs away, opens with Pro'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Done-time on Today and Add task, unlocked')).toBeOnTheScreen();
    expect(screen.getByText('Learning · 50%')).toBeOnTheScreen();
    expect(screen.queryAllByText(/logs? away/)).toHaveLength(1);
  });

  it('at the cap, renders the sealed state with no tier-ladder away-count anywhere', () => {
    useCalibrationStore.setState({
      logs: 40,
      companionStage: 5,
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
      companionStage: 5,
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
      companionStage: 5,
      statsByCategory: { cleaning: statFor(95, 'Honest') },
    });

    render(<UnlockLadder keeper />);

    expect(screen.queryByText(/areas sealed/)).toBeNull();
    expect(screen.getByLabelText('Keeper – every area calibrated, unlocked')).toBeOnTheScreen();
  });

  it('keeps earned rungs lit after the lead category sharpness falls (tier is monotonic)', () => {
    // The user capped an area at Honest (monotonic stage 5), then logged a run
    // of sloppy estimates: the rolling 8-log window dragged the lead back to
    // Ripening. The ladder must NOT un-light rungs 4 and 5 — deriving them from
    // the live tier was the bug.
    useCalibrationStore.setState({
      logs: 60,
      companionStage: 5,
      statsByCategory: { cleaning: statFor(70, 'Ripening') },
    });

    render(<UnlockLadder keeper={false} />);

    expect(
      screen.getByLabelText('Honest-Day forecast on the widget, reached, opens with Pro'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Drift re-check when life shifts, unlocked')).toBeOnTheScreen();
    // Nothing on the tier ladder is still being chased, so no rung re-offers a
    // capability the user already holds.
    expect(screen.queryAllByText(/logs? away/)).toHaveLength(0);
    // The header still shows the honest, live progress read — that one may fall.
    expect(screen.getByText('Getting closer · 70%')).toBeOnTheScreen();
  });

  it('marks the two Pro rungs for a free user and leaves the four free ones plain', () => {
    render(<UnlockLadder keeper={false} />);

    // Two PRO pills, on start-by-anchor and honest-day-forecast.
    expect(screen.getAllByText('PRO')).toHaveLength(2);
    expect(
      screen.getByLabelText('Reverse start-by anchor, not yet unlocked, opens with Pro'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Drift re-check when life shifts, not yet unlocked'),
    ).toBeOnTheScreen();
  });

  it('shows no Pro marking to a subscriber', () => {
    useEntitlement.setState({ isPro: true });

    render(<UnlockLadder keeper={false} />);

    expect(screen.queryAllByText('PRO')).toHaveLength(0);
    expect(
      screen.getByLabelText('Reverse start-by anchor, not yet unlocked'),
    ).toBeOnTheScreen();
  });
});
