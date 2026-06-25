import { create } from 'zustand';
import {
  getDatabase,
  makeCategoryStatsRepo,
  makeTaskEventsRepo,
  makeCompanionRepo,
  makeContextTagRepo,
  makeDiscoveriesRepo,
  type Database,
} from '@/src/db';
import {
  applyLog as engineApplyLog,
  clampRatio,
  tierFor,
  alphaFor,
  alphaRegFor,
  logsToNextTier,
  priorFor,
  resolveSuggestion,
  solveAffine,
  coldStartAnchor,
  emptyGlobalBias,
  updateGlobalBias,
  detectInsight,
  shouldBankDiscovery,
  buildTrendSeries,
  keeperReached,
  driftHealthFromRecent,
  companionStageFor,
  capabilityFor,
  confidenceFor,
  honestRangeFor,
  honestNumber,
  correlateReasons,
  correlateContext,
  proReadiness,
  reconcileGoal,
  errorBandToAccuracy,
  accuracyToErrorBand,
  SHARPNESS_WINDOW,
  TIERS,
  CATEGORY_NAMES,
} from '@/src/engine';
import type {
  CompanionStage,
  CompanionCapability,
  DriftHealth,
  ContextCorrelation,
  AffineFit,
  AffineStats,
  GlobalBias,
  ProFeatureId,
} from '@/src/engine';
import type {
  AdaptSpeed,
  LogSource,
  LogStatus,
  Tier,
  CalibrationConfidence,
  CalibrationSummary,
  Discovery,
  HonestRange,
  Insight,
  ReasonInsight,
  ReasonSample,
  TrendSeries,
  CategoryGoal,
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

/** kv flag: set once the Pro pitch has been unlocked; cleared only by a full
 *  data reset. Monotonic latch: confidence can fall, the pitch must not re-lock. */
const PRO_PITCH_LATCH_KEY = 'whenbee.proPitchUnlocked';

// Per-category graduation ledger: the set of category ids that have already
// reached 'honest' confidence and fired their graduation moment (Step 9 reads
// this to fire exactly once each). Persisted as a JSON string[] under one key.
const GRADUATED_KEY = 'calibration.graduatedCategories';

/** Read the persisted graduation ledger as a Set. Tolerates a missing/corrupt
 *  value by returning an empty set — a bad read never blocks the loop. */
function readGraduated(): Set<string> {
  const raw = kv.getString(GRADUATED_KEY);
  if (raw === null) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

/** Persist the graduation ledger as a stable JSON array (sorted for determinism). */
function writeGraduated(ids: Set<string>): void {
  kv.set(GRADUATED_KEY, JSON.stringify([...ids].sort()));
}

// ── Per-category goals (Pro, no-guilt) — kv only, OFF the training path ───────
// A goal is a small mutable preference + a latched best, not a log, so it lives in
// kv (one key per category) and never enters SQLite or the model. Goal methods
// only ever READ a category's `sharpness`; they never call applyLog or write stats.
const goalKey = (categoryId: string): string => `goal.${categoryId}`;
/** Ledger of category ids whose met-celebration already fired (mirrors the
 *  graduation ledger so the seal shows exactly once). */
const GOAL_CELEBRATED_KEY = 'goal.celebrated';

/** Read one category's goal, tolerating a missing/corrupt value by returning
 *  null — a bad read falls back to the empty state, never an error surface. */
function readGoal(categoryId: string): CategoryGoal | null {
  const raw = kv.getString(goalKey(categoryId));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as CategoryGoal;
  } catch {
    return null;
  }
}

/** Persist one category's goal as a single JSON kv value. */
function writeGoal(goal: CategoryGoal): void {
  kv.set(goalKey(goal.categoryId), JSON.stringify(goal));
}

/** Read the met-celebration ledger as a Set, tolerating missing/corrupt values. */
function readGoalCelebrated(): Set<string> {
  const raw = kv.getString(GOAL_CELEBRATED_KEY);
  if (raw === null) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

/** Persist the met-celebration ledger as a stable JSON array (sorted). */
function writeGoalCelebrated(ids: Set<string>): void {
  kv.set(GOAL_CELEBRATED_KEY, JSON.stringify([...ids].sort()));
}

// Cross-category cold-start bias. A single GlobalBias row (an EWMA of every
// counted clamped ratio) lets a brand-new category open at the user's typical
// optimism instead of the cold population prior. Stored as one JSON kv value.
const GLOBAL_BIAS_KEY = 'calib.global.bias';

/** Read the persisted global bias, tolerating a missing/corrupt value by
 *  returning the neutral empty bias — a bad read never anchors a category wrong. */
function readGlobalBias(): GlobalBias {
  const raw = kv.getString(GLOBAL_BIAS_KEY);
  if (raw === null) return emptyGlobalBias();
  try {
    const parsed = JSON.parse(raw) as GlobalBias;
    return typeof parsed.lnEwma === 'number' && typeof parsed.n === 'number'
      ? parsed
      : emptyGlobalBias();
  } catch {
    return emptyGlobalBias();
  }
}

/** Persist the global bias as a single JSON kv value. */
function writeGlobalBias(g: GlobalBias): void {
  kv.set(GLOBAL_BIAS_KEY, JSON.stringify(g));
}

/** Pluck the five affine sums off a persisted stat row into an AffineStats. */
function statsOf(row: {
  sw: number;
  swx: number;
  swy: number;
  swxx: number;
  swxy: number;
}): AffineStats {
  return { sw: row.sw, swx: row.swx, swy: row.swy, swxx: row.swxx, swxy: row.swxy };
}

/** Build a category's confidence + (non-honest) honest range from its completed
 *  logs. `n` is the trained sample size; `honestMinutes` is the summary's honest
 *  number. Shared by loadCategoryDetail and any other category-facing summary. */
function confidenceAndRange(
  n: number,
  honestMinutes: number,
  guessMinutes: number,
  clampedRatios: number[],
  prior: number,
): { confidence: CalibrationConfidence; range: HonestRange | null } {
  const confidence = confidenceFor({ n, clampedRatios });
  const range =
    confidence === 'honest'
      ? null
      : honestRangeFor({ honestMinutes, guessMinutes, clampedRatios, prior });
  return { confidence, range };
}

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

export interface CachedStat {
  mEffective: number;
  n: number;
  sharpness: number;
  tier: Tier;
  /** Solved affine fit (a + b·guess) for the category's current sums + anchor. */
  fit: AffineFit;
  /** Recent clamped ratios (newest-last) — the band's input. Empty/omitted until
   *  hydrated with logged data. Lets the live Add-Task suggestion carry a range. */
  clampedRatios?: number[];
  /** Category prior multiplier — anchors the low-n band. Omitted in legacy callers. */
  priorMult?: number;
}

export interface ApplyLogParams {
  category: string;
  estimateMin: number;
  actualMin: number;
  status: LogStatus;
  source: LogSource;
  adaptSpeed: AdaptSpeed;
  /** recurring affine deferred — dormant until a caller sets recurringKey. Kept
   *  for API stability; currently unused by applyLog. */
  recurringKey?: string | null;
  label?: string | null;
  nowMs?: number;
  suggestedHonestMin?: number | null;
  /** Epoch ms at which the task timer STARTED; used to derive `startLocalMinute`
   *  at persist time. Absent / null for retroactive (manual) logs. */
  startedAt?: number | null;
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
  /** Earned-Readiness axis (raw→setting→honest), SEPARATE from the honey `tier`.
   *  Derived from sample size + spread of clamped ratios; may move either way. */
  confidence: CalibrationConfidence;
  logsToNext: number;
  /** resolveSuggestion at a 15-min guess (the canonical "honest number" demo). */
  summary: CalibrationSummary;
  /** detectInsight over the category's completed logs; null when it doesn't qualify. */
  insight: Insight | null;
  /** buildTrendSeries replayed from the completed logs. */
  trend: TrendSeries;
  /** recent est-vs-actual rows, newest first. */
  recent: RecentLog[];
  /** The first meaningful honest range for this category (frozen at first 'setting').
   *  The "from" anchor for the narrowing caption; null until the first band. */
  firstHonestRange: HonestRange | null;
}

/** One event row exposed to the focus-window learning hook (read-only, cross-category). */
export interface FocusEventRow {
  category: string;
  estimateMin: number;
  actualMin: number | null;
  status: LogStatus;
  startedAt: number | null;
  startLocalMinute: number | null;
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

/** The companion's presence block — its 6-stage growth, derived purely from the
 *  monotonic companion fuel (maxTier + keeper). Read-only; the engine owns the math. */
export interface CompanionPresence {
  /** 1..6 — derived from companionStageFor (Raw→Keeper). Only ever climbs. */
  stage: CompanionStage;
  /** What this stage unlocks — the engine's capability copy for the stage. */
  capability: CompanionCapability;
  /** True once every tracked category caps at Honest (set-once milestone). */
  keeper: boolean;
  /** Lifetime counted-log count (Layer-1 nectar) — the provenance behind the bee. */
  lifetimeNectar: number;
  /** Positive-only drift register: 'settled' (calm) or 'curious' (worth a re-check). */
  driftHealth: DriftHealth;
  /** Per-install procedural seed — drives the deterministic stripe recolor. */
  seed: number;
  /** Optional user-set display name; null when the companion is still unnamed. */
  name: string | null;
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
  /** The companion's 6-stage presence, derived from the monotonic fuel row. */
  companion: CompanionPresence;
  /** Lifetime count of banked distinct discoveries (monotonic). */
  discoveryCount: number;
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
  /** Category ids that have reached 'honest' confidence and already fired their
   *  graduation moment. Mirrors the kv ledger; Step 9 reads it to fire once each. */
  graduatedCategories: Set<string>;
  db: Database | null;
  setDatabase: (db: Database) => void;
  hydrate: () => Promise<void>;
  /** True when `categoryId` has already graduated (read from the in-memory mirror). */
  isGraduated: (categoryId: string) => boolean;
  /** Latch `categoryId` as graduated. Idempotent — re-marking is a no-op and the
   *  ledger never loses entries. Persists through kv. */
  markGraduated: (categoryId: string) => void;
  applyLog: (input: ApplyLogParams) => Promise<LogResult>;
  loadCategoryDetail: (categoryId: string) => Promise<CategoryDetail>;
  loadReclaimSummary: () => Promise<ReclaimSummary>;
  /** Set (or clear, when blank) the companion's optional display name. */
  nameCompanion: (name: string | null) => Promise<void>;
  /** The banked distinct-discovery gallery, newest-first, plus the live count. */
  loadDiscoveries: () => Promise<{ discoveries: Discovery[]; discoveryCount: number }>;
  /** Cross-category snapshot for the read-only Patterns self-insight surface. */
  loadPatternsData: () => Promise<PatternsData>;
  /** READ-ONLY. Recent events with startLocalMinute for focus-window learning.
   *  The hook consumes this via the store (layer rule: no direct db access). */
  loadFocusEvents: (limit?: number) => Promise<FocusEventRow[]>;
  /** READ-ONLY. Reason correlations for the Pro "what steals your time" surface.
   *  Never trains the model; safe to skip. */
  loadReasonInsights: () => Promise<ReasonInsight[]>;
  /**
   * CAPTURE-ONLY. Attach a free-form context tag (a reason) to a logged event.
   * Pure side-channel analytics: it NEVER trains the model, touches the
   * multiplier/honey, or banks reclaim. Safe to call (or skip) after a log.
   */
  setReason: (eventId: string, value: string, source: string) => Promise<void>;
  /**
   * CAPTURE-ONLY (S4). Attach an optional context tag (e.g. key:'energy') to a
   * logged event. Same side-channel guarantees as setReason: never trains the
   * model, never touches multiplier/honey/reclaim.
   */
  setContext: (eventId: string, key: string, value: string, source: string) => Promise<void>;
  /** READ-ONLY (S4). Context correlations (e.g. energy × accuracy) for the Pro
   *  "when you're sharpest" / context surface. Never trains the model. */
  loadContextInsights: () => Promise<ContextCorrelation[]>;
  resetCategory: (categoryId: string) => Promise<void>;
  /** Clear in-memory caches after a full/learning data wipe. The db itself is
   *  cleared by the dataReset service; this just drops the cached mirrors so the
   *  UI doesn't show stale stats before the next hydrate. */
  reset: () => void;
  /** Latched Pro-readiness selector. `pitchUnlocked` is true once any category
   *  reaches 'setting' confidence, and stays true forever (kv-latched) — a full
   *  data reset is the only way to relock it. `perFeatureReady` is a pure snapshot. */
  getProReadiness: () => { pitchUnlocked: boolean; perFeatureReady: Record<ProFeatureId, boolean> };

  // ── Per-category goals (Pro, no-guilt) — read/write OFF the training path ────
  /** Read a category's goal, reconcile it against the live `sharpness` (advancing
   *  the max-latched best + met), persist the advance, and return it. Null if none. */
  loadGoal: (categoryId: string) => CategoryGoal | null;
  /** Build + persist a fresh goal for `categoryId` from its current `sharpness`,
   *  with the given "within X%" target band. Fires `goal_set`. Reads only sharpness. */
  setGoal: (categoryId: string, targetErrorBand: number) => CategoryGoal;
  /** Remove a category's goal + its met-celebration entry (used by resetCategory). */
  clearGoal: (categoryId: string) => void;
  /** Whether the met-celebration already fired for this category. */
  hasCelebratedGoal: (categoryId: string) => boolean;
  /** Latch this category's met-celebration as fired (idempotent). */
  markGoalCelebrated: (categoryId: string) => void;
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

/** How many recent events the Patterns surface scans. Generous (the "this week"
 *  surprise + early/recent splits want history) but bounded so the read stays cheap. */
const PATTERNS_SCAN_LIMIT = 500;

/** How many recent reason⋈event rows the Pro correlation read scans. Bounded so the
 *  read stays cheap; well above any realistic tagged-over-run history. */
const REASON_SCAN_LIMIT = 500;

export const useCalibrationStore = create<CalibrationState>((set, get) => ({
  logs: 0,
  statsByCategory: {},
  graduatedCategories: new Set(),
  db: null,

  setDatabase: (db) => set({ db }),

  isGraduated: (categoryId) => get().graduatedCategories.has(categoryId),

  markGraduated: (categoryId) => {
    // Read the persisted ledger fresh so concurrent writers can't clobber each
    // other; mark is idempotent and the set only ever grows.
    const ledger = readGraduated();
    if (ledger.has(categoryId)) {
      // Already graduated — keep the in-memory mirror in sync but skip the write.
      set({ graduatedCategories: ledger });
      return;
    }
    ledger.add(categoryId);
    writeGraduated(ledger);
    set({ graduatedCategories: ledger });
  },

  hydrate: async () => {
    // Rehydrate the graduation ledger from kv first (synchronous, Expo Go-safe).
    set({ graduatedCategories: readGraduated() });

    const db = await resolveDb(get, set);
    const statsRepo = makeCategoryStatsRepo(db);
    const taskEventsRepo = makeTaskEventsRepo(db);
    const tracked = useCategoriesStore.getState().categories;
    const global = readGlobalBias();
    const next: Record<string, CachedStat> = {};
    for (const cat of tracked) {
      const row = await statsRepo.get(cat.id);
      // Cold categories (n=0) anchor on the global-nudged prior; trained ones keep
      // their population prior as the ridge anchor.
      const anchor = row.n > 0 ? row.priorMult : coldStartAnchor(row.priorMult, global);
      // Recent clamped-ratio window (oldest → newest) so the live Add-Task
      // suggestion can carry a honest range without re-reading per keystroke.
      const recentEvents = await taskEventsRepo.listByCategory(cat.id, SHARPNESS_WINDOW);
      const clampedRatios = recentEvents
        .filter((e) => e.status === 'completed' && e.actualMin !== null)
        .map((e) => clampRatio(e.estimateMin, e.actualMin as number))
        .reverse();
      next[cat.id] = {
        mEffective: row.mEffective,
        n: row.n,
        sharpness: row.sharpness,
        tier: tierFor(row.sharpness),
        fit: solveAffine(statsOf(row), anchor),
        clampedRatios,
        priorMult: row.priorMult,
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

    const nowMs = input.nowMs ?? Date.now();

    // 2. Seeded category stats (never null) + the cross-category cold-start bias.
    const prev = await categoryStatsRepo.get(input.category);
    const global = readGlobalBias();
    // Cold categories anchor on the global-nudged prior; trained ones keep their
    // population prior as the ridge anchor.
    const anchor = prev.n > 0 ? prev.priorMult : coldStartAnchor(prev.priorMult, global);

    // 3. Recent clamped ratios, oldest → newest (events come newest-first).
    const recentEvents = await taskEventsRepo.listByCategory(input.category, 8);
    const recentClampedRatios = recentEvents
      .filter((e) => e.status === 'completed' && e.actualMin !== null)
      .map((e) => clampRatio(e.estimateMin, e.actualMin as number))
      .reverse();

    // recurring affine deferred — dormant until a caller sets recurringKey.

    // 5. Pure engine step.
    const result = engineApplyLog({
      estimateMin: input.estimateMin,
      actualMin: input.actualMin,
      status: input.status,
      source: input.source,
      adaptSpeed: input.adaptSpeed,
      prior: prev.priorMult,
      category: {
        stats: statsOf(prev),
        n: prev.n,
        anchor,
        sharpness: prev.sharpness,
        reclaimedMinutes: prev.reclaimedMinutes,
      },
      recurring: null,
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
      startedAt: input.startedAt ?? null,
      endedAt: nowMs,
      createdAt,
      suggestedHonestMin: input.suggestedHonestMin ?? null,
      reclaimDividendMin: result.reclaimDeltaMin,
      startLocalMinute:
        input.startedAt != null
          ? new Date(input.startedAt).getHours() * 60 + new Date(input.startedAt).getMinutes()
          : null,
    });

    // The rolling clamped-ratio window AFTER this log (oldest → newest), reused for
    // the firstHonestRange capture and the live cache so the next Add-Task band is
    // already current.
    const windowAfterCache = [...recentClampedRatios, clampRatio(input.estimateMin, input.actualMin)].slice(
      -SHARPNESS_WINDOW,
    );

    // 7. Persist updated stats only when the log trained the model.
    const companionRepo = makeCompanionRepo(db);
    // Lifetime total AFTER this log's deposit. For an uncounted/zero-deposit log
    // it's the unchanged current total — read once below and overwritten when we
    // actually bank, so the Reward count-up always lands on the live number.
    let reclaimLifetimeMin = (await companionRepo.get()).reclaimedMinutesLifetime;
    if (result.counted) {
      // Capture firstHonestRange once — the first time this category's confidence
      // reaches a meaningful band ('setting' or beyond). Frozen thereafter; it is
      // the "from" anchor for the category-detail narrowing caption (§7). Cheap,
      // on-device, off the critical render path.
      const windowAfter = windowAfterCache;
      const confidenceAfter = confidenceFor({ n: result.category.n, clampedRatios: windowAfter });
      const firstHonestRange =
        prev.firstHonestRange == null && confidenceAfter !== 'raw'
          ? honestRangeFor({
              honestMinutes: honestNumber(input.estimateMin, result.category.mEffective),
              guessMinutes: input.estimateMin,
              clampedRatios: windowAfter,
              prior: prev.priorMult,
            })
          : (prev.firstHonestRange ?? null);

      await categoryStatsRepo.upsert({
        categoryId: input.category,
        n: result.category.n,
        // logEwma is retired by the affine model; the trained sums carry the fit.
        logEwma: 0,
        mEffective: result.category.mEffective,
        sharpness: result.category.sharpness,
        priorMult: prev.priorMult,
        adaptSpeed: input.adaptSpeed,
        updatedAt: nowMs,
        reclaimedMinutes: prev.reclaimedMinutes,
        firstHonestRange,
        ...result.category.stats,
      });
      // Fold this counted log's clamped ratio into the cross-category bias so the
      // next cold category opens at the user's typical optimism, not the cold prior.
      writeGlobalBias(updateGlobalBias(global, result.ratioClamped, alphaRegFor(input.adaptSpeed, 'timed')));
      if (result.reclaimDeltaMin > 0) {
        await companionRepo.deposit(result.reclaimDeltaMin);
        await companionRepo.depositToCategory(input.category, result.reclaimDeltaMin);
        reclaimLifetimeMin = (await companionRepo.get()).reclaimedMinutesLifetime;
      }
      // recurring affine deferred — dormant until a caller sets recurringKey.

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
            fit: result.categoryFit,
            clampedRatios: windowAfterCache,
            priorMult: prev.priorMult,
          },
        },
      };
    });

    const tierBefore = tierFor(prev.sharpness);
    const tierAfter = tierFor(result.category.sharpness);
    const leveledUp = result.counted && tierAfter !== tierBefore;

    // 8b. Banked discovery — compute the insight ONCE on the write path. Banking
    //     is real state (not analytics), so it runs BEFORE the fire-and-forget try
    //     below: a persistence failure must surface, not be silently swallowed.
    //     Only a counted log can produce a qualifying insight.
    const ratio = clampRatio(input.estimateMin, input.actualMin);
    const insight = result.counted
      ? detectInsight({
          categoryId: input.category,
          n: result.category.n,
          mEffective: result.category.mEffective,
          // Ordered ln-ratios: the pre-log window plus this counted log.
          orderedLogRatios: [...recentClampedRatios, ratio].map((r) => Math.log(r)),
        })
      : null;
    if (insight) {
      const discoveriesRepo = makeDiscoveriesRepo(db);
      const last = await discoveriesRepo.lastForCategory(insight.categoryId);
      if (
        shouldBankDiscovery({
          candidateMultiplier: insight.multiplier,
          lastBankedMultiplier: last?.multiplier ?? null,
        })
      ) {
        await discoveriesRepo.bank({
          id: makeId(nowMs),
          categoryId: insight.categoryId,
          multiplier: insight.multiplier,
          honestForFifteen: insight.honestForFifteen,
          headline: insight.headline,
          discoveredAt: nowMs,
        });
      }
    }

    // 9. Side-effects — fire-and-forget; never block or throw into the caller.
    try {
      if (result.counted) haptics.success();
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
      // qualifies on the write path (the canonical surfacing point). Reuses the
      // `insight` computed above (8b) so it isn't detected twice.
      if (insight && claimAha(input.category)) {
        analytics.capture('aha_shown', {
          category: input.category,
          multiplier: insight.multiplier,
          n: result.category.n,
        });
      }

      // discovery_unlocked: a banking-intent marker for every qualifying insight.
      // Analytics-only here (may be swallowed) — the bank WRITE already happened
      // above in 8b, outside this try, so it can never be lost.
      if (insight) {
        analytics.capture('discovery_unlocked', {
          categoryId: insight.categoryId,
          multiplier: insight.multiplier,
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

    const baseSummary = resolveSuggestion({
      guessMinutes: 15,
      category: {
        fit: solveAffine(
          statsOf(stat),
          stat.n > 0 ? stat.priorMult : coldStartAnchor(stat.priorMult, readGlobalBias()),
        ),
        n: stat.n,
      },
      recurring: null,
    });

    // Earned-Readiness: derive confidence + (non-honest) honest range from the
    // category's completed clamped ratios, then attach both to the summary so any
    // honest-number surface can show the band / reserve-price hint.
    const clampedRatios = steps.map((s) => s.clampedRatio);
    const { confidence, range } = confidenceAndRange(
      stat.n,
      baseSummary.honestMinutes,
      baseSummary.guessMinutes,
      clampedRatios,
      stat.priorMult,
    );
    const summary: CalibrationSummary = { ...baseSummary, confidence, range };

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
      confidence,
      logsToNext: logsToNextTier(stat.sharpness),
      summary,
      insight,
      trend,
      recent,
      firstHonestRange: stat.firstHonestRange ?? null,
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

    // Companion presence — derive the stage purely from the monotonic fuel row, then
    // hang the engine's capability copy off it. driftHealth defaults to 'settled' so a
    // cold row (pre-first-log) reads as calm, never anxious.
    const stage = companionStageFor({ maxTier: companion.maxTier, keeper: companion.keeper });
    const presence: CompanionPresence = {
      stage,
      capability: capabilityFor(stage),
      keeper: companion.keeper,
      lifetimeNectar: companion.lifetimeDataPoints,
      driftHealth: companion.driftHealth ?? 'settled',
      seed: companion.seed,
      name: companion.name ?? null,
    };

    return {
      lifetimeMin: companion.reclaimedMinutesLifetime,
      byCategory,
      biggestArea,
      honestLogCount,
      companion: presence,
      discoveryCount: companion.discoveryCount,
    };
  },

  nameCompanion: async (name: string | null) => {
    const db = await resolveDb(get, set);
    await makeCompanionRepo(db).setName(name);
  },

  loadDiscoveries: async () => {
    const db = await resolveDb(get, set);
    // Newest-first card list (capped) plus the monotonic lifetime count. Map the
    // db rows to the domain Discovery shape so the hub never sees a db DTO.
    const rows = await makeDiscoveriesRepo(db).list(50);
    const discoveryCount = (await makeCompanionRepo(db).get()).discoveryCount;
    const discoveries: Discovery[] = rows.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      multiplier: r.multiplier,
      honestForFifteen: r.honestForFifteen,
      headline: r.headline,
      discoveredAt: r.discoveredAt,
    }));
    return { discoveries, discoveryCount };
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

  loadFocusEvents: async (limit = PATTERNS_SCAN_LIMIT) => {
    const db = await resolveDb(get, set);
    const taskEventsRepo = makeTaskEventsRepo(db);
    const rows = await taskEventsRepo.listRecent(limit);
    return rows.map((e) => ({
      category: e.category,
      estimateMin: e.estimateMin,
      actualMin: e.actualMin,
      status: e.status,
      startedAt: e.startedAt,
      startLocalMinute: e.startLocalMinute,
    }));
  },

  loadReasonInsights: async () => {
    const db = await resolveDb(get, set);
    // Read-only reason⋈event join. This never trains the model — it only powers the
    // Pro "what steals your time" surface, and a network/read failure here can't
    // touch the core loop.
    const rows = await makeContextTagRepo(db).listReasonEvents(REASON_SCAN_LIMIT);

    // The engine stays clock-free, so the STORE derives local hour/weekday from each
    // event's createdAt. Drop rows with no usable est/actual (abandoned or malformed).
    const samples: ReasonSample[] = rows
      .filter((r) => r.actualMin !== null && r.actualMin > 0 && r.estimateMin > 0)
      .map((r) => {
        const d = new Date(r.createdAt);
        return {
          category: r.category,
          reason: r.reason,
          direction: (r.actualMin as number) > r.estimateMin ? 'over' : 'under',
          hour: d.getHours(),
          weekday: d.getDay(),
        };
      });

    return correlateReasons(samples).map((c) => ({
      ...c,
      categoryName: detailCategoryName(c.categoryId),
    }));
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

  setContext: async (eventId, key, value, source) => {
    const db = await resolveDb(get, set);
    // Capture-only side channel — writes a context tag and nothing else. No stat
    // read, no applyLog, no reclaim: the model never sees this.
    await makeContextTagRepo(db).set({ eventId, key, value, source, createdAt: Date.now() });
  },

  loadContextInsights: async () => {
    const db = await resolveDb(get, set);
    const repo = makeContextTagRepo(db);
    // One read per supported context dimension. The engine stays clock-free; we
    // only map each tagged event to { value, clamped ratio }. Read-only.
    const KEYS = ['energy'] as const;
    const out: ContextCorrelation[] = [];
    for (const key of KEYS) {
      const rows = await repo.listContextEvents(key, 200);
      const samples = rows
        .filter((r) => r.actualMin !== null && r.actualMin > 0)
        .map((r) => ({ value: r.value, ratio: clampRatio(r.estimateMin, r.actualMin as number) }));
      const corr = correlateContext(key, samples);
      if (corr) out.push(corr);
    }
    return out;
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
      firstHonestRange: null,
      sw: 0,
      swx: 0,
      swy: 0,
      swxx: 0,
      swxy: 0,
    });

    // Patch the cache so dependent screens reflect the fresh prior immediately.
    // Empty sums solved against the prior give a flat fit { a: 0, b: prior }.
    set((state) => ({
      statsByCategory: {
        ...state.statsByCategory,
        [categoryId]: {
          mEffective: prior,
          n: 0,
          sharpness: 0,
          tier: tierFor(0),
          fit: solveAffine({ sw: 0, swx: 0, swy: 0, swxx: 0, swxy: 0 }, prior),
          clampedRatios: [],
          priorMult: prior,
        },
      },
    }));

    // A reset category starts goal-free — drop any stale goal + celebration so a
    // fresh baseline isn't carried over from the old learning.
    get().clearGoal(categoryId);
  },

  getProReadiness: () => {
    const stats = Object.values(get().statsByCategory);
    // Lead confidence = the most-advanced category's confidence axis.
    const order: Record<'raw' | 'setting' | 'honest', number> = { raw: 0, setting: 1, honest: 2 };
    const leadConfidence = stats.reduce<'raw' | 'setting' | 'honest'>((best, s) => {
      const c = confidenceFor({ n: s.n, clampedRatios: s.clampedRatios ?? [] });
      const cRank = order[c];
      const bestRank = order[best];
      return cRank > bestRank ? c : best;
    }, 'raw');
    const totalCompletedLogs = stats.reduce((sum, s) => sum + s.n, 0);
    const snapshot = proReadiness({ leadConfidence, totalCompletedLogs });
    // Latch: once unlocked, stay unlocked (confidence can fall; the pitch can't relock).
    const latched = kv.getString(PRO_PITCH_LATCH_KEY) === '1';
    const pitchUnlocked = snapshot.pitchUnlocked || latched;
    if (pitchUnlocked && !latched) kv.set(PRO_PITCH_LATCH_KEY, '1');
    return { pitchUnlocked, perFeatureReady: snapshot.perFeatureReady };
  },

  // ── Per-category goals — kv only, never the model ───────────────────────────
  loadGoal: (categoryId) => {
    const existing = readGoal(categoryId);
    if (!existing) return null;
    // Reconcile against the LIVE sharpness so simply opening the screen advances
    // the max-latched best/met. reconcileGoal is pure + monotonic (best never drops).
    const sharpness = get().statsByCategory[categoryId]?.sharpness ?? 0;
    const reconciled = reconcileGoal(existing, sharpness);
    writeGoal(reconciled);
    return reconciled;
  },

  setGoal: (categoryId, targetErrorBand) => {
    const sharpness = get().statsByCategory[categoryId]?.sharpness ?? 0;
    const targetAccuracy = errorBandToAccuracy(targetErrorBand);
    const goal: CategoryGoal = {
      categoryId,
      targetAccuracy,
      baselineAccuracy: sharpness,
      bestAccuracy: sharpness,
      met: sharpness >= targetAccuracy,
      setAt: Date.now(),
    };
    writeGoal(goal);
    analytics.capture('goal_set', {
      category: categoryId,
      target_band: targetErrorBand,
      baseline_band: accuracyToErrorBand(sharpness),
    });
    return goal;
  },

  clearGoal: (categoryId) => {
    kv.delete(goalKey(categoryId));
    const led = readGoalCelebrated();
    if (led.delete(categoryId)) writeGoalCelebrated(led);
  },

  hasCelebratedGoal: (categoryId) => readGoalCelebrated().has(categoryId),

  markGoalCelebrated: (categoryId) => {
    const led = readGoalCelebrated();
    if (led.has(categoryId)) return;
    led.add(categoryId);
    writeGoalCelebrated(led);
  },

  reset: () => {
    // Factory reset clears the cross-category bias and the Pro pitch latch too —
    // a fresh start should require re-earning the pitch gate.
    kv.delete(GLOBAL_BIAS_KEY);
    kv.delete(PRO_PITCH_LATCH_KEY);
    set({ logs: 0, statsByCategory: {}, graduatedCategories: new Set() });
  },
}));
