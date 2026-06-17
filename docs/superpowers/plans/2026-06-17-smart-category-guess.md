# Smart Category Guess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Add-Task / Retro category guesser learn from the user's own confirmed picks, support custom categories, and tolerate word variants — all on-device and clock-free.

**Architecture:** A pure layer (`categoryGuess.ts`) does tokenize → stopword-filter → light-stem, then resolves a category by strict tiers **learned > custom-name > built-in**. A persisted `vocabStore` (Zustand + `zustandKv`) holds the learned map plus a monotonic `seq` integer (recency without `Date.now()`), and banks an association on every real commit. `useAddTask` and `useRetro` read the map to pre-pick and call `bank()` at their commit points.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Zustand + `persist`, `expo-sqlite/kv-store` (via `zustandKv`), Jest.

**Spec:** `docs/superpowers/specs/2026-06-17-smart-category-guess-design.md`

---

## File Structure

- **Modify** `src/features/shared/categoryGuess.ts` — add `tokenizeStems`, `stem`, stopwords, the `LearnedMap` / `GuessContext` types, the tiered `guessCategory(title, ctx?)`, and `bankAssociation`. Pure; no React, no clock.
- **Modify** `src/features/shared/__tests__/categoryGuess.test.ts` — extend; keep the existing 12 tests green.
- **Create** `src/stores/vocabStore.ts` — persisted learned-map store with `bank()`.
- **Create** `src/stores/__tests__/vocabStore.test.ts`.
- **Modify** `src/features/add-task/useAddTask.ts` — pass `ctx` to `guessCategory`, `bank()` on commit.
- **Modify** `src/features/retro/useRetro.ts` — learned-aware pre-pick + `bank()` on save.
- **Modify** `src/app/(modals)/retro.tsx` — pass `guessedId` + `usage` to the chips.

Backward compatibility: `guessCategory`'s second arg is **optional**. Called with a title only (as the 12 existing tests do), it behaves exactly as today (built-in tier).

---

## Task 1: Tokenize + stopwords + light stemmer (pure)

**Files:**
- Modify: `src/features/shared/categoryGuess.ts`
- Test: `src/features/shared/__tests__/categoryGuess.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/features/shared/__tests__/categoryGuess.test.ts` — update the import line first:

```ts
import { guessCategory, sortPickerCategories, tokenizeStems } from '../categoryGuess';
```

Then add this block after the existing `describe('guessCategory', …)`:

```ts
describe('tokenizeStems', () => {
  it('lowercases, splits, and drops stopwords', () => {
    expect(tokenizeStems('Reply TO that Email')).toEqual(['reply', 'email']);
  });

  it('stems common variants to a shared root', () => {
    expect(tokenizeStems('emailing emails emailed')).toEqual(['email', 'email', 'email']);
    expect(tokenizeStems('cleaning cleaned')).toEqual(['clean', 'clean']);
    expect(tokenizeStems('groceries')).toEqual(['grocery']);
  });

  it('does not over-stem short words', () => {
    expect(tokenizeStems('is as')).toEqual([]); // both stopwords
    expect(tokenizeStems('buy gym')).toEqual(['buy', 'gym']); // len<4, untouched
  });

  it('returns empty for blank or punctuation-only input', () => {
    expect(tokenizeStems('   ')).toEqual([]);
    expect(tokenizeStems('!!! ???')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/shared/__tests__/categoryGuess.test.ts -t tokenizeStems`
Expected: FAIL — `tokenizeStems is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/features/shared/categoryGuess.ts`, replace the existing `tokenize` function (lines ~22-25) with the following. Keep everything else in the file for now.

```ts
/** Filler words that carry no category signal — dropped before matching/banking. */
const STOPWORDS: ReadonlySet<string> = new Set([
  'to', 'that', 'the', 'a', 'an', 'of', 'for', 'my', 'this', 'some',
  'and', 'on', 'in', 'it', 'is', 'up', 'do',
]);

/**
 * Light suffix stemmer — NOT full Porter. Collapses common inflections so
 * `emailing/emails/emailed → email` and `cleaning/cleaned → clean`, while
 * leaving short words (`is`, `buy`, `gym`) intact. Only stems when the root
 * stays ≥ 3 chars so we never strip a word down to noise.
 */
function stem(word: string): string {
  if (word.length < 4) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  for (const suffix of ['ing', 'ed', 'ly', 'es', 's'] as const) {
    if (word.endsWith(suffix)) {
      const base = word.slice(0, -suffix.length);
      if (base.length >= 3) return base;
    }
  }
  return word;
}

/** Lowercase content stems of a title: split → drop stopwords → stem. */
export function tokenizeStems(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w))
    .map(stem)
    .filter(Boolean);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/shared/__tests__/categoryGuess.test.ts -t tokenizeStems`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/categoryGuess.ts src/features/shared/__tests__/categoryGuess.test.ts
git commit -m "feat: add stopword-filtered light stemmer for category guess"
```

---

## Task 2: Tiered guessCategory (learned > custom-name > built-in)

**Files:**
- Modify: `src/features/shared/categoryGuess.ts`
- Test: `src/features/shared/__tests__/categoryGuess.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/features/shared/__tests__/categoryGuess.test.ts`. Update the import to include the new type:

```ts
import { guessCategory, sortPickerCategories, tokenizeStems, type LearnedMap } from '../categoryGuess';
```

Then add:

```ts
describe('guessCategory with context', () => {
  const cat = (id: string, name: string) => ({ id, name, adaptSpeed: 'balanced' as const });

  it('still works built-in only when no context is passed', () => {
    expect(guessCategory('Reply to that email')).toBe('admin');
  });

  it('learned association beats the built-in keyword list', () => {
    // "email" would map to admin built-in, but the user has taught it → errands
    const learned: LearnedMap = { email: { errands: { count: 3, lastSeq: 9 } } };
    expect(
      guessCategory('forward the email', { learned, availableIds: ['admin', 'errands'] }),
    ).toBe('errands');
  });

  it('custom category name beats built-in when nothing is learned', () => {
    const namedCats = [cat('gym', 'Gym'), cat('admin', 'Admin & email')];
    expect(
      guessCategory('morning gym session', { namedCats, availableIds: ['gym', 'admin'] }),
    ).toBe('gym');
  });

  it('learned beats a custom-name match', () => {
    const learned: LearnedMap = { gym: { admin: { count: 2, lastSeq: 5 } } };
    const namedCats = [cat('gym', 'Gym'), cat('admin', 'Admin & email')];
    expect(
      guessCategory('gym', { learned, namedCats, availableIds: ['gym', 'admin'] }),
    ).toBe('admin');
  });

  it('breaks equal learned counts by most recent (higher lastSeq)', () => {
    const learned: LearnedMap = {
      walk: { errands: { count: 2, lastSeq: 4 }, getting_ready: { count: 2, lastSeq: 8 } },
    };
    expect(
      guessCategory('walk', { learned, availableIds: ['errands', 'getting_ready'] }),
    ).toBe('getting_ready');
  });

  it('skips a learned id that is no longer available (deleted category)', () => {
    const learned: LearnedMap = { email: { ghost: { count: 5, lastSeq: 9 } } };
    // ghost not in availableIds → falls through to built-in → admin
    expect(guessCategory('email', { learned, availableIds: ['admin'] })).toBe('admin');
  });

  it('returns null for an all-stopword title', () => {
    expect(guessCategory('to the')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/shared/__tests__/categoryGuess.test.ts -t "guessCategory with context"`
Expected: FAIL — context arg ignored / `LearnedMap` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/features/shared/categoryGuess.ts`:

(a) Add the types and a stemmed-keyword index near the top, after the `GUESS_KEYWORDS` constant:

```ts
/** Per-stem learned vote: how many times a stem was banked to a category, and
 *  the highest `seq` (recency) at which it happened. */
export type LearnedMap = Record<string, Record<string, { count: number; lastSeq: number }>>;

/** Optional signals that make the guess smarter than the built-in keyword list. */
export interface GuessContext {
  /** Per-stem → category counts learned from the user's confirmed picks. */
  learned?: LearnedMap;
  /** Tracked categories (id + display name) for name-word matching. */
  namedCats?: readonly { id: string; name: string }[];
  /** Ids the picker is currently showing; a guess outside this set is dropped. */
  availableIds?: readonly string[];
}

/** Built-in keywords, pre-stemmed once so title stems match inflected keywords. */
const STEMMED_KEYWORDS: readonly (readonly [string, ReadonlySet<string>])[] =
  GUESS_KEYWORDS.map(([id, kws]) => [id, new Set(kws.map(stem))] as const);
```

(b) Replace the existing `guessCategory` function body entirely with the tiered version:

```ts
/**
 * Best-effort category id for a title, or null. Resolves by strict tiers:
 *   1. learned (the user's own banked picks) — max count, recency tiebreak
 *   2. custom-name (a tracked category whose NAME contains a title word)
 *   3. built-in keyword list (legacy behavior)
 * Only ever returns an id present in `ctx.availableIds` (when provided), so a
 * guess at a deleted category falls through to the next tier.
 */
export function guessCategory(title: string, ctx: GuessContext = {}): string | null {
  const stems = tokenizeStems(title);
  if (stems.length === 0) return null;
  const stemSet = new Set(stems);
  const avail = ctx.availableIds ? new Set(ctx.availableIds) : null;
  const ok = (id: string): boolean => avail === null || avail.has(id);

  // Tier 1 — learned.
  if (ctx.learned) {
    const tally: Record<string, { count: number; lastSeq: number }> = {};
    for (const s of stems) {
      const entry = ctx.learned[s];
      if (!entry) continue;
      for (const [id, v] of Object.entries(entry)) {
        if (!ok(id)) continue;
        const acc = tally[id] ?? { count: 0, lastSeq: 0 };
        tally[id] = { count: acc.count + v.count, lastSeq: Math.max(acc.lastSeq, v.lastSeq) };
      }
    }
    let best: { id: string; count: number; lastSeq: number } | null = null;
    for (const [id, t] of Object.entries(tally)) {
      if (
        best === null ||
        t.count > best.count ||
        (t.count === best.count && t.lastSeq > best.lastSeq)
      ) {
        best = { id, count: t.count, lastSeq: t.lastSeq };
      }
    }
    if (best) return best.id;
  }

  // Tier 2 — custom (tracked) category name words.
  if (ctx.namedCats && ctx.namedCats.length > 0) {
    let best: { id: string; hits: number } | null = null;
    for (const c of ctx.namedCats) {
      if (!ok(c.id)) continue;
      const nameStems = new Set(tokenizeStems(c.name));
      let hits = 0;
      for (const s of stemSet) if (nameStems.has(s)) hits += 1;
      if (hits > 0 && (best === null || hits > best.hits)) best = { id: c.id, hits };
    }
    if (best) return best.id;
  }

  // Tier 3 — built-in keyword list (stemmed).
  let bestId: string | null = null;
  let bestScore = 0;
  for (const [id, kwSet] of STEMMED_KEYWORDS) {
    if (!ok(id)) continue;
    let score = 0;
    for (const s of stemSet) if (kwSet.has(s)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestScore > 0 ? bestId : null;
}
```

- [ ] **Step 4: Run the whole file to verify new + existing pass**

Run: `npx jest src/features/shared/__tests__/categoryGuess.test.ts`
Expected: PASS — the original 12 + Task 1's 4 + the 7 new context tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/categoryGuess.ts src/features/shared/__tests__/categoryGuess.test.ts
git commit -m "feat: resolve category guess by learned, custom-name, built-in tiers"
```

---

## Task 3: bankAssociation (pure)

**Files:**
- Modify: `src/features/shared/categoryGuess.ts`
- Test: `src/features/shared/__tests__/categoryGuess.test.ts`

- [ ] **Step 1: Write the failing test**

Update the import:

```ts
import {
  guessCategory,
  sortPickerCategories,
  tokenizeStems,
  bankAssociation,
  type LearnedMap,
} from '../categoryGuess';
```

Add:

```ts
describe('bankAssociation', () => {
  it('increments the count for each content stem under the chosen category', () => {
    const map = bankAssociation({}, 'fold the laundry', 'cleaning', 1);
    expect(map.fold?.cleaning).toEqual({ count: 1, lastSeq: 1 });
    expect(map.laundry?.cleaning).toEqual({ count: 1, lastSeq: 1 });
    expect(map.the).toBeUndefined(); // stopword not banked
  });

  it('accumulates counts and records the latest seq', () => {
    let map: LearnedMap = bankAssociation({}, 'gym', 'fitness', 1);
    map = bankAssociation(map, 'gym', 'fitness', 4);
    expect(map.gym?.fitness).toEqual({ count: 2, lastSeq: 4 });
  });

  it('keeps competing categories for the same stem side by side', () => {
    let map: LearnedMap = bankAssociation({}, 'walk', 'errands', 1);
    map = bankAssociation(map, 'walk', 'getting_ready', 2);
    expect(map.walk?.errands).toEqual({ count: 1, lastSeq: 1 });
    expect(map.walk?.getting_ready).toEqual({ count: 1, lastSeq: 2 });
  });

  it('does not mutate the input map', () => {
    const map: LearnedMap = {};
    bankAssociation(map, 'gym', 'fitness', 1);
    expect(map).toEqual({});
  });

  it('is a no-op for an all-stopword title', () => {
    const map: LearnedMap = { gym: { fitness: { count: 1, lastSeq: 1 } } };
    expect(bankAssociation(map, 'to the', 'errands', 9)).toBe(map);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/shared/__tests__/categoryGuess.test.ts -t bankAssociation`
Expected: FAIL — `bankAssociation is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/features/shared/categoryGuess.ts`:

```ts
/**
 * Bank a title → category association at sequence `seq`. For each content stem
 * in the title, bumps `count` for `catId` and stamps `lastSeq = seq`. Pure:
 * returns a new map and never mutates the input. No-op (returns the same
 * reference) when the title has no content stems.
 */
export function bankAssociation(
  map: LearnedMap,
  title: string,
  catId: string,
  seq: number,
): LearnedMap {
  const stems = tokenizeStems(title);
  if (stems.length === 0) return map;
  const next: LearnedMap = { ...map };
  for (const s of stems) {
    const entry = { ...(next[s] ?? {}) };
    const prev = entry[catId] ?? { count: 0, lastSeq: 0 };
    entry[catId] = { count: prev.count + 1, lastSeq: seq };
    next[s] = entry;
  }
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/shared/__tests__/categoryGuess.test.ts -t bankAssociation`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/categoryGuess.ts src/features/shared/__tests__/categoryGuess.test.ts
git commit -m "feat: add bankAssociation to learn title-word category links"
```

---

## Task 4: vocabStore (persisted learned map)

**Files:**
- Create: `src/stores/vocabStore.ts`
- Test: `src/stores/__tests__/vocabStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/stores/__tests__/vocabStore.test.ts`:

```ts
import { useVocabStore } from '../vocabStore';
import { guessCategory } from '@/src/features/shared/categoryGuess';

describe('vocabStore', () => {
  beforeEach(() => useVocabStore.setState({ map: {}, seq: 0 }));

  it('banks a title under a category and ticks seq', () => {
    useVocabStore.getState().bank('fold the laundry', 'cleaning');
    const { map, seq } = useVocabStore.getState();
    expect(seq).toBe(1);
    expect(map.laundry?.cleaning).toEqual({ count: 1, lastSeq: 1 });
  });

  it('accumulates counts across banks and advances seq each call', () => {
    const { bank } = useVocabStore.getState();
    bank('gym', 'fitness');
    bank('gym', 'fitness');
    const { map, seq } = useVocabStore.getState();
    expect(seq).toBe(2);
    expect(map.gym?.fitness).toEqual({ count: 2, lastSeq: 2 });
  });

  it('resolves conflicts by count, then by most recent seq', () => {
    const { bank } = useVocabStore.getState();
    bank('walk', 'errands'); // seq 1
    bank('walk', 'getting_ready'); // seq 2 — equal count, more recent
    const guess = guessCategory('walk', {
      learned: useVocabStore.getState().map,
      availableIds: ['errands', 'getting_ready'],
    });
    expect(guess).toBe('getting_ready');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/stores/__tests__/vocabStore.test.ts`
Expected: FAIL — cannot find module `../vocabStore`.

- [ ] **Step 3: Write minimal implementation**

Create `src/stores/vocabStore.ts` (mirrors `categoriesStore.ts`'s persist setup):

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import { bankAssociation, type LearnedMap } from '@/src/features/shared/categoryGuess';

// ──────────────────────────────────────────────────────────────────────────────
// vocabStore — on-device learned vocabulary for the category guesser. Maps task
// title stems → the categories the user actually picked, banked on every real
// commit (Add-Task confirm, Retro "forgot to log"). `seq` is a monotonic integer
// stamped on each bank so recency can break count ties WITHOUT a clock — the
// guesser stays deterministic and the engine purity invariant holds.
//   • No network — pure local KV.
//   • bank() is the only writer; the guesser reads `map` to pre-pick.
// ──────────────────────────────────────────────────────────────────────────────

interface VocabState {
  /** stem → { categoryId → { count, lastSeq } }. */
  map: LearnedMap;
  /** Monotonic bank counter; provides recency ordering without Date.now(). */
  seq: number;
  /** Learn a title → category link. Bumps counts and ticks seq. */
  bank: (title: string, catId: string) => void;
}

export const useVocabStore = create<VocabState>()(
  persist(
    (set, get) => ({
      map: {},
      seq: 0,
      bank: (title, catId) => {
        const nextSeq = get().seq + 1;
        set({ map: bankAssociation(get().map, title, catId, nextSeq), seq: nextSeq });
      },
    }),
    { name: 'vocab', storage: createJSONStorage(() => zustandKv) },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/stores/__tests__/vocabStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/vocabStore.ts src/stores/__tests__/vocabStore.test.ts
git commit -m "feat: add vocabStore to persist the learned category vocabulary"
```

---

## Task 5: Wire useAddTask (smart pre-pick + bank on commit)

**Files:**
- Modify: `src/features/add-task/useAddTask.ts`

No new unit test — the pure logic and the store are already covered. This task wires existing, tested pieces together.

- [ ] **Step 1: Import the store and the guess context**

At the top of `src/features/add-task/useAddTask.ts`, the `guessCategory` import already exists. Add the vocab store import next to the other store imports:

```ts
import { useVocabStore } from '@/src/stores/vocabStore';
```

- [ ] **Step 2: Read the learned map + bank action inside the hook**

Just after `const categories = usePickerCategories();` (around line 54), add:

```ts
  const learned = useVocabStore((s) => s.map);
  const bank = useVocabStore((s) => s.bank);
```

- [ ] **Step 3: Pass context into the live guess**

Replace the existing `setTitle` (lines ~65-71):

```ts
  const setTitle = (s: string) => {
    setTitleState(s);
    if (manualRef.current) return;
    const g = guessCategory(s);
    setGuessedCategory(g);
    setCategoryState(g);
  };
```

with the context-aware version:

```ts
  const setTitle = (s: string) => {
    setTitleState(s);
    if (manualRef.current) return;
    const g = guessCategory(s, {
      learned,
      namedCats: categories,
      availableIds: categories.map((c) => c.id),
    });
    setGuessedCategory(g);
    setCategoryState(g);
  };
```

- [ ] **Step 4: Bank the association on each real commit**

In `addToToday` (after `addTask({ … })`, before `return true`):

```ts
  const addToToday = (): boolean => {
    if (!canSubmit || category === null) return false;
    addTask({ label: title.trim(), category, guessMin });
    bank(title.trim(), category);
    return true;
  };
```

In `onAddAndStart` (after `const task = addTask({ … });`, before `router.replace`):

```ts
    const task = addTask({ label: title.trim(), category, guessMin });
    bank(title.trim(), category);
```

- [ ] **Step 5: Typecheck + lint the file**

Run: `npx tsc --noEmit && npx eslint src/features/add-task/useAddTask.ts`
Expected: no errors, no warnings.

- [ ] **Step 6: Commit**

```bash
git add src/features/add-task/useAddTask.ts
git commit -m "feat: make Add-Task guess learned-aware and bank picks on commit"
```

---

## Task 6: Wire useRetro (pre-pick + bank on save)

**Files:**
- Modify: `src/features/retro/useRetro.ts`
- Modify: `src/app/(modals)/retro.tsx`

- [ ] **Step 1: Add imports + the result field to the hook**

In `src/features/retro/useRetro.ts`, add imports near the top:

```ts
import { useRef } from 'react';
import { useVocabStore } from '@/src/stores/vocabStore';
import { guessCategory } from '@/src/features/shared/categoryGuess';
```

> Note: `useEffect`/`useState` are already imported from `'react'` on line 1 — add `useRef` to that existing import instead of duplicating the line if your linter prefers (`import { useEffect, useRef, useState } from 'react';`).

Add `guessedCategory` and `usage` to the `UseRetroResult` interface (alongside `category`):

```ts
  /** Auto-guessed category id while it's still the active pick (null after a
   *  manual override). Drives the ✦ marker on the chip. */
  guessedCategory: string | null;
  /** Per-category usage counts for the frequency-sorted picker row. */
  usage: Record<string, number>;
```

- [ ] **Step 2: Add the pre-pick state, learned read, and bank action**

Inside `useRetro`, after the existing `const [category, setCategory] = useState…` and `const [label, setLabel] = useState('')` lines, replace the raw `label` state wiring with guess-aware versions. First add:

```ts
  const learned = useVocabStore((s) => s.map);
  const bank = useVocabStore((s) => s.bank);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  const [guessedCategory, setGuessedCategory] = useState<string | null>(null);
  const manualRef = useRef(false);

  const usage: Record<string, number> = {};
  for (const [id, s] of Object.entries(statsByCategory)) usage[id] = s.n;
```

> `useCalibrationStore` is already imported at the top of the file. `statsByCategory` exposes `.n` per category (same shape `useAddTask` reads).

- [ ] **Step 3: Replace setCategory + setLabel with guess-aware wrappers**

The hook currently returns the raw `setCategory`/`setLabel` state setters. Wrap them. Add these and return the wrapped versions:

```ts
  const setLabelGuessed = (s: string) => {
    setLabel(s);
    if (manualRef.current) return;
    const g = guessCategory(s, {
      learned,
      namedCats: categories,
      availableIds: categories.map((c) => c.id),
    });
    setGuessedCategory(g);
    setCategory(g);
  };

  const setCategoryManual = (id: string) => {
    manualRef.current = true;
    setGuessedCategory(null);
    setCategory(id);
  };
```

> `setCategory`'s state type is `string | null`, so `setCategory(g)` (where `g` may be null) typechecks.

- [ ] **Step 4: Bank on save + return the new fields**

In `onSave`, after the `applyLog({ … })` call resolves and before `router.replace('/(modals)/reward')`, add:

```ts
    if (trimmedLabel) bank(trimmedLabel, category);
```

Update the returned object: expose `setCategory: setCategoryManual`, `setLabel: setLabelGuessed`, plus `guessedCategory` and `usage`:

```ts
  return {
    categories,
    category,
    setCategory: setCategoryManual,
    label,
    setLabel: setLabelGuessed,
    guessMin,
    setGuessMin,
    actualMin,
    setActualMin,
    canSave,
    onSave,
    guessedCategory,
    usage,
  };
```

- [ ] **Step 5: Pass guessedId + usage to the chips in the retro screen**

In `src/app/(modals)/retro.tsx`, replace line 74:

```tsx
          <CategoryChips categories={r.categories} value={r.category} onChange={r.setCategory} />
```

with:

```tsx
          <CategoryChips
            categories={r.categories}
            value={r.category}
            onChange={r.setCategory}
            guessedId={r.guessedCategory}
            usage={r.usage}
          />
```

- [ ] **Step 6: Run the retro tests + typecheck + lint**

Run: `npx jest src/features/retro && npx tsc --noEmit && npx eslint src/features/retro/useRetro.ts "src/app/(modals)/retro.tsx"`
Expected: existing retro tests PASS, no type errors, no lint warnings.

> If an existing retro test asserts on `setLabel`/`setCategory` identity or the result shape, update it to match the new guess-aware wrappers — the behavior (saving a log) is unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/features/retro/useRetro.ts "src/app/(modals)/retro.tsx"
git commit -m "feat: pre-pick and learn the category in the Retro log flow"
```

---

## Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the 12 original `categoryGuess` tests, the new pure-layer tests, and `vocabStore`.

- [ ] **Step 2: Lint + typecheck the whole project**

Run: `npm run lint && npm run typecheck`
Expected: 0 warnings, 0 type errors.

- [ ] **Step 3: Manual smoke (simulator)**

Per `CLAUDE.md`, there is no CLI tap. With `npm run ios` running:
1. Open Add-Task, type `email the landlord` → **Admin & email** pre-picked with the ✦ bulb.
2. Override to **Errands**, set a guess, **Add to today**.
3. Reopen Add-Task, type `email the plumber` → now **Errands** pre-picked (learned beat built-in).
4. Add a custom category **Gym**; type `morning gym` → **Gym** pre-picked (custom-name tier).

- [ ] **Step 4: Final commit (only if smoke surfaced a fix)**

```bash
git add -A
git commit -m "fix: <describe any smoke-test fix>"
```

---

## Self-Review Notes

- **Spec coverage:** stemmer + stopwords (Task 1), tiered precedence learned>custom>built-in + availability filter (Task 2), banking with recency seq (Task 3), persisted store (Task 4), Add-Task wiring + bank-on-commit (Task 5), Retro pre-pick + bank-on-save (Task 6), invariants verified (Task 7). All spec sections mapped.
- **Backward compat:** `guessCategory(title)` keeps its 1-arg form; the 12 existing tests are untouched and asserted green in Task 2 Step 4.
- **Type consistency:** `LearnedMap`, `GuessContext`, `bankAssociation(map,title,catId,seq)`, `useVocabStore` `{ map, seq, bank }` names match across Tasks 2–6.
- **Clock-free:** recency via `seq` only; no `Date.now()` anywhere — engine/pure-layer purity preserved.
