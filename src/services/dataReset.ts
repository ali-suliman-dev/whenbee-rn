// Two user-initiated, on-device reset scopes. No network; never touches Pro
// (that lives on RevenueCat). The UI calls these through useAccountReset, never
// directly (the src/app → src/services boundary stays closed via the hook).

import type { Database } from '@/src/db';
import { kv } from '@/src/lib/kv';

/**
 * KV keys that SURVIVE a "Reset progress". Everything else in KV is treated as
 * learning/session state and cleared. Includes the persisted store names we keep
 * (settings, categories, vocab, onboarding) plus the founder-reserve + install
 * stamps. Vocab is kept because the categories it guesses for are kept.
 */
export const KEEP_ON_PROGRESS: ReadonlySet<string> = new Set([
  'settings',
  'categories',
  'vocab',
  'onboarding',
  'paywall.founderReserved',
  'paywall.founderReservedAt',
  'whenbee.installAt',
  'whenbee.installFired',
]);

/** Reset progress: forget what Whenbee learned, keep the setup. The companion
 *  keeps its name + appearance seed; only its growth resets. */
export async function wipeLearning(db: Database): Promise<void> {
  const { name, seed } = await db.getCompanion();
  await db.wipeAll();
  await db.setCompanionName(name);
  await db.setSeed(seed); // wipeAll set seed=0, so this re-applies the kept look
  for (const key of kv.getAllKeys()) {
    if (!KEEP_ON_PROGRESS.has(key)) kv.delete(key);
  }
}

/** Erase everything: a clean device, as if freshly installed. */
export async function wipeEverything(db: Database): Promise<void> {
  await db.wipeAll();
  kv.clearAll();
}
