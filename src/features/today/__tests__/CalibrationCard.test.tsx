import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import i18n from '@/src/i18n';
import { useCalibrationStore, type CachedStat } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { resolveTheme } from '@/src/theme/useTheme';
import type { CompanionStage } from '@/src/engine';

// F19 spy: wraps the real hook so the render-count regression test below can
// assert CalibrationCard's subtree calls it exactly once — every other test
// in this file exercises the REAL hook through this same wrapper.
const mockUseNextUnlockSpy = jest.fn();
jest.mock('@/src/features/whenbee/useNextUnlock', () => {
  const actual = jest.requireActual<typeof import('@/src/features/whenbee/useNextUnlock')>(
    '@/src/features/whenbee/useNextUnlock',
  );
  return {
    ...actual,
    useNextUnlock: (...args: unknown[]) => {
      mockUseNextUnlockSpy(...args);
      return actual.useNextUnlock(...(args as []));
    },
  };
});

// eslint-disable-next-line import/first -- must follow the jest.mock above
import { CalibrationCard } from '../CalibrationCard';

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
    mockUseNextUnlockSpy.mockClear();
  });

  afterEach(() => {
    act(() => {
      useCalibrationStore.setState({ statsByCategory: {}, logs: 0, companionStage: 1 });
    });
  });

  it('renders the localised tier word, the percentage, and the next-unlock sentence', () => {
    // sharpness 64 lands exactly on the Ripening threshold: tier "Getting
    // closer", 18 points to Thickening (82) → ceil(18/4) = 5 logs, and the
    // NEXT stage (4) sharpens the honest-day forecast — a Pro feature, so a
    // free user is told so rather than sold it as a logging reward. Stage 4
    // is not the one genuinely stage-gated rung (only drift-recalibration,
    // stage 5, is — F1), so this uses "sharpen" phrasing, not "unlock".
    setStats(64, 'Ripening', 20, 3);

    render(<CalibrationCard />);

    // F8: an eyebrow names the scope — this tier/pct is the LEAD (sharpest)
    // tracked area, not an aggregate across everything logged.
    expect(screen.getByText('Your sharpest area')).toBeOnTheScreen();
    expect(screen.getByText('Getting closer')).toBeOnTheScreen();
    expect(screen.getByText('64%')).toBeOnTheScreen();
    expect(
      screen.getByText('5 more logs sharpen Honest-Day forecast when you plan, a Pro feature'),
    ).toBeOnTheScreen();
    // The grouped a11y label carries the SAME sentence — it used to compose its
    // own copy and silently dropped the Pro qualifier.
    expect(
      screen.getByLabelText(
        'Your sharpest area, Getting closer, 64 percent calibrated. 5 more logs sharpen Honest-Day forecast when you plan, a Pro feature',
      ),
    ).toBeOnTheScreen();
  });

  it('drops the Pro qualifier for a subscriber', () => {
    useEntitlement.setState({ isPro: true });
    setStats(64, 'Ripening', 20, 3);

    render(<CalibrationCard />);

    expect(
      screen.getByText('5 more logs sharpen Honest-Day forecast when you plan'),
    ).toBeOnTheScreen();
  });

  it('F16: singular "1 more log sharpens", a Pro feature (ladder.sharpenPro_one) — a free user, one log short', () => {
    // sharpness 79 lands one log short of Thickening (82): ceil((82-79)/4) = 1.
    // The NEXT stage (4) sharpens Honest-Day forecast, a Pro feature. i18next
    // resolves `_one` off `count === 1`, a different translation key entirely
    // from `_other` — this only proves out with count exactly 1.
    setStats(79, 'Ripening', 20, 3);

    render(<CalibrationCard />);

    expect(
      screen.getByText('1 more log sharpens Honest-Day forecast when you plan, a Pro feature'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/more logs sharpen/)).toBeNull();
  });

  it('F16: singular "1 more log sharpens" (ladder.sharpen_one) drops the Pro qualifier for a subscriber', () => {
    useEntitlement.setState({ isPro: true });
    setStats(79, 'Ripening', 20, 3);

    render(<CalibrationCard />);

    expect(
      screen.getByText('1 more log sharpens Honest-Day forecast when you plan'),
    ).toBeOnTheScreen();
  });

  it('F16: singular "1 more log unlocks" (ladder.unlock_one) on the one genuinely gated rung', () => {
    // sharpness 90 (Thickening) lands one log short of Honest (93):
    // ceil((93-90)/4) = 1. Stage 4's next rung is drift-recalibration, the
    // ONE genuinely stage-gated capability (F1) — "unlocks", not "sharpens".
    setStats(90, 'Thickening', 40, 4);

    render(<CalibrationCard />);

    expect(
      screen.getByText('1 more log unlocks Drift re-check when life shifts'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/more logs unlock/)).toBeNull();
  });

  it('F16: singular ladder copy in Swedish too', async () => {
    await i18n.changeLanguage('sv');
    try {
      setStats(79, 'Ripening', 20, 3);

      render(<CalibrationCard />);

      expect(
        screen.getByText('1 logg till skärper Ärlig dag-prognos när du planerar, en Pro-funktion'),
      ).toBeOnTheScreen();
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  it('at the cap, renders the sealed line in place of the away-count', () => {
    setStats(100, 'Honest', 40, 5);

    render(<CalibrationCard />);

    expect(screen.getByText('Honest')).toBeOnTheScreen();
    expect(screen.getByText('100%')).toBeOnTheScreen();
    expect(screen.getByText('Calibrated ✦')).toBeOnTheScreen();
    expect(screen.queryByText(/more logs/)).not.toBeOnTheScreen();
    // F10: the ✦ is a visual-only cue — the spoken a11y label drops it so
    // VoiceOver/TalkBack never announces a stray glyph.
    expect(
      screen.getByLabelText('Your sharpest area, Honest, 100 percent calibrated. Calibrated'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(/✦/)).toBeNull();
  });

  it('F3 regression: never shows "Calibrated ✦" next to a lower tier word after the sealed lead is deleted/reset', () => {
    // The monotonic companion stage stayed at 5 (an earlier area sealed and
    // that fuel never lowers), but the lead category was deleted/reset — no
    // tracked category proves Honest live anymore, so the visible tier/pct
    // read "Just started, 0%". The old bug: the sealed line still rendered
    // "Calibrated ✦" underneath, directly contradicting the number above it.
    useCalibrationStore.setState({
      statsByCategory: {},
      logs: 40,
      companionStage: 5,
    });

    render(<CalibrationCard />);

    expect(screen.getByText('Just started')).toBeOnTheScreen();
    expect(screen.getByText('0%')).toBeOnTheScreen();
    // Neither the (now false) sealed claim nor a fabricated capability name —
    // there is nothing honest left to say on this rung.
    expect(screen.queryByText('Calibrated ✦')).toBeNull();
    expect(screen.queryByText(/more logs/)).toBeNull();
    // F14: the header ring never reads as an empty circle at 0% (it floors its
    // fill at `ring.endowedPct`) — this bar sits directly beneath it showing
    // the SAME number, so its fill follows the same floor rather than reading
    // as a genuinely empty bar right under a ring that visibly isn't.
    const light = resolveTheme('light');
    const fill = screen.getByTestId('calibration-card-fill');
    expect(StyleSheet.flatten(fill.props.style).width).toBe(`${light.ring.endowedPct}%`);
  });

  it('F14: floors the bar fill but never fudges the displayed number itself', () => {
    // sharpness 3 is below the ring's endowed floor — the number stays true.
    setStats(3, 'Raw', 2, 1);

    render(<CalibrationCard />);

    expect(screen.getByText('3%')).toBeOnTheScreen();
    const light = resolveTheme('light');
    const fill = screen.getByTestId('calibration-card-fill');
    expect(StyleSheet.flatten(fill.props.style).width).toBe(`${light.ring.endowedPct}%`);
  });

  it('F10: composes the percentage through i18n so Swedish gets its own space-before-% convention', async () => {
    setStats(64, 'Ripening', 20, 3);
    await i18n.changeLanguage('sv');
    try {
      render(<CalibrationCard />);
      expect(screen.getByText('64 %')).toBeOnTheScreen();
      expect(screen.queryByText('64%')).toBeNull();
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  it('F19: resolves useNextUnlock exactly once per render for the whole card subtree', () => {
    // Before the fix this hook ran 3x per render in this one card: directly
    // here, again inside useUnlockSentence, and a third time inside the child
    // <NextUnlock/> — each opening its own pair of store subscriptions and
    // recomputing aggregateCalibration over the identical input. CalibrationCard
    // now resolves it once and passes the result down via NextUnlock's
    // `unlock` prop (a pure resolveUnlockSentence call replaces the second
    // internal hook call), so a single render must call the hook exactly once.
    setStats(64, 'Ripening', 20, 3);

    render(<CalibrationCard />);

    expect(mockUseNextUnlockSpy).toHaveBeenCalledTimes(1);
  });
});
