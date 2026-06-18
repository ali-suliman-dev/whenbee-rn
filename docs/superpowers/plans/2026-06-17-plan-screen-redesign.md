# Start-By Plan Screen Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken Start-By Plan screen with a two-phase **Build → Run** experience: a drag-sortable card list for composing the plan, and a timeline progress-rail for running it with loggable, timer-backed tasks.

**Architecture:** One route (`src/app/(tabs)/plan.tsx`) renders **BuildView** when `planStore.active` is null and **RunView** when a plan is active. The pure engine (`src/engine/planner.ts`) gains between-task breather gaps and a `reproject` diff. The store (`src/stores/planStore.ts`) gains `breatherMin`, per-task run state, and a reorder guard. Running a task routes through the existing `/(modals)/timer` (timer-as-log) — the planner never writes logs.

**Tech Stack:** React Native 0.81 (Fabric) · Expo SDK 54 · expo-router 6 · Zustand (+ kv persist) · react-native-reanimated ~4.1 · react-native-gesture-handler ~2.28 · react-native-reorderable-list (to add) · TypeScript strict.

## Global Constraints

- **Theme tokens only.** Every color/spacing/size/font/radius comes from `src/theme/tokens.ts` via `useTheme()`. No inline hex or raw number. New value ⇒ add a token; new token *group* ⇒ add a matching line in `useTheme`'s `resolveTheme` or `t.<key>` is `undefined`.
- **Dark + light both.** Tokens resolve per mode; never hardcode a dark value.
- **Layer boundary (ESLint-enforced):** `src/app/**` and `src/components/**` must NOT import `src/services/*` or `src/db/*`. Route through store / provider / feature hook. Routes in `src/app/` stay thin.
- **Invariants:** no guilt, **amber-never-red** (red used ONLY for the Abandon action, never for the over/verdict state); honey/sharpness monotonic; **core loop on-device only** (no network in the plan); no streaks; one-thing-at-a-time. Engine is pure (no React/RN/`Date.now()`).
- **TDD required** for engine, store, domain, hooks (logic layer). Write the failing test first.
- **RN Fabric gotchas:** no CSS `boxShadow` (use View-edge or `Platform.select`); `Pressable` function-form `style` drops under reactCompiler+nativewind — put visuals on an inner `View`; read/write Reanimated shared values with `.get()/.set()`, never `.value`; footers add `useSafeAreaInsets().bottom`.
- **Commands:** `npm run lint` (0 warnings), `npm run typecheck`, `npm test`, single: `npx jest <path>`. Expo deps via `npx expo install` then `npx expo-doctor` (expect 18/18).
- **Git:** Conventional Commits. **NEVER** add `Co-Authored-By` / AI-attribution / 🤖 to any commit or PR. Work in an **isolated git worktree**; open a PR; **do not merge** — the founder merges by hand.
- **MANDATORY design/code skills** when implementing the matching area: `clean-code`, `coding-standards`, `typescript-expert`, `react-native-expert`, `ui-design:react-native-design`, `creating-reanimated-animations` + `motion-design` (any animation), `conversion-psychology` + `humanizer` (any user-facing copy).

**Reference:** design spec at `docs/superpowers/specs/2026-06-17-plan-screen-redesign-design.md`; rendered mockup at `docs/superpowers/mockups/2026-06-17-plan-final-two-phase.html`.

---

## File Structure

**Modify:**
- `src/domain/types.ts` — run fields, breather, timeline-item kind.
- `src/engine/constants.ts` — breather chip values.
- `src/engine/planner.ts` — breather gaps in backward pass + timeline; `reproject`.
- `src/engine/index.ts` — export `reproject`.
- `src/stores/planStore.ts` — `breatherMin`, run state, actions, reorder guard.
- `src/features/planner/usePlanner.ts` — phase selectors, breather, reproject, cut state.
- `src/app/(tabs)/plan.tsx` — thin: render BuildView or RunView.
- `src/theme/tokens.ts` + `src/theme/useTheme` — rail geometry tokens.
- `package.json` — add `react-native-reorderable-list`.

**Create (in `src/features/planner/`):**
- `BuildView.tsx`, `RunView.tsx`
- `PlanTaskCard.tsx` (build + run variants), `PlanRail.tsx`, `RailNode.tsx`
- `DurationWheel.tsx`, `FinishTimeWheel.tsx` (wrap the reused wheel)
- `BreatherChips.tsx`, `AbandonButton.tsx`, `CutCard.tsx`
- Tests under `src/features/planner/__tests__/`, `src/engine/__tests__/`, `src/stores/__tests__/`.

---

## Task 0: Isolated worktree + branch

**Files:** none (git setup).

- [ ] **Step 1: Create an isolated worktree** (use superpowers:using-git-worktrees). From the main repo root:

```bash
git worktree add ../whenbee-plan-redesign -b feature/plan-screen-redesign
cd ../whenbee-plan-redesign
```

- [ ] **Step 2: Verify you are in the worktree on the new branch**

```bash
git rev-parse --abbrev-ref HEAD   # → feature/plan-screen-redesign
pwd                                # → .../whenbee-plan-redesign
```
Expected: branch is `feature/plan-screen-redesign`, cwd is the worktree. **All subsequent work happens here.** After each commit, re-run `git rev-parse --abbrev-ref HEAD` to confirm commits land on this branch (not main).

- [ ] **Step 3: Install deps in the worktree**

```bash
npm install
```

---

## Task 1: Domain types — run state, breather, timeline kind

**Files:**
- Modify: `src/domain/types.ts`
- Test: `src/engine/__tests__/planner.test.ts` (types are exercised by later engine tests; no standalone type test)

**Interfaces:**
- Produces: `PlanTaskStatus`, extended `PlanTaskInput`/plan-task with `status`, `completedAt`, `actualMin`, `suggestedHonestMin`; `PlanTimelineItem` gains `kind: 'task' | 'breather'`; plan input gains `breatherMin`.

- [ ] **Step 1: Read the current types**

Run: `sed -n '1,200p' src/domain/types.ts` and locate `PlanTaskInput`, `PlanTimelineItem`, `PlanResult`, `PlanVerdict`.

- [ ] **Step 2: Add run + breather fields** (adapt names to the existing shapes you just read; keep additive, do not break current fields)

```typescript
export type PlanTaskStatus = 'upcoming' | 'running' | 'done';

// Extend the existing plan task type used by the store/UI (NOT the pure engine input):
//   status: lifecycle in Run mode
//   completedAt: ms when logged (from the timer-as-log path)
//   actualMin: real logged minutes (display only; never written back to the model here)
//   suggestedHonestMin: frozen honest suggestion at creation
export interface PlanTaskRunState {
  status: PlanTaskStatus;
  completedAt?: number;
  actualMin?: number;
  suggestedHonestMin: number;
}

// Timeline items can be a scheduled task OR a between-task breather gap.
export type PlanTimelineKind = 'task' | 'breather';
```

Then: add `kind: PlanTimelineKind` to `PlanTimelineItem` (default `'task'` at construction sites) and add optional `breatherMin?: number` to the engine plan input type.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (additive optional fields; fix any required-field breakage by defaulting at construction).

- [ ] **Step 4: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(plan): add run-state, breather, and timeline-kind domain types"
```

---

## Task 2: Engine — between-task breather gaps (TDD)

**Files:**
- Modify: `src/engine/constants.ts`, `src/engine/planner.ts`, `src/engine/index.ts`
- Test: `src/engine/__tests__/planner.test.ts`

**Interfaces:**
- Consumes: `planBackward(input)` (existing), `effectiveBlockMin` (existing).
- Produces: `planBackward` honours `input.breatherMin` — inserts a gap of `breatherMin` between consecutive tasks, pushing `startBy` earlier and emitting `kind:'breather'` timeline items. `BREATHER_CHIPS = [0,5,10,20] as const`.

- [ ] **Step 1: Write the failing test**

```typescript
import { planBackward } from '../planner';

test('breatherMin inserts gaps between tasks and pushes startBy earlier', () => {
  const deadline = Date.UTC(2026, 5, 17, 22, 52); // 22:52
  const base = {
    deadline,
    nowMs: Date.UTC(2026, 5, 17, 18, 0),
    bufferMin: 0,
    tasks: [
      { id: 'a', label: 'A', category: 'x', durationMin: 30 },
      { id: 'b', label: 'B', category: 'x', durationMin: 30 },
      { id: 'c', label: 'C', category: 'x', durationMin: 30 },
    ],
  };
  const noBreather = planBackward({ ...base, breatherMin: 0 });
  const withBreather = planBackward({ ...base, breatherMin: 10 });

  // 3 tasks → 2 gaps × 10m = 20m earlier start
  expect(noBreather.startBy - withBreather.startBy).toBe(20 * 60_000);
  // timeline includes 2 breather items
  expect(withBreather.timeline.filter((i) => i.kind === 'breather')).toHaveLength(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/planner.test.ts -t "breatherMin inserts"`
Expected: FAIL (breather unhandled / `kind` undefined).

- [ ] **Step 3: Add the constant**

In `src/engine/constants.ts`:
```typescript
/** Between-task breather chip values (minutes). Off / +5 / +10 / +20. */
export const BREATHER_CHIPS = [0, 5, 10, 20] as const;
export const DEFAULT_BREATHER_MIN = 0;
```

- [ ] **Step 4: Implement breather in the backward pass**

In `src/engine/planner.ts`, read the current `buildTimeline`/`startByFor` loop, then: between consecutive tasks subtract `breatherMin` from the running cursor and emit a `{ kind: 'breather', startMs, endMs }` item. Tag every existing task item with `kind: 'task'`. Pseudostructure (adapt to the real loop):

```typescript
const breatherMin = Math.max(0, input.breatherMin ?? 0);
// walking backward from deadline: after placing task i (i>0), insert a gap
// cursor = taskStart - breatherMin*60_000, and push a breather timeline item
// spanning [cursor, taskStart] when breatherMin > 0.
```
`startBy` is the final cursor (already earlier because gaps were subtracted).

- [ ] **Step 5: Export nothing new yet; run the test**

Run: `npx jest src/engine/__tests__/planner.test.ts -t "breatherMin inserts"`
Expected: PASS.

- [ ] **Step 6: Run the full engine suite (no regressions)**

Run: `npx jest src/engine`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/constants.ts src/engine/planner.ts src/engine/__tests__/planner.test.ts
git commit -m "feat(engine): insert between-task breather gaps in the backward pass"
```

---

## Task 3: Engine — `reproject` diff (TDD)

**Files:**
- Modify: `src/engine/planner.ts`, `src/engine/index.ts`
- Test: `src/engine/__tests__/planner.test.ts`

**Interfaces:**
- Produces: `reproject(input: { deadline; nowMs; bufferMin?; breatherMin?; tasks: {id,durationMin,status?}[] }): { startBy; timeline; verdict; totalMin; stillFits: boolean }` — recomputes over **incomplete** tasks only (skips `status === 'done'`), returns the same shape as `planBackward` plus `stillFits`. Never mutates; caller confirms.

- [ ] **Step 1: Write the failing test**

```typescript
import { reproject } from '../planner';

test('reproject skips done tasks and flags fit against the same deadline', () => {
  const deadline = Date.UTC(2026, 5, 17, 22, 52);
  const out = reproject({
    deadline,
    nowMs: Date.UTC(2026, 5, 17, 22, 0),
    bufferMin: 0,
    breatherMin: 0,
    tasks: [
      { id: 'a', durationMin: 20, status: 'done' },
      { id: 'b', durationMin: 30, status: 'upcoming' },
    ],
  });
  // only 'b' (30m) remains; 22:00 + 30m = 22:30 ≤ 22:52 → fits
  expect(out.stillFits).toBe(true);
  expect(out.timeline.filter((i) => i.kind === 'task')).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/planner.test.ts -t "reproject skips done"`
Expected: FAIL ("reproject is not a function").

- [ ] **Step 3: Implement `reproject`**

In `src/engine/planner.ts`: filter out `status === 'done'`, call the shared backward pass over the remainder, set `stillFits = startBy >= nowMs` (i.e. the verdict is not `'over'`). Reuse `cutLadder` for the over case so the caller can show the cut card.

```typescript
export function reproject(input: ReprojectInput): ReprojectResult {
  const remaining = input.tasks.filter((t) => t.status !== 'done');
  const result = planBackward({ ...input, tasks: remaining });
  return { ...result, stillFits: result.verdict.kind === 'fits' };
}
```

- [ ] **Step 4: Export it** — add to `src/engine/index.ts`:
```typescript
export { planBackward, reproject, DEFAULT_BUFFER_MIN } from './planner';
export { BREATHER_CHIPS, DEFAULT_BREATHER_MIN } from './constants';
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/engine`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/planner.ts src/engine/index.ts src/engine/__tests__/planner.test.ts
git commit -m "feat(engine): add reproject diff over incomplete tasks"
```

---

## Task 4: Store — breather, run state, reorder guard (TDD)

**Files:**
- Modify: `src/stores/planStore.ts`
- Test: `src/stores/__tests__/planStore.test.ts`

**Interfaces:**
- Consumes: existing `addTask`, `reorderTasks`, `saveActive`, `clearActive`, `reset`, `setBuffer`.
- Produces: `setBreather(min: number)`; `breatherMin` on draft + active; `startTask(id)` sets that task `status:'running'` and others stay `upcoming`/`done`; `completeTask(id, actualMin)` → `status:'done'`, `completedAt`, `actualMin`; `reorderTasks(ids)` rejects any move of a `running` task (returns unchanged).

- [ ] **Step 1: Write the failing tests**

```typescript
import { usePlanStore } from '../planStore';

beforeEach(() => usePlanStore.getState().reset());

test('setBreather stores between-task breather minutes on the draft', () => {
  usePlanStore.getState().setBreather(10);
  expect(usePlanStore.getState().draft.breatherMin).toBe(10);
});

test('reorderTasks refuses to move the running task', () => {
  const s = usePlanStore.getState();
  const a = s.addTask({ label: 'A', category: 'x', durationMin: 20 });
  const b = s.addTask({ label: 'B', category: 'x', durationMin: 20 });
  s.saveActive();                 // freeze → active
  s.startTask(a.id);              // a is running
  s.reorderTasks([b.id, a.id]);   // attempt to move a out of slot 0
  expect(usePlanStore.getState().active!.tasks[0]!.id).toBe(a.id); // unchanged
});

test('completeTask marks done with actual minutes', () => {
  const s = usePlanStore.getState();
  const a = s.addTask({ label: 'A', category: 'x', durationMin: 20 });
  s.saveActive();
  s.completeTask(a.id, 24);
  const t = usePlanStore.getState().active!.tasks[0]!;
  expect(t.status).toBe('done');
  expect(t.actualMin).toBe(24);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/stores/__tests__/planStore.test.ts`
Expected: FAIL (`setBreather`/`startTask`/`completeTask` undefined).

- [ ] **Step 3: Implement**

Read `src/stores/planStore.ts` fully. Add `breatherMin: DEFAULT_BREATHER_MIN` to `emptyDraft` and to the `ActivePlan` frozen in `saveActive`. Add a `status: 'upcoming'` + `suggestedHonestMin` default when creating tasks. Add the three actions; in `reorderTasks`, if any task currently `running` would change index, return state unchanged. Persist only `active` (existing `partialize`).

- [ ] **Step 4: Run tests**

Run: `npx jest src/stores/__tests__/planStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/planStore.ts src/stores/__tests__/planStore.test.ts
git commit -m "feat(plan): store breather, run state, and running-task reorder guard"
```

---

## Task 5: Hook — `usePlanner` phase selectors + reproject + cut state (TDD)

**Files:**
- Modify: `src/features/planner/usePlanner.ts`
- Test: `src/features/planner/__tests__/usePlanner.test.ts` (create if absent)

**Interfaces:**
- Produces: `phase: 'build' | 'run'` (derived from `active`); `setBreather`; `runGroups: { done, now, next }` split from the active plan; `reproject()` returning the engine diff + setting `cut` state; `cut: CutChoice | null`; `acceptCut()` / `dismissCut()`.

- [ ] **Step 1: Write the failing test**

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { usePlanner } from '../usePlanner';
import { usePlanStore } from '@/src/stores/planStore';

beforeEach(() => usePlanStore.getState().reset());

test('phase flips to run once a plan is active', () => {
  const { result } = renderHook(() => usePlanner());
  act(() => { result.current.addTask({ label: 'A', category: 'x', durationMin: 20 }); });
  expect(result.current.phase).toBe('build');
  act(() => { result.current.saveActive(); });
  expect(result.current.phase).toBe('run');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/planner/__tests__/usePlanner.test.ts -t "phase flips"`
Expected: FAIL.

- [ ] **Step 3: Implement** the selectors/actions in `usePlanner.ts`, wiring `reproject` from the engine with `Date.now()` supplied at the hook boundary (engine stays pure). Derive `runGroups` by `status`.

- [ ] **Step 4: Run tests**

Run: `npx jest src/features/planner`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/usePlanner.ts src/features/planner/__tests__/usePlanner.test.ts
git commit -m "feat(plan): usePlanner phase selectors, reproject, and cut-card state"
```

---

## Task 6: Add the drag-reorder library

**Files:** Modify `package.json` (via installer).

- [ ] **Step 1: Install via Expo and check doctor**

```bash
npx expo install react-native-reorderable-list
npx expo-doctor
```
Expected: installs; `expo-doctor` reports 18/18. If it reports an SDK-54 / RN-0.81 incompatibility, STOP and switch this task to a hand-rolled `Gesture.Pan()` + shared-value sortable list (Reanimated worklets) per `ui-design:react-native-design`; record the decision in the PR description.

- [ ] **Step 2: Confirm it builds**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(plan): add react-native-reorderable-list for drag-to-reorder"
```

---

## Task 7: Theme tokens — rail geometry

**Files:** Modify `src/theme/tokens.ts` and the `useTheme` resolver.

- [ ] **Step 1: Read** `src/theme/tokens.ts` and the `useTheme`/`resolveTheme` enumeration (per the project gotcha: a new token group needs a matching `useTheme` line).

- [ ] **Step 2: Add a `planRail` group**

```typescript
// Start-By Plan progress rail geometry (RunView). gutter = time/node column
// width; node = circle diameter; nowRing = pulse halo radius; nowPillPad y/x.
planRail: { gutter: 46, node: 20, nowRing: 3, breatherNode: 16, connector: 2 },
```
Add the matching `planRail` line to the `useTheme` resolver so `t.planRail` is defined.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/theme/tokens.ts src/theme/*useTheme*
git commit -m "feat(plan): add planRail geometry tokens"
```

---

## Task 8: Wheels — `DurationWheel` + `FinishTimeWheel`

**Files:**
- Read first: `src/features/shared/TimeField.tsx` (the existing Add-Task picker).
- Create: `src/features/planner/DurationWheel.tsx`, `src/features/planner/FinishTimeWheel.tsx`

**Interfaces:**
- Produces: `<DurationWheel valueMin step={5} onChange />` (slim, 3-row, center pill); `<FinishTimeWheel value={Date} mode onChange />` (two slim HH:MM columns + mode chips). Both reuse `TimeField`'s wheel physics (snap + momentum + haptic). All styling from tokens.

- [ ] **Step 1: Read `TimeField.tsx`** to learn the existing wheel API (snap interval, render of rows, haptics). Reuse its inner wheel; if it's not extractable, wrap a `ScrollView`/`FlatList` with `snapToInterval` + `pagingEnabled={false}` and `onMomentumScrollEnd` → nearest index, matching its look.

- [ ] **Step 2: Implement `DurationWheel`** — vertical wheel, center row bold + `tokens.colors.*` pill (`surfaceSunken`), neighbours `inkFaint`; step 5; emits minutes. Center selection band uses `radii.full`. No play button (Build only).

- [ ] **Step 3: Implement `FinishTimeWheel`** — two `DurationWheel`-style columns (hours 0–23, minutes 0–55 step 5) with a `:` between, plus mode chips (`leave by` / `be done by` / `be at`) above. Emits a `Date`/ms deadline.

- [ ] **Step 4: Verify render in the running app** (no CLI tap; screenshot per CLAUDE.md). Build BuildView later consumes these — for now add a temporary Storybook-less manual mount or defer visual check to Task 9's screenshot. Typecheck:

Run: `npm run typecheck && npm run lint -- src/features/planner/DurationWheel.tsx src/features/planner/FinishTimeWheel.tsx`
Expected: PASS, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/DurationWheel.tsx src/features/planner/FinishTimeWheel.tsx
git commit -m "feat(plan): DurationWheel + FinishTimeWheel reusing the Add-Task wheel"
```

---

## Task 9: BuildView (Phase 1)

**Files:**
- Create: `src/features/planner/BuildView.tsx`, `src/features/planner/PlanTaskCard.tsx`, `src/features/planner/BreatherChips.tsx`
- Read: existing `src/features/planner/BufferChips.tsx`, `DeadlinePicker.tsx`, `TaskRow.tsx`, `VerdictCard.tsx` for patterns to follow/replace.

**Interfaces:**
- Consumes: `usePlanner()` (`draft`, `addTask`, `removeTask`, `updateTaskDuration`, `reorderTasks`, `setBreather`, `setDeadline`, `saveActive`, verdict).
- Produces: `<BuildView />` rendered by the route when `phase === 'build'`.

- [ ] **Step 1: `BreatherChips`** — chips `Off / +5 / +10 / +20` bound to `setBreather` (repurpose `BufferChips`). Label "Breather between tasks". Tokens only; active chip = `primarySoft` + `primary` border.

- [ ] **Step 2: `PlanTaskCard` (build variant)** — `⠿ drag · [range chip · title · category] · <DurationWheel>`; NO play button. Range chip mono `primary`. Card uses `surface` + `hairline` + `radii.card`. `Pressable` is a bare wrapper; visuals on inner `View` (Fabric gotcha).

- [ ] **Step 3: `BuildView`** — eyebrow + "Plan backward" title; `FinishTimeWheel`; `BreatherChips`; a `ReorderableList` (from Task 6) of `PlanTaskCard`; inline `＋ add a task…` composer (title input + category chips inline — no modal); live `start by … · fits ✓` line / amber verdict; **Build my plan** primary button **disabled when `draft.tasks.length === 0`**. Footer respects `useSafeAreaInsets().bottom`.

- [ ] **Step 4: Wire reorder** — `onReorder` → `reorderTasks(newIdOrder)`; long-press to activate; spring reflow via `tokens.motion.spring` (per `creating-reanimated-animations`).

- [ ] **Step 5: Run the app + screenshot-verify** (per CLAUDE.md sim flow):

```bash
npm run ios   # dev build; Expo Go cannot run this app
# reset onboarding if needed, then:
xcrun simctl io booted screenshot /tmp/buildview.png
```
Look critically: alignment, spacing rhythm, wheel centering, disabled CTA at 0 tasks. Fix before proceeding.

- [ ] **Step 6: Lint + typecheck**

Run: `npm run lint -- src/features/planner/BuildView.tsx src/features/planner/PlanTaskCard.tsx src/features/planner/BreatherChips.tsx && npm run typecheck`
Expected: PASS, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/features/planner/BuildView.tsx src/features/planner/PlanTaskCard.tsx src/features/planner/BreatherChips.tsx
git commit -m "feat(plan): BuildView with wheels, drag reorder, inline add, breather chips"
```

---

## Task 10: RunView + progress rail (Phase 2)

**Files:**
- Create: `src/features/planner/RunView.tsx`, `src/features/planner/PlanRail.tsx`, `src/features/planner/RailNode.tsx`
- Modify: `src/features/planner/PlanTaskCard.tsx` (add run variant)

**Interfaces:**
- Consumes: `usePlanner()` (`runGroups`, `reorderTasks`, `reproject`, `breatherMin`, `active`).
- Produces: `<RunView />` rendered when `phase === 'run'`.

- [ ] **Step 1: `RailNode`** — states: `done` (green `success` fill + ✓), `now` (purple `primary` fill + white center dot + pulsing halo ring; the **now** label is a purple pill, white text, `padding 2px 8px`), `next` (hollow ring `border`), `breather` (small `☕`). Node size from `tokens.planRail.node`. Pulse via Reanimated (2.2s calm; `creating-reanimated-animations` + `motion-design`); reduced-motion → static.

- [ ] **Step 2: `PlanRail`** — left gutter (`tokens.planRail.gutter`) with `RailNode` + mono time per row, connected by a 2px spine: dashed `success` above done, `primary` through now, faint `hairline` for upcoming. Times mono `10px`.

- [ ] **Step 3: `PlanTaskCard` (run variant)** — done: strike-through + `logged Nm`, dimmed. now (pinned, NO drag handle): raised card, `done ~HH:MM`, progress bar, **open timer** button. next: `⠿` + duration + **▶**.

- [ ] **Step 4: `RunView`** — top bar (`Today's plan` + `done by … · on track ✓` + Abandon button slot from Task 11); the rail list (done + now pinned + draggable upcoming + breather rows); footer `⟳ Re-plan` (calls `reproject`) + `＋ Add task`. Upcoming reorder via `ReorderableList`; running task not draggable.

- [ ] **Step 5: Screenshot-verify** — `npm run ios`; create an active plan; `xcrun simctl io booted screenshot /tmp/runview.png`. Check the rail spine alignment, green/purple states, pulse, pinned-now. Fix.

- [ ] **Step 6: Lint + typecheck**

Run: `npm run lint -- src/features/planner/RunView.tsx src/features/planner/PlanRail.tsx src/features/planner/RailNode.tsx src/features/planner/PlanTaskCard.tsx && npm run typecheck`
Expected: PASS, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/features/planner/RunView.tsx src/features/planner/PlanRail.tsx src/features/planner/RailNode.tsx src/features/planner/PlanTaskCard.tsx
git commit -m "feat(plan): RunView progress rail with pinned NOW and loggable rows"
```

---

## Task 11: Abandon + Cut card

**Files:**
- Create: `src/features/planner/AbandonButton.tsx`, `src/features/planner/CutCard.tsx`

**Interfaces:**
- Consumes: `usePlanner()` (`clearActive`, `cut`, `acceptCut`, `dismissCut`).
- Produces: `<AbandonButton />` (red pill + confirm sheet → `clearActive`), `<CutCard />` (amber triage, user approves a cut).

- [ ] **Step 1: `AbandonButton`** — red pill using `colors.danger` (the ONLY red in the feature). On tap → confirm sheet: "Abandon this plan? Clears the schedule. Your learning is safe." Confirm → `clearActive()`; Cancel → dismiss. Copy via `conversion-psychology` + `humanizer` (no guilt language).

- [ ] **Step 2: `CutCard`** — amber (`accentSoft` + `accent` text), shows the `cutLadder` choice ("About Nm over. Cut **X** → done by HH:MM, or push the finish."). Buttons: accept cut / push deadline / dismiss. **Never red, never auto-applies.**

- [ ] **Step 3: Mount** `AbandonButton` in RunView top bar; `CutCard` shown when `cut` is set (after `reproject` returns over).

- [ ] **Step 4: Screenshot-verify** the red Abandon + amber CutCard. Confirm red is ONLY on Abandon.

- [ ] **Step 5: Lint + typecheck + commit**

```bash
npm run lint -- src/features/planner/AbandonButton.tsx src/features/planner/CutCard.tsx && npm run typecheck
git add src/features/planner/AbandonButton.tsx src/features/planner/CutCard.tsx
git commit -m "feat(plan): Abandon action and amber cut card (triage, never red)"
```

---

## Task 12: Loggable rows — route to the timer

**Files:** Modify `src/features/planner/PlanTaskCard.tsx` (run variant), `src/features/planner/RunView.tsx`.

**Interfaces:**
- Consumes: existing `/(modals)/timer` route + `useTimer` params: `{ taskId, label, category, estimateMin, guessMin, suggestedHonestMin }`.

- [ ] **Step 1: Wire ▶ / open-timer** — on press:
```typescript
router.push({
  pathname: '/(modals)/timer',
  params: {
    taskId: task.id,
    label: task.label,
    category: task.category,
    estimateMin: String(task.durationMin),
    guessMin: String(task.durationMin),
    suggestedHonestMin: String(task.suggestedHonestMin),
  },
});
```
Also call `startTask(task.id)` so the rail marks it running.

- [ ] **Step 2: On return / completion** — when the timer logs (the normal `applyLog` path runs in the timer modal), the plan must mark the task done. Detect completion via the store/log signal the timer already emits; call `completeTask(id, actualMin)`. (Read `src/features/timer/useTimer.ts` for the completion hook; do NOT add a new write path — the planner only reads.)

- [ ] **Step 3: Manual verification (run the app)** — start a plan task, stop & log, confirm: the node turns green, NOW advances, and honey/reclaim updated on Today (the normal log effects). Screenshot.

- [ ] **Step 4: Lint + typecheck + commit**

```bash
npm run lint -- src/features/planner/PlanTaskCard.tsx src/features/planner/RunView.tsx && npm run typecheck
git add src/features/planner/PlanTaskCard.tsx src/features/planner/RunView.tsx
git commit -m "feat(plan): run plan tasks through the existing timer-as-log path"
```

---

## Task 13: Route wiring — thin `plan.tsx`

**Files:** Modify `src/app/(tabs)/plan.tsx`.

**Interfaces:**
- Consumes: `usePlanner().phase`, `<BuildView />`, `<RunView />`.

- [ ] **Step 1: Replace the screen body** with a thin switch (route stays logic-free per the layer rule):

```tsx
export default function PlanScreen() {
  const { phase } = usePlanner();
  return (
    <Screen>
      {phase === 'run' ? <RunView /> : <BuildView />}
    </Screen>
  );
}
```
Remove the old in-route business logic (DeadlinePicker/TaskRow/VerdictCard usage now lives in BuildView/RunView). Delete now-dead files (`TaskRow.tsx`, etc.) only if nothing else imports them — grep first.

- [ ] **Step 2: Build → Run transition animation** — cross-fade/slide ≤300ms ease-out when `phase` changes (`motion-design`); reduced-motion → instant.

- [ ] **Step 3: Screenshot-verify the full flow** — empty Build (CTA disabled) → add tasks → Build my plan → Run rail → Abandon → empty Build. Fix any jank.

- [ ] **Step 4: Lint + typecheck + commit**

```bash
npm run lint -- src/app/(tabs)/plan.tsx && npm run typecheck
git add src/app/(tabs)/plan.tsx
git commit -m "feat(plan): thin route renders Build or Run by active-plan presence"
```

---

## Task 14: Full verification gate

**Files:** none (verification).

- [ ] **Step 1: Full suite**

```bash
npm run lint && npm run typecheck && npm test
```
Expected: lint 0 warnings, typecheck clean, all tests pass.

- [ ] **Step 2: Engine/store coverage check** — confirm tests exist for: breather gaps, reproject (fits + over), reorder guard, complete/start task, phase flip. Add any missing.

- [ ] **Step 3: Manual invariant pass** — verify: no red anywhere except Abandon; over-state is amber; Build CTA disabled at 0 tasks; running task can't be dragged; reset works; no network call in the plan flow.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "test(plan): close coverage gaps and fix verification findings"
```

---

## Task 15: PR — do NOT merge

**Files:** none (delivery).

- [ ] **Step 1: Confirm branch + push**

```bash
git rev-parse --abbrev-ref HEAD     # feature/plan-screen-redesign
git push -u origin feature/plan-screen-redesign
```

- [ ] **Step 2: Open the PR (no AI attribution, no auto-merge)**

```bash
gh pr create --title "feat(plan): two-phase Build → Run Start-By Plan redesign" \
  --body "Redesigns the Start-By Plan screen into two phases — Build (drag-sortable card list, finish-by + duration wheels, between-task breather) and Run (timeline progress rail, pinned NOW, loggable timer-backed tasks, Abandon + amber cut card).

Spec: docs/superpowers/specs/2026-06-17-plan-screen-redesign-design.md
Drag lib: react-native-reorderable-list (or hand-rolled fallback — note which).

Invariants honored: amber-never-red (red only on Abandon), on-device-only, honey monotonic, no streaks, tokens-only.

Do not merge — founder reviews and merges by hand."
```

- [ ] **Step 3: STOP.** Do not merge (not `gh pr merge`, not the button). Report the PR URL and wait for the founder.

- [ ] **Step 4: Worktree cleanup** — after the founder confirms the PR is merged (or tells you to drop it), from the main repo:

```bash
cd ../whenbee                       # back to the main checkout
git worktree remove ../whenbee-plan-redesign
git worktree prune
```
(Do not remove the worktree before the PR is handled — that's where the branch work lives.)

---

## Self-Review (against the spec)

- **Spec coverage:** two-phase model (T9/T10/T13) · D1 rail (T10) · D2 pinned-now reorder guard (T4/T10) · D3 abandon-only (T11) · green/purple colors (T10) · nowpill 2px8px (T10) · wheels (T8) · breather option-2 (T2/T9) · manual start (T12) · adaptive cut card (T3/T11) · loggable timer-as-log (T12) · drag lib (T6) · tokens (T7) · invariants (T14). Notifications + Brain Breather are explicitly fast-follow (spec §13) → no task, correct.
- **Placeholders:** engine/store/hook tasks carry real test + impl code; component tasks carry concrete structure + the exact timer params + exact token group. Where existing-file internals are needed (TimeField wheel API, timer completion hook), the step says "read X first" with the interface to match — not a hand-wave.
- **Type consistency:** `status` values (`upcoming|running|done`), `breatherMin`, `reproject` shape, `completeTask(id, actualMin)`, timer params — used identically across T1/T3/T4/T5/T12.
