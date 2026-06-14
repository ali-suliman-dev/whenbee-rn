import { render, screen, waitFor } from '@testing-library/react-native';
import Patterns from '@/src/app/(tabs)/patterns';
import { useCalibrationStore, type PatternsData } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// Screen test: seeded data → cards render; empty data → the calm empty state (no
// card, no scold).
// ──────────────────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function setPatternsData(data: PatternsData) {
  useCalibrationStore.setState({ loadPatternsData: async () => data });
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
});
