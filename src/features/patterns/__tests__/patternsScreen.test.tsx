import { render, screen, waitFor } from '@testing-library/react-native';
import Patterns from '@/src/app/(tabs)/patterns';
import { useCalibrationStore, type PatternsData } from '@/src/stores/calibrationStore';

// Mock expo-router: useFocusEffect runs the callback once (mirrors an immediate
// focus) so usePatterns' on-focus refresh path is exercised without navigation.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => cb(),
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
    expect(screen.queryByText('YOUR HONEST MAP')).toBeNull();
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
      // Archetype qualifies (2 categories, ≥12 logs) and the honest map lists rows.
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });
    expect(screen.getByText('YOUR HONEST MAP')).toBeOnTheScreen();
    expect(screen.getByText('WHAT TO EXPECT')).toBeOnTheScreen();
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
      expect(screen.getByText('YOUR HONEST MAP')).toBeOnTheScreen();
    });
    // Dial exposes its filled-step count via the progressbar label (honest = 3 of 3).
    expect(screen.getByLabelText('Admin & email readiness: honest, 3 of 3')).toBeOnTheScreen();
    // Warm, no-guilt framing line (single honest area).
    expect(screen.getByText('One area reads honest now. The rest are catching up.')).toBeOnTheScreen();
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
      expect(screen.getByText('YOUR HONEST MAP')).toBeOnTheScreen();
    });
    // raw → only the first pip lit (1 of 3).
    expect(screen.getByLabelText('admin readiness: raw, 1 of 3')).toBeOnTheScreen();
    expect(
      screen.getByText('Your areas are still settling. A few more logs and the numbers sharpen.'),
    ).toBeOnTheScreen();
  });
});
