# Routines (Pro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`). This is the largest feature in the queue — work strictly task-by-task, commit each.

**Goal:** A routine is a saved, ordered list of steps ("morning routine") that learns how long the WHOLE chain actually takes (per-step learning + a learned between-step "transition" overhead) and gives one honest total + a "start by" time. Build once, run with one-tap timers, watch the total tighten over real runs. Pro.

**Architecture:** Pure chain math in `src/engine/routine.ts` (TDD). Routine structure in TWO new SQLite tables (`routines`, `routine_steps`) via an **append-only migration at index 0008**. Per-step learning REUSES the existing `recurring_stats` table via a namespaced key `routine:{routineId}:{stepId}` (no schema change there) trained through the existing `applyLog` recurring path. A new `routinesStore` (list + build draft + active-run KV slice mirroring `planStore`). UI is a `Today · Routines` segment on the Plan tab; build/run reuse `PlanTaskCard`/`RunView`/`PlanRail`/`planBackward`. Full spec: `docs/product/specs/06-routines.md`.

> **AUDIT OVERRIDE:** the spec says migration "0006" — that index is taken (0005 name, 0006 first-honest-range, 0007 affine stats are all merged). **Use the next free index `0008`.** Confirm the exact next index by reading `src/db/migrations.ts` before writing.

**Tech Stack:** Expo SDK 54, RN 0.81 (Fabric), TS strict + `noUncheckedIndexedAccess`, Zustand + persist/`zustandKv`, expo-sqlite, Reanimated, Jest.

## Global Constraints

- **No-guilt:** no red anywhere; skipping/abandoning a run are first-class (not failures); no streak across runs; a long run is "good to know", never "you were late". The learned total only ever tightens (EWMA, clamped); the *displayed* build total may move as you edit steps (composition, not regression) — never framed as going backward. Amber accent only.
- **Reuse, don't reinvent:** per-step learning = the existing `recurring_stats` + `applyLog` path (namespaced key). Start-by = existing `planBackward`. Run UI = existing `RunView`/`PlanRail`. Build rows = existing `PlanTaskCard`/`DurationWheel`/`FinishTimeWheel`. Only genuinely-new math = the chain total + transition factor.
- **Engine purity:** `routine.ts` is pure, clock-free, no db/RN. The store passes resolved numbers in.
- **Layer rule:** features never touch raw SQL — go through `routinesRepo` and the store. `domain/types.ts` changes first (contract).
- **Append-only migration:** `IF NOT EXISTS`, never reorder existing entries. Both `memoryDatabase` and `sqliteDatabase` implement the new port methods.
- **Theming:** tokens via `useTheme()` + `typography`; no raw numbers/hex. The one indigo is the active segment / primary CTA; amber for honest totals.
- **Motion:** entering-only (no `exiting` — Fabric SIGABRT), `.get()/.set()`, honor `ReduceMotion.System`.
- **Privacy/on-device:** routines, steps, learned stats, run state all local SQLite/KV. No network, no calendar (the be-done-by anchor is a local minute-of-day int, never EventKit).
- **Pro lapse:** never delete a user's routines/learned data on downgrade; just re-lock the surface.
- **Commits:** Conventional Commits, **no AI/co-author trailers** (HARD RULE), plain `git`, no `init-cmt`.
- **Never merge.** Open a PR and stop.

---

### Task 1: Domain types

**Files:** Modify `src/domain/types.ts`.

**Interfaces:** Produces `Routine`, `RoutineStep`, `RoutineStepKey`, `RoutineSummary` (consumed by engine, db, store, UI).

- [ ] **Step 1:** Add (verbatim from spec §7.1):

```ts
export interface Routine {
  id: string;
  name: string;
  doneByMinuteOfDay: number | null;
  transitionFactor: number;  // ≥1, learned; defaults to TRANSITION_PRIOR
  runCount: number;          // completed full runs; monotonic
  createdAt: number;
  updatedAt: number;
}

export interface RoutineStep {
  id: string;
  routineId: string;
  position: number;          // 0-based, contiguous
  label: string;
  category: Category;        // reuse the existing Category type
  guessMin: number;
}

/** Per-step recurring key, namespaced so it never collides with free recurring keys. */
export type RoutineStepKey = `routine:${string}:${string}`; // routine:{routineId}:{stepId}

export interface RoutineSummary {
  routineId: string;
  honestTotalMin: number;    // round5(sum(per-step honest) × transitionFactor)
  basis: 'personal' | 'prior';
  label: string;             // "based on your last N runs" | "based on typical patterns"
  runCount: number;
  steps: { stepId: string; honestMin: number }[];
}
```

(Confirm the existing `Category` type name/shape in `domain/types.ts` and reuse it.)

- [ ] **Step 2:** `npm run typecheck` → clean. Commit. `git commit -m "feat(domain): add Routine types"`

---

### Task 2: Engine — `routine.ts` (TDD)

**Files:** Modify `src/engine/constants.ts`, `src/engine/index.ts`; create `src/engine/routine.ts`, `src/engine/__tests__/routine.test.ts`.

**Interfaces:** Produces `stepHonestMinutes`, `routineHonestTotal`, `routineBasis`, `distributeRoutineRun` + constants `TRANSITION_PRIOR=1.15`, `TRANSITION_ALPHA=0.3`, `ROUTINE_PERSONAL_MIN_RUNS=3`, `TRANSITION_FLOOR=1.0`, `TRANSITION_CEIL=2.0`.

- [ ] **Step 1: Constants** (spec §8.1) into `src/engine/constants.ts`:

```ts
// ── Routines (Pro) ───────────────────────────────────────────────────────────
export const TRANSITION_PRIOR = 1.15;          // day-1 chain seam overhead (+15%)
export const TRANSITION_ALPHA = 0.3;           // EWMA rate for the transition factor
export const ROUTINE_PERSONAL_MIN_RUNS = 3;    // below this, total is prior-based
export const TRANSITION_FLOOR = 1.0;
export const TRANSITION_CEIL = 2.0;
```

- [ ] **Step 2: Failing tests** — `src/engine/__tests__/routine.test.ts` (spec §8.3 cases): `routineHonestTotal([20,10,15],1.0)===45`; with `1.15` → round5(51.75)=50; `routineHonestTotal([],f)===5` (floor, never 0); `stepHonestMinutes` equals `honestNumber` (delegation); `routineBasis(0|2)` → prior + "typical patterns", `routineBasis(3)` → personal + "based on your last 3 runs"; `distributeRoutineRun` returns per-step `{stepKey,estimateMin,actualMin}` trainings + a clamped+EWMA `nextTransitionFactor`; transition clamp (3× run can't exceed CEIL 2.0); transition floor (fast run can't drop below 1.0); purity (no mutation, no clock); single-step routine trains the factor.

- [ ] **Step 3: Run → fail.**

- [ ] **Step 4: Implement `src/engine/routine.ts`** (spec §8.2). `stepHonestMinutes(guessMin, stepM) = honestNumber(guessMin, stepM)`. `routineHonestTotal(perStepHonestMin, factor) = max(5, round5(sum × factor))`. `routineBasis(runCount)` → `{ basis, label }` keyed on `ROUTINE_PERSONAL_MIN_RUNS`. `distributeRoutineRun({ steps: {stepKey,guessMin,actualMin,stepMBefore}[], priorFactor })`:
  - `stepTrainings` = one `{ stepKey, estimateMin: guessMin, actualMin }` per step.
  - `observedFactor = sum(actualMin) / sum(stepHonestBaseline)` where `stepHonestBaseline = stepHonestMinutes(guessMin, stepMBefore)`; clamp to `[FLOOR,CEIL]`, EWMA with `TRANSITION_ALPHA` against `priorFactor`, clamp again. Pure, no mutation.

  Import `honestNumber` from `./multiplier`.

- [ ] **Step 5: Export** the four fns + types from `src/engine/index.ts`.

- [ ] **Step 6: Run → pass. Commit.**

```bash
git add src/engine/routine.ts src/engine/constants.ts src/engine/index.ts src/engine/__tests__/routine.test.ts
git commit -m "feat(engine): add routine chain math (transition factor, pure)"
```

---

### Task 3: DB — migration 0008 + port methods + adapters + repo (TDD)

**Files:** Modify `src/db/migrations.ts`, `src/db/types.ts`, `src/db/Database.ts`, `src/db/memoryDatabase.ts`, `src/db/sqliteDatabase.ts`; create `src/db/repositories/routinesRepo.ts` + tests in `src/db/repositories/__tests__/`.

**Interfaces:** `routinesRepo` with `list()`, `get(id)`, `create(routine, steps)`, `update(routine, steps)`, `remove(id)`, `setTransitionFactor(id, factor)`, `incrementRunCount(id)` — full CRUD over both tables. Mirrors existing repos.

- [ ] **Step 1: Confirm the next migration index** by reading `src/db/migrations.ts` (expected 0008). Append (spec §7.2, index corrected):

```sql
-- 0008 — Routines (Pro): saved multi-step sequences + ordered steps.
CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  done_by_minute_of_day INTEGER,
  transition_factor REAL NOT NULL DEFAULT 1.15,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS routine_steps (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  guess_min REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_routine_steps_routine ON routine_steps (routine_id, position);
```

- [ ] **Step 2: DTOs** in `src/db/types.ts`: `RoutineRow`, `RoutineStepRow`.

- [ ] **Step 3: Port + adapters** — add the routine methods to the `Database` interface (`src/db/Database.ts`) and implement in BOTH `memoryDatabase.ts` (in-memory maps) and `sqliteDatabase.ts` (parameterized SQL, INSERT OR REPLACE / DELETE; steps replaced atomically on update). Mirror the shape of the existing `category_stats` methods.

- [ ] **Step 4: `routinesRepo.ts`** — thin semantic wrapper over the port (mirror `categoryStatsRepo.ts`). Map rows ↔ domain types.

- [ ] **Step 5: Tests** (write alongside) — `routinesRepo` round-trips a routine + steps through the **memory** adapter: create → list → get (steps ordered by position); update replaces steps; remove deletes both; `setTransitionFactor`/`incrementRunCount` persist. Add a migration test asserting the tables exist after migrate (follow the existing migration test pattern).

- [ ] **Step 6: Run → green. Commit.**

```bash
git add src/db/migrations.ts src/db/types.ts src/db/Database.ts src/db/memoryDatabase.ts src/db/sqliteDatabase.ts src/db/repositories/routinesRepo.ts src/db/repositories/__tests__
git commit -m "feat(db): add routines + routine_steps tables and repo (migration 0008)"
```

---

### Task 4: Store — `routinesStore` (list + build draft + active-run slice)

**Files:** Create `src/stores/routinesStore.ts` + test.

**Interfaces:** Zustand store: `routines: Routine[]` (+ steps), `loadRoutines()`, build-draft state (`draft`, `setName`, `addStep`, `editStep`, `removeStep`, `reorderSteps`, `setDoneBy`, `saveDraft`, `editExisting(id)`), and an active-run slice (KV-persisted like `planStore.active`): `startRun(routineId)`, `completeStep(stepId, actualMin)`, `skipStep(stepId)`, `finishRun()`, `abandonRun()`. On `finishRun` (FULL run only — all steps done), call `distributeRoutineRun`, feed each `stepTrainings` entry to the existing recurring training path, persist `nextTransitionFactor` + `incrementRunCount`. Partial/skip runs train only completed steps and do NOT touch the factor or `runCount`.

- [ ] **Step 1: Read first** — `src/stores/planStore.ts` (active/draft KV-persist pattern), `src/stores/calibrationStore.ts` + `src/engine/update.ts` recurring path + `src/db/repositories/recurringRepo.ts` to learn EXACTLY how a recurring task trains (the `applyLog` recurring branch). The routine step training must reuse that path with the `routine:{routineId}:{stepId}` key — mirror it, do not invent a parallel learning path.
- [ ] **Step 2: Implement** the store. Only the active-run slice is KV-persisted (mirror `planStore`'s `persist` + `partialize` if it uses one); the routine list is loaded from `routinesRepo` on demand. `stepMBefore` for `distributeRoutineRun` = the step's recurring M (or category M fallback) read BEFORE training this run.
- [ ] **Step 3: Tests** — saving a draft persists a routine+steps (via memory db); a full run trains each step (assert the recurring stat advanced) + bumps `runCount` + updates `transitionFactor`; a run with a skipped step does NOT bump `runCount` or the factor but trains completed steps; abandon clears the active-run slice.
- [ ] **Step 4: Commit.** `git commit -m "feat(store): add routinesStore with learned-chain run training"`

---

### Task 5: Hook — `useRoutines`

**Files:** Create `src/features/routines/useRoutines.ts` + light test.

**Interfaces:** Composes `routinesStore` + engine: derive `RoutineSummary` per routine (`routineHonestTotal` over resolved per-step honest minutes × `transitionFactor`, `routineBasis`), and run `planBackward` for the "start by" when `doneByMinuteOfDay` is set (compute today's deadline epoch from the minute-of-day + `nowMs`; tomorrow if already past). Resolve per-step honest minutes via the recurring-or-category M (reuse `resolveSuggestion`'s fallback, as `usePlanner.suggestedDuration` does).

- [ ] **Step 1–4:** test (summary total + basis + start-by for a seeded routine) → implement → green → commit. `git commit -m "feat(routines): add useRoutines hook (summary + start-by)"`

---

### Task 6: UI — Plan tab `Today · Routines` segment + Routines list + locked teaser

**Files:** Modify `src/app/(tabs)/plan.tsx`; create `src/features/routines/RoutinesList.tsx`, `src/features/routines/RoutinesLocked.tsx`.

UI — typecheck + lint; sim pending founder. Per spec §3/§5.1/§9/§10:
- `plan.tsx` gains a header segmented control `Today · Routines` (active = the one indigo indicator). `Today` = the existing BuildView/RunView flow (UNCHANGED, free). `Routines` = the new surface, wrapped `<ProGate fallback={<RoutinesLocked/>}><RoutinesList/></ProGate>`. The segment itself is always visible (discoverable); content gated.
- `RoutinesList`: routine cards (name, honest total `type.honestNumberMd` + basis caption, optional `Start by {time}`, a "N steps" chip), empty state ("Save a sequence you do a lot, like your morning. I'll learn how long the whole thing really takes."), a "New routine" `AppButton`. Footer `+ insets.bottom`.
- `RoutinesLocked`: one greyed non-interactive sample routine (0.4 opacity) showing the shape + value line "Save your morning once. Whenbee learns how long the whole thing really takes, so \"start by\" is a number you can trust." + one indigo `AppButton` "See Whenbee Pro" → `router.push({ pathname: '/(modals)/paywall', params: { trigger: 'routines' } })`. Fire `routines_paywall`.
- Fire `routines_tab_viewed { is_pro, routine_count }` on the Routines segment mount.

- [ ] **Step 1–4:** build → mount → typecheck+lint → commit. `git commit -m "feat(routines): add Routines segment, list, and locked teaser"`

---

### Task 7: UI — Routine build + run

**Files:** Create `src/features/routines/RoutineBuildView.tsx`, `src/features/routines/RoutineRunView.tsx` (route them from `RoutinesList` selection / "New routine").

UI — typecheck + lint; sim pending founder. Per spec §5.2/§5.3:
- **Build:** name field; steps list reusing `PlanTaskCard` shape (label + category + per-step honest duration read-only, tapping it opens `DurationWheel` to edit the GUESS); "+ Add step" inline; optional "Be done by" `FinishTimeWheel` (`showModes={false}`); a live running honest total (`type.honestNumberLg`) with the transition factor applied + "including the in-between time" caption. Save disabled until name + ≥1 step.
- **Run:** reuse `RunView` + `PlanRail` seeded from the routine's steps (mapped to the run rail's task input); current step has the one-tap timer; finishing a step records its actual + advances; skip allowed; completion recap (calm, amber, no guilt) — "That run took {actual}. Your {name} is settling — next time I'll expect about {honest}." (ran long → the "Good to know" variant). On full completion the store trains (Task 4).
- Copy verbatim from spec §10; banned guilt strings absent.

- [ ] **Step 1–4:** build both → wire navigation → typecheck+lint → commit. `git commit -m "feat(routines): add routine build and run views"`

---

### Task 8: Paywall trigger + analytics

**Files:** Modify `src/features/paywall/Paywall.tsx`, `src/services/analytics.ts`.

- [ ] **Step 1:** Add `'routines'` to `Paywall.tsx`'s `Trigger` union + `isTrigger`, and to the `paywall_view.trigger` union in `analytics.ts`. Add the events (spec §12): `routines_tab_viewed`, `routines_paywall`, `routine_created`, `routine_edited`, `routine_run_started`, `routine_step_completed`, `routine_step_skipped`, `routine_run_completed`, `routine_run_abandoned` (no PII — names never sent; use a non-reversible hash only where a routine must be distinguished).
- [ ] **Step 2:** typecheck + lint + commit. `git commit -m "feat(analytics): add routine events and routines trigger"`

---

### Task 9: Full gate + PR (do NOT merge)

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test` → all green.
- [ ] **Step 2:**

```bash
git push -u origin feat/pro-06-routines
gh pr create --title "feat: routines (Pro)" \
  --body "Saved multi-step sequences with one learned honest total + start-by. New routines/routine_steps tables (migration 0008), pure chain math (per-step recurring learning + EWMA transition factor), routinesStore + active-run slice, Today·Routines segment on the Plan tab reusing PlanTaskCard/RunView/PlanRail/planBackward. Per-step learning reuses recurring_stats via namespaced keys (no parallel learning path). No-guilt: skips/abandons first-class, learned total only tightens. Spec: docs/product/specs/06-routines.md. Plan: docs/superpowers/plans/2026-06-21-pro-06-routines.md. Sim verification pending (founder)."
```

Do NOT merge. Report PR URL, commits, gate output, deviations (esp. the migration index + how step training was wired), main HEAD unchanged.

---

## Self-Review

**Spec coverage:** domain types ✔ (T1), chain engine + constants ✔ (T2), tables/port/adapters/repo at index 0008 ✔ (T3), store with full-run training + partial-run rules ✔ (T4), summary + start-by hook ✔ (T5), segment + list + locked ✔ (T6), build + run ✔ (T7), trigger + analytics ✔ (T8). Per-step learning reuses `recurring_stats` (not a parallel store) ✔. No-guilt + on-device + no-calendar enforced.

**Override applied:** migration index corrected to 0008 (spec's 0006 is taken) — stated in header + T3.

**Placeholder scan:** domain/engine/migration carry full code + tests. T3–T7 give exact tables, port-method intent, copy strings, reuse targets, and instruct reading the recurring-training path before wiring (the one genuinely-integration-risky step) rather than hand-waving it.

**Type consistency:** `Routine`/`RoutineStep`/`RoutineStepKey`/`RoutineSummary`, `stepHonestMinutes`/`routineHonestTotal`/`routineBasis`/`distributeRoutineRun`, `routinesRepo` CRUD, the store actions, and the nine `routine*` events are consistent T1–T8.
