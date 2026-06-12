# Whenbee MVP — Finish Plan (Phases A–F)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the Whenbee build from "core loop + calibration + planner are real" to a **shippable MVP** — adding the **Reclaim Bank** (the new tangible-payoff layer), the real **Honeycomb + Whenbee companion** surfaces, **reason capture**, the **retention funnel + D7**, **native presence**, the single **Pro gate** (paywall + Honest-Day calendar), the lean **Patterns** tab, and **a11y/perf/copy polish** — then beta + launch.

**Architecture:** Unchanged one-way layering — `src/engine` (pure TS) ← `src/db` (port `Database` + memory/sqlite adapters + repos) ← `src/stores` (Zustand) ← `src/features` + `src/app` (expo-router). The new Reclaim layer adds **exactly one pure engine function** (`reclaimDividendMinutes`) + additive monotonic DB fields; it touches **none** of the calibration math (`02-ENGINE.md` moat). All new UI is **token-driven** off `src/theme/tokens.ts` and copies the conventions of the already-built screens.

**Tech Stack (locked — do not change):** Expo SDK 54 · RN 0.81.5 · React 19.1 · TS strict (`noUncheckedIndexedAccess`) · expo-router 6 typed routes · gluestack-ui v3 · NativeWind 4.2 · Zustand 5 · expo-sqlite 16 + `src/lib/kv.ts` · react-native-svg · **Reanimated 4** (`.get()/.set()`, never `.value`) · react-native-purchases (Expo-Go-guarded) · expo-calendar · PostHog · Sentry · Jest + RNTL.

---

## WHERE WE ARE (assessed 2026-06-12, do not re-derive)

**Done & real (typecheck/lint/test green · 32 test files):**

- **Phase 0** — Flat Tactical tokens (`src/theme/tokens.ts`, rich: colors light/dark, radii, motion durations + spring, type-role scale), fonts, domain types (core), 4-tab IA (`Today/Plan/Whenbee/Patterns`) + modal routes, tactile primitives (`AppButton`, `Card`, `Chip`, `HonestNumber`, `Toast`, `TierTrail`, `Screen`, `ScreenHeader`, `WhenbeeTabBar`).
- **Phase 1** — Engine (`constants, priors, ratio, ewma, multiplier, sharpness, insight, trend, update, planner, index` — all TDD); DB port `Database` + `memoryDatabase`/`sqliteDatabase` + migration runner + repos (`taskEventsRepo`, `categoryStatsRepo`, `recurringRepo`); stores (`calibrationStore`, `timerStore`, `categoriesStore`, `planStore`, `rewardStore`, `tasksStore`, `onboardingStore`, `settingsStore`); onboarding (3 steps); Today (FocusCard + honest number + provenance + OptimismNudge + FAB + log chip); Timer (Reanimated finish-time ring + amber over-state + pause/resume active-time-only + Stop&log → reward); Reward/Retro/Add-task basic loop.
- **Phase 2** — Category-detail (HonestCard, AhaCard **[free aha already ships]**, AdaptSegment, TrendChart, RecentList); Planner (`planBackward` + cut-one verdict + buffer chips + persisted active plan in KV + reproject-with-diff).

**Placeholder / not started (this plan):**

- Honeycomb is `HoneycombStripPlaceholder` (aggregate badge, no per-cell SVG).
- Whenbee tab is category-rows only — **no companion avatar, tier trail, blind-spot, Reclaim hero, CTA**.
- **Reclaim Bank: nothing exists** (no `reclaim.ts`, no companion/reclaim fields, no deposit beat). ← the new core concept.
- Reason capture (A14/A15): no `contextTagRepo`, no reason chips.
- Analytics: only `app_open/onboarding_*/paywall_view/purchase/screen_view/task_logged/cell_capped` — funnel + D7 + reclaim events missing.
- Native presence: none (no `@bacons/apple-targets`).
- Paywall: `ProGate`/`useEntitlement` exist; **no offerings, no paywall modal, no calendar feature**.
- Patterns tab: empty stub.
- a11y/perf/copy audit, feedback board, release prep: not started.

### Key facts the executor must respect

1. **Calibration driver vs honest-shown.** In the timer flow, route param **`guessMin` is the naïve guess that trains the model**; **`estimateMin` is the honest number shown** (the ring fills toward it). `calibrationStore.applyLog`'s `estimateMin` param receives the **naïve guess**. The Reclaim dividend is therefore `reclaimDividendMinutes(naïveGuess, actual, honestShown)`.
2. **Tasks are not persisted as rows until logged** — `task_events` is written inside `calibrationStore.applyLog` (step 6). The "honest number shown" lives in route params / `tasksStore`; it gets **frozen onto the `task_events` row at log time** via a new param.
3. **Discoveries gallery is fast-follow, NOT v1** (`mvp/03b §7`, `00-MVP-DEFINITION §4 #6b`). The aha *card* already ships (category-detail). v1 builds **Reclaim only** — no `discoveries` table, no gallery, no discovery reward beat. (The data-model note in `05c §4` lists discoveries; ignore it for v1.)
4. **Reanimated 4 gotchas (CLAUDE.md):** read/write shared values with `.get()/.set()`; never `.value`. Function-form `style={({pressed}) => …}` on `Pressable` silently renders nothing — keep `Pressable` a bare touch wrapper, put visuals on an inner `View` (see `AppButton`). Honor `useReducedMotion()`.

---

## MANDATORY skill usage (per CLAUDE.md — invoke BEFORE the work, every applicable task)

| Work in a task | Invoke (Skill tool) |
|---|---|
| Any code (baseline) | `clean-code`, `coding-standards` |
| Any TypeScript / engine / types | `typescript-expert` |
| Any RN component/screen/hook/native | `react-native-expert` |
| Perf (lists, re-renders, startup, 60fps) | `vercel-react-native-skills` |
| New layer/store/boundary decision | `react-native-architecture` |
| **Any** design decision (spacing/size/font/layout/color/hierarchy/new element) | `ui-design:react-native-design` |
| Color choice (which token where) | `color-expert` |
| UX/flow/heuristics | `ux-principles` |
| **Any** animation/transition/micro-interaction | `creating-reanimated-animations` + `motion-design` |
| **Any** user-facing string | `conversion-psychology` + `humanizer` |

Process skills first: bugs → `superpowers:systematic-debugging`; new feature exploration → `superpowers:brainstorming` (already done for the specs).

### Design-match law (non-negotiable)

**The source of design for every new element is the existing app, not free-styling.** Before building any surface, open the nearest already-built sibling and copy its structure:

- New **card** → mirror `src/features/today/FocusCard.tsx` (token-driven `ViewStyle`/`TextStyle`, `type.*` role styles, `Card tone`, scarce-accent discipline, a leading design-rationale comment block).
- New **hero number** → mirror `src/components/HonestNumber.tsx` (Inter tabular numerals, `tone`/`size` props).
- New **list row** → mirror the `CategoryRow` in `src/app/(tabs)/whenbee.tsx`.
- New **animation** → mirror `src/features/timer/TimerRing.tsx` + `(modals)/timer.tsx` (shared values, `useReducedMotion()`, durations from `t.motion.*`).

**Color discipline (already encoded in the codebase, keep it):** `primary` indigo = the one live marker + the one primary action per screen; `accent` amber = scarce — identity fills (honey cells, Whenbee stripes), the optimism nudge, **and now Reclaim**; `success` grass = confirmations; **red is banned everywhere** (no-guilt invariant). Every spacing/size/font/color value comes from a `tokens.ts` token via `useTheme()` — if a value is missing, **add a token**, never inline.

### Whenbee invariants (enforce in every task)

No guilt ever (amber never red; no streaks/loss/decay/shame) · honey **and** Reclaim are **monotonic** (only climb) · core loop **on-device only** (no account/network/LLM in guess→timer→learn) · honest number appears wherever a plan is made · Pro pricing **read from RevenueCat**, never hardcoded · exactly **one** Pro gate = Honest-Day calendar.

### Verification gate after EVERY task (headless)

`npm run typecheck` clean · `npm run lint` clean (0 warnings) · `npm test` green · for tasks touching native config also `npx expo-doctor` (expect 18/18) and `npx expo export --platform ios`. Commit per task — **Conventional Commits, NO AI/co-author attribution** (use `/init-cmt`). After any UI change, **screenshot-verify on the simulator** and look critically before marking done (CLAUDE.md global rule; sim reset recipe in CLAUDE.md "Known gotchas").

---

## Milestone STOPS (founder review checkpoints — only 3 total)

- **■ STOP 1** — end of **Phase A**: review the Reclaim data model + property tests (monotonic, reconciliation, both-directions) before any Reclaim UI is built.
- **■ STOP 2** — end of **Phase B**: dogfood the full *felt* loop on device (log → reward deposit beat → Whenbee hub Reclaim grows + Honeycomb fills). This is the make-or-break felt moment.
- **■ STOP 3** — end of **Phase D**: verify the Pro flow on device (sandbox purchase/trial/restore + **no un-consented calendar writes**) before polish/beta.

---

## File Structure (new/changed in this plan)

```
src/
  engine/
    reclaim.ts                    # ★ NEW pure fn: reclaimDividendMinutes + formatReclaim + RECLAIM_MIN_DISPLAY
    update.ts                     # extend ApplyLogResult.reclaimDeltaMin
    constants.ts                  # + RECLAIM_MIN_DISPLAY (re-export site)
    __tests__/reclaim.test.ts
  domain/
    types.ts                      # + Companion type, CategoryStats.reclaimedMinutes, TaskEvent reclaim/honest fields, ContextReason
  db/
    migrations.ts                 # 0002 — additive columns + companion + log_tags tables
    types.ts                      # + CompanionRow, ContextTagRow, extend TaskEventRow/CategoryStatRow
    Database.ts                   # + companion + contextTag port methods
    memoryDatabase.ts             # implement new methods
    sqliteDatabase.ts             # implement new methods
    repositories/
      companionRepo.ts            # NEW — single-row monotonic aggregates
      contextTagRepo.ts           # NEW — reason capture (key:'reason')
    index.ts                      # export new repos
  stores/
    calibrationStore.ts           # freeze suggestedHonestMin; compute+persist reclaim in the log txn; return reclaimDeltaMin
  features/
    reward/                       # + ReclaimDeposit beat, reason chips, full choreography
    today/                        # + ReclaimTodayLine under the honeycomb strip
    whenbee/                      # NEW — WhenbeeHub, WhenbeeAvatar, TierTrailHub, BlindSpotCard, ReclaimHeroCard, useWhenbeeHub
    patterns/                     # NEW — Phase E cards
    paywall/                      # + Paywall screen content, offerings
    calendar/                     # NEW — HonestDayPreview, useHonestDay
  components/
    honeycomb/                    # NEW — Honeycomb, HoneycombStrip (sharpness-driven SVG)
  services/
    analytics.ts                  # extend event union (funnel + reclaim + reason + plan + paywall + calendar)
    calendar.ts                   # NEW — expo-calendar read + confirmed write (Expo-Go guarded)
    feedback.ts                   # Phase F — Supabase board (off the core-loop path)
  app/
    (modals)/paywall.tsx          # real paywall
    (tabs)/whenbee.tsx patterns.tsx   # replace placeholders
targets/                          # Phase C — @bacons/apple-targets widget + Live Activity (flagged)
```

---

# PHASE A — Reclaim Bank: engine + data + freeze (pure / TDD, no felt UI)

**Goal:** the Reclaim dividend exists as pure math, the data model banks it monotonically inside the existing log transaction, and `suggestedHonestMin` is frozen onto every logged task. No visible UI yet — this de-risks the new core concept behind property tests. **Math SoT: `build-plan-final/05c-RECLAIM-AND-DISCOVERIES.md`. Feature SoT: `mvp/03b-RECLAIM-FEATURE-SPEC.md`.**

> Invoke `typescript-expert` + `clean-code` + `coding-standards` for every task here; `react-native-architecture` for A.4 (store/txn boundary).

### Task A.1: `reclaim.ts` — the one new pure function (TDD)

**Files:**
- Create: `src/engine/reclaim.ts`, `src/engine/__tests__/reclaim.test.ts`
- Modify: `src/engine/index.ts` (export), `src/engine/constants.ts` (add `RECLAIM_MIN_DISPLAY`)

- [ ] **Step 1: Write the failing tests** (verbatim from `05c §14`):

```ts
// src/engine/__tests__/reclaim.test.ts
import { reclaimDividendMinutes, formatReclaim } from '../reclaim';

describe('reclaimDividendMinutes', () => {
  it('credits the under-estimator when the honest number was closer', () => {
    expect(reclaimDividendMinutes(15, 32, 30)).toBe(15); // |32-15| - |32-30| = 17 - 2
  });
  it('credits the over-reserver too (calibration down still pays)', () => {
    expect(reclaimDividendMinutes(60, 35, 40)).toBe(20); // 25 - 5
  });
  it('never deposits a negative when the honest number was worse', () => {
    expect(reclaimDividendMinutes(30, 28, 55)).toBe(0); // max(0, 2 - 27)
  });
  it('is zero when the honest number equalled the guess (no help given)', () => {
    expect(reclaimDividendMinutes(20, 50, 20)).toBe(0); // 30 - 30
  });
});

describe('formatReclaim', () => {
  it('formats hours and minutes', () => { expect(formatReclaim(860)).toBe('14h 20m'); });
  it('drops the hour when under 60', () => { expect(formatReclaim(35)).toBe('35m'); });
});
```

- [ ] **Step 2: Run** `npx jest reclaim` → FAIL ("Cannot find module '../reclaim'").

- [ ] **Step 3: Implement** `src/engine/reclaim.ts` (verbatim from `05c §3.1`, `§3.5`):

```ts
// src/engine/reclaim.ts — pure, O(1), no clock, no I/O.
// The ONLY new math in the Reclaim layer. Touches none of the calibration moat.

/**
 * Minutes of prediction error the honest number spared the user on this task.
 *   guessError  = |actual − estimate|   (how wrong the naïve guess was)
 *   honestError = |actual − honestShown| (how wrong Whenbee's number was)
 *   dividend    = max(0, round(guessError − honestError))
 * Non-negative by construction → the bank can only rise (no loss state).
 * Rewards the under-estimator AND the over-reserver: it measures closeness to
 * reality, not "slowness".
 */
export function reclaimDividendMinutes(
  estimateMin: number,
  actualMin: number,
  honestShownMin: number,
): number {
  const guessError = Math.abs(actualMin - estimateMin);
  const honestError = Math.abs(actualMin - honestShownMin);
  return Math.max(0, Math.round(guessError - honestError));
}

/** 860 → "14h 20m"; 35 → "35m"; 0 → caller skips display entirely. */
export function formatReclaim(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
```

Add to `src/engine/constants.ts`:

```ts
/** Sub-1-minute deposits are stored but never rendered (no "+0m"). */
export const RECLAIM_MIN_DISPLAY = 1;
```

Add to `src/engine/index.ts`:

```ts
export { reclaimDividendMinutes, formatReclaim } from './reclaim';
export { RECLAIM_MIN_DISPLAY } from './constants';
```

- [ ] **Step 4: Run** `npx jest reclaim` → PASS. Run full `npm test` (engine suite still green).
- [ ] **Step 5: Commit** — `feat(engine): reclaim dividend + formatter (the one new pure fn)`.

### Task A.2: extend `ApplyLogResult` with `reclaimDeltaMin` (TDD)

**Files:**
- Modify: `src/engine/update.ts`
- Modify: `src/engine/__tests__/engine.test.ts` (or wherever `applyLog` is tested — find with `grep -rl "describe('applyLog" src/engine/__tests__`)

> `applyLog` stays clockless/pure. It receives the honest-shown value as input and computes the deposit only when `counted`.

- [ ] **Step 1: Write failing tests** appended to the existing `applyLog` describe:

```ts
it('returns reclaimDeltaMin from the honest-shown number when counted', () => {
  const res = applyLog({
    estimateMin: 15, actualMin: 32, status: 'completed', source: 'timed',
    adaptSpeed: 'balanced', prior: 1.8,
    category: { n: 0, logEwma: 0, mEffective: 1.8, sharpness: 0 },
    recurring: null, recentClampedRatios: [], suggestedHonestMin: 30,
  });
  expect(res.reclaimDeltaMin).toBe(15); // |32-15| - |32-30|
});
it('reclaimDeltaMin is 0 for an abandoned log (not counted)', () => {
  const res = applyLog({
    estimateMin: 15, actualMin: 5, status: 'abandoned', source: 'timed',
    adaptSpeed: 'balanced', prior: 1.8,
    category: { n: 3, logEwma: 0.4, mEffective: 1.6, sharpness: 50 },
    recurring: null, recentClampedRatios: [], suggestedHonestMin: 24,
  });
  expect(res.reclaimDeltaMin).toBe(0);
});
it('falls back to honestNumber(estimate, mEffective) when no suggestedHonestMin given', () => {
  // mEffective 1.8, estimate 15 → honestNumber 27 (round5). |40-15|-|40-27| = 25-13 = 12
  const res = applyLog({
    estimateMin: 15, actualMin: 40, status: 'completed', source: 'retro',
    adaptSpeed: 'balanced', prior: 1.8,
    category: { n: 5, logEwma: 0.6, mEffective: 1.8, sharpness: 40 },
    recurring: null, recentClampedRatios: [], suggestedHonestMin: null,
  });
  expect(res.reclaimDeltaMin).toBe(12);
});
```

> Confirm `honestNumber(15, 1.8) === 27` against `src/engine/multiplier.ts` rounding before locking the third expectation; adjust the literal if the engine rounds differently.

- [ ] **Step 2: Run** the engine test file → FAIL.
- [ ] **Step 3: Implement** in `src/engine/update.ts`:
  - Add to `ApplyLogInput`: `suggestedHonestMin: number | null;`
  - Add to `ApplyLogResult`: `reclaimDeltaMin: number;`
  - Import `honestNumber` from `./multiplier` and `reclaimDividendMinutes` from `./reclaim`.
  - In the **not-counted** early return, add `reclaimDeltaMin: 0`.
  - After the counted branch computes `catM`/`sharpness`, before `return`:

```ts
const honestShownMin =
  input.suggestedHonestMin ?? honestNumber(input.estimateMin, input.category.mEffective); // M_before
const reclaimDeltaMin = reclaimDividendMinutes(input.estimateMin, input.actualMin, honestShownMin);
```

  - Add `reclaimDeltaMin` to the counted `return`.
- [ ] **Step 4: Run** engine tests → PASS; full `npm test` green.
- [ ] **Step 5: Commit** — `feat(engine): applyLog returns reclaimDeltaMin (honest-shown vs guess)`.

### Task A.3: data-model deltas — types, migration, DB port + adapters (TDD)

**Files:**
- Modify: `src/domain/types.ts`, `src/db/types.ts`, `src/db/migrations.ts`, `src/db/Database.ts`, `src/db/memoryDatabase.ts`, `src/db/sqliteDatabase.ts`
- Modify: `src/db/__tests__/migrations.test.ts`, `src/db/__tests__/memoryDatabase.test.ts`

> Additive only; every new aggregate monotonic. Migration is a **new appended entry** (`0002`) — never edit `0001`.

- [ ] **Step 1: Add domain types** (`src/domain/types.ts`):

```ts
/** Single-row monotonic companion aggregates (the Reclaim bank lives here). */
export interface Companion {
  reclaimedMinutesLifetime: number; // += deposit per counted log; never decremented
}
```
  - Extend `CategoryStats` with `reclaimedMinutes: number;`
  - Extend `TaskEvent` with `suggestedHonestMin: number | null;` and `reclaimDividendMin: number;`
  - Add `export type ContextReason = string;` (free reason slug, capture-only).

- [ ] **Step 2: Add DB row types** (`src/db/types.ts`):
  - `CompanionRow { reclaimedMinutesLifetime: number }`
  - Extend `CategoryStatRow` with `reclaimedMinutes: number`
  - Extend `TaskEventRow` with `suggestedHonestMin: number | null` and `reclaimDividendMin: number`
  - `ContextTagRow { eventId: string; key: string; value: string; source: string; createdAt: number }`

- [ ] **Step 3: Write the failing migration test** (`migrations.test.ts`): assert running all migrations on `:memory:` yields a `companion` table with one row defaulting `reclaimed_minutes_lifetime = 0`, a `log_tags` table, and that `category_stats` has a `reclaimed_minutes` column and `task_events` has `suggested_honest_min` + `reclaim_dividend_min`. Assert idempotent re-run.

- [ ] **Step 4: Run** → FAIL.

- [ ] **Step 5: Append migration `0002`** to `src/db/migrations.ts` (after the existing `0001` entry; `ALTER TABLE ADD COLUMN` is not `IF NOT EXISTS`-safe, so guard via the `user_version` runner — these only run once):

```ts
  // 0002 — Reclaim bank + reason capture (additive, monotonic).
  `
  ALTER TABLE category_stats ADD COLUMN reclaimed_minutes REAL NOT NULL DEFAULT 0;
  ALTER TABLE task_events ADD COLUMN suggested_honest_min REAL;
  ALTER TABLE task_events ADD COLUMN reclaim_dividend_min REAL NOT NULL DEFAULT 0;

  CREATE TABLE IF NOT EXISTS companion (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    reclaimed_minutes_lifetime REAL NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO companion (id, reclaimed_minutes_lifetime) VALUES (1, 0);

  CREATE TABLE IF NOT EXISTS log_tags (
    event_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (event_id, key)
  );
  `,
```

- [ ] **Step 6: Extend the `Database` port** (`src/db/Database.ts`):

```ts
  getCompanion(): Promise<CompanionRow>;
  addReclaim(deltaMin: number): Promise<void>;            // monotonic += on the single row
  addCategoryReclaim(categoryId: string, deltaMin: number): Promise<void>;
  insertContextTag(row: ContextTagRow): Promise<void>;    // capture-only; never read by the model
```
  (Import the new row types.)

- [ ] **Step 7: Implement in both adapters.**
  - `memoryDatabase.ts`: hold a `companion = { reclaimedMinutesLifetime: 0 }`; `addReclaim` does `+=`; `addCategoryReclaim` patches the in-memory stat; a `Map<string, ContextTagRow>` keyed `${eventId}:${key}`. Ensure `getCategoryStat`/`upsertCategoryStat`/`insertTaskEvent` carry the new fields (default `reclaimedMinutes:0`, `suggestedHonestMin:null`, `reclaimDividendMin:0`).
  - `sqliteDatabase.ts`: `getCompanion` selects row id=1; `addReclaim` runs `UPDATE companion SET reclaimed_minutes_lifetime = reclaimed_minutes_lifetime + ? WHERE id = 1`; `addCategoryReclaim` runs `UPDATE category_stats SET reclaimed_minutes = reclaimed_minutes + ? WHERE category_id = ?`; `insertContextTag` does `INSERT OR REPLACE INTO log_tags …`. Map the new columns in every `task_events`/`category_stats` read+write.

- [ ] **Step 8: Run** `npm test` (migration + memoryDatabase + repositories tests) → PASS. `npm run typecheck`.
- [ ] **Step 9: Commit** — `feat(db): companion + reclaim columns + log_tags (additive migration 0002)`.

### Task A.4: repos + `calibrationStore.applyLog` banks the deposit in the log txn (TDD)

**Files:**
- Create: `src/db/repositories/companionRepo.ts`, `src/db/repositories/contextTagRepo.ts`
- Modify: `src/db/index.ts`, `src/db/repositories/categoryStatsRepo.ts` (carry `reclaimedMinutes`), `src/db/repositories/taskEventsRepo.ts` (carry the two new fields)
- Modify: `src/stores/calibrationStore.ts`
- Modify: `src/stores/__tests__/calibrationStore.test.ts`

- [ ] **Step 1: Write `companionRepo` + `contextTagRepo`** (thin pass-throughs over the port, mirroring existing repo style):

```ts
// src/db/repositories/companionRepo.ts
import type { Database } from '../Database';
export function makeCompanionRepo(db: Database) {
  return {
    get: () => db.getCompanion(),
    deposit: (deltaMin: number) => db.addReclaim(deltaMin),
    depositToCategory: (categoryId: string, deltaMin: number) =>
      db.addCategoryReclaim(categoryId, deltaMin),
  };
}
```
```ts
// src/db/repositories/contextTagRepo.ts
import type { Database } from '../Database';
import type { ContextTagRow } from '../types';
export function makeContextTagRepo(db: Database) {
  return {
    /** Capture-only. Never read on the calibration path. */
    setReason: (row: ContextTagRow) => db.insertContextTag(row),
  };
}
```
  Export both from `src/db/index.ts`.

- [ ] **Step 2: Extend `ApplyLogParams` + `LogResult`** in `calibrationStore.ts`:
  - `ApplyLogParams` gains `suggestedHonestMin?: number | null;`
  - `LogResult` gains `reclaimDeltaMin: number;`

- [ ] **Step 3: Write the failing store tests** (`calibrationStore.test.ts`, against the memory DB):
  - A counted log with `estimateMin:15, actualMin:32, suggestedHonestMin:30` returns `reclaimDeltaMin: 15` and `companionRepo.get()` rises by 15.
  - **Monotonic property:** over a random sequence of 20 logs (mixed completed/abandoned, varied values), `companion.reclaimedMinutesLifetime` is non-decreasing at every step.
  - **Reconciliation:** lifetime total === Σ of each event's `reclaimDividendMin`.
  - A `reclaimDeltaMin: 0` log does **not** change the lifetime total.
  - Abandoned log → `reclaimDeltaMin: 0`, no deposit.

- [ ] **Step 4: Run** → FAIL.

- [ ] **Step 5: Wire `applyLog`** in `calibrationStore.ts`:
  - Pass `suggestedHonestMin: input.suggestedHonestMin ?? null` into `engineApplyLog(...)`.
  - Freeze on the event row (step 6 of the store): `suggestedHonestMin: input.suggestedHonestMin ?? null`, `reclaimDividendMin: result.reclaimDeltaMin`.
  - **Inside the `if (result.counted)` block** (same logical transaction as the stats upsert), after the category upsert:

```ts
if (result.reclaimDeltaMin > 0) {
  const companionRepo = makeCompanionRepo(db);
  await companionRepo.deposit(result.reclaimDeltaMin);
  await companionRepo.depositToCategory(input.category, result.reclaimDeltaMin);
}
```
  - Add `reclaimDeltaMin: result.reclaimDeltaMin` to the returned `LogResult`.
  - In the side-effects block, add `if (result.reclaimDeltaMin >= 1) analytics.capture('reclaim_deposit', { minutes: result.reclaimDeltaMin, category: input.category, source: input.source });` (the event type lands in Phase C; keep the call, it's a no-op-safe capture).

> Note: expo-sqlite calls here are sequential awaits, not a literal SQL `BEGIN…COMMIT`. That matches the existing store (the stats upsert isn't wrapped either). Do **not** introduce a transaction wrapper now — keep parity with the current code; the reconciliation test guards correctness.

- [ ] **Step 6: Run** `npm test` → PASS. `npm run typecheck` + `npm run lint`.
- [ ] **Step 7: Commit** — `feat(stores): bank the reclaim deposit inside the log write + freeze honest-shown`.

### Task A.5: freeze `suggestedHonestMin` at every call site (timed · retro · add-task)

**Files:**
- Modify: `src/features/timer/useTimer.ts`, `src/features/retro/useRetro.ts`, `src/features/add-task/useAddTask.ts`, `src/stores/tasksStore.ts`, `src/app/(modals)/timer.tsx` (thread a param)
- Modify the relevant `__tests__` (`timerScreen`/`retroScreen`/`addTaskScreen`)

> Goal: every `applyLog` call passes the honest number the user actually saw. **The honest-shown value is the timer's `estimateMin` param** (and the Today/Add-task `summary.honestMinutes`). The naïve guess stays `guessMin`.

- [ ] **Step 1: Thread `suggestedHonestMin` through the timer.** Add an optional `suggestedHonestMin` route param to `(modals)/timer.tsx` (defaults to `estimateMin`, since the ring fills toward the honest number). In `useTimer`, accept it and pass `suggestedHonestMin` into the `calibrationStore.applyLog` call. Confirm the existing `applyLog` `estimateMin` argument is **`guessMin`** (the naïve guess) — if `useTimer` currently passes the honest `estimateMin` there, that is a latent calibration bug: fix it to pass `guessMin` and add a test asserting the trained ratio uses the guess.

- [ ] **Step 2: Retro.** In `useRetro.ts`, the user types guess + actual with no surfaced suggestion → pass `suggestedHonestMin: null` (the engine falls back to `honestNumber(guess, M_before)` per A.2). Add a test asserting a retro log still produces a `reclaimDeltaMin` (the fallback path).

- [ ] **Step 3: Add-task / Today.** Where a task is queued (`tasksStore.addTask`) or started from Today, carry the shown `summary.honestMinutes` as `suggestedHonestMin` into the timer params, so a planned task banks against the exact number it promised.

- [ ] **Step 4:** Update affected RNTL tests to pass/assert the new param; `npm test` green; `npm run typecheck` + `npm run lint`.
- [ ] **Step 5: Commit** — `feat(loop): freeze the honest-shown number on every logged task`.

**■ STOP 1 — founder review.** Walk the founder through: `reclaim.test.ts`, the monotonic + reconciliation store tests, and the worked examples (`05c §3.3`). Confirm the dividend credits **both** under-guess and over-reserve, and that nothing visible changed yet. Get GO before Phase B.

**PHASE A GATE:** `npm run typecheck` / `npm run lint` / `npm test` green; reclaim is banked + reconciles; no UI regression. Push.

---

# PHASE B — The felt reward layer: Honeycomb · Whenbee hub · Reclaim surfaces · reward choreography · reason capture

**Goal:** turn each log into felt, loss-proof reward — real animated Honeycomb, a real Whenbee hub with the companion + **Reclaim hero**, the **`+Nm reclaimed` deposit beat** in Reward, the Today reclaim line, and capture-only over/under reason chips. This is the make-or-break felt loop.

> **Per-task reads before building:** `build-plan-final/04-DESIGN.md` §1.9 (honeycomb/avatar visuals) + §2 (Whenbee/Reward screens) · `05b-HONEY-SYSTEM.md` · `mvp/02-UX-SPEC.md` · `mvp/03b-RECLAIM-FEATURE-SPEC.md` §2–§5 · `05c §8–§9` (surfaces + binding copy). **Invoke `ui-design:react-native-design` + `color-expert` + `creating-reanimated-animations` + `motion-design` for every UI/animation task, `conversion-psychology` + `humanizer` for every string.** Match the existing screens (Design-match law above).

### Task B.1: Honeycomb SVG component (sharpness-driven, monotonic, a11y)

**Files:**
- Create: `src/components/honeycomb/Honeycomb.tsx`, `src/components/honeycomb/HoneycombStrip.tsx`, `src/components/honeycomb/__tests__/Honeycomb.test.tsx`
- Modify: `src/app/(tabs)/index.tsx` (replace `HoneycombStripPlaceholder` with the real `HoneycombStrip`)

- [ ] **Step 1:** Invoke the design + animation skills. Read `04-DESIGN.md §1.9`. Write a failing RNTL test: `Honeycomb` with a category at `sharpness:78, tier:'Ripening'` renders `accessibilityLabel="Cleaning cell — 78% honey, tier Ripening"`; a `sharpness:95` cell renders the wax-cap state.
- [ ] **Step 2:** Implement with `react-native-svg`: packed hexagon cells (one per tracked category), each filled with `accent` (amber) from the bottom to its `sharpness%` via a clipped fill; un-ripe portion is the flat hex outline (`hairline`) — **never blur** (RN 0.81 box-shadow gotcha). Wax cap (a thin `accentEdge` rim) at `sharpness ≥ 93`. Animate the fill with Reanimated 4 (`withTiming`, `t.motion.honeyFill` 900ms, `Easing.out`) using `.set()` on a shared value; `useReducedMotion()` → set instantly, no animation. Three sizes via a `size: 'strip'|'hub'|'detail'` prop (token-driven dims). Cells **never** decrease (monotonic — drive purely from stored `sharpness`).
- [ ] **Step 3:** `HoneycombStrip` = a horizontal row of small cells + the aggregate honey%/tier pill (reuse what the placeholder showed). Wire it into Today in place of `HoneycombStripPlaceholder`; keep the `onPress → /(tabs)/whenbee` behavior.
- [ ] **Step 4:** RNTL + typecheck + lint green; **screenshot-verify on sim** (cells fill, amber correct, no shadow artifacts). **Commit** — `feat(honeycomb): sharpness-driven hex cell-fill SVG + wax cap + a11y labels`.

### Task B.2: `useWhenbeeHub` — one read for the hub (TDD)

**Files:**
- Create: `src/features/whenbee/useWhenbeeHub.ts`, `src/features/whenbee/__tests__/useWhenbeeHub.test.ts`

- [ ] **Step 1:** Invoke `react-native-architecture`. Write a failing test: the hook returns `{ reclaimLifetimeMin, reclaimByCategory[], biggestArea, honestLogCount, blindSpot, tier, cells[] }`, reading from `companionRepo.get()`, the category stats cache, and `taskEventsRepo`. `biggestArea` = the category with the max `reclaimedMinutes`; `blindSpot` = the tracked category with the **lowest** sharpness **and** ≥1 log (kind framing, never "worst"); `honestLogCount` = count of completed logs (for the provenance line). Empty-state: `reclaimLifetimeMin: 0`, `blindSpot: null`.
- [ ] **Step 2:** FAIL → implement the hook (read-only; no engine math beyond `tierFor`). **Step 3:** PASS. **Commit** — `feat(whenbee): hub data hook (reclaim totals, biggest area, blind spot)`.

### Task B.3: Reclaim hero card + Whenbee hub rebuild

**Files:**
- Create: `src/features/whenbee/ReclaimHeroCard.tsx`, `src/features/whenbee/WhenbeeAvatar.tsx`, `src/features/whenbee/TierTrailHub.tsx`, `src/features/whenbee/BlindSpotCard.tsx`, `src/features/whenbee/WhenbeeHub.tsx`
- Modify: `src/app/(tabs)/whenbee.tsx` (compose the hub; keep the `CategoryRow` drill-down)

- [ ] **Step 1:** Invoke design + color + copy skills. Read `05c §8` (the Reclaim hero ASCII), `04-DESIGN.md §1.9`, `09-BRAND-VOICE.md`. **Build `ReclaimHeroCard`** mirroring `FocusCard`/`HonestNumber` exactly:
  - Layout: small-caps `RECLAIMED` eyebrow (`type.eyebrow`, `inkSoft`) → hero number `formatReclaim(lifetime)` via `HonestNumber size="xl"` with **amber accent on the unit** → provenance caption `from {n} honest logs · learned on-device` (`type.caption`, `inkSoft`) → optional divider + `biggest area · {Name}  {formatReclaim(catMin)}`.
  - **Binding copy** (`05c §9` / `03b §4`) — use verbatim; pass each string through `humanizer`+`conversion-psychology` only to confirm (these are already on-brand): empty state (lifetime 0) renders `Your reclaim starts with your first honest log. No rush.` — **never a 0 number**.
  - `Card tone="focal"`. Amber is the scarce accent here (allowed — identity/Reclaim).
- [ ] **Step 2: `WhenbeeAvatar`** — the 5-stage companion (1:1 with tiers Raw→Honest) + stage-6 "Keeper" prestige, monotonic. A **sensible default ships, no setup wall** (CLAUDE.md invariant). Build as a composed `react-native-svg` bee (amber identity stripes) whose stage is derived from the hub tier; optional one-word name lives in `settingsStore` (default empty → unnamed bee renders fine). Keep it simple/procedural — this is presence, not a dress-up game.
- [ ] **Step 3: `TierTrailHub`** reuses the existing `src/components/TierTrail.tsx` node pattern (done/now/lock by **color + icon**, never color alone). **`BlindSpotCard`** = kind nudge to the lowest-sharpness category (`blindSpot`), `→` opens `/category/[category]`; hidden when `blindSpot` is null. Copy is encouraging, no "weak/worst/behind".
- [ ] **Step 4: `WhenbeeHub`** composes: avatar + honeycomb (`Honeycomb size="hub"`) hero, `TierTrailHub`, `ReclaimHeroCard`, `BlindSpotCard`, the existing category rows, and the **"Make my whole day honest"** CTA (`AppButton variant="amber"`) → for now `router.push('/(modals)/paywall')` (wired live in Phase D). Replace the whenbee.tsx body with `<WhenbeeHub/>` inside the existing `Screen`/`ScrollView`.
- [ ] **Step 5:** RNTL (hero renders number + provenance; empty state renders the no-guilt copy, no zero; blind-spot hidden when null) + typecheck + lint green. **Screenshot-verify** the whole hub; critique spacing/alignment/hierarchy against `FocusCard` before done. **Commit** — `feat(whenbee): companion hub — avatar, tier trail, Reclaim hero, blind spot, day-honest CTA`.

### Task B.4: Reward choreography + the `+Nm reclaimed` deposit beat

**Files:**
- Modify: `src/features/reward/useReward.ts`, `src/features/reward/HoneyBar.tsx`, `src/features/reward/RewardBee.tsx`
- Create: `src/features/reward/ReclaimDeposit.tsx`
- Modify: `src/stores/rewardStore.ts` (carry `reclaimDeltaMin` + new lifetime total through the hand-off), `src/app/(modals)/reward.tsx`
- Modify: `src/features/reward/__tests__/rewardScreen.test.ts`

- [ ] **Step 1:** Invoke the animation + copy skills. Read `05c §7` (choreography order) + `03b §3`. The Reward modal plays, in order: **(1)** `+1 nectar` chip (existing) → **(2)** honey cell fills to new % (existing `HoneyBar`, 700ms) → **(3) NEW** `+Nm reclaimed` amber chip + Reclaim total count-up (`t.motion.pulse` 700ms) — **only when `reclaimDeltaMin ≥ 1`** → **(4)** cap bloom/seal only on a `sharpness ≥ 93` crossing (existing). **No discovery beat in v1** (gallery deferred).
- [ ] **Step 2:** Carry `reclaimDeltaMin` and the post-deposit lifetime total from `applyLog`'s `LogResult` through `rewardStore` into `useReward`. Add a failing test: a reward with `reclaimDeltaMin: 15` renders `+15m reclaimed` and a count-up to the new total; a `reclaimDeltaMin: 0` reward renders **no** reclaim element (no `+0m`).
- [ ] **Step 3:** Build `ReclaimDeposit.tsx`: an amber chip that enters with `withSequence(withTiming(scale 1.08, {duration: t.motion.press}), withSpring(1))` (use `.set()`), and an Inter-tabular count-up from `prevTotal → newTotal` via `withTiming(t.motion.pulse)` driving a shared value read in a derived display (or `react-native-reanimated` `useDerivedValue` + `runOnJS` text set). `useReducedMotion()` → set the final number instantly, no roll, chip just fades in. Copy: `+{n}m reclaimed` (binding).
- [ ] **Step 4:** Update the exits to `See my Reclaim` / `Back to today` (`05c §7`; `See my Reclaim` → `/(tabs)/whenbee`). Run skills `humanizer`+`conversion-psychology` to confirm the two exit labels.
- [ ] **Step 5:** RNTL + typecheck + lint green; **screenshot/screen-record the choreography** on sim; verify reduce-motion path. **Commit** — `feat(reward): +Nm reclaimed deposit beat + full choreography (reduce-motion safe)`.

### Task B.5: Today reclaim line + capture-only over/under reason chips

**Files:**
- Create: `src/features/today/ReclaimTodayLine.tsx`, `src/features/reward/ReasonChips.tsx`
- Modify: `src/app/(tabs)/index.tsx`, `src/features/today/useToday.ts` (sum today's deposits), `src/features/reward/useReward.ts` (reason capture), `src/stores/calibrationStore.ts` (return the new `eventId` so reasons attach), or thread `eventId` via `rewardStore`

- [ ] **Step 1: Reclaim today line.** `useToday` sums `reclaimDividendMin` for events with `createdAt` in today's local window (add a `taskEventsRepo.sumReclaimSince(startOfDayMs)` or filter `listRecentEvents`). `ReclaimTodayLine` renders `+{m}m reclaimed today` (binding copy) under the `HoneycombStrip`; **hidden when the sum is 0**. Test: 0 → not rendered; 35 → `+35m reclaimed today`.
- [ ] **Step 2: Reason chips (A14/A15).** Read `mvp/03-FEATURE-SPEC.md §5` + `mvp/02-UX-SPEC.md §5`. In Reward, after the deposit beat, show an **optional, threshold-gated, symmetric** over/under reason chip row (e.g. over → `Interrupted` / `Underestimated` / `Got distracted`; under → `Focused` / `Overestimated`) — **only** when `|ratio−1|` exceeds a small threshold; never blocks the exit. Pre-fill a guess from pause/late-start signals if available. On tap → `contextTagRepo.setReason({ eventId, key:'reason', value, source:'manual'|'auto', createdAt })`.
- [ ] **Step 3: HARD invariant** — the reason **never** touches the multiplier/honey/Reclaim. Add a test: setting a reason does not change `mEffective` or `sharpness`. Thread the logged `eventId` from `applyLog` → `rewardStore` → `useReward` so the chip can attach to the right row.
- [ ] **Step 4:** Fire `analytics.capture('overrun_reason_shown'|'_tagged'|'_skipped', …)` calls (event types land in Phase C; capture is no-op-safe). RNTL + typecheck + lint green. **Screenshot-verify** the chip row is calm and skippable. **Commit** — `feat(loop): today reclaim line + capture-only over/under reason chips`.

**■ STOP 2 — founder dogfood on device.** Build to device (`npm run ios`), reset onboarding (CLAUDE.md recipe), and run the full loop several times across 1–2 days: Today → Start → Timer → Stop&log → Reward (watch the `+Nm reclaimed` beat) → Whenbee hub (watch Reclaim grow + Honeycomb fill + tier trail advance). **The question to answer:** does logging feel *rewarded*, not like work? If not, cut friction before Phase C.

**PHASE B GATE:** typecheck/lint/test green; `expo export` builds; honeycomb fills monotonically; Reclaim hero + deposit beat correct; reason capture isolated from the model; no red/guilt anywhere; reduce-motion parity. Push. **Tag `v0.1.0`** when the loop is end-to-end felt.

---

# PHASE C — Retention instrumentation + native presence (the spine gate)

**Goal:** the full PostHog funnel + D7 cohort populating, plus the static widget + Live Activity scaffold. **This phase's gate authorizes all monetization work — no Pro until D7 is measurable.**

> Read `mvp/06-RELEASE-AND-METRICS.md` §1–§2. Invoke `react-native-expert` (native config) + `vercel-react-native-skills` (keep capture non-blocking).

### Task C.1: typed analytics funnel + reclaim/reason/plan/paywall events

**Files:**
- Modify: `src/services/analytics.ts`, `src/services/__tests__/analytics.test.ts`
- Add event calls across the loop where missing (most were stubbed in A/B as no-op-safe captures — now type them).

- [ ] **Step 1:** Extend the `AppEvent` union with every event in `06-RELEASE-AND-METRICS §2`: `app_installed`, `onboarding_completed`, `task_started`, `task_logged`, `first_log`, `honey_ripened`, `tier_up`, `aha_shown`, `reclaim_deposit`, `reclaim_total_view`, `honest_suggestion_shown`, `optimistic_nudge_shown`, `overrun_reason_shown|_tagged|_skipped`, `plan_built|plan_cut_one|plan_reprojected`, `whenbee_personalized`, `widget_added|widget_engaged`, `paywall_view`, `plan_selected`, `trial_started|purchase|restore_purchases`, `calendar_padded`, `reminder_enabled|reminder_disabled`. Type each event's props.
- [ ] **Step 2:** Write a failing test asserting `analytics.capture` is invoked for `first_log` exactly once (a flag in the store), `aha_shown` when an insight surfaces, `reclaim_deposit` on a ≥1m deposit, and that capture **never throws** even if the sink is down. Implement the missing call sites (`first_log` guard in `calibrationStore`/`tasksStore`; `aha_shown` where `detectInsight` returns non-null; `reclaim_total_view` on Whenbee hub mount; `optimistic_nudge_shown` in `OptimismNudge`; `honest_suggestion_shown` in `FocusCard`/add-task).
- [ ] **Step 3:** PASS; typecheck/lint green. **Commit** — `feat(analytics): full typed Whenbee funnel + reclaim/reason/plan events`.

### Task C.2: D1/D7/D30 retention cohort wiring + verification

**Files:**
- Modify: `src/services/analytics.ts` (ensure stable anonymous distinct id + `app_installed`/`onboarding_completed` fire once)

- [ ] **Step 1:** Confirm a stable per-install distinct id (PostHog default) and that `app_installed` fires exactly once (KV flag), `onboarding_completed` on finish. **D1/D7/D30 retention is defined in the PostHog UI** (a cohort/retention insight over `first_log`) — **FLAG for the user** to create the PostHog retention insight + funnel dashboard (`app_open → onboarding_completed → first_log → aha_shown → paywall_view`); the agent ensures the events exist and flow.
- [ ] **Step 2:** Add a dev-only "fire the funnel" harness or a test asserting the event sequence is emitted across a simulated session. typecheck/lint/test green. **Commit** — `feat(analytics): one-shot install/onboarding events + retention-ready ids`.

### Task C.3: native presence — static widget + Live Activity scaffold (FLAGGED, Expo-Go-guarded)

**Files:**
- Add: `targets/` (via `@bacons/apple-targets`), `app.json` plugin config, an App Group; `src/lib/isExpoGo.ts` guards any RN-side bridge.

- [ ] **Step 1:** Invoke `react-native-expert`. `npx expo install @bacons/apple-targets`. Scaffold a **WidgetKit** target (static Home-screen widget: next task + honest finish time + one-tap start deep link + Whenbee presence) and an **ActivityKit** Live Activity / Dynamic-Island finish-time ring that continues on the Lock Screen. Both read an **App Group** shared store written by the timer.
- [ ] **Step 2:** Everything RN-side that talks to the extension is guarded by `isExpoGo` (Expo Go → no-op). This **requires a dev build + physical device** — **scaffold the config + guards and FLAG the user** to build/sign/smoke-test on device; do not block the Expo-Go UI. `widget_added`/`widget_engaged` events from C.1.
- [ ] **Step 3:** `npx expo-doctor` (18/18) + `npx expo export --platform ios` build. typecheck/lint green. **Commit** — `chore(native): scaffold widget + Live Activity targets behind Expo-Go guard (device smoke-test flagged)`.

**PHASE C HARD GATE:** funnel records `first_log` + `aha_shown` + `reclaim_deposit` end-to-end; D7 retention insight is defined and populating from dogfood/closed-alpha sessions (FLAG the user to confirm in PostHog). typecheck/lint/test/doctor green. **No monetization until retention is measurable.** Push.

---

# PHASE D — Pro: paywall + Honest-Day calendar (the single gate)

**Goal:** ship the one reason to pay — Honest-Day calendar padding — gated by the single `<ProGate>`, triggered only at the CTA. Prices from RevenueCat, never hardcoded.

> Read `build-plan-final/06-MONETIZATION.md` + `mvp/06 §4` (pricing) + `mvp/03-FEATURE-SPEC.md` (calendar). Invoke `react-native-expert` + `conversion-psychology` + `humanizer` (paywall copy) + `color-expert`. The `ProGate`/`useEntitlement` already exist — extend, don't rebuild.

### Task D.1: RevenueCat offerings + entitlement

**Files:**
- Modify: `src/services/purchases.ts`, `src/features/paywall/useEntitlement.ts`, `src/services/__tests__/purchases.test.ts`

- [ ] **Step 1:** Extend the `PurchasesModule` port with `getOfferings()` and `purchasePackage(pkg)`/`restore()`. Implement the native path (real `react-native-purchases`) and the **Expo-Go stub** (returns mock offerings so the paywall UI renders; `isExpoGo` guard). Entitlement id `pro`; 7-day trial on both subs. Write tests against the stub: offerings resolve, `purchase` flips the cached entitlement.
- [ ] **Step 2:** typecheck/lint/test green. **FLAG the user** to configure RevenueCat products (Monthly/Yearly/Lifetime/Founder), the `pro` entitlement, and Apple Developer + payout/tax (needed for sandbox). **Commit** — `feat(purchases): RevenueCat offerings + purchase/restore (Expo-Go stubbed)`.

### Task D.2: Paywall screen (prices from store)

**Files:**
- Create: `src/features/paywall/Paywall.tsx`, `src/features/paywall/PlanPicker.tsx`, `src/features/paywall/BeforeAfterHero.tsx`
- Modify: `src/app/(modals)/paywall.tsx`

- [ ] **Step 1:** Invoke design + copy skills. Read `06-MONETIZATION.md`. Build the paywall mirroring the app's card/typography conventions: **before/after honest-day hero** (`planned crashes 5pm` vs `honest ends 7:10pm`), 4 benefits, social proof line, **plan picker** (Yearly hero "Save 42%" / Lifetime / Monthly) with **all prices from `product.priceString`** — never a hardcoded number, 7-day-trial CTA, guarantee, restore, manage-subscription. Empty/loading + error states.
- [ ] **Step 2:** Wire `paywall_view` (with `trigger`) on mount, `plan_selected`, `trial_started`/`purchase`/`restore_purchases` from RevenueCat callbacks. Trigger the paywall **only** from the Whenbee "Make my whole day honest" CTA (wire B.3's CTA live) + a Settings upgrade row — **never** at install/onboarding/during a timer/after a log.
- [ ] **Step 3:** RNTL (renders store prices from mock offerings; no hardcoded price); typecheck/lint green; **screenshot-verify**. **Commit** — `feat(paywall): before/after hero, store-priced plan picker, trial/restore`.

### Task D.3: Honest-Day calendar (the Pro feature) behind `<ProGate>`

**Files:**
- Create: `src/services/calendar.ts`, `src/features/calendar/HonestDayPreview.tsx`, `src/features/calendar/useHonestDay.ts`
- Gate the entry with `<ProGate>`; route from the Whenbee CTA (post-purchase) / Settings.

- [ ] **Step 1:** Invoke `react-native-expert`. `npx expo install expo-calendar`. `src/services/calendar.ts`: request **read** permission first → list today's events → map each to a category (heuristic by title + a confirm step) → inflate each block by that category's effective `M` (from the stats cache) → return a **before/after** diff. **Guarded by `isExpoGo`** (Expo Go → mock events).
- [ ] **Step 2:** `HonestDayPreview` shows the **before/after preview** (`planned crashes 5pm` → `honest ends 7:10pm`) + the realistic-day-capacity warning (`this won't fit — cut one`, kind/amber). **Write to the calendar ONLY on an explicit confirm** — no silent writes. Fire `calendar_padded` only on a confirmed write.
- [ ] **Step 3:** Test the pure mapping/inflation (a `buildHonestDay(events, statsByCategory)` helper, unit-tested with fixed inputs); RNTL that no write fires without confirm. **FLAG the user** for the on-device smoke-test of real calendar reads/writes. typecheck/lint/test green. **Commit** — `feat(pro): Honest-Day calendar padding — before/after, confirmed-write-only`.

**■ STOP 3 — founder review on device.** Verify: sandbox **purchase + 7-day trial + restore** on a fresh install; the paywall matches design and shows **store** prices; the calendar shows a real before/after with **zero un-consented writes**; exactly **one** Pro gate exists; the loop is still free end-to-end. If P3/alpha **D7 is weak, stop and fix friction/guilt — do not proceed.**

**PHASE D GATE:** sandbox purchase/trial/restore verified (FLAG device); calendar before/after with no un-consented writes; one Pro gate only; prices from RC. typecheck/lint/test/doctor green. Push.

---

# PHASE E — Patterns (lean, free) + polish (a11y / perf / copy)

**Goal:** ship the free self-insight surface; make the whole app kind, fast, accessible.

> Read `mvp/03-FEATURE-SPEC.md` (S1/S2/S5/S6/S7/S9/S10) + `05-RETENTION.md`. **Correlations + context tags are deferred** (the post-MVP second paywall) — Patterns reads only what the engine already produces. Invoke `ux-principles` + design + copy skills; `ui-design:accessibility-expert` for E.2.

### Task E.1: Patterns tab

**Files:**
- Create: `src/features/patterns/{Archetype,PlanExperiment,YouVsPast,BiggestSurprise,PredictionCard,DriftAlert,CalibrationMap}.tsx`, `src/features/patterns/usePatterns.ts`
- Modify: `src/app/(tabs)/patterns.tsx`

- [ ] **Step 1:** Build the lean cards, each with a **min-sample gate** (hidden until enough data) and dismissible, no-jargon, no-guilt copy:
  - **S1 Archetype** (one shareable time-personality, derived from category M spread).
  - **S2 With-vs-without-plan experiment** (honest verdict — reports wins for winging it when true).
  - **S5 You-vs-past-you** (recent calibration vs earlier).
  - **S6 Biggest surprise this week** (largest |ratio−1| log).
  - **S7 Prediction cards** (also surfaced on Today/Timer): "this usually runs ~Nm".
  - **S9 "What changed?" drift alert** (a category's M moved ≥ threshold).
  - **S10 Calibration map** (per-category honest-vs-guess overview).
- [ ] **Step 2:** TDD the pure derivations in `usePatterns` (each card's data is a pure function over stats/events — test with fixtures). RNTL renders each card on seeded data and **hides** on insufficient data. typecheck/lint/test green; **screenshot-verify**. **Commit** — `feat(patterns): lean free self-insight surface (archetype, experiment, surprise, drift, map)`.

### Task E.2: accessibility + performance + no-guilt copy audit

**Files:** cross-cutting; create `src/lib/__tests__/copyAudit.test.ts`.

- [ ] **Step 1:** Invoke `ui-design:accessibility-expert` + `vercel-react-native-skills`. Pass: reduce-motion equivalents everywhere (verify Honeycomb/Reward/Timer), Dynamic Type with no clipping, 44pt min targets, VoiceOver completes the full loop (labels on the ring, honeycomb, reclaim, chips), AA contrast (tokens already document ratios). Empty/error states on every screen. Performance: 60fps ring, `FlashList` on any list (recent/history/discoveries-when-added), cold start < 2s.
- [ ] **Step 2: Copy audit** — write a test that greps `src/**` for banned mechanics/strings (`streak`, `missed`, `don't lose`, `days in a row`, unqualified `saved you`, any red color token used as a guilt signal) and fails on a hit (allow-list the legitimate `danger` token usages). Run `humanizer` + `conversion-psychology` over all user-facing copy added in B–E. Fix every finding.
- [ ] **Step 3:** Full `npm run lint` + `npm test` green; `npx expo-doctor` 18/18. **Commit** — `chore(a11y): reduce-motion, Dynamic Type, VoiceOver, 60fps + no-guilt copy audit`.

**PHASE E GATE:** VoiceOver completes the loop; reduce-motion parity; Dynamic Type no clipping; 60fps ring; every empty/error path handled; copy audit passes; ESLint + tests green. Push.

---

# PHASE F — Beta + launch (feedback board + release — mostly FLAGGED)

**Goal:** real ADHD hands; validate the metrics; ship.

> Read `mvp/06 §5–§8`. The feedback board is the only network feature — keep it **off the core-loop path** and a **separate data class** (never task/calibration data).

### Task F.1: Feedback board (Supabase, anonymous-default)

**Files:** Create `src/services/feedback.ts`, `src/features/feedback/*`; add a Settings entry.

- [ ] **Step 1:** In the existing Supabase project, create `feature_requests` + `feature_votes` with **RLS** (anonymous-default, optional email). `src/services/feedback.ts` reads/writes via supabase-js, fully guarded so a network failure never touches the loop. Settings entry → board screen (list + submit + vote).
- [ ] **Step 2:** typecheck/lint/test green. **FLAG the user** to deploy the tables + RLS. **Commit** — `feat(feedback): anonymous feature-request board (Supabase, RLS, off core-loop)`.

### Task F.2: Release prep — FLAG for user

**Files:** App Store assets, `app.json` metadata, privacy labels; no app logic.

- [ ] **Step 1: Prepare** (agent does what's possible headless): App Store description (calibration + calendar-honesty positioning), keywords (ADHD + time optimist), privacy nutrition labels ("task data on-device, no account" + declare the feedback board), no health/diagnostic claims, privacy-policy + terms URLs, IAP/sub metadata.
- [ ] **Step 2: FLAG the user** for everything requiring an Apple Developer account / device / store access: EAS `preview` → TestFlight; QA across iOS versions/devices; **Dynamic Island / Live Activity on real hardware**; capture screenshots (Today, timer over-state, Whenbee hub, reward/cap, before/after honest-day, Patterns aha) + preview video; App Review submission (`eas submit`); recruit 10–20 testers (waitlist + r/ADHD / r/adhdwomen / r/ADHD_Programmers); Product Hunt (Tue–Thu 12:01 PT) + Reddit value-first posts + creator seeding + waitlist email.
- [ ] **Step 3: Pre-launch checklist** — run every box in `mvp/06 §5` (build/quality, monetization, store, analytics/infra). **Commit** — `chore(release): store metadata, privacy labels, pre-launch checklist`.

**VALIDATION GATE (the real one):** **D7 retention ≥ 25% on real users.** If weak, the friction/guilt design failed — fix that, nothing else, first. If strong, proceed to the deferred backlog **data-first** (Pro correlations + context tags, **Discoveries gallery**, earned-readiness narrative, brain breathers, recurring-memory Pro framing, coach export, finish-time notifications, then Watch / cloud-sync / Android).

---

## Self-review (spec coverage)

- **Reclaim Bank** (the new core concept) — engine A.1/A.2, data A.3/A.4, freeze A.5, hero + deposit beat + today line B.3/B.4/B.5, events C.1; monotonic + reconciliation property-tested (A.4); both-directions + `+0m`-never-shown enforced (A.1/B.4). Matches `05c` + `03b §5` acceptance criteria.
- **Discoveries** — correctly **deferred to fast-follow** (gallery/banking out of v1 per `03b §7`); the aha *card* already ships (category-detail, Phase 2). No discoveries table built — intentional.
- **`00-MVP-DEFINITION §3` "IN" items** — honeycomb B.1, Whenbee companion + hub B.2/B.3, reward choreography B.4, reason capture B.5, finish-time ring (already built), Start-By (already built), Patterns E.1, native presence C.3, Pro calendar D.3, paywall D.2, funnel + D7 C.1/C.2, feedback board F.1. **"Never cut"** list all present.
- **`00-MVP-DEFINITION §4` "OUT"** — Pro correlations/context-tags, reason-aware honest number, Discoveries gallery, brain breathers, coach export, Watch/cloud/Android, any LLM — all excluded; reason **capture** ships (B.5), only the correlation **read** defers.
- **Invariants** — monotonic Reclaim (A.1 max(0)/A.4 property test) + monotonic honey (existing); amber-never-red (B.1/B.3/B.4 + E.2 audit); on-device loop untouched (Reclaim adds one pure fn, `05c §13`); one Pro gate (D.1–D.3); prices-from-RC (D.2). 
- **Stack** — SDK 54 / expo-sqlite / kv / Zustand / Reanimated 4 respected throughout; migration is additive `0002`; no Drizzle/MMKV/SDK-56.
- **Stops** — exactly 3 (A/B/D), each at a suitable milestone, per the founder's "one or two per milestone, ~2–3 total" preference.
- **Design source** — every UI task mandates reading the nearest built sibling + the design skill + token-only values; no free-styling.
