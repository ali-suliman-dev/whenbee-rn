import { useCalibrationStore } from '../calibrationStore';
import { useCategoriesStore } from '../categoriesStore';
import {
  createMemoryDatabase,
  makeTaskEventsRepo,
  makeCategoryStatsRepo,
  type Database,
  type TaskEventRow,
} from '@/src/db';
import { kv } from '@/src/lib/kv';

const GRADUATED_KEY = 'calibration.graduatedCategories';

/** Fresh memory db + reset store cache, wired through the store's own injection
 *  (`setDatabase` / `resolveDb`). Returns the db for direct repo assertions. */
function freshStore(): Database {
  const db = createMemoryDatabase();
  useCalibrationStore.setState({ logs: 0, statsByCategory: {}, graduatedCategories: new Set() });
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

const T0 = 1_000_000_000_000;

function seedEvent(over: Partial<TaskEventRow>): TaskEventRow {
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

/** Persist N completed logs for a category with the given clamped-ratio spread,
 *  plus a stat row carrying the matching n, so loadCategoryDetail reads real data. */
async function seedCompletedLogs(
  db: Database,
  categoryId: string,
  ratios: number[],
  baseEstimate = 20,
): Promise<void> {
  const eventsRepo = makeTaskEventsRepo(db);
  const statsRepo = makeCategoryStatsRepo(db);
  let createdAt = T0;
  for (const ratio of ratios) {
    await eventsRepo.insert(
      seedEvent({
        category: categoryId,
        estimateMin: baseEstimate,
        actualMin: Math.round(baseEstimate * ratio),
        createdAt: (createdAt += 1000),
      }),
    );
  }
  const existing = await statsRepo.get(categoryId);
  await statsRepo.upsert({
    categoryId,
    n: ratios.length,
    logEwma: existing.logEwma,
    mEffective: existing.mEffective,
    sharpness: existing.sharpness,
    priorMult: existing.priorMult,
    adaptSpeed: existing.adaptSpeed,
    updatedAt: T0,
    reclaimedMinutes: existing.reclaimedMinutes,
  });
}

describe('calibrationStore — confidence + honest range on CategoryDetail', () => {
  beforeEach(() => {
    kv.delete(GRADUATED_KEY);
  });

  it('a cold category reads as raw confidence with no range', async () => {
    freshStore();
    const detail = await useCalibrationStore.getState().loadCategoryDetail('cleaning');
    expect(detail.confidence).toBe('raw');
    // raw → not graduated; range is suppressed for honest only, but raw also yields a band.
    expect(detail.summary.confidence).toBe('raw');
  });

  it('a noisy mid-sample category gets setting confidence and a honest range', async () => {
    const db = freshStore();
    // 4 logs (>= setting min 3, < honest min 6) → 'setting'.
    await seedCompletedLogs(db, 'cleaning', [1.2, 0.7, 1.6, 0.9]);
    const detail = await useCalibrationStore.getState().loadCategoryDetail('cleaning');

    expect(detail.confidence).toBe('setting');
    expect(detail.summary.confidence).toBe('setting');
    // not honest → a range is attached on the summary.
    expect(detail.summary.range).not.toBeNull();
    expect(detail.summary.range?.lowMinutes).toBeLessThan(detail.summary.range?.highMinutes ?? 0);
  });

  it('a large, tightly-clustered category reaches honest with no range', async () => {
    const db = freshStore();
    // 8 logs, very low spread (cv well under 0.35) → 'honest'.
    await seedCompletedLogs(db, 'cleaning', [1.0, 1.02, 0.98, 1.01, 0.99, 1.0, 1.02, 0.98]);
    const detail = await useCalibrationStore.getState().loadCategoryDetail('cleaning');

    expect(detail.confidence).toBe('honest');
    expect(detail.summary.confidence).toBe('honest');
    expect(detail.summary.range).toBeNull();
  });
});

describe('calibrationStore — firstHonestRange capture (narrowing anchor)', () => {
  beforeEach(() => {
    kv.delete(GRADUATED_KEY);
  });

  async function logOnce(db: Database, categoryId: string, estimateMin: number, actualMin: number) {
    await useCalibrationStore.getState().applyLog({
      category: categoryId,
      estimateMin,
      actualMin,
      status: 'completed',
      source: 'timed',
      adaptSpeed: 'balanced',
    });
  }

  it('stays null while still raw (below the setting floor)', async () => {
    const db = freshStore();
    const statsRepo = makeCategoryStatsRepo(db);
    await logOnce(db, 'cleaning', 20, 30); // n=1 → still raw
    const stat = await statsRepo.get('cleaning');
    expect(stat.firstHonestRange).toBeNull();
  });

  it('captures the band the first time confidence reaches setting, then freezes it', async () => {
    const db = freshStore();
    const statsRepo = makeCategoryStatsRepo(db);
    // Three logs → n=3 = setting floor; the third log should capture the anchor.
    await logOnce(db, 'cleaning', 20, 30);
    await logOnce(db, 'cleaning', 20, 28);
    await logOnce(db, 'cleaning', 20, 34);

    const captured = (await statsRepo.get('cleaning')).firstHonestRange;
    expect(captured).not.toBeNull();
    expect(captured?.lowMinutes).toBeLessThan(captured?.highMinutes ?? 0);

    // A later log must NOT overwrite the frozen anchor.
    await logOnce(db, 'cleaning', 20, 20);
    const after = (await statsRepo.get('cleaning')).firstHonestRange;
    expect(after).toEqual(captured);
  });
});

describe('calibrationStore — graduatedCategories tracking', () => {
  beforeEach(() => {
    kv.delete(GRADUATED_KEY);
  });

  it('markGraduated persists through kv and survives a re-read', async () => {
    freshStore();
    expect(useCalibrationStore.getState().isGraduated('cleaning')).toBe(false);

    useCalibrationStore.getState().markGraduated('cleaning');

    expect(useCalibrationStore.getState().isGraduated('cleaning')).toBe(true);
    // Persisted as a JSON array under the stable kv key.
    expect(JSON.parse(kv.getString(GRADUATED_KEY) ?? '[]')).toEqual(['cleaning']);
  });

  it('markGraduated is idempotent — marking twice never duplicates or loses entries', async () => {
    freshStore();
    useCalibrationStore.getState().markGraduated('cleaning');
    useCalibrationStore.getState().markGraduated('cleaning');

    const persisted = JSON.parse(kv.getString(GRADUATED_KEY) ?? '[]') as string[];
    expect(persisted).toEqual(['cleaning']);
    expect(useCalibrationStore.getState().graduatedCategories.size).toBe(1);
  });

  it('marking a second category keeps the first', async () => {
    freshStore();
    useCalibrationStore.getState().markGraduated('cleaning');
    useCalibrationStore.getState().markGraduated('cooking');

    expect(useCalibrationStore.getState().isGraduated('cleaning')).toBe(true);
    expect(useCalibrationStore.getState().isGraduated('cooking')).toBe(true);
    const persisted = JSON.parse(kv.getString(GRADUATED_KEY) ?? '[]') as string[];
    expect(persisted.sort()).toEqual(['cleaning', 'cooking']);
  });

  it('hydrate loads previously persisted graduated categories from kv', async () => {
    kv.set(GRADUATED_KEY, JSON.stringify(['cleaning']));
    freshStore();
    // freshStore resets the set; hydrate should repopulate it from kv.
    useCategoriesStore.setState({
      categories: [{ id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' }],
    });
    await useCalibrationStore.getState().hydrate();
    expect(useCalibrationStore.getState().isGraduated('cleaning')).toBe(true);
  });
});
