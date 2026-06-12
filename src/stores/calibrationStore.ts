import { create } from 'zustand';
import {
  getDatabase,
  makeCategoryStatsRepo,
  makeTaskEventsRepo,
  makeRecurringRepo,
  type Database,
} from '@/src/db';
import { applyLog as engineApplyLog, clampRatio, tierFor } from '@/src/engine';
import type { AdaptSpeed, LogSource, LogStatus, Tier } from '@/src/domain/types';
import { haptics } from '@/src/services/haptics';
import { analytics } from '@/src/services/analytics';
import { useCategoriesStore } from './categoriesStore';

interface CachedStat {
  mEffective: number;
  n: number;
  sharpness: number;
  tier: Tier;
}

export interface ApplyLogParams {
  category: string;
  estimateMin: number;
  actualMin: number;
  status: LogStatus;
  source: LogSource;
  adaptSpeed: AdaptSpeed;
  recurringKey?: string | null;
  label?: string | null;
  nowMs?: number;
}

export interface LogResult {
  counted: boolean;
  multiplier: number;
  sharpness: number;
  tierBefore: Tier;
  tierAfter: Tier;
  leveledUp: boolean;
}

interface CalibrationState {
  logs: number;
  statsByCategory: Record<string, CachedStat>;
  db: Database | null;
  setDatabase: (db: Database) => void;
  hydrate: () => Promise<void>;
  applyLog: (input: ApplyLogParams) => Promise<LogResult>;
}

async function resolveDb(get: () => CalibrationState, set: (p: Partial<CalibrationState>) => void) {
  const existing = get().db;
  if (existing) return existing;
  const db = await getDatabase();
  set({ db });
  return db;
}

/** Generate a collision-resistant id without pulling in a uuid dependency. */
function makeId(createdAt: number): string {
  return `${createdAt}-${Math.random().toString(36).slice(2)}`;
}

export const useCalibrationStore = create<CalibrationState>((set, get) => ({
  logs: 0,
  statsByCategory: {},
  db: null,

  setDatabase: (db) => set({ db }),

  hydrate: async () => {
    const db = await resolveDb(get, set);
    const statsRepo = makeCategoryStatsRepo(db);
    const tracked = useCategoriesStore.getState().categories;
    const next: Record<string, CachedStat> = {};
    for (const cat of tracked) {
      const row = await statsRepo.get(cat.id);
      next[cat.id] = {
        mEffective: row.mEffective,
        n: row.n,
        sharpness: row.sharpness,
        tier: tierFor(row.sharpness),
      };
    }
    set({ statsByCategory: next });
  },

  applyLog: async (input) => {
    const db = await resolveDb(get, set);
    const categoryStatsRepo = makeCategoryStatsRepo(db);
    const taskEventsRepo = makeTaskEventsRepo(db);
    const recurringRepo = makeRecurringRepo(db);

    const nowMs = input.nowMs ?? Date.now();
    const recurringKey = input.recurringKey ?? null;

    // 2. Seeded category stats (never null).
    const prev = await categoryStatsRepo.get(input.category);

    // 3. Recent clamped ratios, oldest → newest (events come newest-first).
    const recentEvents = await taskEventsRepo.listByCategory(input.category, 8);
    const recentClampedRatios = recentEvents
      .filter((e) => e.status === 'completed' && e.actualMin !== null)
      .map((e) => clampRatio(e.estimateMin, e.actualMin as number))
      .reverse();

    // 4. Recurring rolling stat, if any. Seed a cold n=0 row (mEffective = the
    //    category prior) the first time a key is seen so the engine can train it.
    let recurring: { n: number; logEwma: number; mEffective: number } | null = null;
    if (recurringKey) {
      const recurringRow = await recurringRepo.get(recurringKey);
      recurring = recurringRow
        ? { n: recurringRow.n, logEwma: recurringRow.logEwma, mEffective: recurringRow.mEffective }
        : { n: 0, logEwma: 0, mEffective: prev.priorMult };
    }

    // 5. Pure engine step.
    const result = engineApplyLog({
      estimateMin: input.estimateMin,
      actualMin: input.actualMin,
      status: input.status,
      source: input.source,
      adaptSpeed: input.adaptSpeed,
      prior: prev.priorMult,
      category: {
        n: prev.n,
        logEwma: prev.logEwma,
        mEffective: prev.mEffective,
        sharpness: prev.sharpness,
      },
      recurring,
      recentClampedRatios,
    });

    // 6. Persist the raw event (always — abandoned logs are self-awareness data).
    const createdAt = nowMs;
    await taskEventsRepo.insert({
      id: makeId(createdAt),
      category: input.category,
      label: input.label ?? null,
      estimateMin: input.estimateMin,
      actualMin: input.actualMin,
      status: input.status,
      source: input.source,
      startedAt: null,
      endedAt: nowMs,
      createdAt,
    });

    // 7. Persist updated stats only when the log trained the model.
    if (result.counted) {
      await categoryStatsRepo.upsert({
        categoryId: input.category,
        n: result.category.n,
        logEwma: result.category.logEwma,
        mEffective: result.category.mEffective,
        sharpness: result.category.sharpness,
        priorMult: prev.priorMult,
        adaptSpeed: input.adaptSpeed,
        updatedAt: nowMs,
      });
      if (recurringKey && result.recurring) {
        await recurringRepo.upsert({
          key: recurringKey,
          categoryId: input.category,
          n: result.recurring.n,
          logEwma: result.recurring.logEwma,
          mEffective: result.recurring.mEffective,
          updatedAt: nowMs,
        });
      }
    }

    // 8. Patch the cache (O(1)). Count every stored log; only refresh stats when counted.
    set((state) => {
      const logs = state.logs + 1;
      if (!result.counted) return { logs };
      return {
        logs,
        statsByCategory: {
          ...state.statsByCategory,
          [input.category]: {
            mEffective: result.category.mEffective,
            n: result.category.n,
            sharpness: result.category.sharpness,
            tier: tierFor(result.category.sharpness),
          },
        },
      };
    });

    const tierBefore = tierFor(prev.sharpness);
    const tierAfter = tierFor(result.category.sharpness);
    const leveledUp = result.counted && tierAfter !== tierBefore;

    // 9. Side-effects — fire-and-forget; never block or throw into the caller.
    try {
      if (result.counted) haptics.success();
      analytics.capture('task_logged', {
        category: input.category,
        status: input.status,
        source: input.source,
        counted: result.counted,
      });
      if (leveledUp) analytics.capture('cell_capped', { tier: tierAfter });
    } catch {
      // services are safe; this is belt-and-suspenders
    }

    // 10. Result for the UI.
    return {
      counted: result.counted,
      multiplier: result.category.mEffective,
      sharpness: result.category.sharpness,
      tierBefore,
      tierAfter,
      leveledUp,
    };
  },
}));
