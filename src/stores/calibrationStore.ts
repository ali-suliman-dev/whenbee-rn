import { create } from 'zustand';
import {
  getDatabase,
  makeCategoryStatsRepo,
  makeTaskEventsRepo,
  makeRecurringRepo,
  makeCompanionRepo,
  makeContextTagRepo,
  type Database,
} from '@/src/db';
import {
  applyLog as engineApplyLog,
  clampRatio,
  tierFor,
  alphaFor,
  logsToNextTier,
  priorFor,
  resolveSuggestion,
  detectInsight,
  buildTrendSeries,
  keeperReached,
  driftHealthFromRecent,
  TIERS,
  CATEGORY_NAMES,
} from '@/src/engine';
import type {
  AdaptSpeed,
  LogSource,
  LogStatus,
  Tier,
  CalibrationSummary,
  Insight,
  TrendSeries,
} from '@/src/domain/types';
import { haptics } from '@/src/services/haptics';
import { analytics } from '@/src/services/analytics';
import { kv } from '@/src/lib/kv';
import { secondsSinceInstall } from '@/src/lib/install';
import { useCategoriesStore } from './categoriesStore';

// kv flags that gate fire-once funnel events (first counted log; first aha per
// category). Reading/writing kv is synchronous and Expo Go-safe.
const FIRST_LOG_FLAG = 'whenbee.firstLogFired';
const AHA_FLAG_PREFIX = 'whenbee.ahaFired.';

/** True the first time it's called process-/install-wide; sets the flag and
 *  returns false thereafter, so `first_log` fires exactly once ever. */
function claimFirstLog(): boolean {
  if (kv.getString(FIRST_LOG_FLAG) !== null) return false;
  kv.set(FIRST_LOG_FLAG, '1');
  return true;
}

/** True the first time an aha surfaces for `categoryId`; latches per category so
 *  `aha_shown` fires once at the moment the insight first qualifies. */
function claimAha(categoryId: string): boolean {
  const key = `${AHA_FLAG_PREFIX}${categoryId}`;
  if (kv.getString(key) !== null) return false;
  kv.set(key, '1');
  return true;
}

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
  suggestedHonestMin?: number | null;
}

export interface LogResult {
  /** The inserted task-event id (`makeId(createdAt)`) — lets the Reward screen tag
   *  a capture-only reason against this exact row without re-querying. */
  eventId: string;
  counted: boolean;
  multiplier: number;
  sharpness: number;
  tierBefore: Tier;
  tierAfter: Tier;
  leveledUp: boolean;
  reclaimDeltaMin: number;
  /** Lifetime reclaim total AFTER this log's deposit (unchanged when nothing banked). */
  reclaimLifetimeMin: number;
}

/** A recent est-vs-actual receipt row for the category-detail screen (newest first). */
export interface RecentLog {
  estimateMin: number;
  actualMin: number;
  ratio: number;
  createdAt: number;
}

/** Everything the Category Detail / Tune screen needs, assembled in one read. */
export interface CategoryDetail {
  categoryName: string;
  n: number;
  mEffective: number;
  sharpness: number;
  tier: Tier;
  logsToNext: number;
  /** resolveSuggestion at a 15-min guess (the canonical "honest number" demo). */
  summary: CalibrationSummary;
  /** detectInsight over the category's completed logs; null when it doesn't qualify. */
  insight: Insight | null;
  /** buildTrendSeries replayed from the completed logs. */
  trend: TrendSeries;
  /** recent est-vs-actual rows, newest first. */
  recent: RecentLog[];
}

/** One completed/raw log row exposed to the Patterns surface (read-only). */
export interface PatternLog {
  category: string;
  estimateMin: number;
  actualMin: number | null;
  status: LogStatus;
  source: LogSource;
  createdAt: number;
}

/** One category's rolling stats exposed to the Patterns surface. */
export interface PatternCategoryStat {
  categoryId: string;
  n: number;
  mEffective: number;
  sharpness: number;
}

/**
 * The cross-category snapshot the Patterns tab derives from. Assembled in ONE
 * read so the db stays in the store layer (features never touch src/db). Carries a
 * `nameOf` resolver so derivations can label categories without importing priors.
 */
export interface PatternsData {
  categories: PatternCategoryStat[];
  logs: PatternLog[];
  nameOf: (categoryId: string) => string;
}

/** One tracked category's lifetime reclaim, for the hub's "biggest area" list. */
export interface ReclaimByCategory {
  categoryId: string;
  name: string;
  reclaimedMinutes: number;
}

/** Read-only snapshot of reclaim/companion state for the Whenbee hub. */
export interface ReclaimSummary {
  /** companion.reclaimedMinutesLifetime — the all-time banked total. */
  lifetimeMin: number;
  /** Per-category reclaim, sorted by minutes descending. */
  byCategory: ReclaimByCategory[];
  /** The category with the most reclaim, or null when every category is at 0. */
  biggestArea: ReclaimByCategory | null;
  /** Total trained (counted) logs across tracked categories — the provenance N. */
  honestLogCount: number;
}

/** Display name for a seed category; title-cases a custom slug otherwise. */
function detailCategoryName(id: string): string {
  const seed = CATEGORY_NAMES[id];
  if (seed) return seed;
  return id
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface CalibrationState {
  logs: number;
  statsByCategory: Record<string, CachedStat>;
  db: Database | null;
  setDatabase: (db: Database) => void;
  hydrate: () => Promise<void>;
  applyLog: (input: ApplyLogParams) => Promise<LogResult>;
  loadCategoryDetail: (categoryId: string) => Promise<CategoryDetail>;
  loadReclaimSummary: () => Promise<ReclaimSummary>;
  /** Cross-category snapshot for the read-only Patterns self-insight surface. */
  loadPatternsData: () => Promise<PatternsData>;
  /**
   * CAPTURE-ONLY. Attach a free-form context tag (a reason) to a logged event.
   * Pure side-channel analytics: it NEVER trains the model, touches the
   * multiplier/honey, or banks reclaim. Safe to call (or skip) after a log.
   */
  setReason: (eventId: string, value: string, source: string) => Promise<void>;
  /** Sum of reclaimDividendMin over today's (local-day) completed events. */
  loadTodayReclaimMin: (nowMs?: number) => Promise<number>;
  resetCategory: (categoryId: string) => Promise<void>;
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

/** Epoch-ms for local midnight of the day containing `nowMs` (device timezone). */
function startOfLocalDay(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** How far back the today-reclaim scan reads raw events. A day rarely exceeds
 *  a handful of logs; this comfortably covers any realistic single day. */
const TODAY_RECLAIM_SCAN_LIMIT = 200;

/** How many recent events the Patterns surface scans. Generous (the "this week"
 *  surprise + early/recent splits want history) but bounded so the read stays cheap. */
const PATTERNS_SCAN_LIMIT = 500;

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

    // Seed the companion's per-install presence seed exactly once. Date.now is
    // allowed here (store layer) — the engine stays clock-free. setSeed is a
    // no-op when a seed already exists, so this is safe on every hydrate.
    await makeCompanionRepo(db).ensureSeed(() => (Date.now() % 1_000_000) + 1);
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
        reclaimedMinutes: prev.reclaimedMinutes,
      },
      recurring,
      recentClampedRatios,
      suggestedHonestMin: input.suggestedHonestMin ?? null,
    });

    // 6. Persist the raw event (always — abandoned logs are self-awareness data).
    const createdAt = nowMs;
    const eventId = makeId(createdAt);
    await taskEventsRepo.insert({
      id: eventId,
      category: input.category,
      label: input.label ?? null,
      estimateMin: input.estimateMin,
      actualMin: input.actualMin,
      status: input.status,
      source: input.source,
      startedAt: null,
      endedAt: nowMs,
      createdAt,
      suggestedHonestMin: input.suggestedHonestMin ?? null,
      reclaimDividendMin: result.reclaimDeltaMin,
    });

    // 7. Persist updated stats only when the log trained the model.
    const companionRepo = makeCompanionRepo(db);
    // Lifetime total AFTER this log's deposit. For an uncounted/zero-deposit log
    // it's the unchanged current total — read once below and overwritten when we
    // actually bank, so the Reward count-up always lands on the live number.
    let reclaimLifetimeMin = (await companionRepo.get()).reclaimedMinutesLifetime;
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
        reclaimedMinutes: prev.reclaimedMinutes,
      });
      if (result.reclaimDeltaMin > 0) {
        await companionRepo.deposit(result.reclaimDeltaMin);
        await companionRepo.depositToCategory(input.category, result.reclaimDeltaMin);
        reclaimLifetimeMin = (await companionRepo.get()).reclaimedMinutesLifetime;
      }
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

      // --- Companion fuel: only a counted log feeds the three-layer growth model.
      // Layer 1 (lifetime nectar): +1 per counted log, monotonic by construction.
      await companionRepo.bumpNectar();

      // Layer 2 (max tier): monotonic — raiseTier keeps the running max, never
      // regresses. Index the post-update sharpness into the canonical tier ladder.
      const tierIdxAfter = TIERS.indexOf(tierFor(result.category.sharpness));
      if (tierIdxAfter >= 0) await companionRepo.raiseTier(tierIdxAfter);

      // Layer 3 (drift health, positive-only): score the recent clamped-ratio
      // window INCLUDING this log. 'curious' nudges a re-check; never a penalty.
      const driftRatios = [...recentClampedRatios, clampRatio(input.estimateMin, input.actualMin)];
      await companionRepo.setDrift(driftHealthFromRecent(driftRatios));

      // Keeper (set-once): every tracked category at the top 'Honest' tier. Use the
      // just-updated sharpness for the current category and stored sharpness for the
      // rest, so the milestone lands the moment the final cell caps.
      const tracked = useCategoriesStore.getState().categories;
      let cappedCellCount = 0;
      for (const cat of tracked) {
        const sharpness =
          cat.id === input.category
            ? result.category.sharpness
            : (await categoryStatsRepo.get(cat.id)).sharpness;
        if (tierFor(sharpness) === 'Honest') cappedCellCount += 1;
      }
      if (keeperReached({ cappedCellCount, trackedCount: tracked.length })) {
        await companionRepo.setKeeper();
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
      const ratio = clampRatio(input.estimateMin, input.actualMin);
      const entryType = input.source === 'timed' ? 'timed' : 'retro';
      analytics.capture('task_logged', {
        category: input.category,
        guess_min: input.estimateMin,
        actual_min: input.actualMin,
        ratio,
        entry_type: entryType,
        sharpness_after: result.category.sharpness,
        tier_after: tierAfter,
        // Kept for back-compat with existing dashboards/tests.
        status: input.status,
        source: input.source,
        counted: result.counted,
      });

      // first_log: the user's first counted log, ever (kv-gated). Timed against
      // the kv install stamp so it's a real activation-latency read.
      if (result.counted && claimFirstLog()) {
        analytics.capture('first_log', { time_since_install_sec: secondsSinceInstall(nowMs) });
      }

      // honey_ripened: every counted log moves sharpness; report the step.
      if (result.counted) {
        analytics.capture('honey_ripened', {
          sharpness_before: prev.sharpness,
          sharpness_after: result.category.sharpness,
          delta: result.category.sharpness - prev.sharpness,
        });
      }

      // tier_up: a tier index increase (monotonic — never goes backward).
      if (leveledUp) {
        analytics.capture('tier_up', { from_tier: tierBefore, to_tier: tierAfter });
        analytics.capture('cell_capped', { tier: tierAfter });
      }

      // aha_shown: fire once per category at the moment the discovery first
      // qualifies on the write path (the canonical surfacing point). Build the
      // ordered log-ratios from the pre-log window plus this counted log.
      if (result.counted) {
        const orderedLogRatios = [...recentClampedRatios, ratio].map((r) => Math.log(r));
        const insight = detectInsight({
          categoryId: input.category,
          n: result.category.n,
          mEffective: result.category.mEffective,
          orderedLogRatios,
        });
        if (insight && claimAha(input.category)) {
          analytics.capture('aha_shown', {
            category: input.category,
            multiplier: insight.multiplier,
            n: result.category.n,
          });
        }
      }

      if (result.reclaimDeltaMin >= 1) {
        analytics.capture('reclaim_deposit', {
          minutes: result.reclaimDeltaMin,
          category: input.category,
          source: input.source,
        });
      }
    } catch {
      // services are safe; this is belt-and-suspenders
    }

    // 10. Result for the UI.
    return {
      eventId,
      counted: result.counted,
      multiplier: result.category.mEffective,
      sharpness: result.category.sharpness,
      tierBefore,
      tierAfter,
      leveledUp,
      reclaimDeltaMin: result.reclaimDeltaMin,
      reclaimLifetimeMin,
    };
  },

  loadCategoryDetail: async (categoryId) => {
    const db = await resolveDb(get, set);
    const categoryStatsRepo = makeCategoryStatsRepo(db);
    const taskEventsRepo = makeTaskEventsRepo(db);

    // Prior-seeded stat (never null) + the recent window of raw events (newest first).
    const stat = await categoryStatsRepo.get(categoryId);
    const events = await taskEventsRepo.listByCategory(categoryId, 30);

    // Completed logs only, oldest → newest, for the engine replays.
    const completedOldestFirst = events
      .filter((e) => e.status === 'completed' && e.actualMin !== null)
      .slice()
      .reverse();

    const orderedLogRatios: number[] = [];
    const steps: { loggedAt: number; clampedRatio: number; alpha: number }[] = [];
    for (const e of completedOldestFirst) {
      const ratio = clampRatio(e.estimateMin, e.actualMin as number);
      orderedLogRatios.push(Math.log(ratio));
      steps.push({
        loggedAt: e.createdAt,
        clampedRatio: ratio,
        alpha: alphaFor(stat.adaptSpeed, e.source),
      });
    }

    const summary = resolveSuggestion({
      guessMinutes: 15,
      category: { mEffective: stat.mEffective, n: stat.n },
      recurring: null,
    });

    const insight = detectInsight({
      categoryId,
      n: stat.n,
      mEffective: stat.mEffective,
      orderedLogRatios,
    });

    const trend = buildTrendSeries({ steps, prior: stat.priorMult });

    // `recent` = the (newest-first) raw events with their clamped ratio attached.
    const recent: RecentLog[] = events
      .filter((e) => e.status === 'completed' && e.actualMin !== null)
      .map((e) => ({
        estimateMin: e.estimateMin,
        actualMin: e.actualMin as number,
        ratio: clampRatio(e.estimateMin, e.actualMin as number),
        createdAt: e.createdAt,
      }));

    return {
      categoryName: detailCategoryName(categoryId),
      n: stat.n,
      mEffective: stat.mEffective,
      sharpness: stat.sharpness,
      tier: tierFor(stat.sharpness),
      logsToNext: logsToNextTier(stat.sharpness),
      summary,
      insight,
      trend,
      recent,
    };
  },

  loadReclaimSummary: async () => {
    const db = await resolveDb(get, set);
    const companionRepo = makeCompanionRepo(db);
    const categoryStatsRepo = makeCategoryStatsRepo(db);

    const companion = await companionRepo.get();
    const tracked = useCategoriesStore.getState().categories;

    const stats = await Promise.all(
      tracked.map(async (cat) => {
        const stat = await categoryStatsRepo.get(cat.id);
        return { cat, stat };
      }),
    );

    // Sorted desc by reclaimed minutes; the most-reclaimed category is the lead.
    const byCategory: ReclaimByCategory[] = stats
      .map(({ cat, stat }) => ({
        categoryId: cat.id,
        name: detailCategoryName(cat.id),
        reclaimedMinutes: stat.reclaimedMinutes,
      }))
      .sort((a, b) => b.reclaimedMinutes - a.reclaimedMinutes);

    const top = byCategory[0];
    const biggestArea = top && top.reclaimedMinutes > 0 ? top : null;

    const honestLogCount = stats.reduce((sum, { stat }) => sum + stat.n, 0);

    return {
      lifetimeMin: companion.reclaimedMinutesLifetime,
      byCategory,
      biggestArea,
      honestLogCount,
    };
  },

  loadPatternsData: async () => {
    const db = await resolveDb(get, set);
    const categoryStatsRepo = makeCategoryStatsRepo(db);
    const taskEventsRepo = makeTaskEventsRepo(db);
    const tracked = useCategoriesStore.getState().categories;

    const categories: PatternCategoryStat[] = await Promise.all(
      tracked.map(async (cat) => {
        const stat = await categoryStatsRepo.get(cat.id);
        return {
          categoryId: cat.id,
          n: stat.n,
          mEffective: stat.mEffective,
          sharpness: stat.sharpness,
        };
      }),
    );

    // One recent window across every category — the Patterns derivations only need
    // est/actual/source/createdAt per log, never the full row.
    const rows = await taskEventsRepo.listRecent(PATTERNS_SCAN_LIMIT);
    const logs: PatternLog[] = rows.map((e) => ({
      category: e.category,
      estimateMin: e.estimateMin,
      actualMin: e.actualMin,
      status: e.status,
      source: e.source,
      createdAt: e.createdAt,
    }));

    return { categories, logs, nameOf: detailCategoryName };
  },

  setReason: async (eventId, value, source) => {
    const db = await resolveDb(get, set);
    // Capture-only side channel — writes a context tag and nothing else. No stat
    // read, no applyLog, no reclaim: the model never sees this.
    await makeContextTagRepo(db).setReason({
      eventId,
      key: 'reason',
      value,
      source,
      createdAt: Date.now(),
    });
  },

  loadTodayReclaimMin: async (nowMs) => {
    const db = await resolveDb(get, set);
    const taskEventsRepo = makeTaskEventsRepo(db);
    const dayStart = startOfLocalDay(nowMs ?? Date.now());

    const recent = await taskEventsRepo.listRecent(TODAY_RECLAIM_SCAN_LIMIT);
    return recent
      .filter((e) => e.status === 'completed' && e.createdAt >= dayStart)
      .reduce((sum, e) => sum + e.reclaimDividendMin, 0);
  },

  resetCategory: async (categoryId) => {
    const db = await resolveDb(get, set);
    const categoryStatsRepo = makeCategoryStatsRepo(db);
    const taskEventsRepo = makeTaskEventsRepo(db);

    const prior = priorFor(categoryId);
    // Preserve the user's chosen learning mode across a reset (Reset clears the
    // EWMA, not their tuning preference). Fall back to the persisted stat.
    const existing = await categoryStatsRepo.get(categoryId);
    const adaptSpeed: AdaptSpeed = existing.adaptSpeed;
    const now = Date.now();

    await taskEventsRepo.deleteByCategory(categoryId);
    await categoryStatsRepo.upsert({
      categoryId,
      n: 0,
      logEwma: 0,
      mEffective: prior,
      sharpness: 0,
      priorMult: prior,
      adaptSpeed,
      updatedAt: now,
      reclaimedMinutes: 0,
    });

    // Patch the cache so dependent screens reflect the fresh prior immediately.
    set((state) => ({
      statsByCategory: {
        ...state.statsByCategory,
        [categoryId]: { mEffective: prior, n: 0, sharpness: 0, tier: tierFor(0) },
      },
    }));
  },
}));
