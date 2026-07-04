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

const WINDOW_DAYS = 60;

// The focus window the demo data should make the engine DISCOVER. Picked in the
// early afternoon so the learned window reads as personal — clearly NOT the
// 09:00–11:30 prior fallback (FW_PRIOR_WINDOW), so the founder can tell at a
// glance that calibration actually fired rather than a default showing through.
const FOCUS_BAND_START_MIN = 14 * 60; // 14:00
const FOCUS_BAND_END_MIN = 16 * 60; //   16:00
const FOCUS_BAND_LEN_MIN = FOCUS_BAND_END_MIN - FOCUS_BAND_START_MIN;
// Share of each category's logs that start inside the band. A minority — so the
// band sits clearly ABOVE the all-day average (if focus hours were the majority
// they'd define the mean and read as "normal"), while ~⅓ of ~137 logs still puts
// every band bin well over FW_BIN_MIN_EVENTS / FW_BIN_MIN_DAYS.
const FOCUS_BAND_SHARE = 0.33;
// How much sharper the user is in-band. The bias is split MEAN-PRESERVINGLY around
// each category's headline bias: in-band ≈ bias·(1−gain) (user beats their honest
// number → positive focus signal s = log(honest/actual)), out-of-band the slack
// picks up the slack so the category's average bias — and every honest number on
// the other Pro surfaces — is unchanged. The in/out gap is what gives the bins
// enough spread (sd) to clear FW_SD_MIN and the permutation gate. Tuned so the
// engine learns a personal window on ~20/20 seeds (see scratch sim).
const FOCUS_PERF_GAIN = 0.35;
// Out-of-band start times spread across a plausible waking day, band excluded.
const OUT_OF_BAND_START_MIN = 7 * 60; //  07:00
const OUT_OF_BAND_END_MIN = 21 * 60; //   21:00

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

// Five categories. "Getting ready" and "Admin" are the requested two; "Deep work"
// and "Errands" round out the set with a long-task and a mid-task profile so the
// day-capacity and correlations views have variety; "Workout" is a deliberately
// thin 3-log category to show an early-stage, barely-calibrated profile. Biases are
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
  // A fresh, barely-calibrated category: only 3 logs, so it reads as early-stage
  // (low sharpness / early honey) next to the mature four above.
  {
    id: 'workout',
    name: 'Workout',
    adaptSpeed: 'balanced',
    estimateMin: 45,
    bias: 1.3,
    count: 3,
    labels: ['Gym session', 'Evening run', 'Home workout'],
  },
];

interface SeedEvent {
  category: string;
  label: string;
  estimateMin: number;
  actualMin: number;
  adaptSpeed: AdaptSpeed;
  /** Wall-clock start (local). Drives startLocalMinute → focus-window learning. */
  startedAt: number;
  /** End/log time = start + actual. Used as applyLog's nowMs (endedAt/createdAt). */
  nowMs: number;
}

/** Uniform jitter in [-1, 1) scaled by `amount`. */
function jitter(amount: number): number {
  return (Math.random() * 2 - 1) * amount;
}

/** Local-midnight of (today − dayBack) plus a minute-of-day offset → epoch ms. */
function startedAtFor(now: number, dayBack: number, startMinuteOfDay: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayBack);
  return d.getTime() + startMinuteOfDay * 60_000;
}

/** A start minute outside the focus band, spread across the waking day. */
function outOfBandStartMinute(): number {
  const span = OUT_OF_BAND_END_MIN - OUT_OF_BAND_START_MIN - FOCUS_BAND_LEN_MIN;
  const m = OUT_OF_BAND_START_MIN + Math.floor(Math.random() * span);
  // Skip over the band so it stays empty for these picks.
  return m >= FOCUS_BAND_START_MIN ? m + FOCUS_BAND_LEN_MIN : m;
}

/**
 * Build every demo event, sorted oldest → newest. Chronological order matters:
 * applyLog reads each category's recent window from what is already persisted, so
 * the sharpness/honey progression only looks real if we replay time forwards.
 *
 * Each event also gets a real wall-clock start: ~55% land in the focus band (where
 * the user beats their honest number), the rest spread across the day. That
 * time-of-day structure is what lets the focus-window engine learn a personal
 * window instead of sitting on the prior forever.
 */
function buildEvents(now: number): SeedEvent[] {
  const events: SeedEvent[] = [];

  for (const cat of DEMO_CATEGORIES) {
    for (let k = 0; k < cat.count; k++) {
      // Spread the k logs evenly back across the window (k=0 oldest, last = today).
      const dayBack = cat.count > 1 ? Math.round(((cat.count - 1 - k) / (cat.count - 1)) * (WINDOW_DAYS - 1)) : 0;

      const inBand = Math.random() < FOCUS_BAND_SHARE;
      const startMinuteOfDay = inBand
        ? FOCUS_BAND_START_MIN + Math.floor(Math.random() * FOCUS_BAND_LEN_MIN)
        : outOfBandStartMinute();

      // Mean-preserving bias split around cat.bias: sharper in-band, slacker out,
      // so the category's average bias (and its honest number) is left untouched.
      const biasIn = cat.bias * (1 - FOCUS_PERF_GAIN);
      const biasOut = (cat.bias - FOCUS_BAND_SHARE * biasIn) / (1 - FOCUS_BAND_SHARE);
      const effBias = inBand ? biasIn : biasOut;

      const estimateMin = Math.max(1, Math.round(cat.estimateMin * (1 + jitter(0.15))));
      const actualMin = Math.max(1, Math.round(estimateMin * effBias * (1 + jitter(0.1))));
      const label = cat.labels[k % cat.labels.length] ?? cat.name;

      const startedAt = startedAtFor(now, dayBack, startMinuteOfDay);
      const nowMs = startedAt + actualMin * 60_000;

      events.push({ category: cat.id, label, estimateMin, actualMin, adaptSpeed: cat.adaptSpeed, startedAt, nowMs });
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
      startedAt: e.startedAt,
      nowMs: e.nowMs,
    });
  }

  // 4. Refresh the in-memory stat cache so home/Add-Task reflect it immediately.
  await useCalibrationStore.getState().hydrate();

  return events.length;
}
