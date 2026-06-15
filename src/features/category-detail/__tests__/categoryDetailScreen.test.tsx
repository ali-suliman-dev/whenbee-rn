import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CategoryDetailScreen from '@/src/app/category/[category]';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { createMemoryDatabase, type Database, type TaskEventRow } from '@/src/db';

const setAdaptSpeed = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ category: 'cleaning' }),
  useFocusEffect: (cb: () => void) => cb(),
}));

const T0 = 1_700_000_000_000;

function event(over: Partial<TaskEventRow>): TaskEventRow {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    category: 'cleaning',
    label: null,
    estimateMin: 15,
    actualMin: 30,
    status: 'completed',
    source: 'timed',
    startedAt: null,
    endedAt: null,
    createdAt: T0,
    suggestedHonestMin: null,
    reclaimDividendMin: 0,
    ...over,
  };
}

async function seed(opts: { withInsight: boolean }): Promise<Database> {
  const db = createMemoryDatabase();
  await db.upsertCategoryStat({
    categoryId: 'cleaning',
    n: opts.withInsight ? 8 : 0,
    logEwma: 0.6,
    mEffective: opts.withInsight ? 1.9 : 2.0,
    sharpness: 70,
    priorMult: 2.0,
    adaptSpeed: 'balanced',
    updatedAt: T0,
    reclaimedMinutes: 0,
  });
  if (opts.withInsight) {
    const actuals = [60, 15, 90, 12, 30, 30, 30, 30];
    for (let i = 0; i < actuals.length; i++) {
      await db.insertTaskEvent(event({ id: `c${i}`, actualMin: actuals[i], createdAt: T0 + i }));
    }
  }
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

beforeEach(() => {
  setAdaptSpeed.mockClear();
  useCategoriesStore.setState({
    categories: [{ id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' }],
    setAdaptSpeed,
  });
});

describe('CategoryDetailScreen', () => {
  it('renders the honest number and provenance', async () => {
    await seed({ withInsight: true });
    render(<CategoryDetailScreen />);

    // round_to_5(15 × 1.9) = 30 → "~30"
    expect(await screen.findByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('runs 1.9×')).toBeOnTheScreen();
  });

  it('shows the AhaCard only when an insight is present', async () => {
    await seed({ withInsight: true });
    render(<CategoryDetailScreen />);
    expect(await screen.findByText('aha')).toBeOnTheScreen();
  });

  it('hides the AhaCard when no insight qualifies', async () => {
    await seed({ withInsight: false });
    render(<CategoryDetailScreen />);
    // wait for content to load (the honest number for the prior 2.0 → ~30)
    await screen.findByText('Tune how I learn');
    expect(screen.queryByText('aha')).toBeNull();
  });

  it('tapping a learning mode calls setAdaptSpeed', async () => {
    await seed({ withInsight: true });
    render(<CategoryDetailScreen />);

    const reactive = await screen.findByLabelText('Reactive learning mode');
    fireEvent.press(reactive);

    await waitFor(() => expect(setAdaptSpeed).toHaveBeenCalledWith('cleaning', 'reactive'));
  });
});
