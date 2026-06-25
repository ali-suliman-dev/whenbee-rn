import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import Patterns from '@/src/app/(tabs)/patterns';
import { useCalibrationStore, type PatternsData } from '@/src/stores/calibrationStore';

// FocusPatternsCard (now mounted on this screen) calls useLearnedFocusWindow,
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
  }),
}));

// FocusCurve renders SVG which is fine in tests, but stub FocusWindowEditorSheet
// (uses Modal + FinishTimeWheel with native scroll) to keep the screen test lean.
jest.mock('@/src/features/planner/FocusWindowEditorSheet', () => ({
  FocusWindowEditorSheet: () => null,
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
    fireEvent.press(screen.getByRole('button', { name: 'Insights' }));
    expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
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
    fireEvent.press(screen.getByRole('button', { name: 'Insights' }));
    await waitFor(() => {
      expect(screen.getByText('Nothing new right now.')).toBeOnTheScreen();
    });
  });

  it('correlations tab hides numbers content', async () => {
    render(<Patterns />);
    await waitFor(() => {
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByRole('button', { name: 'Correlations' }));
    // Numbers-only content must not be visible on correlations tab
    expect(screen.queryByText('Your progress')).toBeNull();
    // Segment control itself must still be present
    expect(screen.getByRole('button', { name: 'Correlations' })).toBeOnTheScreen();
  });

  it('insights tab shows dismissable feed area after switch', async () => {
    render(<Patterns />);
    await waitFor(() => {
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByRole('button', { name: 'Insights' }));
    // Hero still pinned, and the insights empty state renders
    expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.getByText('Nothing new right now.')).toBeOnTheScreen();
    });
  });
});
