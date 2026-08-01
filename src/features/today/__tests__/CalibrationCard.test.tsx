import { act, render, screen } from '@testing-library/react-native';
import { CalibrationCard } from '../CalibrationCard';
import { useCalibrationStore, type CachedStat } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { CompanionStage } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// CalibrationCard — Today's plain calibration read (tier word + percentage +
// bar + next-unlock sentence). Only `sharpness`/`tier` on each stat entry
// drive the aggregate the card reads (`aggregateCalibration`), so the test
// stats below are cast rather than filling every `CachedStat` field.
// ──────────────────────────────────────────────────────────────────────────────

function setStats(sharpness: number, tier: CachedStat['tier'], logs: number, stage: CompanionStage = 1) {
  useCalibrationStore.setState({
    statsByCategory: {
      cleaning: { sharpness, tier } as unknown as CachedStat,
    },
    logs,
    companionStage: stage,
  });
}

describe('CalibrationCard', () => {
  beforeEach(() => {
    useEntitlement.setState({ isPro: false });
  });

  afterEach(() => {
    act(() => {
      useCalibrationStore.setState({ statsByCategory: {}, logs: 0, companionStage: 1 });
    });
  });

  it('renders the localised tier word, the percentage, and the next-unlock sentence', () => {
    // sharpness 64 lands exactly on the Ripening threshold: tier "Getting
    // closer", 18 points to Thickening (82) → ceil(18/4) = 5 logs, and the
    // NEXT stage (4) unlocks the honest-day forecast — a Pro feature, so a free
    // user is told so rather than sold it as a logging reward.
    setStats(64, 'Ripening', 20, 3);

    render(<CalibrationCard />);

    expect(screen.getByText('Getting closer')).toBeOnTheScreen();
    expect(screen.getByText('64%')).toBeOnTheScreen();
    expect(
      screen.getByText('5 more logs and Honest-Day forecast on the widget, a Pro feature'),
    ).toBeOnTheScreen();
    // The grouped a11y label carries the SAME sentence — it used to compose its
    // own copy and silently dropped the Pro qualifier.
    expect(
      screen.getByLabelText(
        'Getting closer, 64 percent calibrated. 5 more logs and Honest-Day forecast on the widget, a Pro feature',
      ),
    ).toBeOnTheScreen();
  });

  it('drops the Pro qualifier for a subscriber', () => {
    useEntitlement.setState({ isPro: true });
    setStats(64, 'Ripening', 20, 3);

    render(<CalibrationCard />);

    expect(
      screen.getByText('5 more logs and Honest-Day forecast on the widget'),
    ).toBeOnTheScreen();
  });

  it('at the cap, renders the sealed line in place of the away-count', () => {
    setStats(100, 'Honest', 40, 5);

    render(<CalibrationCard />);

    expect(screen.getByText('Honest')).toBeOnTheScreen();
    expect(screen.getByText('100%')).toBeOnTheScreen();
    expect(screen.getByText('Calibrated ✦')).toBeOnTheScreen();
    expect(screen.queryByText(/more logs/)).not.toBeOnTheScreen();
  });
});
