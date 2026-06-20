import { useCalibrationStore } from '../calibrationStore';
import { createMemoryDatabase, type Database } from '@/src/db';
import { kv } from '@/src/lib/kv';

const PRO_PITCH_LATCH_KEY = 'whenbee.proPitchUnlocked';

/** Fresh memory db + reset store state, wired through the store's own injection. */
function freshStore(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {}, graduatedCategories: new Set() });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

describe('calibrationStore pro readiness', () => {
  beforeEach(() => {
    kv.delete(PRO_PITCH_LATCH_KEY);
  });

  it('latches pitchUnlocked once any category reaches setting confidence (n >= 3)', async () => {
    freshStore();
    const store = useCalibrationStore.getState();

    // 3 completed logs drives n=3 = CONFIDENCE_SETTING_MIN_LOGS → 'setting' confidence.
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });

    const r = store.getProReadiness();
    expect(r.pitchUnlocked).toBe(true);
  });

  it('pitchUnlocked is false below the setting threshold (n < 3)', async () => {
    freshStore();
    const store = useCalibrationStore.getState();

    // 2 logs → still 'raw' confidence → pitchUnlocked false.
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });

    const r = store.getProReadiness();
    expect(r.pitchUnlocked).toBe(false);
  });

  it('latch stays true even after the store cache is cleared (confidence would be raw again)', async () => {
    freshStore();
    const store = useCalibrationStore.getState();

    // Drive to 'setting' confidence to set the latch.
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });

    // Confirm latch was set.
    expect(store.getProReadiness().pitchUnlocked).toBe(true);

    // Wipe the in-memory cache so statsByCategory is empty → confidence would be 'raw'.
    useCalibrationStore.setState({ statsByCategory: {} });

    // Latch must keep pitchUnlocked true (kv flag persists).
    expect(store.getProReadiness().pitchUnlocked).toBe(true);
    expect(kv.getString(PRO_PITCH_LATCH_KEY)).toBe('1');
  });
});

describe('calibrationStore pro readiness — reset clears the latch', () => {
  beforeEach(() => {
    kv.delete(PRO_PITCH_LATCH_KEY);
  });

  it('data reset relocks the pitch (kv latch cleared)', async () => {
    freshStore();
    const store = useCalibrationStore.getState();

    // Drive to 'setting' confidence → latch is set.
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });
    await store.applyLog({ category: 'focus', estimateMin: 20, actualMin: 22, status: 'completed', source: 'timed', adaptSpeed: 'balanced' });

    expect(store.getProReadiness().pitchUnlocked).toBe(true);

    // Full data reset must clear the kv latch.
    store.reset();

    // After reset, statsByCategory is empty and the kv flag is gone → false.
    expect(store.getProReadiness().pitchUnlocked).toBe(false);
    expect(kv.getString(PRO_PITCH_LATCH_KEY)).toBeNull();
  });
});
