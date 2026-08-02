import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { UnlockLadder } from '../UnlockLadder';
import i18n from '@/src/i18n';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { CachedStat } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { resolveTheme } from '@/src/theme/useTheme';

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
  'Honest-Day forecast when you plan',
  'Drift re-check when life shifts',
  'Keeper – every area calibrated',
];

beforeEach(() => {
  useCalibrationStore.setState({
    logs: 0,
    statsByCategory: {},
    companionStage: 1,
    keeperCappedHighWater: 0,
  });
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
    // The reached rung directly below it states a fact about calibration
    // ("sharp enough to trust"), never "unlocked" — crossing this tier didn't
    // grant anything new (F1: only the drift-recalibration rung genuinely gates).
    expect(
      screen.getByLabelText('Live finish-time on your timer, sharp enough to trust'),
    ).toBeOnTheScreen();
    // A later, unreached, non-gated rung has nothing more to claim than that.
    expect(
      screen.getByLabelText('Honest-Day forecast when you plan, not yet reached, opens with Pro'),
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
    expect(
      screen.getByLabelText('Done-time on Today and Add task, sharp enough to trust'),
    ).toBeOnTheScreen();
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

  it('at the cap without keeper, rung 6 shows a countable "N of M areas calibrated" milestone, never an unexplained dead end', () => {
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
    expect(screen.getByText('1 of 3 areas calibrated')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Keeper – every area calibrated, 1 of 3 areas calibrated'),
    ).toBeOnTheScreen();
  });

  it('F5 regression: a sealed area drifting back off Honest does not decrement "N of M areas calibrated"', () => {
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
    // Establish the session high-water mark the way a real counted log would
    // (mirrors what `applyLog` does internally) — 1 of 2 areas capped.
    useCalibrationStore.setState({ keeperCappedHighWater: 1 });

    // A run of sloppy estimates drags cleaning's ROLLING window back off
    // Honest — the live read alone would now say "0 of 3".
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: statFor(70, 'Ripening'),
        admin: statFor(50, 'Setting'),
      },
    });

    render(<UnlockLadder keeper={false} />);

    // The milestone must NOT count down — it stays at the session high-water.
    expect(screen.getByText('1 of 3 areas calibrated')).toBeOnTheScreen();
    expect(screen.queryByText('0 of 3 areas calibrated')).toBeNull();
  });

  it('once keeper is reached, rung 6 is marked reached and drops the progress line', () => {
    useCalibrationStore.setState({
      logs: 40,
      companionStage: 5,
      statsByCategory: { cleaning: statFor(95, 'Honest') },
    });

    render(<UnlockLadder keeper />);

    expect(screen.queryByText(/areas calibrated/)).toBeNull();
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
      screen.getByLabelText(
        'Honest-Day forecast when you plan, sharp enough to trust, opens with Pro',
      ),
    ).toBeOnTheScreen();
    // drift-recalibration is the ONE genuinely stage-gated rung — reached, it
    // still says "unlocked" (F1: the founder's call was to keep this rung's
    // language as-is, since it's the one place the claim is true).
    expect(screen.getByLabelText('Drift re-check when life shifts, unlocked')).toBeOnTheScreen();
    // Nothing on the tier ladder is still being chased, so no rung re-offers a
    // capability the user already holds.
    expect(screen.queryAllByText(/logs? away/)).toHaveLength(0);
    // The header still shows the honest, live progress read — that one may fall.
    expect(screen.getByText('Getting closer · 70%')).toBeOnTheScreen();
  });

  it('F16: singular "1 log away" (ladder.away_one / rungCurrentA11y_one) — the free, non-gated current rung', () => {
    // sharpness 90 (Thickening) lands one log short of Honest (93):
    // ceil((93-90)/4) = 1. Stage 4's next rung is drift-recalibration —
    // stage-gated but NOT Pro — so this exercises `rungCurrentA11y_one`
    // (no "opens with Pro"), not the Pro variant.
    useCalibrationStore.setState({
      logs: 40,
      companionStage: 4,
      statsByCategory: { cleaning: statFor(90, 'Thickening') },
    });

    render(<UnlockLadder keeper={false} />);

    expect(screen.getByText('1 log away')).toBeOnTheScreen();
    expect(screen.queryByText(/logs away/)).toBeNull();
    expect(
      screen.getByLabelText('Drift re-check when life shifts, current stage, 1 log away'),
    ).toBeOnTheScreen();
  });

  it('F16: singular "1 log away, opens with Pro" (ladder.rungCurrentProA11y_one) — the Pro current rung', () => {
    // sharpness 61 (Setting) lands one log short of Ripening (64):
    // ceil((64-61)/4) = 1. Stage 2's next rung is start-by-anchor — Pro AND
    // not stage-gated, so this is the Pro variant of the current-rung a11y.
    useCalibrationStore.setState({
      logs: 20,
      companionStage: 2,
      statsByCategory: { cleaning: statFor(61, 'Setting') },
    });

    render(<UnlockLadder keeper={false} />);

    expect(screen.getByText('1 log away')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Reverse start-by anchor, current stage, 1 log away, opens with Pro'),
    ).toBeOnTheScreen();
  });

  it('F16: singular away-count in Swedish too', async () => {
    await i18n.changeLanguage('sv');
    try {
      useCalibrationStore.setState({
        logs: 40,
        companionStage: 4,
        statsByCategory: { cleaning: statFor(90, 'Thickening') },
      });

      render(<UnlockLadder keeper={false} />);

      expect(screen.getByText('1 logg kvar')).toBeOnTheScreen();
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  it('marks the two Pro rungs for a free user and leaves the four free ones plain', () => {
    render(<UnlockLadder keeper={false} />);

    // Two PRO pills, on start-by-anchor and honest-day-forecast.
    expect(screen.getAllByText('PRO')).toHaveLength(2);
    expect(
      screen.getByLabelText('Reverse start-by anchor, not yet reached, opens with Pro'),
    ).toBeOnTheScreen();
    // drift-recalibration is unreached and not yet the current rung here (the
    // current rung is stage 2) — the ONE genuinely gated rung previews its
    // real gate instead of the blank "not yet reached" every other rung gets.
    expect(
      screen.getByLabelText('Drift re-check when life shifts, unlocks at Honest'),
    ).toBeOnTheScreen();
    expect(screen.getByText('unlocks at Honest')).toBeOnTheScreen();
  });

  it('shows no Pro marking to a subscriber', () => {
    useEntitlement.setState({ isPro: true });

    render(<UnlockLadder keeper={false} />);

    expect(screen.queryAllByText('PRO')).toHaveLength(0);
    expect(
      screen.getByLabelText('Reverse start-by anchor, not yet reached'),
    ).toBeOnTheScreen();
  });

  it('F1 regression: only the drift-recalibration rung ever claims to unlock; every other rung says it sharpens', () => {
    // Zero logs → stage 1 reached (running-finish-time), stage 2 current
    // (today-done-time). Neither is the genuinely gated rung.
    render(<UnlockLadder keeper={false} />);

    // Card title reflects the reworded framing.
    expect(screen.getByText('What your logs sharpen')).toBeOnTheScreen();
    // The reached rung is a fact about accuracy, never a claim of new access —
    // no "unlocked" text renders anywhere for a rung that only sharpens.
    expect(screen.queryByText('unlocked')).toBeNull();
    expect(screen.getByText('sharp enough to trust')).toBeOnTheScreen();
  });

  it('F11: an unreached rung reads at AA contrast, not the sub-3:1 faint tokens', () => {
    // Zero logs → only stage 1 is reached; every later rung (besides the
    // current one) is unreached and used to render at `inkFaint`/`surfaceSunken`
    // — 2.69:1 / 1.14:1 on `surface` in light mode, both failing WCAG.
    render(<UnlockLadder keeper={false} />);

    const light = resolveTheme('light');
    const label = screen.getByText('Reverse start-by anchor');
    const labelStyle = StyleSheet.flatten(label.props.style);
    expect(labelStyle.color).toBe(light.colors.inkSoft);
    expect(labelStyle.color).not.toBe(light.colors.inkFaint);
  });

  it('F13: the label row pins its children to the top so a Pro pill never shifts the label off the marker\'s cap-height', () => {
    render(<UnlockLadder keeper={false} />);

    const rows = screen.getAllByTestId('unlock-ladder-label-row');
    for (const row of rows) {
      expect(StyleSheet.flatten(row.props.style).alignItems).toBe('flex-start');
    }
  });

  it('F12: the header title can shrink; the tier/percent status never does', () => {
    render(<UnlockLadder keeper={false} />);

    const title = screen.getByText('What your logs sharpen');
    const status = screen.getByText('Just started · 0%');
    expect(StyleSheet.flatten(title.props.style).flexShrink).toBe(1);
    expect(StyleSheet.flatten(status.props.style).flexShrink).toBe(0);
  });
});
