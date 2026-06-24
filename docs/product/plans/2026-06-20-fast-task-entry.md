# Fast Task Entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the distance from intent → recorded task with three new entry paths (a quick-action arc on the `+`, one-tap quick-task chips on Today, and a quick-start timer that captures details at stop) plus a thumb-zone layout fix to the existing add-task drawer.

**Architecture:** Pure logic lands first (a frequency query in the db/repo layer, a `useQuickTasks` selector hook, and a quick-start mode on `timerStore`), each TDD'd against `createMemoryDatabase`. UI sits on top: an arc menu reusing existing routing/voice, a chips row on Today, a relayout of the add-task sheet, and a post-stop capture sheet reusing the timer's existing `onStopAndLog`/`onAbandon`. Nothing new touches the network — the core loop stays on-device.

**Tech Stack:** Expo SDK 54, React Native 0.81 (Fabric), expo-router 6, Zustand, expo-sqlite, react-native-reanimated, TypeScript strict. Spec: `docs/product/specs/11-fast-task-entry.md`. Visual mock: `docs/brand/tap-entry-mockups.html`.

## Global Constraints

Every task implicitly carries these (copied verbatim from CLAUDE.md / AGENTS.md / the spec):

- **Every spacing/size/font/color value comes from a token in `src/theme/tokens.ts` via `useTheme()`.** Never inline a raw number or hex. If a needed value is missing, add it to `tokens.ts` **and** register it in `resolveTheme` (`src/theme/useTheme.ts`) — a new token group not added to the resolver return is `undefined` at runtime.
- **No CSS `boxShadow`** on RN 0.81 / Fabric — use a View-based edge (see `AppButton` coin edge) or `Platform.select` shadow.
- **`Pressable` keeps a bare touch wrapper; put visual style on an inner `View`.** Function-form `style={({pressed}) => …}` silently renders nothing under reactCompiler + nativewind. Read/write reanimated shared values with `.get()/.set()`, never `.value`.
- **Animations are entering-only.** Never put an `exiting` layout animation on a conditionally-unmounted view (Fabric SIGABRT). Imported helpers called inside a worklet need `'worklet';`.
- **Anything pinned to the bottom adds `useSafeAreaInsets().bottom`.**
- **Core loop stays on-device.** No network call in guess → timer → learn. **No guilt/streak/shame mechanics. Honey/sharpness stays monotonic. Pricing read from RevenueCat, never hardcoded.**
- **TDD for all logic-layer code** (engine/db/stores/services/lib). Test first.
- **Conventional Commits. NO AI/co-author attribution** of any kind (no `Co-Authored-By`, no "Generated with", no 🤖). Subagents commit with **plain `git`**, not the `/init-cmt` skill (its interactive gate stalls autonomous agents).
- **Gate before every commit:** `npm run lint` (0 warnings or it fails), `npm run typecheck`, `npm test`. After editing specific files, lint just those: `npx eslint <files>`.
- `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` are on — indexed access is `T | undefined`; handle it, don't `!`.

---

## Execution protocol (per the founder's instruction)

**This plan is executed by fresh subagents, one per task, each in an isolated git worktree. The founder merges; agents never merge.**

For **each** task below:

1. **Create an isolated worktree** via `superpowers:using-git-worktrees` (native worktree or fallback). Branch name: `feat/fast-entry-task-<N>-<slug>`, based off the current `main`.
2. **Dispatch a fresh subagent** to do only that task **inside that worktree's path**. The subagent must `cd` into the worktree and run every command there.
   - **CWD guard (known footgun):** subagents sometimes commit to the main checkout instead of the worktree. The subagent must `git rev-parse --show-toplevel` and confirm it equals the worktree path **before** its first commit, and after each commit verify `git -C <worktree> log -1 --oneline` shows its commit and the main checkout's `HEAD` is unchanged.
3. Subagent follows the task's TDD steps, committing with plain `git` (conventional message, no attribution), running the full gate (`lint` + `typecheck` + `test`) before each commit.
4. **Two-stage review** between tasks (per `subagent-driven-development`): the subagent reports; review the diff before starting the next task.
5. When the task is complete, the subagent **cleans up** anything transient and the worktree is removed if unchanged; the deliverable is pushed and surfaced for a **PR**. **The subagent opens the PR and stops. It never runs `git merge` / `gh pr merge` / the merge button.** The founder reviews and merges by hand.

Tasks are ordered so each is independently shippable and reviewable. Logic tasks (1, 2, 6) gate the UI tasks that consume them — note the `Consumes` blocks.

---

## File structure

**New files**
- `src/db/queries/frequentTasks.ts` — pure shaping of frequent (label, category) rows from raw events (testable without a db).
- `src/features/quick-tasks/useQuickTasks.ts` — Today-screen selector hook: frequent tasks → sorted, thresholded, with honest estimate; plus a `startQuickTask` action.
- `src/components/quick/QuickTaskChips.tsx` — the horizontal chip row.
- `src/components/quick/QuickActionArc.tsx` — the three-bubble fan over the `+`.
- `src/components/quick/PostStopCaptureSheet.tsx` — capture-at-stop sheet for the quick-start timer.
- Test files mirroring each under `__tests__/`.

**Modified files**
- `src/db/types.ts` / `memoryDatabase.ts` / `sqliteDatabase.ts` (or equivalent `Database` interface + impls) — add `frequentTaskRows()` source query.
- `src/db/repositories/taskEventsRepo.ts` — expose `listFrequentTasks(limit)`.
- `src/components/TabBarAddButton.tsx` — `onPress` opens the arc instead of pushing the route directly.
- `src/components/WhenbeeTabBar.tsx` — host the arc overlay + scrim.
- `src/app/(tabs)/index.tsx` — slot `QuickTaskChips` between `TodayHud` and the focus card. **(Has uncommitted local edits — rebase the task's worktree on the latest `main` that includes them; do not clobber.)**
- `src/app/(modals)/add-task.tsx` — pin the primary CTA in the thumb zone.
- `src/stores/timerStore.ts` — add a quick-start mode (start with no category) + `isQuickStart` flag.
- `src/features/timer/useTimer.ts` + `src/app/(modals)/timer.tsx` — on stop in quick-start mode, route to `PostStopCaptureSheet`.
- `src/theme/tokens.ts` + `src/theme/useTheme.ts` — new `quick` token group (arc bubble geometry, chip metrics).

---

## Task 1: Frequent-tasks query (db + repo, pure-first)

Adds the only missing data primitive: "which (label, category) pairs has the user completed most, and when last". Shape it in a pure function so the core logic is unit-tested without a db, then thread it through the `Database` interface and `taskEventsRepo`.

**Files:**
- Create: `src/db/queries/frequentTasks.ts`
- Create: `src/db/queries/__tests__/frequentTasks.test.ts`
- Modify: `src/db/repositories/taskEventsRepo.ts` (add `listFrequentTasks`)
- Modify: the `Database` interface + `createMemoryDatabase` + `createSqliteDatabase` (add a `completedTaskEvents()` accessor if one is not already reachable; memory impl already holds the rows)

**Interfaces:**
- Consumes: `TaskEventRow` / `TaskEvent` from `src/domain/types.ts` (`{ label: string|null; category; status: 'completed'|'abandoned'|'partial'; estimateMin; endedAt: number|null; ... }`).
- Produces:
  ```ts
  export interface FrequentTask {
    label: string;
    category: string;
    count: number;        // completed runs
    lastGuessMin: number; // estimateMin of the most-recent completed run
    lastEndedAt: number;  // ms
  }
  // pure: rank completed events into frequent tasks
  export function rankFrequentTasks(
    events: TaskEventRow[],
    opts: { now: number; minCount?: number; limit?: number; halfLifeDays?: number },
  ): FrequentTask[];
  // repo method (async):
  listFrequentTasks(limit?: number): Promise<FrequentTask[]>;
  ```

Behaviour locked by the spec: only `status === 'completed'` counts; group by `(label, category)` with a non-empty trimmed label; require `count >= minCount` (**default 3**); sort by `count * recencyDecay(lastEndedAt)` where `recencyDecay = 0.5 ** (ageDays / halfLifeDays)`, **halfLifeDays default 14**; tie-break by `lastEndedAt` desc; cap at `limit` (**default 4**).

- [ ] **Step 1: Write the failing test**

```ts
// src/db/queries/__tests__/frequentTasks.test.ts
import { rankFrequentTasks, type FrequentTask } from '@/src/db/queries/frequentTasks';
import type { TaskEventRow } from '@/src/db';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function ev(over: Partial<TaskEventRow>): TaskEventRow {
  return {
    id: `e-${Math.random()}`, category: 'admin', label: 'Emails',
    estimateMin: 30, actualMin: 45, status: 'completed', source: 'timed',
    startedAt: NOW - DAY, endedAt: NOW - DAY, createdAt: NOW - DAY,
    suggestedHonestMin: 45, reclaimDividendMin: 0, ...over,
  };
}

describe('rankFrequentTasks', () => {
  it('groups completed runs by (label, category) and counts them', () => {
    const out = rankFrequentTasks(
      [ev({}), ev({}), ev({}), ev({ label: 'Gym', category: 'health' })],
      { now: NOW },
    );
    const emails = out.find((t) => t.label === 'Emails');
    expect(emails?.count).toBe(3);
    expect(out.find((t) => t.label === 'Gym')).toBeUndefined(); // below minCount 3
  });

  it('ignores non-completed and empty-label events', () => {
    const out = rankFrequentTasks(
      [ev({}), ev({}), ev({}), ev({ status: 'abandoned' }), ev({ label: '  ' })],
      { now: NOW },
    );
    expect(out.find((t) => t.label === 'Emails')?.count).toBe(3);
  });

  it('ranks by frequency with a recency decay and tie-breaks by recency', () => {
    const stale = Array.from({ length: 6 }, () => ev({ label: 'Stale', endedAt: NOW - 60 * DAY }));
    const fresh = Array.from({ length: 4 }, () => ev({ label: 'Fresh', endedAt: NOW - 1 * DAY }));
    const out = rankFrequentTasks([...stale, ...fresh], { now: NOW, halfLifeDays: 14 });
    expect(out[0]?.label).toBe('Fresh'); // 4 recent outranks 6 stale after decay
  });

  it('caps at limit and carries lastGuessMin from the most recent run', () => {
    const rows = [
      ev({ estimateMin: 20, endedAt: NOW - 3 * DAY }),
      ev({ estimateMin: 25, endedAt: NOW - 1 * DAY }),
      ev({ estimateMin: 30, endedAt: NOW - 5 * DAY }),
    ];
    const out = rankFrequentTasks(rows, { now: NOW, limit: 4 });
    expect(out).toHaveLength(1);
    expect(out[0]?.lastGuessMin).toBe(25);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx jest src/db/queries/__tests__/frequentTasks.test.ts`
Expected: FAIL — `Cannot find module '@/src/db/queries/frequentTasks'`.

- [ ] **Step 3: Implement the pure ranker**

```ts
// src/db/queries/frequentTasks.ts
import type { TaskEventRow } from '@/src/db';

export interface FrequentTask {
  label: string;
  category: string;
  count: number;
  lastGuessMin: number;
  lastEndedAt: number;
}

const DAY_MS = 86_400_000;

export function rankFrequentTasks(
  events: TaskEventRow[],
  opts: { now: number; minCount?: number; limit?: number; halfLifeDays?: number },
): FrequentTask[] {
  const minCount = opts.minCount ?? 3;
  const limit = opts.limit ?? 4;
  const halfLifeDays = opts.halfLifeDays ?? 14;

  const groups = new Map<string, FrequentTask>();
  for (const e of events) {
    if (e.status !== 'completed') continue;
    const label = (e.label ?? '').trim();
    if (!label) continue;
    const endedAt = e.endedAt ?? e.createdAt;
    const key = `${e.category} ${label}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { label, category: e.category, count: 1, lastGuessMin: e.estimateMin, lastEndedAt: endedAt });
    } else {
      g.count += 1;
      if (endedAt > g.lastEndedAt) {
        g.lastEndedAt = endedAt;
        g.lastGuessMin = e.estimateMin;
      }
    }
  }

  const score = (t: FrequentTask): number => {
    const ageDays = Math.max(0, (opts.now - t.lastEndedAt) / DAY_MS);
    return t.count * Math.pow(0.5, ageDays / halfLifeDays);
  };

  return [...groups.values()]
    .filter((t) => t.count >= minCount)
    .sort((a, b) => score(b) - score(a) || b.lastEndedAt - a.lastEndedAt)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx jest src/db/queries/__tests__/frequentTasks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Expose it on the repo over the real db**

Add to `TaskEventsRepo` (interface + impl in `src/db/repositories/taskEventsRepo.ts`). Use the repo's existing event source (it already reads rows via the `Database`); if no "all completed" accessor exists, read recent with a generous cap and rank:

```ts
// in TaskEventsRepo interface
listFrequentTasks(limit?: number): Promise<FrequentTask[]>;

// in the implementation (mirror the existing listRecent pattern)
async listFrequentTasks(limit = 4): Promise<FrequentTask[]> {
  const rows = await this.listRecent(500); // existing method; raw TaskEventRow[]
  return rankFrequentTasks(rows, { now: Date.now(), limit });
}
```

> If `listRecent`'s cap would miss older repeats, add a `listCompleted(limit)` accessor to the `Database` interface + both impls (`createMemoryDatabase`, `createSqliteDatabase`) instead — follow the exact shape of the neighbouring `listRecent` query. Keep `Date.now()` in the repo, never in the pure ranker.

- [ ] **Step 6: Add a repo test against the in-memory db**

```ts
// src/db/repositories/__tests__/taskEventsRepo.frequent.test.ts
import { createMemoryDatabase } from '@/src/db';
import { makeTaskEventsRepo } from '@/src/db/repositories/taskEventsRepo'; // match the real factory name

it('listFrequentTasks returns only >=3x completed tasks, capped', async () => {
  const db = createMemoryDatabase();
  const repo = makeTaskEventsRepo(db);
  for (let i = 0; i < 3; i++) {
    await db.insertTaskEvent({ id: `e${i}`, category: 'admin', label: 'Emails', estimateMin: 30,
      actualMin: 40, status: 'completed', source: 'timed', startedAt: 1, endedAt: 1 + i, createdAt: 1,
      suggestedHonestMin: 40, reclaimDividendMin: 0 });
  }
  const out = await repo.listFrequentTasks();
  expect(out.map((t) => t.label)).toEqual(['Emails']);
});
```

Run: `npx jest src/db/`  → Expected: PASS. Adjust the factory import to the real export name found in the file.

- [ ] **Step 7: Gate + commit**

```bash
npx eslint src/db/queries/frequentTasks.ts src/db/repositories/taskEventsRepo.ts
npm run typecheck && npx jest src/db/
git add src/db/queries src/db/repositories
git commit -m "feat(db): rank frequent completed tasks for quick-start chips"
```

---

## Task 2: `useQuickTasks` selector hook

Turns frequent tasks into chip view-models (label, category, honest estimate string) and exposes a `startQuickTask` action that boots the timer with the learned guess. Logic-layer → TDD.

**Files:**
- Create: `src/features/quick-tasks/useQuickTasks.ts`
- Create: `src/features/quick-tasks/__tests__/useQuickTasks.test.ts`

**Interfaces:**
- Consumes: `taskEventsRepo.listFrequentTasks` (Task 1); `resolveSuggestion({ guessMinutes, category, recurring, prior })` from `src/engine/multiplier.ts` → `{ honestMinutes }`; the category stats source `useCalibrationStore` uses (match how `useAddTask` builds its `resolveSuggestion` input at `useAddTask.ts:104`); `timerStore.start({ label, category, estimateMin, guessMin, suggestedHonestMin })`.
- Produces:
  ```ts
  export interface QuickTaskChip {
    id: string;            // `${category} ${label}`
    label: string;
    category: string;
    honestMin: number;     // resolved honest estimate
    guessMin: number;      // lastGuessMin (what we start the timer with)
  }
  export function useQuickTasks(): {
    chips: QuickTaskChip[];      // already thresholded + capped by Task 1
    startQuickTask: (chip: QuickTaskChip) => void;
  };
  ```

`startQuickTask` calls `timerStore.start({ label: chip.label, category: chip.category, estimateMin: chip.honestMin, guessMin: chip.guessMin, suggestedHonestMin: chip.honestMin })` then `router.push('/(modals)/timer')` (match how the Today screen's existing task-start handler navigates — reuse that path rather than inventing params).

- [ ] **Step 1: Write the failing test** (build the honest mapping + start wiring)

```ts
// src/features/quick-tasks/__tests__/useQuickTasks.test.ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useQuickTasks } from '@/src/features/quick-tasks/useQuickTasks';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { createMemoryDatabase } from '@/src/db';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

async function seed() {
  const db = createMemoryDatabase();
  for (let i = 0; i < 3; i++) {
    await db.insertTaskEvent({ id: `e${i}`, category: 'admin', label: 'Emails', estimateMin: 30,
      actualMin: 50, status: 'completed', source: 'timed', startedAt: 1, endedAt: 1 + i, createdAt: 1,
      suggestedHonestMin: 50, reclaimDividendMin: 0 });
  }
  useCalibrationStore.getState().setDatabase(db);
  return db;
}

it('exposes thresholded chips with a resolved honest estimate', async () => {
  await seed();
  const { result } = renderHook(() => useQuickTasks());
  await waitFor(() => expect(result.current.chips.length).toBe(1));
  const chip = result.current.chips[0]!;
  expect(chip.label).toBe('Emails');
  expect(chip.guessMin).toBe(30);
  expect(chip.honestMin).toBeGreaterThanOrEqual(30); // honest >= guess for a slow category
});

it('startQuickTask boots the timer with the learned guess', async () => {
  await seed();
  const { result } = renderHook(() => useQuickTasks());
  await waitFor(() => expect(result.current.chips.length).toBe(1));
  act(() => result.current.startQuickTask(result.current.chips[0]!));
  expect(useTimerStore.getState().status).not.toBe('idle');
});
```

- [ ] **Step 2: Run it, verify it fails** — `npx jest src/features/quick-tasks` → FAIL (module not found).

- [ ] **Step 3: Implement the hook**

```tsx
// src/features/quick-tasks/useQuickTasks.ts
import { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { resolveSuggestion } from '@/src/engine';
import type { FrequentTask } from '@/src/db/queries/frequentTasks';

export interface QuickTaskChip { id: string; label: string; category: string; honestMin: number; guessMin: number; }

export function useQuickTasks() {
  const repo = useCalibrationStore((s) => s.taskEventsRepo); // match the real selector exposing the repo/db
  const statsFor = useCalibrationStore((s) => s.statsFor);   // match how useAddTask reads category stats
  const [chips, setChips] = useState<QuickTaskChip[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!repo) return;
      const frequent: FrequentTask[] = await repo.listFrequentTasks(4);
      const mapped = frequent.map((t) => {
        const { honestMinutes } = resolveSuggestion({
          guessMinutes: t.lastGuessMin,
          category: statsFor(t.category),
          recurring: null,
          prior: null,
        });
        return { id: `${t.category} ${t.label}`, label: t.label, category: t.category,
          honestMin: honestMinutes, guessMin: t.lastGuessMin } satisfies QuickTaskChip;
      });
      if (alive) setChips(mapped);
    })();
    return () => { alive = false; };
  }, [repo, statsFor]);

  const startQuickTask = useCallback((chip: QuickTaskChip) => {
    useTimerStore.getState().start({
      label: chip.label, category: chip.category, estimateMin: chip.honestMin,
      guessMin: chip.guessMin, suggestedHonestMin: chip.honestMin,
    });
    router.push('/(modals)/timer');
  }, []);

  return { chips, startQuickTask };
}
```

> Match the real `calibrationStore` selectors for the repo and the per-category stats input. If the store exposes the db rather than a ready `taskEventsRepo`, build the repo via its factory once and memoize. Keep the `resolveSuggestion` input identical in shape to `useAddTask.ts:104`.

- [ ] **Step 4: Run it, verify it passes** — `npx jest src/features/quick-tasks` → PASS.

- [ ] **Step 5: Gate + commit**

```bash
npx eslint src/features/quick-tasks
npm run typecheck && npx jest src/features/quick-tasks
git add src/features/quick-tasks
git commit -m "feat(quick): useQuickTasks selector + start action for quick-task chips"
```

---

## Task 3: `QuickTaskChips` row on Today

**Files:**
- Create: `src/components/quick/QuickTaskChips.tsx`
- Modify: `src/app/(tabs)/index.tsx` (slot between `TodayHud` ~L194 and the focus card ~L200)
- Modify: `src/theme/tokens.ts` + `src/theme/useTheme.ts` (add `quick` group if chip metrics aren't covered by existing tokens)

**Interfaces:**
- Consumes: `useQuickTasks()` (Task 2).
- Produces: `<QuickTaskChips />` — self-contained, renders nothing when `chips.length === 0`.

Design (all values via `useTheme()` — add a `quick` token group rather than inlining):
- Section label "Tap to start again" using the existing `eyebrow`/`tasklbl` role.
- Horizontal row, **no scroll, max 4 chips, drop to 3 if cramped** (render `chips.slice(0, 4)`; the data is already capped).
- Each chip: `surface` fill, 1px `border` hairline, `radii.full`, a small play disc (`primarySoft` bg, `primaryEdge` glyph), title (`heading`/`bodySm` weight 700), estimate sub-line `~{honestMin}m honest` (`caption`, `inkSoft`). View-based depth only — **no `boxShadow`**.
- `Pressable` is a bare wrapper; visual style + pressed scale (`scale` token) on an inner `View`. `haptics.light()` on press → `startQuickTask(chip)`.
- `accessibilityRole="button"`, `accessibilityLabel={`Start ${label}, about ${honestMin} minutes`}`.
- Entering only: `FadeIn`/`FadeInDown` with `motion.base`; **no exiting animation**.

- [ ] **Step 1:** Build `QuickTaskChips.tsx` to the spec above. Add any missing `quick` tokens to `tokens.ts` and register the group in `resolveTheme`.
- [ ] **Step 2:** Slot `<QuickTaskChips />` into `src/app/(tabs)/index.tsx` between `TodayHud` and the focus card, wrapped in a `View` whose gap matches the surrounding section rhythm.
- [ ] **Step 3:** `npx eslint` the two files; `npm run typecheck`.
- [ ] **Step 4: Screenshot-verify on the simulator** (no CLI tap; verify rendered):
  - Seed ≥3 completed runs of a task (or run against a dev build that already has history), `npm run ios`, navigate to Today.
  - `xcrun simctl io booted screenshot /tmp/chips.png`; open it and judge: chips in one row, baseline-aligned title/estimate, play disc optically centered to cap-height, no clipping, hairline (not shadow) edges. Fix until it would satisfy a designer's eye. Confirm the row is **absent** when no task qualifies.
- [ ] **Step 5: Commit**

```bash
git add src/components/quick/QuickTaskChips.tsx src/app/(tabs)/index.tsx src/theme/tokens.ts src/theme/useTheme.ts
git commit -m "feat(quick): one-tap quick-task chips on Today"
```

---

## Task 4: Quick-action arc on the `+`

Replace the tab `+`'s direct route-push with a three-bubble fan (Voice · Timer · Type). Pure interaction + routing; reuses existing destinations.

**Files:**
- Create: `src/components/quick/QuickActionArc.tsx`
- Modify: `src/components/TabBarAddButton.tsx` (onPress toggles the arc), `src/components/WhenbeeTabBar.tsx` (host arc + scrim)
- Modify: `src/theme/tokens.ts` + `useTheme.ts` (`quick.arc` geometry)

**Interfaces:**
- Consumes: `router.push('/(modals)/add-task')` (Type), the timer quick-start (Task 6 — until then, Timer bubble is wired but its handler calls a `startQuickStart()` stub that Task 6 fills), `useVoiceCapture` (Voice — open the existing `ListeningSheet`).
- Produces: `<QuickActionArc open onClose branchHandlers />`.

Design:
- Bubbles are coin discs (`radii.full`, `surface` fill, `border` hairline, **View-based bottom edge**, no shadow). Center bubble (Timer) `primary`-filled. Geometry from a new `quick.arc` token group (bubble size, fan radius, offsets).
- Open: a `scrim` (use `colors.scrim`) behind; bubbles **stagger up** with `motion.enterStagger` on `motion.easing.out`, spring settle `motion.spring`. **Entering-only** — on close, unmount without an `exiting` animation (fade the scrim via opacity state, not a layout-exit).
- `+` keeps its press sink/squash + `haptics.light()`. Tapping scrim or `+` again closes.
- **Reduced motion:** fade only (gate on `useReducedMotion()`), per existing pattern.
- **A11y:** bubbles read left→right Voice, Timer, Type; each an `accessibilityRole="button"` with a clear `accessibilityLabel`.
- Branch handlers:
  - **Type** → `router.push('/(modals)/add-task')` (the current destination).
  - **Voice** → start `useVoiceCapture` + show `ListeningSheet` (reuse components; on draft, route to add-task prefilled — match the existing voice→add-task wiring if present, else push add-task and hand it the draft).
  - **Timer** → `startQuickStart()` (Task 6).

- [ ] **Step 1:** Add `quick.arc` tokens; register in `resolveTheme`.
- [ ] **Step 2:** Build `QuickActionArc.tsx` (controlled `open`, `onClose`, three handlers).
- [ ] **Step 3:** In `TabBarAddButton.tsx`, change `onPress` to toggle arc-open state (lift state into `WhenbeeTabBar` or a small context) instead of `router.push`. Render `<QuickActionArc />` from `WhenbeeTabBar` so it can overlay the bar + scrim the screen.
- [ ] **Step 4:** `npx eslint` changed files; `npm run typecheck`.
- [ ] **Step 5: Screenshot-verify** the open arc on the simulator (`xcrun simctl io booted screenshot`): three bubbles fan into the thumb arc, coin edges (not shadows), Timer centered/elevated, scrim dims Today, nothing clipped by the home indicator (safe-area). Judge critically; fix.
- [ ] **Step 6: Commit**

```bash
git add src/components/quick/QuickActionArc.tsx src/components/TabBarAddButton.tsx src/components/WhenbeeTabBar.tsx src/theme/tokens.ts src/theme/useTheme.ts
git commit -m "feat(quick): quick-action arc (Voice/Timer/Type) on the add button"
```

---

## Task 5: Thumb-zone CTA in the add-task drawer

Pure layout move — no logic change. Pin **Add & start timer** in the lower-third thumb arc; keep **Add to today** as the quiet secondary beneath it; footer respects the safe-area inset.

**Files:**
- Modify: `src/app/(modals)/add-task.tsx`

- [ ] **Step 1:** Restructure the sheet so the scrollable fields and the action footer are separate: fields in the `ScrollView`, the two buttons in a footer pinned to the bottom of the sheet (not below scroll content), with `paddingBottom: insets.bottom + t.space[…]` via `useSafeAreaInsets()`. Keep `onAddAndStart` / `addToToday` calls unchanged. All spacing from tokens.
- [ ] **Step 2:** `npx eslint src/app/(modals)/add-task.tsx`; `npm run typecheck`.
- [ ] **Step 3: Screenshot-verify**: open the drawer on the sim, confirm the primary button sits in natural thumb reach without scrolling, secondary reads as quieter, footer clears the home indicator, the focus ring/keyboard don't cover the CTA. Judge; fix.
- [ ] **Step 4: Commit**

```bash
git add src/app/(modals)/add-task.tsx
git commit -m "feat(add-task): pin primary CTA in the thumb zone"
```

---

## Task 6: Quick-start timer mode (capture at stop) — store logic

Let the timer start with **no category**, flagged quick-start, so the stop flow can capture details while context is fresh. Logic-layer → TDD on `timerStore`.

**Files:**
- Modify: `src/stores/timerStore.ts`
- Modify: `src/stores/__tests__/timerStore.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // new action — starts bare, no category required
  quickStart: (nowMs?: number) => void;
  // new state flag the timer screen reads
  isQuickStart: boolean;
  ```
  `quickStart` sets the running session with `label: ''`, `category: null`-equivalent sentinel, `estimateMin: 0`, `guessMin: 0`, `isQuickStart: true`. Existing `start(task)` sets `isQuickStart: false`. `stop(now)` is unchanged (still returns `{ actualMin }`); `cancel()` clears `isQuickStart`.

> The current `start` signature requires `category: string`. Add `quickStart` as a sibling action (don't loosen `start`). Store the running category as `string | null`; default the existing field to a non-null sentinel for normal starts so nothing downstream breaks. Confirm `resumeFromKv` round-trips the new flag.

- [ ] **Step 1: Write the failing test**

```ts
// add to src/stores/__tests__/timerStore.test.ts
import { useTimerStore } from '@/src/stores/timerStore';

it('quickStart runs a bare timer flagged as quick-start', () => {
  useTimerStore.getState().quickStart(1_000);
  const s = useTimerStore.getState();
  expect(s.status).not.toBe('idle');
  expect(s.isQuickStart).toBe(true);
  const { actualMin } = useTimerStore.getState().stop(1_000 + 5 * 60_000);
  expect(actualMin).toBe(5);
});

it('normal start is not flagged quick-start', () => {
  useTimerStore.getState().start({ label: 'Emails', category: 'admin', estimateMin: 40 }, 1_000);
  expect(useTimerStore.getState().isQuickStart).toBe(false);
});
```

- [ ] **Step 2: Run, verify fail** — `npx jest src/stores/__tests__/timerStore.test.ts` → FAIL (`quickStart` undefined).
- [ ] **Step 3: Implement** `quickStart` + `isQuickStart` in `timerStore.ts`, mirroring `start`'s session setup but with the bare/sentinel values and the flag; set `isQuickStart: false` in `start`; persist/restore the flag in the kv round-trip.
- [ ] **Step 4: Run, verify pass** — `npx jest src/stores/__tests__/timerStore.test.ts` → PASS.
- [ ] **Step 5: Gate + commit**

```bash
npx eslint src/stores/timerStore.ts
npm run typecheck && npx jest src/stores
git commit -am "feat(timer): quick-start mode (bare timer, capture at stop)"
```

---

## Task 7: Post-stop capture sheet + wire-up

On stopping a quick-start timer, present a non-blocking sheet to name + categorize. **Save** → log a `completed` event (trains the model). **Skip** → record an **abandoned** entry (kept, editable later, not trained). Reuses the timer's existing `onStopAndLog` / `onAbandon`.

**Files:**
- Create: `src/components/quick/PostStopCaptureSheet.tsx`
- Modify: `src/features/timer/useTimer.ts`, `src/app/(modals)/timer.tsx`
- Modify: `src/theme/tokens.ts` + `useTheme.ts` if new metrics needed.

**Interfaces:**
- Consumes: `useTimerStore().isQuickStart` (Task 6); existing `onStopAndLog()` (logs `completed`) and `onAbandon()` (logs `abandoned`); the category picker (`CategoryChips`) + the category-guess helper used by `useAddTask`.
- Produces: `<PostStopCaptureSheet visible category name onChange onSave onSkip />`.

Behaviour:
- When the timer screen stops **and** `isQuickStart`, instead of immediately calling `onStopAndLog`, show `PostStopCaptureSheet` (action-sheet shape, **not** a blocking alert).
- Pre-select the most-likely category (guess from the typed/spoken name if any, else the user's most-frequent). Happy path: one tap **Save**.
- **Save:** set the captured `label` + `category` on the running/just-stopped session, then call `onStopAndLog()` (writes `completed`, trains, matures honey).
- **Skip:** call `onAbandon()` (writes `abandoned`) so it's kept in history but excluded from learning. Offer **Undo** (reuse any existing undo affordance / toast) instead of a confirm dialog.
- Quiet consequence line on skip (copy is **provisional — Task 8 runs the humanizer/conversion pass**): primary **Save — teaches your real pace**, secondary **Skip for now**; skipped entry shows `Unsorted · won't sharpen your estimates until you sort it.` No red, no nag, no re-prompt. Honor no-guilt invariant.
- **A11y + safe-area + tokens-only + entering-only animation** as per Global Constraints.

- [ ] **Step 1:** Build `PostStopCaptureSheet.tsx` (controlled; category chips + optional name; Save/Skip).
- [ ] **Step 2:** In `useTimer.ts` / `timer.tsx`, branch the stop handler on `isQuickStart`: show the sheet; Save → set label/category then `onStopAndLog`; Skip → `onAbandon`. Normal (non-quick) timers keep today's behaviour exactly.
- [ ] **Step 3:** `npx eslint` changed files; `npm run typecheck`; `npx jest src/stores src/features` (no regressions).
- [ ] **Step 4: Screenshot-verify** on the sim: run a quick-start from the arc, stop it, confirm the sheet rises non-blocking with a category pre-selected, Save logs it (appears in Done Today), Skip keeps it as Unsorted without shame styling. Judge; fix.
- [ ] **Step 5: Commit**

```bash
git add src/components/quick/PostStopCaptureSheet.tsx src/features/timer/useTimer.ts src/app/(modals)/timer.tsx src/theme/tokens.ts src/theme/useTheme.ts
git commit -m "feat(timer): capture-at-stop sheet for quick-start (save trains, skip abandons)"
```

---

## Task 8: Copy pass, a11y sweep, full-suite green, PR

**Files:** any strings added in Tasks 3–7; no new behaviour.

- [ ] **Step 1: Microcopy** — run every user-facing string added (chip label, arc bubble labels, capture sheet buttons + consequence line, any toast) through `conversion-psychology` (clarity/benefit framing) then `humanizer` (strip AI-slop tells). Keep the no-guilt invariant. Update strings in place.
- [ ] **Step 2: A11y** — confirm `accessibilityLabel`/`accessibilityRole` on every new touchable (chips, three arc bubbles in left→right Voice/Timer/Type order, Save/Skip), and that reduced-motion paths fade rather than spring.
- [ ] **Step 3: Full gate** — `npm run lint && npm run typecheck && npm test`. All green.
- [ ] **Step 4: Final device pass** — `npm run ios`; walk the whole flow (arc → each branch; chips re-fire; drawer thumb CTA; quick-start → capture Save/Skip). Capture a screenshot of each for the PR.
- [ ] **Step 5: Commit + open PR (do not merge)**

```bash
git commit -am "chore(quick): copy + a11y polish for fast task entry" || true
git push -u origin <branch>
gh pr create --title "feat: fast task entry (arc, quick chips, quick-start, thumb-zone CTA)" \
  --body "Implements docs/product/specs/11-fast-task-entry.md. Screens attached. Per repo policy, leaving merge to the founder."
```

Stop after opening the PR. **Never merge.**

---

## Self-review (against the spec)

- **Spec A (arc)** → Task 4. **Spec B (chips: ≤4, ≥3 runs, freq×recency)** → Tasks 1–3 (thresholds live in `rankFrequentTasks`). **Spec C (thumb-zone drawer)** → Task 5. **Spec D (quick-start capture: at-stop, pre-selected category, Save/Skip, kept-as-Unsorted, Undo-not-confirm, no nag)** → Tasks 6–7. **Accessibility (left→right Voice/Timer/Type)** → Tasks 4 + 8. **Microcopy humanizer pass** → Task 8.
- **No blocking placeholders:** every logic step ships real test + impl code; UI steps carry token rules + screenshot gates rather than vague "style it nicely".
- **Type consistency:** `FrequentTask` (Task 1) is consumed unchanged in Task 2; `QuickTaskChip` (Task 2) consumed in Task 3; `isQuickStart`/`quickStart` (Task 6) consumed in Task 7. `timerStore.start` keeps its existing `{label,category,estimateMin,guessMin?,suggestedHonestMin?,taskId?}` shape; `quickStart` is additive.
- **Open risk flagged to the executor:** the exact `calibrationStore` selector names for the repo + per-category stats (Task 2) and the `taskEventsRepo` factory export name (Task 1) must be matched to the real code — both are called out inline.
