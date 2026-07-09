import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import Patterns from '@/src/app/(tabs)/patterns';
import { useCalibrationStore, type PatternsData } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { kv } from '@/src/lib/kv';

// FocusPeakCard (the pinned focus card on this screen) calls useLearnedFocusWindow,
// which loads focus events from calibrationStore via expo-sqlite. Stub it so the
// screen tests don't hit the sqlite path — the card's own tests cover its states.
jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: () => ({
    basis: 'prior' as const,
    startMin: 540,
    endMin: 690,
    scoreByBin: Array(38).fill(0),
    sampleCount: 0,
    distinctDays: 0,
    confidence: 0,
    held: false,
    gates: {
      sessions: { have: 0, need: 15 },
      days: { have: 0, need: 5 },
      peak: { have: 0, need: 6, confirming: false },
    },
  }),
}));

// FocusCurve renders SVG which is fine in tests, but stub FocusWindowEditorSheet
// (uses Modal + FinishTimeWheel with native scroll) to keep the screen test lean.
jest.mock('@/src/features/planner/FocusWindowEditorSheet', () => ({
  FocusWindowEditorSheet: () => null,
}));

// FocusPeakCard (now the pinned card) also calls useFocusInsights, which reads
// focus events via calibrationStore.loadFocusEvents. Stub it the same way as
// useLearnedFocusWindow so the screen tests don't depend on the sqlite path —
// the card's own states are covered by FocusPeakCard.test.tsx.
jest.mock('@/src/features/patterns/useFocusInsights', () => ({
  useFocusInsights: () => null,
}));

// Mock expo-router: useFocusEffect runs the callback once (mirrors an immediate
// focus) so usePatterns' on-focus refresh path is exercised without navigation.
// useRouter is stubbed so ArchetypePlaceholder's onTakeQuiz can push without error.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => cb(),
  useRouter: () => ({ push: jest.fn() }),
}));

// ──────────────────────────────────────────────────────────────────────────────
// Screen test: seeded data → cards render; empty data → the calm empty state (no
// card, no scold).
// ──────────────────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function setPatternsData(data: PatternsData) {
  // Stub both reads the screen kicks off on mount: the Patterns projection and the
  // Pro "what steals your time" insights (default empty → no Pro card, no sqlite).
  useCalibrationStore.setState({
    loadPatternsData: async () => data,
    loadReasonInsights: async () => [],
    loadContextInsights: async () => [],
  });
}

describe('Patterns screen', () => {
  it('renders the calm empty state when no logs exist', async () => {
    setPatternsData({ categories: [], logs: [], nameOf: (id) => id });

    render(<Patterns />);

    await waitFor(() => {
      expect(screen.getByText('Your patterns are on the way')).toBeOnTheScreen();
    });
    // No insight cards, and nothing that reads as a scold.
    expect(screen.queryByText('YOUR TIME PERSONALITY')).toBeNull();
    expect(screen.queryByText('Your numbers')).toBeNull();
  });

  it('renders earned cards when seeded with qualifying data', async () => {
    setPatternsData({
      nameOf: (id) => (id === 'admin' ? 'Admin & email' : id),
      categories: [
        { categoryId: 'admin', n: 8, mEffective: 2.0, sharpness: 60 },
        { categoryId: 'email', n: 6, mEffective: 1.8, sharpness: 55 },
      ],
      logs: Array.from({ length: 8 }, (_, i) => ({
        category: 'admin',
        estimateMin: 10,
        actualMin: 20,
        status: 'completed' as const,
        source: 'timed' as const,
        createdAt: NOW - (8 - i) * DAY,
      })),
    });

    render(<Patterns />);

    await waitFor(() => {
      // ArchetypeHero qualifies (2 categories, ≥12 logs) and the honest map lists rows.
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });
    expect(screen.getByText('Your numbers')).toBeOnTheScreen();
    // Section header from the redesigned sectioned story.
    expect(screen.getByText('Your progress')).toBeTruthy();
    // The empty state must NOT show when cards are present.
    expect(screen.queryByText('Your patterns are on the way')).toBeNull();
  });

  it('shows the readiness dial filled to honest for a settled category', async () => {
    setPatternsData({
      nameOf: (id) => (id === 'admin' ? 'Admin & email' : id),
      categories: [{ categoryId: 'admin', n: 8, mEffective: 2.0, sharpness: 60 }],
      // Tight 2× cluster, n≥6 → confidence 'honest' → all 3 pips lit.
      logs: Array.from({ length: 8 }, (_, i) => ({
        category: 'admin',
        estimateMin: 10,
        actualMin: 20,
        status: 'completed' as const,
        source: 'timed' as const,
        createdAt: NOW - (8 - i) * DAY,
      })),
    });

    render(<Patterns />);

    await waitFor(() => {
      expect(screen.getByText('Your numbers')).toBeOnTheScreen();
    });
    // Dial exposes its filled-step count via the progressbar label (honest = 3 of 3).
    expect(screen.getByLabelText('Admin & email readiness: honest, 3 of 3')).toBeOnTheScreen();
    // Warm, no-guilt framing line (single honest area).
    expect(screen.getByText('One area reads honest now. The rest are catching up.')).toBeOnTheScreen();
  });

  it('shows the archetype placeholder for a logged-but-unearned user', async () => {
    setPatternsData({
      nameOf: (id) => id,
      categories: [{ categoryId: 'admin', n: 1, mEffective: 2.0, sharpness: 20 }],
      logs: [{ category: 'admin', estimateMin: 10, actualMin: 20, status: 'completed' as const, source: 'timed' as const, createdAt: NOW - DAY }],
    });
    render(<Patterns />);
    await waitFor(() => expect(screen.getByText('Meet your time personality')).toBeOnTheScreen());
  });

  it('shows a partially-filled dial for a raw category', async () => {
    setPatternsData({
      nameOf: (id) => id,
      categories: [{ categoryId: 'admin', n: 1, mEffective: 2.0, sharpness: 20 }],
      logs: [
        {
          category: 'admin',
          estimateMin: 10,
          actualMin: 20,
          status: 'completed' as const,
          source: 'timed' as const,
          createdAt: NOW - DAY,
        },
      ],
    });

    render(<Patterns />);

    await waitFor(() => {
      expect(screen.getByText('Your numbers')).toBeOnTheScreen();
    });
    // raw → only the first pip lit (1 of 3).
    expect(screen.getByLabelText('admin readiness: raw, 1 of 3')).toBeOnTheScreen();
    expect(
      screen.getByText('Your areas are still settling. A few more logs and the numbers sharpen.'),
    ).toBeOnTheScreen();
  });
});

describe('Patterns screen — segment routing', () => {
  beforeEach(() => {
    setPatternsData({
      nameOf: (id) => id,
      categories: [
        { categoryId: 'admin', n: 8, mEffective: 2.0, sharpness: 60 },
        { categoryId: 'email', n: 6, mEffective: 1.8, sharpness: 55 },
      ],
      logs: Array.from({ length: 8 }, (_, i) => ({
        category: 'admin',
        estimateMin: 10,
        actualMin: 20,
        status: 'completed' as const,
        source: 'timed' as const,
        createdAt: NOW - (8 - i) * DAY,
      })),
    });
  });

  it('hero and review render regardless of selected tab', async () => {
    render(<Patterns />);
    await waitFor(() => {
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });
    // Switch to Insights tab — hero must still be present
    fireEvent.press(screen.getByRole('tab', { name: 'Insights' }));
    expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
  });

  it('pins the focus card outside the Numbers tab content', async () => {
    render(<Patterns />);
    await waitFor(() => {
      expect(screen.getByText('Your numbers')).toBeOnTheScreen();
    });
    // Pinned on the default (Numbers) tab.
    expect(screen.getByText("WHEN YOU'RE SHARP")).toBeOnTheScreen();

    // Still pinned after switching off Numbers — never buried inside a segment.
    fireEvent.press(screen.getByRole('tab', { name: 'Correlations' }));
    expect(screen.getByText("WHEN YOU'RE SHARP")).toBeOnTheScreen();
  });

  it('numbers tab (default) shows progress, not correlations content', async () => {
    render(<Patterns />);
    await waitFor(() => {
      expect(screen.getByText('Your progress')).toBeOnTheScreen();
    });
    // Numbers-specific content is visible; correlations-only content is not
    expect(screen.getByText('Your numbers')).toBeOnTheScreen();
    // The correlations segment content (pro gate locked card) must not appear on numbers tab
    expect(screen.queryByText('What steals your time')).toBeNull();
  });

  it('insights tab shows empty message when no insight cards exist', async () => {
    render(<Patterns />);
    await waitFor(() => {
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByRole('tab', { name: 'Insights' }));
    await waitFor(() => {
      expect(screen.getByText("You're all caught up.")).toBeOnTheScreen();
    });
  });

  it('correlations tab hides numbers content', async () => {
    render(<Patterns />);
    await waitFor(() => {
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByRole('tab', { name: 'Correlations' }));
    // Numbers-only content must not be visible on correlations tab
    expect(screen.queryByText('Your progress')).toBeNull();
    // Segment control itself must still be present
    expect(screen.getByRole('tab', { name: 'Correlations' })).toBeOnTheScreen();
  });

  it('insights tab shows dismissable feed area after switch', async () => {
    render(<Patterns />);
    await waitFor(() => {
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByRole('tab', { name: 'Insights' }));
    // Hero still pinned, and the insights empty state renders
    expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.getByText("You're all caught up.")).toBeOnTheScreen();
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Pro-gate regression: free users on the Correlations tab see only the single
// teaser card — never the actual correlation data. Numbers + Insights stay free.
// ──────────────────────────────────────────────────────────────────────────────
describe('Patterns screen — Pro-gate (Correlations)', () => {
  const NOW_GATE = 1_700_000_000_000;
  const DAY_GATE = 24 * 60 * 60 * 1000;

  function seedWithInsights() {
    // Seed loadReasonInsights with a real insight so lockedTeaser === 'steals'
    // and the StealsYourTimeLocked teaser is the one shown.
    useCalibrationStore.setState({
      loadPatternsData: async () => ({
        nameOf: (id: string) => id,
        categories: [
          { categoryId: 'admin', n: 8, mEffective: 2.0, sharpness: 60 },
          { categoryId: 'email', n: 6, mEffective: 1.8, sharpness: 55 },
        ],
        logs: Array.from({ length: 8 }, (_, i) => ({
          category: 'admin',
          estimateMin: 10,
          actualMin: 20,
          status: 'completed' as const,
          source: 'timed' as const,
          createdAt: NOW_GATE - (8 - i) * DAY_GATE,
        })),
      }),
      // One reason insight → lockedTeaser picks 'steals'
      loadReasonInsights: async () => [
        {
          categoryId: 'admin',
          categoryName: 'Admin',
          reason: 'getting pulled away',
          share: 0.6,
          sampleCount: 5,
          totalOver: 30,
          timeSkew: null,
          weekdaySkew: null,
        },
      ],
      loadContextInsights: async () => [],
    });
  }

  beforeEach(() => {
    // Explicitly set free (belt-and-suspenders: kv won't set the override in
    // tests, but this makes the intent clear and guards against future changes).
    useEntitlement.setState({ isPro: false });
    seedWithInsights();
  });

  afterEach(() => {
    // Reset Pro state so this suite doesn't bleed into others.
    useEntitlement.setState({ isPro: false });
  });

  it('free user on Correlations tab sees the teaser, not the correlation data', async () => {
    render(<Patterns />);

    await waitFor(() => {
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });

    // Switch to Correlations
    fireEvent.press(screen.getByRole('tab', { name: 'Correlations' }));

    await waitFor(() => {
      // Teaser headline is visible (StealsYourTimeLocked)
      expect(screen.getByText('See where your time really goes.')).toBeOnTheScreen();
    });

    // The actual Pro correlation component must NOT render for free users
    expect(screen.queryByText('WHAT STEALS YOUR TIME')).toBeNull();
  });

  it('Numbers and Insights tabs remain free — no gate on those segments', async () => {
    render(<Patterns />);

    await waitFor(() => {
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });

    // Numbers tab is default — free content visible
    expect(screen.getByText('Your progress')).toBeOnTheScreen();

    // Switch to Insights — still free
    fireEvent.press(screen.getByRole('tab', { name: 'Insights' }));
    await waitFor(() => {
      // No paywall text on the free Insights tab
      expect(screen.queryByText('See where your time really goes.')).toBeNull();
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// DriftNote dismiss — C1 regression: DriftNote must be dismissable in Insights.
//
// Seeds enough completed logs to trigger a drift alert (6 logs, early half at
// actualMin/estimateMin ≈ 1.5×, recent half at ≈ 2.5×, gap > DRIFT_MIN_GAP 0.4).
// Navigates to the Insights tab, verifies the DriftNote renders via its "PACE
// SHIFT" eyebrow, presses the dismiss ×, and asserts the card disappears.
// Re-mounting verifies the dismissal is durable (kv-backed).
// ──────────────────────────────────────────────────────────────────────────────
describe('Patterns screen — DriftNote dismiss (C1)', () => {
  const NOW_D = 1_710_000_000_000;
  const DAY_D = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    // Clear kv so dismissals from other suites don't interfere.
    kv.clearAll();

    // 6 logs for "admin": first 3 = actualMin 15 on estimate 10 (1.5×),
    // last 3 = actualMin 25 on estimate 10 (2.5×). Gap = 1.0 > 0.4 = triggers drift.
    useCalibrationStore.setState({
      loadPatternsData: async (): Promise<PatternsData> => ({
        nameOf: (id) => (id === 'admin' ? 'Admin & email' : id),
        categories: [{ categoryId: 'admin', n: 6, mEffective: 2.0, sharpness: 50 }],
        logs: [
          // Early half (3 logs) — low ratio
          { category: 'admin', estimateMin: 10, actualMin: 15, status: 'completed' as const, source: 'timed' as const, createdAt: NOW_D - 6 * DAY_D },
          { category: 'admin', estimateMin: 10, actualMin: 15, status: 'completed' as const, source: 'timed' as const, createdAt: NOW_D - 5 * DAY_D },
          { category: 'admin', estimateMin: 10, actualMin: 15, status: 'completed' as const, source: 'timed' as const, createdAt: NOW_D - 4 * DAY_D },
          // Recent half (3 logs) — high ratio, gap ≈ 1.0
          { category: 'admin', estimateMin: 10, actualMin: 25, status: 'completed' as const, source: 'timed' as const, createdAt: NOW_D - 3 * DAY_D },
          { category: 'admin', estimateMin: 10, actualMin: 25, status: 'completed' as const, source: 'timed' as const, createdAt: NOW_D - 2 * DAY_D },
          { category: 'admin', estimateMin: 10, actualMin: 25, status: 'completed' as const, source: 'timed' as const, createdAt: NOW_D - 1 * DAY_D },
        ],
      }),
      loadReasonInsights: async () => [],
      loadContextInsights: async () => [],
    });
  });

  afterEach(() => {
    kv.clearAll();
  });

  it('DriftNote in Insights tab can be dismissed and stays gone (in-session)', async () => {
    render(<Patterns />);

    // With 1 category + 6 logs: view is non-empty, segment control renders.
    // Wait for data to fully load (Numbers tab shows "Your numbers").
    await waitFor(() => {
      expect(screen.getByText('Your numbers')).toBeOnTheScreen();
    });

    // Navigate to Insights tab
    fireEvent.press(screen.getByRole('tab', { name: 'Insights' }));

    // DriftNote must render (via its PatternCard eyebrow)
    await waitFor(() => {
      expect(screen.getByText('PACE SHIFT')).toBeOnTheScreen();
    });

    // Dismiss the DriftNote via the × button
    fireEvent.press(screen.getByLabelText('Hide this drift note'));

    // Card disappears immediately — PatternCard renders null once dismissed
    expect(screen.queryByText('PACE SHIFT')).toBeNull();

    // Navigate away and back to verify the dismissal holds within the session
    fireEvent.press(screen.getByRole('tab', { name: 'Numbers' }));
    await waitFor(() => expect(screen.getByText('Your numbers')).toBeOnTheScreen());
    fireEvent.press(screen.getByRole('tab', { name: 'Insights' }));

    // DriftNote stays dismissed when re-entering the Insights tab
    expect(screen.queryByText('PACE SHIFT')).toBeNull();
  });

  // Cross-mount kv durability is covered by usePatternDismiss.test.ts
  // ("re-mounting the hook with a dismissed id stays dismissed") — that test
  // exercises the kv read-on-init path directly without the async data-loading
  // overhead that causes RNTL cleanup to time out in full screen renders.
});
