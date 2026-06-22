import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CategoryDetailScreen from '@/src/app/category/[category]';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { createMemoryDatabase, type Database, type TaskEventRow } from '@/src/db';
import { kv } from '@/src/lib/kv';

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
    startLocalMinute: null,
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
  sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
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
  kv.delete('calibration.graduatedCategories');
  useCalibrationStore.setState({ graduatedCategories: new Set() });
  useCategoriesStore.setState({
    categories: [{ id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' }],
    setAdaptSpeed,
  });
});

describe('CategoryDetailScreen', () => {
  it('renders the honest band while still learning (high-variance data → setting)', async () => {
    await seed({ withInsight: true });
    render(<CategoryDetailScreen />);

    // n=8 but the spread of clamped ratios (CV ≈ 0.38 > 0.35) keeps confidence at
    // 'setting', so the hero shows the range band + tier meaning, not the tight ~30.
    expect(await screen.findByText('YOUR HONEST RANGE')).toBeOnTheScreen();
    expect(screen.getByText('still sharpening your pace')).toBeOnTheScreen();
    expect(screen.queryByText('~30')).toBeNull();
  });

  it('renders the tight honest number once the category graduates', async () => {
    // Settled data: 8 identical runs → CV 0, n ≥ 6 → honest confidence.
    const db = createMemoryDatabase();
    await db.upsertCategoryStat({
      categoryId: 'cleaning',
      n: 8,
      logEwma: 0.6,
      mEffective: 2.0,
      sharpness: 90,
      priorMult: 2.0,
      adaptSpeed: 'balanced',
      updatedAt: T0,
      reclaimedMinutes: 0,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });
    for (let i = 0; i < 8; i++) {
      await db.insertTaskEvent(event({ id: `s${i}`, estimateMin: 15, actualMin: 30, createdAt: T0 + i }));
    }
    useCalibrationStore.setState({ logs: 0, statsByCategory: {}, graduatedCategories: new Set() });
    useCalibrationStore.getState().setDatabase(db);

    render(<CategoryDetailScreen />);

    // round_to_5(15 × 2.0) = 30 → "~30", with the runs multiplier line.
    expect(await screen.findByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('runs 2.0×')).toBeOnTheScreen();
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
