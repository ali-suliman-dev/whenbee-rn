import { renderHook, waitFor } from '@testing-library/react-native';
import { useWhenbeeHub } from '../useWhenbeeHub';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { createMemoryDatabase } from '@/src/db';
import { priorFor } from '@/src/engine';
import type { AdaptSpeed } from '@/src/domain/types';

const T0 = 1_700_000_000_000;

function trackCategories(ids: string[]): void {
  useCategoriesStore.setState({
    categories: ids.map((id) => ({ id, name: id, adaptSpeed: 'balanced' as AdaptSpeed })),
  });
}

beforeEach(() => {
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(createMemoryDatabase());
  useCategoriesStore.setState({ categories: [] });
});

describe('useWhenbeeHub', () => {
  it('returns the empty state when nothing is tracked', async () => {
    const { result } = renderHook(() => useWhenbeeHub());

    await waitFor(() => {
      expect(result.current.honestLogCount).toBe(0);
    });

    expect(result.current.blindSpot).toBeNull();
    expect(result.current.cells).toEqual([]);
    expect(result.current.tier).toBe('Raw');
  });

  it('composes honest-log count, blind spot, and cells', async () => {
    const db = createMemoryDatabase();
    useCalibrationStore.getState().setDatabase(db);
    trackCategories(['cleaning', 'admin', 'errands']);

    // cleaning: most reclaim (50), high sharpness → lead tier comes from here.
    await db.upsertCategoryStat({
      categoryId: 'cleaning',
      n: 6,
      logEwma: 0.4,
      mEffective: 1.6,
      sharpness: 70,
      priorMult: priorFor('cleaning'),
      adaptSpeed: 'balanced',
      updatedAt: T0,
      reclaimedMinutes: 50,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });
    // admin: less reclaim (20), LOWEST sharpness with logs → blind spot.
    await db.upsertCategoryStat({
      categoryId: 'admin',
      n: 2,
      logEwma: 0.2,
      mEffective: 1.3,
      sharpness: 15,
      priorMult: priorFor('admin'),
      adaptSpeed: 'balanced',
      updatedAt: T0,
      reclaimedMinutes: 20,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });
    // errands: lower sharpness than admin BUT n=0 → does not qualify as blind spot.
    await db.upsertCategoryStat({
      categoryId: 'errands',
      n: 0,
      logEwma: 0,
      mEffective: priorFor('errands'),
      sharpness: 5,
      priorMult: priorFor('errands'),
      adaptSpeed: 'balanced',
      updatedAt: T0,
      reclaimedMinutes: 0,
    sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
    });
    await db.addReclaim(70);

    // Cells are derived from the calibration cache (warm it like the app boot does).
    useCalibrationStore.setState({
      statsByCategory: {
        cleaning: { mEffective: 1.6, n: 6, sharpness: 70, tier: 'Ripening' },
        admin: { mEffective: 1.3, n: 2, sharpness: 15, tier: 'Setting' },
        errands: { mEffective: priorFor('errands'), n: 0, sharpness: 5, tier: 'Raw' },
      },
    });

    const { result } = renderHook(() => useWhenbeeHub());

    await waitFor(() => {
      expect(result.current.honestLogCount).toBe(8);
    });

    // blind spot = lowest sharpness WITH n>=1 → admin (15), not errands (5, n=0).
    expect(result.current.blindSpot?.categoryId).toBe('admin');
    expect(result.current.blindSpot?.sharpness).toBe(15);

    // lead tier = tierFor of the max sharpness (70) → 'Ripening'.
    expect(result.current.tier).toBe('Ripening');

    // cells: one per tracked category, ready for <Honeycomb size="hub" />.
    expect(result.current.cells.map((c) => c.categoryId)).toEqual([
      'cleaning',
      'admin',
      'errands',
    ]);
    expect(result.current.cells[0]).toMatchObject({
      categoryId: 'cleaning',
      sharpness: 70,
      tier: 'Ripening',
    });
  });

  it('blind spot is null when no tracked category has a log', async () => {
    const db = createMemoryDatabase();
    useCalibrationStore.getState().setDatabase(db);
    trackCategories(['cleaning']);
    // cold stat: n=0.
    useCalibrationStore.setState({
      statsByCategory: { cleaning: { mEffective: 2.0, n: 0, sharpness: 0, tier: 'Raw' } },
    });

    const { result } = renderHook(() => useWhenbeeHub());

    await waitFor(() => {
      expect(result.current.cells).toHaveLength(1);
    });
    expect(result.current.blindSpot).toBeNull();
  });
});
