import { render, screen } from '@testing-library/react-native';
import { UnlockLadder } from '../UnlockLadder';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { CachedStat } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// UnlockLadder — the Progress tab's six-stage capability list. Reads
// useNextUnlock() straight off the calibration store, so these fixtures mirror
// useNextUnlock.test.ts's cases for a deterministic ladder.
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
});

describe('UnlockLadder', () => {
  it('renders all six stages', () => {
    render(<UnlockLadder keeper={false} />);

    for (const label of ALL_CAPABILITY_LABELS) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it('marks the current stage and shows the away-count only there', () => {
    // Zero logs → Raw tier: stage 1 (running-finish-time) reached, stage 2
    // (today-done-time) is current, logsToNextTier(0) = 10.
    render(<UnlockLadder keeper={false} />);

    expect(screen.getByText('Done-time on Today and Add task')).toBeOnTheScreen();
    expect(screen.getByText('10 logs away')).toBeOnTheScreen();
    // No other rung carries an away-count line.
    expect(screen.queryAllByText(/logs? away/)).toHaveLength(1);
  });

  it('shows a different current stage and away-count at mid-tier', () => {
    useCalibrationStore.setState({
      logs: 12,
      statsByCategory: {
        cleaning: statFor(50, 'Setting'),
        admin: statFor(10, 'Raw'),
      },
    });

    render(<UnlockLadder keeper={false} />);

    // Setting tier: stage 3 (start-by-anchor) is current, logsToNextTier(50) = 4.
    expect(screen.getByText('4 logs away')).toBeOnTheScreen();
    expect(screen.queryAllByText(/logs? away/)).toHaveLength(1);
  });

  it('at the cap, renders the sealed state with no away-count anywhere', () => {
    useCalibrationStore.setState({
      logs: 40,
      statsByCategory: { cleaning: statFor(95, 'Honest') },
    });

    render(<UnlockLadder keeper={false} />);

    for (const label of ALL_CAPABILITY_LABELS) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.queryAllByText(/logs? away/)).toHaveLength(0);
  });

  it('at the cap with keeper reached, still renders no away-count', () => {
    useCalibrationStore.setState({
      logs: 40,
      statsByCategory: { cleaning: statFor(95, 'Honest') },
    });

    render(<UnlockLadder keeper />);

    expect(screen.queryAllByText(/logs? away/)).toHaveLength(0);
    expect(screen.getByText('Keeper – every area calibrated')).toBeOnTheScreen();
  });
});
