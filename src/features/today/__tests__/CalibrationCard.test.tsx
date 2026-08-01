import { act, render, screen } from '@testing-library/react-native';
import { CalibrationCard } from '../CalibrationCard';
import { useCalibrationStore, type CachedStat } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// CalibrationCard — Today's plain calibration read (tier word + percentage +
// bar + next-unlock sentence). Only `sharpness`/`tier` on each stat entry
// drive the aggregate the card reads (`aggregateCalibration`), so the test
// stats below are cast rather than filling every `CachedStat` field.
// ──────────────────────────────────────────────────────────────────────────────

function setStats(sharpness: number, tier: CachedStat['tier'], logs: number) {
  useCalibrationStore.setState({
    statsByCategory: {
      cleaning: { sharpness, tier } as unknown as CachedStat,
    },
    logs,
  });
}

describe('CalibrationCard', () => {
  afterEach(() => {
    act(() => {
      useCalibrationStore.setState({ statsByCategory: {}, logs: 0 });
    });
  });

  it('renders the localised tier word, the percentage, and the next-unlock sentence', () => {
    // sharpness 64 lands exactly on the Ripening threshold: tier "Getting
    // closer", 18 points to Thickening (82) → ceil(18/4) = 5 logs, and the
    // NEXT stage (4) unlocks the honest-day forecast.
    setStats(64, 'Ripening', 20);

    render(<CalibrationCard />);

    expect(screen.getByText('Getting closer')).toBeOnTheScreen();
    expect(screen.getByText('64%')).toBeOnTheScreen();
    expect(
      screen.getByText('5 more logs and Honest-Day forecast on the widget'),
    ).toBeOnTheScreen();
  });

  it('at the cap, renders the sealed line in place of the away-count', () => {
    setStats(100, 'Honest', 40);

    render(<CalibrationCard />);

    expect(screen.getByText('Honest')).toBeOnTheScreen();
    expect(screen.getByText('100%')).toBeOnTheScreen();
    expect(screen.getByText('Calibrated ✦')).toBeOnTheScreen();
    expect(screen.queryByText(/more logs/)).not.toBeOnTheScreen();
  });
});
