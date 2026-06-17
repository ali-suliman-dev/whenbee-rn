# Smart Category Guess — Design

**Date:** 2026-06-17
**Status:** Approved, ready for implementation plan

## Problem

The Add-Task category picker auto-selects a category from the task title, but the
guesser (`src/features/shared/categoryGuess.ts`) is a fixed dictionary:

- Only the **6 built-in seed categories** can be guessed (`admin`, `errands`,
  `cleaning`, `cooking`, `creative`, `getting_ready`). Custom categories the user
  adds are **never** pre-picked.
- **Exact whole-word match only** — `email` hits, `emailing` misses. No stemming,
  no synonyms beyond the hardcoded list, no semantic understanding.
- **No learning.** Override the guess for the same phrase 50 times and it forgets
  every time.

Result: it fails exactly when the user expects help — on their own custom
categories and on task wording that doesn't literally contain a keyword.

## Goal

Make the guesser learn from the user's own confirmed picks, support custom
categories, and tolerate word variants — all on-device, clock-free, no network.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Learn trigger | Bank on **commit only**: confirmed task (Add-Task) + "forgot to log" (Retro save). No banking from idle typing. |
| Precedence | **Learned > custom-name > built-in.** The user's own corrections always win. |
| Conflict / decay | **Highest count wins, recent-weighted.** Count per (stem→category); tie broken by most recent (`lastSeq`). Never fully forgets. |
| Match fidelity | **Stopword-filtered + light stem.** Drop filler words; `emailing/emails/emailed → email`, `cleaning/cleaned → clean`. |

## Architecture

```
useAddTask / useRetro  ──reads──>  guessCategory(title, ctx)   [PURE, categoryGuess.ts]
        │                                   ▲
        │ on commit                         │ ctx = { learned, customCats, availableIds }
        └──bank(title, catId)──> vocabStore ─┘  [persisted via zustandKv]
```

**Layers (one-directional, matches repo convention):**

- **Pure layer** — `src/features/shared/categoryGuess.ts` (extended). No React, no
  `Date`, no clock. Tokenize → stopword-filter → stem; `guessCategory(title, ctx)`
  applies the precedence tiers; `bankAssociation(map, title, catId, seq)` returns a
  new map. Exhaustively unit-tested.
- **Store layer** — `src/stores/vocabStore.ts` (new). Zustand + `persist` over
  `zustandKv`, `name: 'vocab'`. Holds the `LearnedMap` + a monotonic `seq` integer.
  Exposes `bank(title, catId)`. Recency uses `seq` (ticks per bank), **not**
  `Date.now()` — preserves engine purity and deterministic tests.
- **Wiring** — `useAddTask` and `useRetro` read the map + picker categories to build
  `ctx`, and call `bank()` at their commit points.

## Algorithm

### Tokenize → filter → stem

Applied uniformly to titles, custom-category names, and built-in keywords.

1. Lowercase, split on non-alphanumeric (`[^a-z0-9]+`), drop empties.
2. Drop **stopwords**: `to, that, the, a, an, of, for, my, this, some, and, on,
   in, it, is, up, do`. (Filler only — never content words.)
3. **Light stemmer** (not full Porter): strip a trailing `ies`→`y`, else strip
   trailing `ing` / `ed` / `ly` / `es` / `s`. Only stem if the result length ≥ 3,
   so `emails/emailing/emailed → email`, `cleaning/cleaned → clean`, while `is`,
   `as` stay intact.

### Scoring — collect votes, resolve by tier

For each title stem, collect candidate votes from three sources:

- **Learned** — `LearnedMap[stem]` → `{ catId: { count, lastSeq } }`. Weight =
  `count`; recency tiebreak = `lastSeq`.
- **Custom-name** — stem appears in a tracked custom category's stemmed name →
  that category.
- **Built-in** — stem in `GUESS_KEYWORDS` → seed id.

Resolve by **strict tiers** (highest non-empty tier wins):

1. Any **learned** votes → category with max total `count`; tie → max `lastSeq`.
2. else any **custom-name** votes → category with most stem hits; tie →
   category-list order.
3. else any **built-in** votes → max keyword hits; tie → `GUESS_KEYWORDS` order
   (current behavior preserved).
4. else → `null`.

**Availability filter:** only return an id present in `ctx.availableIds` (the ids
the picker is showing). A learned/custom id whose category was deleted falls
through to the next tier instead of pre-picking a ghost.

### Banking

`bankAssociation(map, title, catId, seq)` — pure, returns a new map:

- For each content stem in the title: `map[stem][catId].count += 1`,
  `map[stem][catId].lastSeq = seq`.
- The store ticks `seq` by 1 on each `bank()` call and passes the new value in.

`LearnedMap = Record<stem, Record<catId, { count: number; lastSeq: number }>>`

Recency stays deterministic: `count` drives the pick, `lastSeq` breaks ties and
lets a newer habit overtake on equal counts. Old counts persist — never zeroed.

## Wiring

- **`src/features/add-task/useAddTask.ts`** — build `ctx` from `vocabStore.map` +
  `usePickerCategories()` (ids + names + availableIds). Pass `ctx` to
  `guessCategory` inside `setTitle`. Call `vocab.bank(title, category)` inside
  `onAddAndStart` and `addToToday` (real commits only).
- **`src/features/retro/useRetro.ts`** — add learned-aware pre-pick on `setLabel`
  (mirror the add-task `manualRef` override pattern so a hand pick is never
  overwritten). Call `vocab.bank(label, category)` inside `onSave` (the
  "forgot to log" bank). Retro gains pre-pick it didn't have before.
- **`CategoryChips`** — no change. It already floats `guessedId` first, marks it
  with the bulb, and highlights the selection. The guess just gets smarter.

## Edge cases

- Empty title / all-stopword title → `null` (no pre-pick).
- Learned/custom id pointing at a deleted category → filtered by `availableIds`.
- Custom name that slugs to a built-in id (e.g. user names one "Admin") → the
  custom entry already wins its own id via the existing picker merge; unaffected.
- Map growth — unbounded but tiny (hundreds of stems max for a real user). No cap
  now (YAGNI); revisit only if it ever proves a problem.

## Testing (TDD — tests first)

**Pure** (`src/features/shared/__tests__/categoryGuess.test.ts`, extend; keep the
12 existing green):

- Stemmer: `emailing → email`, `cleaned → clean`, guard `is`/`as` un-stemmed.
- Stopword drop: `to/that/the` contribute no votes.
- Precedence: learned beats built-in; custom-name beats built-in; learned beats
  custom-name.
- Recent-weight: equal counts resolved by higher `lastSeq`.
- Availability filter: learned id absent from `availableIds` → falls through.
- Empty / all-stopword → `null`.

**Store** (`src/stores/__tests__/vocabStore.test.ts`, new):

- `bank` increments the right (stem, catId) count and ticks `seq`.
- Conflicting banks resolve by `count`, then `lastSeq`.
- Persistence round-trip via `zustandKv`.

## Invariants honored

- **On-device-only** — no network in guess or bank.
- **Clock-free** — `seq` integer, never `Date.now()`. Engine/pure layer stays
  deterministic.
- **No guilt** — pre-pick is a silent helpful default; override is one tap, zero
  penalty, no shame copy.

## Out of scope (YAGNI)

- On-device LLM / embeddings (kills zero-friction boot; overkill).
- Synonym dictionaries beyond stemming.
- Map size cap / eviction.
- Cross-device sync of the learned map.
