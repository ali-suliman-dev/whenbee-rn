# Data Reset ("Danger Zone") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two styled, confirm-guarded reset actions to Settings — "Reset progress" (forget learning, keep setup) and "Erase everything" (full factory reset → onboarding) — in a Danger Zone section.

**Architecture:** A new `Database.wipeAll()` port method (both adapters) clears every table; `services/dataReset.ts` composes it with KV helpers for the two scopes; a `useAccountReset` feature hook orchestrates the service + in-memory Zustand store resets + navigation; a styled `ConfirmSheet` + `DataResetGlyph` drive the UI from `settings.tsx`. Layer boundaries hold (screen → hook → service/db).

**Tech Stack:** React Native (Expo SDK 54), TypeScript (strict), Zustand + persist, expo-sqlite + expo-sqlite/kv-store, react-native-reanimated, react-native-svg, Jest.

## Global Constraints

- **No guilt/shame/streak language** in any copy (product invariant). Frame resets as a fresh start.
- **Core loop on-device only** — no network in any reset path. Pro entitlement lives on RevenueCat, untouched by either reset.
- **All spacing/size/font/color values come from theme tokens** in `src/theme/tokens.ts` via `useTheme()`. No inline raw numbers or hex. Add a token if one is missing.
- **TDD required** for logic-layer code (db, services, stores, lib). Write the failing test first.
- **`src/app/**` and `src/components/**` must NOT import `src/db/*` or `src/services/*`** — route through the hook.
- **Conventional Commits**, NO AI/co-author attribution of any kind.
- **Pressable gotcha:** keep `Pressable` a bare touch wrapper; put visual style on an inner `View`. Read/write reanimated shared values with `.get()/.set()`.
- Lint each touched file: `npx eslint <files>` (flat `eslint.config.js`). `npm run lint` is 0-warnings.
- After all tasks: `npm run typecheck` and `npm test` must pass.

## File Structure

- `src/db/Database.ts` — add `wipeAll()` to the port interface.
- `src/db/memoryDatabase.ts` — implement `wipeAll()` (clear Maps + reset companion).
- `src/db/sqliteDatabase.ts` — implement `wipeAll()` (transactional DELETEs + companion reset).
- `src/db/__tests__/wipeAll.test.ts` — new, against the memory adapter.
- `src/lib/kv.ts` — add `clearAll()` + `getAllKeys()`.
- `src/lib/__tests__/kv.test.ts` — extend with clearAll/getAllKeys cases.
- `src/services/dataReset.ts` — new: `wipeLearning(db)` + `wipeEverything(db)`.
- `src/services/__tests__/dataReset.test.ts` — new.
- `src/stores/calibrationStore.ts` — add `reset()`.
- `src/stores/categoriesStore.ts` — add `reset()`.
- `src/stores/settingsStore.ts` — add `reset()`.
- `src/stores/vocabStore.ts` — add `reset()`.
- `src/stores/planStore.ts` — add `reset()`.
- `src/stores/__tests__/storeResets.test.ts` — new, covers the five reset actions.
- `src/features/settings/useAccountReset.ts` — new orchestration hook.
- `src/theme/tokens.ts` — add `dangerEdge` color (light + dark).
- `src/components/AppButton.tsx` — add `danger` variant.
- `src/components/DataResetGlyph.tsx` — new glyph (`progress` | `erase`).
- `src/components/ConfirmSheet.tsx` — new styled bottom-sheet confirm.
- `src/app/settings.tsx` — Danger Zone section; `SettingRow` gains a `leading` slot.

---

### Task 1: `Database.wipeAll()` port + both adapters

**Files:**
- Modify: `src/db/Database.ts` (interface)
- Modify: `src/db/memoryDatabase.ts`
- Modify: `src/db/sqliteDatabase.ts`
- Test: `src/db/__tests__/wipeAll.test.ts`

**Interfaces:**
- Consumes: existing `Database` port, `createMemoryDatabase()`.
- Produces: `Database.wipeAll(): Promise<void>` — clears task_events, category_stats, recurring_stats, log_tags, discoveries; resets the companion singleton to defaults with `seed = 0` and `name = null`.

- [ ] **Step 1: Write the failing test**

Create `src/db/__tests__/wipeAll.test.ts`:

```ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';

describe('Database.wipeAll', () => {
  it('clears every table and resets the companion to defaults', async () => {
    const db = createMemoryDatabase();

    await db.upsertCategoryStat({
      categoryId: 'cooking', n: 5, logEwma: 0.2, mEffective: 1.3,
      sharpness: 0.4, priorMult: 1.2, adaptSpeed: 'balanced',
      updatedAt: 1000, reclaimedMinutes: 30,
    });
    await db.insertTaskEvent({
      id: 'e1', category: 'cooking', label: null, estimateMin: 15, actualMin: 20,
      status: 'completed', source: 'timed', startedAt: null, endedAt: 2000,
      createdAt: 2000, suggestedHonestMin: 18, reclaimDividendMin: 2,
    });
    await db.insertDiscovery({
      id: 'd1', categoryId: 'cooking', multiplier: 1.3, honestForFifteen: 20,
      headline: 'x', discoveredAt: 3000,
    });
    await db.setCompanionName('Bramble');
    await db.bumpLifetimeNectar();
    await db.raiseMaxTier(3);

    await db.wipeAll();

    expect(await db.getCategoryStat('cooking')).toBeNull();
    expect(await db.listRecentEvents(10)).toEqual([]);
    expect(await db.listDiscoveries(10)).toEqual([]);
    const companion = await db.getCompanion();
    expect(companion).toEqual({
      reclaimedMinutesLifetime: 0,
      lifetimeDataPoints: 0,
      maxTier: 0,
      keeper: false,
      seed: 0,
      driftHealth: 'settled',
      discoveryCount: 0,
      name: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/db/__tests__/wipeAll.test.ts`
Expected: FAIL — `db.wipeAll is not a function`.

- [ ] **Step 3: Add the port method**

In `src/db/Database.ts`, add inside the `Database` interface (after `incrementDiscoveryCount`):

```ts
  /** Factory reset: clears every table and returns the companion singleton to its
   *  default row (seed 0 so the next hydrate re-seeds a fresh appearance, name null). */
  wipeAll(): Promise<void>;
```

- [ ] **Step 4: Implement in the memory adapter**

In `src/db/memoryDatabase.ts`, add as the last method of the returned object (after `incrementDiscoveryCount`):

```ts
    async wipeAll(): Promise<void> {
      categoryStats.clear();
      recurringStats.clear();
      events.clear();
      contextTags.clear();
      discoveries.clear();
      companion.reclaimedMinutesLifetime = 0;
      companion.lifetimeDataPoints = 0;
      companion.maxTier = 0;
      companion.keeper = false;
      companion.seed = 0;
      companion.driftHealth = 'settled';
      companion.discoveryCount = 0;
      companion.name = null;
    },
```

- [ ] **Step 5: Implement in the sqlite adapter**

In `src/db/sqliteDatabase.ts`, add as the last method of the returned object (after `incrementDiscoveryCount`):

```ts
    async wipeAll(): Promise<void> {
      await db.withTransactionAsync(async () => {
        await db.execAsync(
          `DELETE FROM task_events;
           DELETE FROM category_stats;
           DELETE FROM recurring_stats;
           DELETE FROM log_tags;
           DELETE FROM discoveries;
           UPDATE companion SET
             reclaimed_minutes_lifetime = 0,
             lifetime_data_points = 0,
             max_tier = 0,
             keeper = 0,
             seed = 0,
             drift_health = 'settled',
             discovery_count = 0,
             name = NULL
           WHERE id = 1;`,
        );
      });
    },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/db/__tests__/wipeAll.test.ts`
Expected: PASS.

- [ ] **Step 7: Lint + commit**

```bash
npx eslint src/db/Database.ts src/db/memoryDatabase.ts src/db/sqliteDatabase.ts src/db/__tests__/wipeAll.test.ts
git add src/db/Database.ts src/db/memoryDatabase.ts src/db/sqliteDatabase.ts src/db/__tests__/wipeAll.test.ts
git commit -m "feat(db): add wipeAll port for factory reset"
```

---

### Task 2: KV `clearAll()` + `getAllKeys()`

**Files:**
- Modify: `src/lib/kv.ts`
- Test: `src/lib/__tests__/kv.test.ts`

**Interfaces:**
- Produces: `kv.clearAll(): void` (wraps `Storage.clearSync()`), `kv.getAllKeys(): string[]` (wraps `Storage.getAllKeysSync()`).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/kv.test.ts` (inside the existing `describe`):

```ts
  it('lists all keys', () => {
    kv.set('a', '1');
    kv.set('b', '2');
    expect(kv.getAllKeys()).toEqual(expect.arrayContaining(['a', 'b']));
  });
  it('clears every key', () => {
    kv.set('x', '1');
    kv.clearAll();
    expect(kv.getAllKeys()).toEqual([]);
    expect(kv.getString('x')).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/kv.test.ts`
Expected: FAIL — `kv.getAllKeys is not a function`.

- [ ] **Step 3: Implement**

In `src/lib/kv.ts`, extend the `kv` object:

```ts
export const kv = {
  set: (key: string, value: string) => Storage.setItemSync(key, value),
  getString: (key: string): string | null => Storage.getItemSync(key),
  delete: (key: string) => Storage.removeItemSync(key),
  getAllKeys: (): string[] => Storage.getAllKeysSync(),
  clearAll: () => Storage.clearSync(),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/kv.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/lib/kv.ts src/lib/__tests__/kv.test.ts
git add src/lib/kv.ts src/lib/__tests__/kv.test.ts
git commit -m "feat(kv): add clearAll and getAllKeys helpers"
```

---

### Task 3: `services/dataReset.ts` — the two scopes

**Files:**
- Create: `src/services/dataReset.ts`
- Test: `src/services/__tests__/dataReset.test.ts`

**Interfaces:**
- Consumes: `Database` (with `wipeAll`), `kv.getAllKeys/clearAll/delete`.
- Produces:
  - `wipeLearning(db: Database): Promise<void>` — `wipeAll`, restore companion name+seed, delete every KV key NOT in the keep-list.
  - `wipeEverything(db: Database): Promise<void>` — `wipeAll` + `kv.clearAll()`.
  - `KEEP_ON_PROGRESS: ReadonlySet<string>` (exported for the test).

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/dataReset.test.ts`:

```ts
import { createMemoryDatabase } from '@/src/db/memoryDatabase';
import { kv } from '@/src/lib/kv';
import { wipeLearning, wipeEverything } from '@/src/services/dataReset';

beforeEach(() => kv.clearAll());

async function seedDb() {
  const db = createMemoryDatabase();
  await db.upsertCategoryStat({
    categoryId: 'cooking', n: 5, logEwma: 0.2, mEffective: 1.3, sharpness: 0.4,
    priorMult: 1.2, adaptSpeed: 'balanced', updatedAt: 1000, reclaimedMinutes: 30,
  });
  await db.setCompanionName('Bramble');
  await db.setSeed(42);
  return db;
}

describe('wipeLearning', () => {
  it('clears learning data + keys but keeps setup keys and companion identity', async () => {
    const db = await seedDb();
    kv.set('settings', '{"colorMode":"dark"}');
    kv.set('categories', '{"state":{"categories":[]}}');
    kv.set('paywall.founderReserved', '1');
    kv.set('whenbee.installAt', '1000');
    kv.set('calibration.graduatedCategories', '["cooking"]');
    kv.set('whenbee.ahaFired.cooking', '1');
    kv.set('today-tasks', '{"state":{"tasks":[]}}');

    await wipeLearning(db);

    // db wiped
    expect(await db.getCategoryStat('cooking')).toBeNull();
    // companion identity preserved
    const c = await db.getCompanion();
    expect(c.name).toBe('Bramble');
    expect(c.seed).toBe(42);
    // kept keys survive
    expect(kv.getString('settings')).not.toBeNull();
    expect(kv.getString('categories')).not.toBeNull();
    expect(kv.getString('paywall.founderReserved')).toBe('1');
    expect(kv.getString('whenbee.installAt')).toBe('1000');
    // learning keys gone
    expect(kv.getString('calibration.graduatedCategories')).toBeNull();
    expect(kv.getString('whenbee.ahaFired.cooking')).toBeNull();
    expect(kv.getString('today-tasks')).toBeNull();
  });
});

describe('wipeEverything', () => {
  it('clears the db and every KV key', async () => {
    const db = await seedDb();
    kv.set('settings', '{"colorMode":"dark"}');
    kv.set('vocab', '{"state":{"map":{}}}');

    await wipeEverything(db);

    expect(await db.getCategoryStat('cooking')).toBeNull();
    expect((await db.getCompanion()).name).toBeNull();
    expect(kv.getAllKeys()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/dataReset.test.ts`
Expected: FAIL — cannot find module `dataReset`.

- [ ] **Step 3: Implement the service**

Create `src/services/dataReset.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/__tests__/dataReset.test.ts`
Expected: PASS (both describes).

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/services/dataReset.ts src/services/__tests__/dataReset.test.ts
git add src/services/dataReset.ts src/services/__tests__/dataReset.test.ts
git commit -m "feat(services): add learning + full data-reset scopes"
```

---

### Task 4: In-memory store `reset()` actions

**Files:**
- Modify: `src/stores/calibrationStore.ts`, `categoriesStore.ts`, `settingsStore.ts`, `vocabStore.ts`, `planStore.ts`
- Test: `src/stores/__tests__/storeResets.test.ts`

**Interfaces:**
- Produces (all `(): void`): `useCalibrationStore.reset` (logs=0, statsByCategory={}, graduatedCategories=new Set()), `useCategoriesStore.reset` (categories=[]), `useSettingsStore.reset` (colorMode='system', remindersEnabled=false, dailyRitualEnabled=false), `useVocabStore.reset` (map={}, seq=0), `usePlanStore.reset` (draft=emptyDraft, active=null).

- [ ] **Step 1: Write the failing test**

Create `src/stores/__tests__/storeResets.test.ts`:

```ts
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVocabStore } from '@/src/stores/vocabStore';
import { usePlanStore } from '@/src/stores/planStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

describe('store reset actions', () => {
  it('categoriesStore.reset empties the tracked list', () => {
    useCategoriesStore.getState().setCategories([{ id: 'a', name: 'A', adaptSpeed: 'balanced' }]);
    useCategoriesStore.getState().reset();
    expect(useCategoriesStore.getState().categories).toEqual([]);
  });

  it('settingsStore.reset returns prefs to defaults', () => {
    useSettingsStore.getState().setColorMode('dark');
    useSettingsStore.getState().setRemindersEnabled(true);
    useSettingsStore.getState().setDailyRitualEnabled(true);
    useSettingsStore.getState().reset();
    const s = useSettingsStore.getState();
    expect(s.colorMode).toBe('system');
    expect(s.remindersEnabled).toBe(false);
    expect(s.dailyRitualEnabled).toBe(false);
  });

  it('vocabStore.reset clears the learned map', () => {
    useVocabStore.getState().bank('clean kitchen', 'cleaning');
    useVocabStore.getState().reset();
    expect(useVocabStore.getState().map).toEqual({});
    expect(useVocabStore.getState().seq).toBe(0);
  });

  it('planStore.reset drops the active plan and draft', () => {
    usePlanStore.getState().setDeadline(123);
    usePlanStore.getState().reset();
    expect(usePlanStore.getState().active).toBeNull();
    expect(usePlanStore.getState().draft.deadline).toBeNull();
  });

  it('calibrationStore.reset clears in-memory caches', () => {
    useCalibrationStore.setState({
      logs: 5,
      statsByCategory: { a: { mEffective: 1, n: 2, sharpness: 0.1, tier: 'Forming' } },
      graduatedCategories: new Set(['a']),
    });
    useCalibrationStore.getState().reset();
    const c = useCalibrationStore.getState();
    expect(c.logs).toBe(0);
    expect(c.statsByCategory).toEqual({});
    expect(c.graduatedCategories.size).toBe(0);
  });
});
```

(If `'Forming'` is not a valid `Tier`, use any literal from `TIERS[0]`; the value is irrelevant to the assertion.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/stores/__tests__/storeResets.test.ts`
Expected: FAIL — `reset is not a function`.

- [ ] **Step 3: Add `reset` to each store**

`src/stores/categoriesStore.ts` — add to the state object (and to the `CategoriesState` interface: `reset: () => void;`):

```ts
      reset: () => set({ categories: [] }),
```

`src/stores/settingsStore.ts` — interface `reset: () => void;`, and in the creator:

```ts
      reset: () => set({ colorMode: 'system', remindersEnabled: false, dailyRitualEnabled: false }),
```

`src/stores/vocabStore.ts` — interface `reset: () => void;`, and:

```ts
      reset: () => set({ map: {}, seq: 0 }),
```

`src/stores/planStore.ts` — interface `reset: () => void;`, and (reuse the existing `emptyDraft`):

```ts
      reset: () => set({ draft: emptyDraft, active: null }),
```

`src/stores/calibrationStore.ts` — interface `reset: () => void;`, and in the creator:

```ts
  reset: () => set({ logs: 0, statsByCategory: {}, graduatedCategories: new Set() }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/stores/__tests__/storeResets.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/stores/calibrationStore.ts src/stores/categoriesStore.ts src/stores/settingsStore.ts src/stores/vocabStore.ts src/stores/planStore.ts src/stores/__tests__/storeResets.test.ts
git add src/stores/calibrationStore.ts src/stores/categoriesStore.ts src/stores/settingsStore.ts src/stores/vocabStore.ts src/stores/planStore.ts src/stores/__tests__/storeResets.test.ts
git commit -m "feat(stores): add reset actions for data wipe"
```

---

### Task 5: `useAccountReset` orchestration hook

**Files:**
- Create: `src/features/settings/useAccountReset.ts`

**Interfaces:**
- Consumes: `getDatabase` from `@/src/db`, `wipeLearning`/`wipeEverything` from `@/src/services/dataReset`, the store `reset`/`clear`/`cancel`/`hydrate` actions, `router` from `expo-router`.
- Produces: `useAccountReset(): { resetting: boolean; resetProgress: () => Promise<void>; eraseEverything: () => Promise<void> }`.

> No new test: this is a thin React orchestration hook over already-tested units (service + store resets). Verified manually on the sim in Task 9.

- [ ] **Step 1: Implement the hook**

Create `src/features/settings/useAccountReset.ts`:

```ts
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { getDatabase } from '@/src/db';
import { wipeLearning, wipeEverything } from '@/src/services/dataReset';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';
import { usePlanStore } from '@/src/stores/planStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVocabStore } from '@/src/stores/vocabStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';

/**
 * Drives the two Settings "Danger zone" resets. Clears persistence (db + kv) via
 * the dataReset service, then resets the matching in-memory Zustand stores so the
 * live UI reflects the wipe without a relaunch. Erase additionally drops the
 * boot-gate flag and bounces through the root → welcome onboarding.
 */
export function useAccountReset() {
  const [resetting, setResetting] = useState(false);

  const resetProgress = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const db = await getDatabase();
      await wipeLearning(db);
      // Session/learning caches → empty, then repopulate from the now-clean db.
      useTasksStore.getState().clear();
      usePlanStore.getState().reset();
      useTimerStore.getState().cancel();
      useCalibrationStore.getState().reset();
      await useCalibrationStore.getState().hydrate();
    } finally {
      setResetting(false);
    }
  }, [resetting]);

  const eraseEverything = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const db = await getDatabase();
      await wipeEverything(db);
      useTasksStore.getState().clear();
      usePlanStore.getState().reset();
      useTimerStore.getState().cancel();
      useCalibrationStore.getState().reset();
      useCategoriesStore.getState().reset();
      useSettingsStore.getState().reset();
      useVocabStore.getState().reset();
      useOnboardingStore.getState().reset();
      router.replace('/'); // Index re-redirects to welcome (completed === false)
    } finally {
      setResetting(false);
    }
  }, [resetting]);

  return { resetting, resetProgress, eraseEverything };
}
```

- [ ] **Step 2: Lint + typecheck + commit**

```bash
npx eslint src/features/settings/useAccountReset.ts
npm run typecheck
git add src/features/settings/useAccountReset.ts
git commit -m "feat(settings): add useAccountReset orchestration hook"
```

---

### Task 6: `dangerEdge` token + `AppButton` danger variant

**Files:**
- Modify: `src/theme/tokens.ts` (add `dangerEdge` to light + dark color sets)
- Modify: `src/components/AppButton.tsx`

**Interfaces:**
- Produces: `t.colors.dangerEdge`; `AppButton` accepts `variant="danger"` (filled red, white label, danger coin-edge).

- [ ] **Step 1: Add the token**

In `src/theme/tokens.ts`, next to each `danger:` entry add a darker edge:
- light (near line 153): after `danger: '#D14343',` add `dangerEdge: '#A82F2F',`
- dark (near line 208): after `danger: '#E06464',` add `dangerEdge: '#B84A4A',`

- [ ] **Step 2: Extend AppButton variants**

In `src/components/AppButton.tsx`:
- Widen the type: `type NewVariant = 'indigo' | 'amber' | 'ghost' | 'danger';`
- Add to each record:

```ts
  const bg: Record<NewVariant, string> = {
    indigo: t.colors.primary,
    amber: t.colors.accent,
    ghost: t.colors.surface,
    danger: t.colors.danger,
  };
  const fg: Record<NewVariant, string> = {
    indigo: t.colors.onIndigo,
    amber: t.colors.onAmber,
    ghost: t.colors.ink,
    danger: '#FFFFFF',
  };
  const edge: Record<NewVariant, string> = {
    indigo: t.colors.primaryEdge,
    amber: t.colors.accentEdge,
    ghost: 'transparent',
    danger: t.colors.dangerEdge,
  };
```

(`danger` is a filled variant — `isGhost` stays false, so it gets the coin-edge + drop-on-press for free.)

- [ ] **Step 3: Typecheck + lint + commit**

```bash
npm run typecheck
npx eslint src/theme/tokens.ts src/components/AppButton.tsx
git add src/theme/tokens.ts src/components/AppButton.tsx
git commit -m "feat(ui): add danger button variant + dangerEdge token"
```

---

### Task 7: `DataResetGlyph`

**Files:**
- Create: `src/components/DataResetGlyph.tsx`

**Interfaces:**
- Consumes: `useTheme`, reanimated, react-native-svg.
- Produces: `DataResetGlyph({ kind: 'progress' | 'erase', active?: boolean, size?: number })`. `progress` = amber counter-clockwise refresh arc around an indigo seed; `erase` = danger-tinted sweep over an indigo bin. One-shot meaning-mapped motion when `active` flips false→true; reduced-motion → still.

- [ ] **Step 1: Implement the glyph**

Create `src/components/DataResetGlyph.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// DataResetGlyph — Danger-zone member of the 24-box / 1.6-stroke glyph family
// (sibling of ReasonGlyph / AppearanceGlyph). Two kinds:
//   progress — amber counter-clockwise refresh arc around an indigo seed dot
//              ("start the growing over"). One-shot CCW spin on confirm.
//   erase    — danger sweep arc above an indigo bin ("clear it all out").
//              One-shot left sweep on confirm.
// `active` false→true triggers the one-shot; reduced-motion holds the rest state.
// erase uses the danger token (never amber) so the two states never read alike.
// ──────────────────────────────────────────────────────────────────────────────

const BOX = 24;
const SW = 1.6;

export function DataResetGlyph({
  kind,
  active = false,
  size = 22,
}: {
  kind: 'progress' | 'erase';
  active?: boolean;
  size?: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const indigo = t.colors.primary;
  const amber = t.colors.accent;
  const danger = t.colors.danger;

  const rot = useSharedValue(0);
  const tx = useSharedValue(0);

  const wasActive = useRef(active);
  useEffect(() => {
    const justActivated = active && !wasActive.current;
    wasActive.current = active;
    if (!justActivated || reduced) return;
    const spring = t.motion.spring;
    if (kind === 'progress') {
      rot.set(withSequence(withTiming(-300, { duration: 520 }), withSpring(0, spring)));
    } else {
      tx.set(withSequence(withTiming(-3, { duration: 90 }), withSpring(0, spring)));
    }
  }, [active, reduced, kind, rot, tx, t.motion.spring]);

  const anim = useAnimatedStyle(() => ({
    transform: kind === 'progress' ? [{ rotate: `${rot.get()}deg` }] : [{ translateX: tx.get() }],
  }));

  return (
    <Animated.View style={anim}>
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`} fill="none">
        {kind === 'progress' ? (
          <>
            {/* indigo seed at the centre */}
            <Circle cx={12} cy={12} r={2.2} fill={indigo} />
            {/* amber CCW refresh arc with an arrowhead at its head */}
            <Path
              d="M18 8 A7 7 0 1 0 19 12"
              stroke={amber}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            <Path
              d="M18.4 4.6 L18 8 L14.7 7"
              stroke={amber}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            {/* indigo bin body + lid */}
            <Path
              d="M7 8 H17 L16 19 a1.4 1.4 0 0 1 -1.4 1.3 H9.4 A1.4 1.4 0 0 1 8 19 Z"
              stroke={indigo}
              strokeWidth={SW}
              strokeLinejoin="round"
            />
            <Path d="M5.5 8 H18.5" stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
            <Path d="M10 8 V6 a1.2 1.2 0 0 1 1.2 -1.2 H12.8 A1.2 1.2 0 0 1 14 6 V8" stroke={indigo} strokeWidth={SW} strokeLinejoin="round" />
            {/* danger sweep accents inside the bin */}
            <Path d="M11 11.5 V16.5 M14 11.5 V16.5" stroke={danger} strokeWidth={SW} strokeLinecap="round" />
          </>
        )}
      </Svg>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Typecheck + lint + commit**

```bash
npm run typecheck
npx eslint src/components/DataResetGlyph.tsx
git add src/components/DataResetGlyph.tsx
git commit -m "feat(ui): add DataResetGlyph (progress + erase)"
```

---

### Task 8: `ConfirmSheet`

**Files:**
- Create: `src/components/ConfirmSheet.tsx`
- Test: `src/components/__tests__/ConfirmSheet.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useSafeAreaInsets`, `AppButton`, `AppText`, `DataResetGlyph`, reanimated, RN `Modal`/`Pressable`/`View`.
- Produces:

```ts
export interface ConfirmSheetProps {
  visible: boolean;
  tone: 'caution' | 'danger';
  glyphKind: 'progress' | 'erase';
  title: string;
  bullets: string[];
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}
```

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/ConfirmSheet.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ConfirmSheet } from '@/src/components/ConfirmSheet';

const baseProps = {
  visible: true,
  tone: 'danger' as const,
  glyphKind: 'erase' as const,
  title: 'Erase everything?',
  bullets: ['Deletes all of it.', 'Starts from the welcome screen.'],
  confirmLabel: 'Erase everything',
};

describe('ConfirmSheet', () => {
  it('renders title + bullets and fires onConfirm / onCancel', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByText } = render(
      <ConfirmSheet {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />,
    );
    getByText('Erase everything?');
    getByText('Deletes all of it.');
    fireEvent.press(getByText('Erase everything'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/ConfirmSheet.test.tsx`
Expected: FAIL — cannot find module `ConfirmSheet`.

- [ ] **Step 3: Implement the sheet**

Create `src/components/ConfirmSheet.tsx`:

```tsx
import { useEffect } from 'react';
import { Modal, Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { DataResetGlyph } from './DataResetGlyph';

// ──────────────────────────────────────────────────────────────────────────────
// ConfirmSheet — styled, reduced-motion-aware bottom-sheet confirmation for
// destructive actions (the Settings Danger Zone). NOT a native alert: it matches
// the app's surface + hairline + radii so a wipe feels considered, not alarming.
// Scrim fades in; the sheet springs up from the bottom. Reduced motion → instant.
// ──────────────────────────────────────────────────────────────────────────────

export interface ConfirmSheetProps {
  visible: boolean;
  tone: 'caution' | 'danger';
  glyphKind: 'progress' | 'erase';
  title: string;
  bullets: string[];
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({
  visible,
  tone,
  glyphKind,
  title,
  bullets,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const progress = useSharedValue(0); // 0 hidden → 1 shown
  useEffect(() => {
    const target = visible ? 1 : 0;
    if (reduced) {
      progress.set(target);
      return;
    }
    progress.set(
      visible
        ? withSpring(1, { damping: 18, stiffness: 240 })
        : withTiming(0, { duration: t.motion.fast }),
    );
  }, [visible, reduced, progress, t.motion.fast]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 40 }],
  }));

  const accent = tone === 'danger' ? t.colors.danger : t.colors.accent;

  const sheet: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[5],
    paddingTop: t.space[5],
    paddingBottom: insets.bottom + t.space[5],
    gap: t.space[4],
  };
  const headerRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const titleStyle: TextStyle = { color: t.colors.ink };
  const bulletRow: ViewStyle = { flexDirection: 'row', gap: t.space[2], alignItems: 'flex-start' };
  const dot: ViewStyle = {
    width: t.space[1.5],
    height: t.space[1.5],
    borderRadius: t.radii.full,
    backgroundColor: accent,
    marginTop: t.space[2],
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[{ position: 'absolute', inset: 0, backgroundColor: t.colors.scrim }, scrimStyle]}
        >
          <Pressable style={{ flex: 1 }} accessibilityLabel="Dismiss" onPress={onCancel} />
        </Animated.View>

        <Animated.View style={[sheet, sheetStyle]}>
          <View style={headerRow}>
            <DataResetGlyph kind={glyphKind} active={visible} size={t.iconSize.xl} />
            <AppText variant="title" style={titleStyle}>{title}</AppText>
          </View>

          <View style={{ gap: t.space[2] }}>
            {bullets.map((b) => (
              <View key={b} style={bulletRow}>
                <View style={dot} />
                <AppText variant="body" style={{ flex: 1, color: t.colors.inkSoft }}>{b}</AppText>
              </View>
            ))}
          </View>

          <View style={{ gap: t.space[2] }}>
            <AppButton
              label={confirmLabel}
              onPress={onConfirm}
              variant={tone === 'danger' ? 'danger' : 'amber'}
              fullWidth
            />
            <AppButton label="Cancel" onPress={onCancel} variant="ghost" fullWidth />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
```

> Note: confirm `AppText` `variant` names against `src/components/AppText.tsx` before finishing — use the existing title/body variants (e.g. `title`/`bodyLg`/`body`). Adjust the `variant` props to whatever that file actually exports; do not invent variants.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/ConfirmSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/components/ConfirmSheet.tsx src/components/__tests__/ConfirmSheet.test.tsx
git add src/components/ConfirmSheet.tsx src/components/__tests__/ConfirmSheet.test.tsx
git commit -m "feat(ui): add styled ConfirmSheet for destructive actions"
```

---

### Task 9: Wire the Danger Zone into Settings

**Files:**
- Modify: `src/app/settings.tsx`

**Interfaces:**
- Consumes: `useAccountReset`, `ConfirmSheet`, `DataResetGlyph`.
- Produces: a "Danger zone" section with two rows + their confirm sheets; `SettingRow` gains an optional `leading?: ReactNode` slot.

- [ ] **Step 1: Add a `leading` slot to `SettingRow`**

In `src/app/settings.tsx`, extend `SettingRow`'s props and content:
- Props: add `leading?: ReactNode;` (and make `icon?: IconName;` optional).
- In `content`, replace the leading icon line with:

```tsx
      {leading ?? <Ionicons name={icon as IconName} size={t.iconSize.md} color={tint ?? t.colors.inkSoft} />}
```

- [ ] **Step 2: Replace the `__DEV__` Developer block with the Danger Zone**

Remove the `handleReplayOnboarding` function and the `__DEV__ ? (...) : null` Developer section. Add this state near the other `useState` hooks:

```tsx
  const { resetting, resetProgress, eraseEverything } = useAccountReset();
  const [sheet, setSheet] = useState<null | 'progress' | 'erase'>(null);

  async function handleResetProgress() {
    setSheet(null);
    await resetProgress();
    showToast('Reset done — fresh slate.');
  }
  async function handleEraseEverything() {
    setSheet(null);
    await eraseEverything(); // navigates to onboarding; no toast needed
  }
```

Add the section as the LAST child of the `ScrollView` (after Appearance):

```tsx
        <View style={{ gap: t.space[3] }}>
          <AppText variant="label" style={{ color: t.colors.danger }}>Danger zone</AppText>
          <SettingRow
            leading={<DataResetGlyph kind="progress" size={t.iconSize.md} />}
            title="Reset progress"
            note="Forget what Whenbee learned — keep your setup."
            tint={t.colors.accent}
            onPress={() => setSheet('progress')}
            disabled={resetting}
          />
          <SettingRow
            leading={<DataResetGlyph kind="erase" size={t.iconSize.md} />}
            title="Erase everything"
            note="Wipe the app and start the welcome over."
            tint={t.colors.danger}
            onPress={() => setSheet('erase')}
            disabled={resetting}
          />
        </View>
```

Add the two sheets just before the closing `</Screen>` (next to `<Toast … />`):

```tsx
      <ConfirmSheet
        visible={sheet === 'progress'}
        tone="caution"
        glyphKind="progress"
        title="Reset your progress?"
        bullets={[
          'Clears every logged time and what Whenbee learned.',
          'Keeps your categories, look, and reminders.',
          'Your Whenbee keeps its name — just starts growing again.',
        ]}
        confirmLabel="Reset progress"
        onConfirm={handleResetProgress}
        onCancel={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={sheet === 'erase'}
        tone="danger"
        glyphKind="erase"
        title="Erase everything?"
        bullets={[
          'Deletes all of it — tasks, learning, categories, settings.',
          "You'll start from the welcome screen, like a fresh install.",
          "Pro isn't stored here — 'Restore purchases' brings it back.",
        ]}
        confirmLabel="Erase everything"
        onConfirm={handleEraseEverything}
        onCancel={() => setSheet(null)}
      />
```

Add imports at the top:

```tsx
import { useAccountReset } from '@/src/features/settings/useAccountReset';
import { ConfirmSheet } from '@/src/components/ConfirmSheet';
import { DataResetGlyph } from '@/src/components/DataResetGlyph';
```

Remove the now-unused `useOnboardingStore` import if `resetOnboarding`/`handleReplayOnboarding` were its only consumers.

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck
npx eslint src/app/settings.tsx
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings.tsx
git commit -m "feat(settings): add Danger Zone with progress + erase resets"
```

---

### Task 10: Full verification + manual sim pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full gates**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all pass, 0 warnings.

- [ ] **Step 2: Manual sim verification (per CLAUDE.md recipe)**

Run `npm run ios`. In the app:
1. Log a few tasks so there's data + companion growth; name the companion.
2. Settings → Danger zone → **Reset progress** → confirm. Verify: Today is empty, calibration is back to priors, categories + appearance + reminders unchanged, the companion keeps its name but its growth/tier reset.
3. Re-log data, then **Erase everything** → confirm. Verify the app lands on the welcome onboarding; after re-onboarding there is no prior data, no companion name, default appearance.
4. Toggle "Reduce Motion" in iOS settings and reopen a sheet — it should appear instantly with no animation.
5. Capture before/after screenshots with `xcrun simctl io booted screenshot` and eyeball spacing/alignment/tone (danger row red, progress row amber; sheet matches app surfaces).

- [ ] **Step 3: Final bundle commit (if any sim-driven tweaks)**

Use the `/init-cmt` skill to review and commit any remaining changes (per project rule). No AI attribution.

---

## Self-Review notes

- **Spec coverage:** wipeAll (T1), kv helpers (T2), two scopes incl. companion-identity keep (T3), store resets (T4), hook + navigation (T5), danger button/token (T6), glyph (T7), ConfirmSheet (T8), Danger Zone wiring + Developer-row removal (T9), tests + manual (T10). Vocab erase-only handled by KEEP_ON_PROGRESS (T3) + eraseEverything resetting vocab (T5). All spec sections mapped.
- **Type consistency:** `wipeLearning`/`wipeEverything` names match across T3/T5; `reset` action name consistent across stores T4/T5; `ConfirmSheetProps` consistent T8/T9; `DataResetGlyph` `kind`/`active`/`size` consistent T7/T8/T9; `danger` variant consistent T6/T8.
- **Open verifications flagged inline (not placeholders):** AppText variant names (T8 note) and Tier literal in the calibration test (T4 note) — both say exactly what to check and the fallback.
