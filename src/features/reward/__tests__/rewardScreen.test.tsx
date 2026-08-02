import { render, screen } from '@testing-library/react-native';
import Reward from '@/src/app/(modals)/reward';
import { useRewardStore } from '@/src/stores/rewardStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { LogResult, CachedStat } from '@/src/stores/calibrationStore';

const mockDismiss = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    dismiss: (...a: unknown[]) => mockDismiss(...a),
    push: (...a: unknown[]) => mockPush(...a),
  },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

const baseResult: LogResult = {
  eventId: 'evt-test',
  counted: true,
  multiplier: 2.2,
  sharpness: 64,
  tierBefore: 'Setting',
  tierAfter: 'Ripening',
  leveledUp: false,
  reclaimDeltaMin: 0,
  reclaimLifetimeMin: 0,
  stageJustRose: false,
};

beforeEach(() => {
  mockDismiss.mockClear();
  mockPush.mockClear();
  useRewardStore.getState().clear();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {}, companionStage: 1 });
  useEntitlement.setState({ isPro: false });
  // Stub loadReclaimSummary so the NotifSoftAskCard (rendered inside Reward)
  // never hits SQLite, which is unavailable in the Jest environment.
  useCalibrationStore.setState({
    loadReclaimSummary: jest.fn().mockResolvedValue({
      lifetimeMin: 0,
      byCategory: [],
      biggestArea: null,
      honestLogCount: 0,
      companion: {
        stage: 1,
        capability: 'timer',
        keeper: false,
        lifetimeNectar: 0,
        driftHealth: 'settled',
        seed: 1,
        name: null,
      },
      discoveryCount: 0,
    }),
  });
});

describe('Reward screen', () => {
  it('renders the actual number, the delta chip, and the honey pct', () => {
    useRewardStore.getState().setReward({
      actualMin: 28,
      guessMin: 15,
      category: 'getting_ready',
      label: 'Leave for work',
      result: baseResult,
    });

    render(<Reward />);

    expect(screen.getByText('28')).toBeOnTheScreen();
    // The gray "you guessed…" sentence is now a glanceable delta chip.
    expect(screen.getByText('13m over your guess')).toBeOnTheScreen();
    // Honey pct: number + muted unit suffix render as separate nodes now.
    expect(screen.getByText('64')).toBeOnTheScreen();
    // Multiplier folded into the HONEY header as a quiet "· 2.2×" meta.
    expect(screen.getByText('· 2.2×')).toBeOnTheScreen();
  });

  it('renders a deterministic timed headline from the rotating set', () => {
    useCalibrationStore.setState({ logs: 0 });
    useRewardStore.getState().setReward({
      actualMin: 10,
      guessMin: 10,
      category: 'email',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    // logs % 4 === 0 → first headline.
    expect(screen.getByText('Logged. Nice one.')).toBeOnTheScreen();
  });

  it('renders the reworded nectar headline at rotation index 3', () => {
    useCalibrationStore.setState({ logs: 3 });
    useRewardStore.getState().setReward({
      actualMin: 10,
      guessMin: 10,
      category: 'email',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    // logs % 4 === 3 → fourth headline (the de-twee'd one).
    expect(screen.getByText("That's one more, logged.")).toBeOnTheScreen();
  });

  it('shows the cap eyebrow + seal ritual when the cell ripens to Honest', () => {
    useRewardStore.getState().setReward({
      actualMin: 12,
      guessMin: 15,
      category: 'email',
      label: null,
      result: { ...baseResult, sharpness: 95, tierAfter: 'Honest', leveledUp: true },
    });
    render(<Reward />);
    expect(screen.getByText('Honest cell sealed')).toBeOnTheScreen();
    expect(
      screen.getByText('New honest cell. Nothing to keep up.'),
    ).toBeOnTheScreen();
  });

  it('renders the graceful fallback when there is no reward (deep-linked)', () => {
    // store is cleared in beforeEach → result is null.
    render(<Reward />);
    expect(screen.getByText('Nothing to celebrate yet')).toBeOnTheScreen();
    expect(screen.getByText('Back to today')).toBeOnTheScreen();
    // No crash, no honey row.
    expect(screen.queryByText('HONEY')).toBeNull();
  });

  it('renders the hub CTA button with the new label', () => {
    useRewardStore.getState().setReward({
      actualMin: 32,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: { ...baseResult, reclaimDeltaMin: 15, reclaimLifetimeMin: 200 },
    });
    render(<Reward />);
    // No reclaim chip — the beat is gone.
    expect(screen.queryByText(/reclaimed/)).toBeNull();
    expect(screen.queryByLabelText(/banked/)).toBeNull();
    // The primary CTA now reads "See your bee".
    expect(screen.getByText('See your bee')).toBeOnTheScreen();
    expect(screen.getByText('Back to today')).toBeOnTheScreen();
  });

  it('shows no reclaim element regardless of reclaimDeltaMin', () => {
    useRewardStore.getState().setReward({
      actualMin: 12,
      guessMin: 12,
      category: 'email',
      label: null,
      result: { ...baseResult, reclaimDeltaMin: 0, reclaimLifetimeMin: 40 },
    });
    render(<Reward />);
    expect(screen.queryByText(/reclaimed/)).toBeNull();
    expect(screen.queryByLabelText(/banked/)).toBeNull();
  });

  it('shows the over-run reason row when the run ran well past the guess', () => {
    // 32 vs 15 → ratio ~2.1, past the 0.25 gate → over-run chips.
    useRewardStore.getState().setReward({
      actualMin: 32,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    expect(screen.getByText('Where did the time go?')).toBeOnTheScreen();
    expect(screen.getByText('Paused')).toBeOnTheScreen();
    // The two exits are still present — the row never blocks them.
    expect(screen.getByText('See your bee')).toBeOnTheScreen();
    expect(screen.getByText('Back to today')).toBeOnTheScreen();
  });

  it('shows the under-run reason row when the run came in well under the guess', () => {
    // 8 vs 30 → ratio ~0.27, past the gate on the under side → under-run chips.
    useRewardStore.getState().setReward({
      actualMin: 8,
      guessMin: 30,
      category: 'email',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    expect(screen.getByText('What made it quick?')).toBeOnTheScreen();
    expect(screen.getByText('Flow')).toBeOnTheScreen();
  });

  it('shows what this log sharpens next, mid-ladder', () => {
    // Same fixture as CalibrationCard's mid-ladder test: sharpness 64 lands
    // exactly on the Ripening threshold; 18 points to Thickening (82) →
    // ceil(18/4) = 5 logs; the NEXT stage (4) sharpens the honest-day forecast.
    // That capability is Pro, so a free user gets the Pro-sharpen sentence —
    // the screen must not sell a paywalled feature as a logging reward. It's
    // "sharpen" phrasing, not "unlock", because stage 4 is not the one
    // genuinely stage-gated rung (only drift-recalibration, stage 5, is — F1).
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { sharpness: 64, tier: 'Ripening' } as unknown as CachedStat,
      },
      logs: 20,
      companionStage: 3,
    });
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    expect(
      screen.getByText('5 more logs sharpen Honest-Day forecast when you plan, a Pro feature'),
    ).toBeOnTheScreen();
  });

  it('drops the Pro qualifier for a subscriber', () => {
    useEntitlement.setState({ isPro: true });
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { sharpness: 64, tier: 'Ripening' } as unknown as CachedStat,
      },
      logs: 20,
      companionStage: 3,
    });
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    expect(
      screen.getByText('5 more logs sharpen Honest-Day forecast when you plan'),
    ).toBeOnTheScreen();
  });

  it('says what THIS log sharpened on a crossing that is NOT the genuinely gated rung', () => {
    // tierBefore Setting → tierAfter Ripening is an upward crossing, and
    // `stageJustRose` says THIS log's fuel write is what raised the monotonic
    // stage — the store's own before-vs-after read, not a re-derived compare
    // against the (already-advanced) current stage. The rung this crossing
    // buys is start-by-anchor (stage 3), which is Pro but NOT stage-gated
    // (F1 — only drift-recalibration genuinely gates), so the payoff line is
    // a neutral fact regardless of the viewer's entitlement: no Pro mention,
    // because crossing this tier didn't grant or reveal anything new to
    // ANYONE, subscriber or not.
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { sharpness: 64, tier: 'Ripening' } as unknown as CachedStat,
      },
      logs: 20,
      companionStage: 3,
    });
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: { ...baseResult, leveledUp: true, stageJustRose: true },
    });
    render(<Reward />);
    expect(screen.getByText('Reverse start-by anchor just got sharper')).toBeOnTheScreen();
    expect(screen.queryByText(/opens with Pro/)).toBeNull();
    expect(screen.queryByText(/Just unlocked/)).toBeNull();
    // …and it does NOT also show the next target on the same beat.
    expect(screen.queryByText(/more logs/)).toBeNull();
  });

  it('names the freshly-sharpened capability the same way for a subscriber (no Pro branch on a non-gated crossing)', () => {
    useEntitlement.setState({ isPro: true });
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { sharpness: 64, tier: 'Ripening' } as unknown as CachedStat,
      },
      logs: 20,
      companionStage: 3,
    });
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: { ...baseResult, leveledUp: true, stageJustRose: true },
    });
    render(<Reward />);
    expect(screen.getByText('Reverse start-by anchor just got sharper')).toBeOnTheScreen();
  });

  it('F1 regression: says "Just unlocked" only on a crossing of the ONE genuinely gated rung (drift-recalibration)', () => {
    // tierBefore Thickening → tierAfter Honest is the ONE crossing that buys
    // a real feature gate (stage 5, drift-recalibration — `DRIFT_RECHECK_MIN_STAGE`
    // in hubGates.ts is the only place the app reads companion stage as a gate).
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { sharpness: 90, tier: 'Thickening' } as unknown as CachedStat,
      },
      logs: 40,
      companionStage: 5,
    });
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: {
        ...baseResult,
        tierBefore: 'Thickening',
        tierAfter: 'Honest',
        leveledUp: true,
        stageJustRose: true,
      },
    });
    render(<Reward />);
    expect(screen.getByText('Just unlocked: Drift re-check when life shifts')).toBeOnTheScreen();
    expect(screen.queryByText(/just got sharper/)).toBeNull();
  });

  it('does not re-announce a rung the user passed long ago', () => {
    // A second area catching up to Honest while the companion is already at
    // stage 5 crossed no NEW rung — no "just unlocked", just the sealed line
    // (the live lead is genuinely Honest here too, so the sealed claim is
    // consistent with what's on screen — see the F3 test below for the case
    // where it isn't).
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { sharpness: 95, tier: 'Honest' } as unknown as CachedStat,
      },
      logs: 20,
      companionStage: 5,
    });
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: { ...baseResult, leveledUp: true },
    });
    render(<Reward />);
    expect(screen.queryByText(/Just unlocked/)).toBeNull();
    // Stage 5 is the top of the tier ladder → the sealed line, never a rung
    // the monotonic stage already passed.
    expect(screen.getByText('Calibrated ✦')).toBeOnTheScreen();
  });

  it('F3 regression: never claims "Calibrated ✦" when the monotonic stage is sealed but the live tier is not', () => {
    // The monotonic stage stayed at 5 (an earlier area sealed and that fuel
    // never lowers), but the just-logged category's live tier is only
    // Ripening — the exact mismatch a reset/deleted lead produces. The old
    // code showed the sealed line off the monotonic stage alone; it is not an
    // honest claim when nothing tracked is visibly Honest.
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { sharpness: 64, tier: 'Ripening' } as unknown as CachedStat,
      },
      logs: 20,
      companionStage: 5,
    });
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    expect(screen.queryByText('Calibrated ✦')).toBeNull();
    expect(screen.queryByText(/more logs/)).toBeNull();
  });

  it('F4 regression: a second category crossing the SAME boundary a different category already earned does not re-announce it', () => {
    // The exact bug: Deep work crossed Ripening→Thickening weeks ago and the
    // reward screen correctly announced it — the companion stage is already 4.
    // Now Errands crosses that same boundary; `raiseTier` is a no-op so the
    // stage stays 4. The OLD guard compared `crossedStage (4) !== companionStage
    // (4)` — both AFTER the log — and that's always false once the store has
    // already advanced its own mirror inside applyLog, so it re-announced the
    // capability as newly earned a second time. `stageJustRose` is a real
    // before-vs-after read and correctly comes back false here.
    useCalibrationStore.setState({
      statsByCategory: {
        errands: { sharpness: 64, tier: 'Ripening' } as unknown as CachedStat,
      },
      logs: 40,
      companionStage: 4,
    });
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'errands',
      label: null,
      // tierBefore/tierAfter mirror an upward Thickening crossing (index 3 →
      // crossedStage 4), the exact value companionStage already holds — the
      // "after-with-after" trap — but stageJustRose is false because THIS
      // log's own fuel write did not raise the mirror.
      result: {
        ...baseResult,
        tierBefore: 'Ripening',
        tierAfter: 'Thickening',
        leveledUp: true,
        stageJustRose: false,
      },
    });
    render(<Reward />);
    expect(screen.queryByText(/Just unlocked/)).toBeNull();
    expect(screen.queryByText(/You reached/)).toBeNull();
  });

  it('never spans two subjects in one a11y label: the card describes THIS category, the unlock row describes the companion', () => {
    // The just-logged category sits at 30% while another area leads at 64%.
    // The old combined label glued "30 percent" to an unlock sentence derived
    // from the 64% lead and read it as one false claim.
    useCalibrationStore.setState({
      statsByCategory: {
        admin: { sharpness: 30, tier: 'Setting' } as unknown as CachedStat,
        cleaning: { sharpness: 64, tier: 'Ripening' } as unknown as CachedStat,
      },
      logs: 20,
      companionStage: 3,
    });
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'admin',
      label: null,
      result: { ...baseResult, sharpness: 30 },
    });
    render(<Reward />);

    // The card's own label: this category's number and multiplier, nothing else.
    expect(
      screen.getByLabelText('Calibration, 30 percent, multiplier 2.2 times.'),
    ).toBeOnTheScreen();
    // The unlock row is its own focusable unit, derived from the 64% lead.
    expect(
      screen.getByLabelText('5 more logs sharpen Honest-Day forecast when you plan, a Pro feature'),
    ).toBeOnTheScreen();
    // And it is explicitly introduced as a different subject.
    expect(screen.getByText('Across everything you track')).toBeOnTheScreen();
  });

  it('shows the sealed line in place of the away-count once calibration is capped', () => {
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { sharpness: 100, tier: 'Honest' } as unknown as CachedStat,
      },
      logs: 40,
    });
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'cleaning',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    expect(screen.getByText('Calibrated ✦')).toBeOnTheScreen();
    expect(screen.queryByText(/more logs/)).toBeNull();
  });

  it('hides the reason row when the run landed close to the guess', () => {
    // 16 vs 15 → ratio ~1.07, inside the gate → no chips.
    useRewardStore.getState().setReward({
      actualMin: 16,
      guessMin: 15,
      category: 'email',
      label: null,
      result: baseResult,
    });
    render(<Reward />);
    expect(screen.queryByText('Where did the time go?')).toBeNull();
    expect(screen.queryByText('What made it quick?')).toBeNull();
  });
});
