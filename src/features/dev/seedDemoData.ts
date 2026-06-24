// __DEV__-only demo-data seeder.
//
// Fills the app with ~2 months of realistic completed task logs across four
// categories so every Pro surface (Honest Week/Month, day-capacity, confidence
// band, correlations, Patterns, Discoveries) has something to show — WITHOUT
// touching a real device install. Simulator and device keep fully separate data
// containers (the core loop is on-device-only, no cloud sync), so running this
// in the sim can never reach a phone build.
//
// Learning goes through the real engine path (calibrationStore.applyLog), so the
// honest numbers, sharpness tiers, honey maturity, reclaim bank and discoveries
// are all genuinely computed — not faked stats that would render inconsistently.
//
// Guarded by __DEV__ at the only call site (Settings → Developer). Safe to no-op
// in production.

import { getDatabase } from '@/src/db/client';
import { makeTaskEventsRepo } from '@/src/db/repositories/taskEventsRepo';
import { makeCategoryStatsRepo } from '@/src/db/repositories/categoryStatsRepo';
import { priorFor } from '@/src/engine/priors';
import { emptyAffineStats } from '@/src/engine';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoriesStore, type CategoryEntry } from '@/src/stores/categoriesStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { AdaptSpeed } from '@/src/domain/types';

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 60;

interface DemoCategory {
  id: string;
  name: string;
  adaptSpeed: AdaptSpeed;
  /** Typical guess the user makes, in minutes. */
  estimateMin: number;
  /** True personal bias — actual ≈ estimate × bias. >1 = chronic optimist. */
  bias: number;
  /** How many logs to lay down across the window. */
  count: number;
  /** Realistic task names, cycled so frequent-tasks + "steals your time" read true. */
  labels: string[];
}

// Four categories. "Getting ready" and "Admin" are the requested two; "Deep work"
// and "Errands" round out the set with a long-task and a mid-task profile so the
// day-capacity and correlations views have variety. Biases are deliberately
// distinct and consistent enough to climb the honey tiers and trip a Discovery.
const DEMO_CATEGORIES: DemoCategory[] = [
  {
    id: 'getting_ready',
    name: 'Getting ready',
    adaptSpeed: 'balanced',
    estimateMin: 15,
    bias: 1.6,
    count: 52,
    labels: ['Shower & dress', 'Morning routine', 'Get out the door'],
  },
  {
    id: 'admin',
    name: 'Admin & email',
    adaptSpeed: 'balanced',
    estimateMin: 20,
    bias: 1.45,
    count: 42,
    labels: ['Inbox catch-up', 'Pay invoices', 'Reply to emails', 'Paperwork'],
  },
  {
    id: 'deep_work',
    name: 'Deep work',
    adaptSpeed: 'balanced',
    estimateMin: 75,
    bias: 1.25,
    count: 26,
    labels: ['Write the spec', 'Code review', 'Design pass', 'Focus block'],
  },
  {
    id: 'errands',
    name: 'Errands',
    adaptSpeed: 'balanced',
    estimateMin: 35,
    bias: 1.5,
    count: 17,
    labels: ['Groceries', 'Post office', 'Pharmacy run'],
  },
];

interface SeedEvent {
  category: string;
  label: string;
  estimateMin: number;
  actualMin: number;
  adaptSpeed: AdaptSpeed;
  nowMs: number;
}

/** Uniform jitter in [-1, 1) scaled by `amount`. */
function jitter(amount: number): number {
  return (Math.random() * 2 - 1) * amount;
}

/**
 * Build every demo event, sorted oldest → newest. Chronological order matters:
 * applyLog reads each category's recent window from what is already persisted, so
 * the sharpness/honey progression only looks real if we replay time forwards.
 */
function buildEvents(now: number): SeedEvent[] {
  const events: SeedEvent[] = [];

  for (const cat of DEMO_CATEGORIES) {
    for (let k = 0; k < cat.count; k++) {
      // Spread the k logs evenly back across the window (k=0 oldest, last = today),
      // dropped at a plausible daytime hour with a little jitter.
      const dayBack = cat.count > 1 ? Math.round(((cat.count - 1 - k) / (cat.count - 1)) * (WINDOW_DAYS - 1)) : 0;
      const hourMs = (8 + Math.floor(Math.random() * 11)) * 3_600_000; // 08:00–19:00
      const nowMs = now - dayBack * DAY_MS - DAY_MS + hourMs;

      const estimateMin = Math.max(1, Math.round(cat.estimateMin * (1 + jitter(0.15))));
      const actualMin = Math.max(1, Math.round(estimateMin * cat.bias * (1 + jitter(0.1))));
      const label = cat.labels[k % cat.labels.length] ?? cat.name;

      events.push({ category: cat.id, label, estimateMin, actualMin, adaptSpeed: cat.adaptSpeed, nowMs });
    }
  }

  return events.sort((a, b) => a.nowMs - b.nowMs);
}

/** Wipe prior logs + stats for the demo categories so re-running is idempotent. */
async function resetDemoCategories(): Promise<void> {
  const db = await getDatabase();
  const events = makeTaskEventsRepo(db);
  const stats = makeCategoryStatsRepo(db);

  for (const cat of DEMO_CATEGORIES) {
    await events.deleteByCategory(cat.id);
    const prior = priorFor(cat.id);
    // Cold-start row identical to the repo's lazy seed — back to n=0.
    await stats.upsert({
      categoryId: cat.id,
      n: 0,
      logEwma: 0,
      mEffective: prior,
      sharpness: 0,
      priorMult: prior,
      adaptSpeed: cat.adaptSpeed,
      updatedAt: 0,
      reclaimedMinutes: 0,
      firstHonestRange: null,
      ...emptyAffineStats(),
    });
  }
}

/**
 * Seed the simulator with demo data and flip the app into a fully-set-up,
 * Pro-unlocked, past-onboarding state. Returns the number of logs written.
 *
 * Note: the companion's lifetime reclaim/nectar/tier are monotonic and are NOT
 * reset between runs — intended to be run once on a fresh sim. Re-running just
 * stacks more honey on top, which is harmless for previewing.
 */
export async function seedDemoData(): Promise<number> {
  if (!__DEV__) return 0;

  // 1. Track the four categories so the UI lists them.
  const categories: CategoryEntry[] = DEMO_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    adaptSpeed: c.adaptSpeed,
  }));
  useCategoriesStore.getState().setCategories(categories);

  // 2. Past onboarding + Pro forced on (survives relaunch via the dev override).
  useOnboardingStore.getState().complete();
  useEntitlement.getState().setPro(true);

  // 3. Clean slate for these categories, then replay ~2 months forwards.
  await resetDemoCategories();

  const events = buildEvents(Date.now());
  const apply = useCalibrationStore.getState().applyLog;
  for (const e of events) {
    await apply({
      category: e.category,
      label: e.label,
      estimateMin: e.estimateMin,
      actualMin: e.actualMin,
      status: 'completed',
      source: 'timed',
      adaptSpeed: e.adaptSpeed,
      nowMs: e.nowMs,
    });
  }

  // 4. Refresh the in-memory stat cache so home/Add-Task reflect it immediately.
  await useCalibrationStore.getState().hydrate();

  return events.length;
}
