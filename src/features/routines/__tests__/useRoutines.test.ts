import { renderHook, act } from '@testing-library/react-native';
import { useRoutines } from '../useRoutines';
import { useRoutinesStore } from '@/src/stores/routinesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { createMemoryDatabase } from '@/src/db';

function resetStores() {
  useRoutinesStore.setState({ db: null, routines: [], stepMByKey: {}, activeRun: null });
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useSettingsStore.getState().reset();
}

beforeEach(resetStores);

describe('useRoutines', () => {
  it('derives an honest total + prior basis for a fresh routine', async () => {
    const db = createMemoryDatabase();
    useRoutinesStore.getState().setDatabase(db);
    useRoutinesStore.getState().resetDraft();

    const s = useRoutinesStore.getState();
    s.setName('Morning');
    s.addStep({ label: 'a', category: 'getting-ready', guessMin: 20 });
    s.addStep({ label: 'b', category: 'meals', guessMin: 10 });
    s.addStep({ label: 'c', category: 'admin', guessMin: 15 });
    await act(async () => {
      await useRoutinesStore.getState().saveDraft();
    });

    // Category M = 1.0 for every step (no learned stats yet → prior fallback resolved
    // to 1.0 via the injected calibration cache below).
    useCalibrationStore.setState({
      statsByCategory: {
        'getting-ready': { mEffective: 1, n: 0, sharpness: 0, tier: 'Raw', fit: { a: 0, b: 1 } },
        meals: { mEffective: 1, n: 0, sharpness: 0, tier: 'Raw', fit: { a: 0, b: 1 } },
        admin: { mEffective: 1, n: 0, sharpness: 0, tier: 'Raw', fit: { a: 0, b: 1 } },
      } as never,
    });

    const { result } = renderHook(() => useRoutines({ nowMs: Date.UTC(2026, 5, 21, 8, 0) }));
    expect(result.current.summaries).toHaveLength(1);
    const summary = result.current.summaries[0]!;
    // sum honest (20+10+15=45) × prior factor 1.15 → round5(51.75) = 50.
    expect(summary.summary.honestTotalMin).toBe(50);
    expect(summary.summary.basis).toBe('prior');
    expect(summary.summary.label).toBe('based on typical patterns');
  });

  it('computes a start-by when a be-done-by anchor is set', async () => {
    const db = createMemoryDatabase();
    useRoutinesStore.getState().setDatabase(db);
    useRoutinesStore.getState().resetDraft();

    const s = useRoutinesStore.getState();
    s.setName('Leave');
    s.setDoneBy(9 * 60); // out the door by 09:00
    s.addStep({ label: 'a', category: 'admin', guessMin: 20 });
    await act(async () => {
      await useRoutinesStore.getState().saveDraft();
    });
    useCalibrationStore.setState({
      statsByCategory: {
        admin: { mEffective: 1, n: 0, sharpness: 0, tier: 'Raw', fit: { a: 0, b: 1 } },
      } as never,
    });

    // now = 06:00 local on the same day; deadline 09:00 is in the future.
    const now = new Date();
    now.setHours(6, 0, 0, 0);
    const { result } = renderHook(() => useRoutines({ nowMs: now.getTime() }));
    const summary = result.current.summaries[0]!;
    expect(summary.startByMs).not.toBeNull();
    // Start-by must fall before the 09:00 deadline.
    const deadline = new Date(now);
    deadline.setHours(9, 0, 0, 0);
    expect(summary.startByMs! < deadline.getTime()).toBe(true);
  });

  it('returns no start-by when there is no anchor', async () => {
    const db = createMemoryDatabase();
    useRoutinesStore.getState().setDatabase(db);
    useRoutinesStore.getState().resetDraft();
    const s = useRoutinesStore.getState();
    s.setName('No anchor');
    s.addStep({ label: 'a', category: 'admin', guessMin: 20 });
    await act(async () => {
      await useRoutinesStore.getState().saveDraft();
    });
    useCalibrationStore.setState({
      statsByCategory: { admin: { mEffective: 1, n: 0, sharpness: 0, tier: 'Raw', fit: { a: 0, b: 1 } } } as never,
    });
    const { result } = renderHook(() => useRoutines({ nowMs: Date.now() }));
    expect(result.current.summaries[0]!.startByMs).toBeNull();
  });

  it('falls back to the SEEDED prior (not the population prior) for a cold, unwarmed category', async () => {
    const db = createMemoryDatabase();
    useRoutinesStore.getState().setDatabase(db);
    useRoutinesStore.getState().resetDraft();

    const s = useRoutinesStore.getState();
    s.setName('Creative block');
    s.addStep({ label: 'Sketch', category: 'creative', guessMin: 20 });
    await act(async () => {
      await useRoutinesStore.getState().saveDraft();
    });
    // No calibrationStore entry for 'creative' → the hook must fall through to
    // seededPriorFor, not the raw priorFor.
    useCalibrationStore.setState({ statsByCategory: {} });

    const { result: unseeded } = renderHook(() => useRoutines({ nowMs: Date.UTC(2026, 5, 21, 8, 0) }));
    const unseededTotal = unseeded.current.summaries[0]!.summary.honestTotalMin;

    act(() => {
      useSettingsStore.getState().setArchetypeSeed({ m0: 3.0, source: 'quiz', tookAt: 1 });
    });
    const { result: seeded } = renderHook(() => useRoutines({ nowMs: Date.UTC(2026, 5, 21, 8, 0) }));
    const seededTotal = seeded.current.summaries[0]!.summary.honestTotalMin;

    expect(seededTotal).not.toBe(unseededTotal);
  });
});
