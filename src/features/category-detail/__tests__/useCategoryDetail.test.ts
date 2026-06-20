import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useCategoryDetail } from '@/src/features/category-detail/useCategoryDetail';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { createMemoryDatabase, type Database, type TaskEventRow } from '@/src/db';
import { kv } from '@/src/lib/kv';

// Real useFocusEffect runs the (memoized) callback on focus, not on every render.
// Model that with a useEffect keyed on the callback so a state-driven re-render
// doesn't re-fire it (a raw `cb()` would loop forever once refresh sets state).
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void) => {
      useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

const T0 = 1_700_000_000_000;
const GRADUATED_KEY = 'calibration.graduatedCategories';

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

/** Seed a category whose completed logs are settled enough to read 'honest'
 *  (n ≥ 6, identical ratios → CV 0). */
async function seedHonest(): Promise<Database> {
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
  // 8 identical est/actual rows → identical clamped ratios → CV 0 → honest.
  for (let i = 0; i < 8; i++) {
    await db.insertTaskEvent(event({ id: `c${i}`, estimateMin: 15, actualMin: 30, createdAt: T0 + i }));
  }
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

/** Seed a still-learning category (n below the honest floor → 'raw'/'setting'). */
async function seedLearning(): Promise<Database> {
  const db = createMemoryDatabase();
  await db.upsertCategoryStat({
    categoryId: 'cleaning',
    n: 1,
    logEwma: 0.6,
    mEffective: 2.0,
    sharpness: 20,
    priorMult: 2.0,
    adaptSpeed: 'balanced',
    updatedAt: T0,
    reclaimedMinutes: 0,
  sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0,
  });
  await db.insertTaskEvent(event({ id: 'c0', estimateMin: 15, actualMin: 30, createdAt: T0 }));
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

beforeEach(() => {
  // Clear the kv graduation ledger + the in-memory mirror before each test.
  kv.delete(GRADUATED_KEY);
  useCalibrationStore.setState({ graduatedCategories: new Set() });
  useCategoriesStore.setState({
    categories: [{ id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' }],
  });
});

describe('useCategoryDetail — graduation', () => {
  it('justGraduated is true the first time a category turns honest', async () => {
    await seedHonest();
    const { result } = renderHook(() => useCategoryDetail('cleaning'));

    await waitFor(() => expect(result.current.detail?.confidence).toBe('honest'));
    expect(result.current.justGraduated).toBe(true);
    // The ledger should now hold the category (fired exactly once).
    expect(useCalibrationStore.getState().isGraduated('cleaning')).toBe(true);
  });

  it('justGraduated is false on a subsequent refresh of an already-honest category', async () => {
    await seedHonest();
    const first = renderHook(() => useCategoryDetail('cleaning'));
    await waitFor(() => expect(first.result.current.justGraduated).toBe(true));
    first.unmount();

    // Re-mount the hook against the same (already-graduated) category.
    const second = renderHook(() => useCategoryDetail('cleaning'));
    await waitFor(() => expect(second.result.current.detail?.confidence).toBe('honest'));
    expect(second.result.current.justGraduated).toBe(false);
  });

  it('justGraduated stays false while a category is still learning', async () => {
    await seedLearning();
    const { result } = renderHook(() => useCategoryDetail('cleaning'));

    await waitFor(() => expect(result.current.detail).not.toBeNull());
    expect(result.current.detail?.confidence).not.toBe('honest');
    expect(result.current.justGraduated).toBe(false);
    expect(useCalibrationStore.getState().isGraduated('cleaning')).toBe(false);
  });

  it('clears justGraduated when the screen calls clearJustGraduated', async () => {
    await seedHonest();
    const { result } = renderHook(() => useCategoryDetail('cleaning'));
    await waitFor(() => expect(result.current.justGraduated).toBe(true));

    act(() => result.current.clearJustGraduated());
    await waitFor(() => expect(result.current.justGraduated).toBe(false));
  });
});
