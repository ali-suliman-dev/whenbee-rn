# Focus-Window Planner (Pro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a Pro "focus window" — the user marks the hours their head works best (e.g. 9:00–12:00); the app packs their honest-numbered tasks into that fixed window in priority order and lists what spills past it, with one-tap "Move up".

**Architecture:** Pure engine `src/engine/focusWindow.ts` (first-fit pack + smallest-eviction promote, TDD). Window stored as two ints in `settingsStore` (kv, no migration) — mirrors the `dayEndMin` pattern already merged. A shared honest-task resolver feeds both this and any future capacity surface. `FocusWindowCard` mounts on the Plan tab's `BuildView`, `ProGate`-d. **04 day-capacity was dropped and never built**, so this spec's references to `CapacityBar`/`resolveHonestTasks`/"below the CapacityCard" do NOT exist — build them here as fresh, self-contained pieces. Full spec: `docs/product/specs/09-focus-window-planner.md` (read §5 wireframes, §10 copy; **ignore its "reuse spec-04 CapacityBar / mount below CapacityCard" lines — 04 isn't built**).

**Tech Stack:** Expo SDK 54, RN 0.81 (Fabric), TS strict + `noUncheckedIndexedAccess`, Zustand, Reanimated, Jest, flat ESLint.

## Global Constraints

- **No-guilt:** amber-never-red; the spill list is "can wait", never "behind/too much/failed/overcommitted". No streak, no count of unfilled windows.
- **No health framing — by rule:** the window is "your focus window" / "the hours your head works best". NEVER reference energy, meds, symptoms, ADHD, or any condition anywhere (copy or comments). It stores only two local time-of-day integers.
- **Theming:** every value a token from `src/theme/tokens.ts` via `useTheme()` + roles from `typography.ts`. No raw numbers/hex. Reuse `Card`/`AppButton`/`Chip`/`FinishTimeWheel`. New token groups need a matching `useTheme` resolver line.
- **Layer rule:** UI → `useFocusWindow` hook → engine + stores. No `src/services`/`src/db` import in components.
- **Engine purity:** `focusWindow.ts` is pure, clock-free, never mutates inputs. The hook resolves honest minutes and reads the clock.
- **kv only:** window is two ints in `settingsStore`. No SQLite, no migration, nothing logged/trained.
- **Indigo vs amber:** the single CTA (invite "Set your focus window", locked "Fit your focus window") is the one filled indigo `AppButton`. The fill bar + "window full" state are amber. Never amber for a Pro CTA.
- **Motion:** durations/easing from `tokens.motion`; Reanimated `.get()/.set()`; entering-only (no `exiting` — Fabric SIGABRT); honor `ReduceMotion.System`.
- **Commits:** Conventional Commits, **no AI/co-author trailers** (HARD RULE), plain `git`, no `init-cmt`.
- **Never merge.** Open a PR and stop.

---

### Task 1: Engine — `focusWindow.ts` (TDD)

**Files:**
- Create: `src/engine/focusWindow.ts`
- Modify: `src/engine/index.ts`
- Create: `src/engine/__tests__/focusWindow.test.ts`
- (Domain types from Task 2 are imported here — do Task 2 first.)

**Interfaces:**
- Produces (exported via `src/engine/index.ts`): `focusWindowMinutes`, `fitFocusWindow`, `promoteIntoWindow`, and the `FocusWindowTask`/`FocusWindowInput` input types.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/__tests__/focusWindow.test.ts` (cases from spec §8):

```ts
import { fitFocusWindow, promoteIntoWindow, focusWindowMinutes } from '../focusWindow';

const tasks = (...mins: [string, number][]) => mins.map(([id, honestMin]) => ({ id, label: id, honestMin }));
const win = (tasksList: { id: string; label: string; honestMin: number }[], windowStartMin: number, windowEndMin: number) =>
  fitFocusWindow({ tasks: tasksList, windowStartMin, windowEndMin }, 'personal');

describe('focusWindowMinutes', () => {
  it('is end - start, floored at 0', () => {
    expect(focusWindowMinutes({ windowStartMin: 540, windowEndMin: 720 })).toBe(180);
    expect(focusWindowMinutes({ windowStartMin: 720, windowEndMin: 540 })).toBe(0);
  });
});

describe('fitFocusWindow', () => {
  it('1: empty → fits, nothing packed', () => {
    const r = win([], 540, 720);
    expect(r.verdict).toBe('fits'); expect(r.packedMin).toBe(0);
    expect(r.inWindow).toEqual([]); expect(r.spilled).toEqual([]);
  });
  it('2: all fit', () => {
    const r = win(tasks(['a', 90], ['b', 40], ['c', 20]), 540, 720); // 150 ≤ 180
    expect(r.verdict).toBe('fits'); expect(r.packedMin).toBe(150);
    expect(r.spilled).toEqual([]);
  });
  it('3: exact fit', () => {
    const r = win(tasks(['a', 90], ['b', 40], ['c', 20]), 540, 690); // window 150
    expect(r.verdict).toBe('fits'); expect(r.packedMin).toBe(150);
  });
  it('4: spill in order', () => {
    const r = win(tasks(['a', 90], ['b', 40], ['c', 50]), 540, 670); // window 130
    expect(r.verdict).toBe('spills');
    expect(r.inWindow.map((p) => p.id)).toEqual(['a', 'b']);
    expect(r.spilled.map((p) => p.id)).toEqual(['c']);
  });
  it('5: first-fit keeps trying smaller later tasks', () => {
    const r = win(tasks(['a', 50], ['b', 90], ['c', 40]), 540, 670); // window 130
    expect(r.inWindow.map((p) => p.id)).toEqual(['a', 'c']); // 50 fits, 90 spills, 40 fits
    expect(r.spilled.map((p) => p.id)).toEqual(['b']);
  });
  it('6: first task bigger than window', () => {
    const r = win(tasks(['a', 200], ['b', 10]), 540, 720); // window 180
    expect(r.inWindow.map((p) => p.id)).toEqual(['b']);
    expect(r.spilled.map((p) => p.id)).toEqual(['a']);
  });
  it('7: zero-length window spills all', () => {
    const r = win(tasks(['a', 30]), 600, 600);
    expect(r.verdict).toBe('spills'); expect(r.windowMin).toBe(0);
  });
  it('8: start>end floors window to 0', () => {
    const r = win(tasks(['a', 30]), 700, 600);
    expect(r.windowMin).toBe(0); expect(r.spilled.length).toBe(1);
  });
  it('counts + basis', () => {
    const r = win(tasks(['a', 30], ['b', 30]), 540, 720);
    expect(r.fitCount).toBe(2); expect(r.totalCount).toBe(2); expect(r.basis).toBe('personal');
  });
});

describe('promoteIntoWindow', () => {
  it('9: promote with free space, no eviction', () => {
    const base = win(tasks(['a', 90], ['b', 50]), 540, 720); // both fit (140≤180)... force spill instead:
    const spillBase = win(tasks(['a', 90], ['b', 50], ['c', 60]), 540, 670); // window 130: a,b in (140>130) → a in(90), b spills(50? 90+50=140>130) so a in, b spill, c spill
    // a(90) in, rem 40; b(50) spill; c(60) spill. free = 130-90 = 40 → promoting nothing fits w/o evict; test eviction below.
    expect(spillBase.inWindow.map((p) => p.id)).toEqual(['a']);
  });
  it('10: promote needs eviction → smallest in-window bumped', () => {
    const base = win(tasks(['a', 40], ['b', 30], ['c', 100]), 540, 620); // window 80: a(40) in, b(30) in (70), c spills
    const r = promoteIntoWindow(base, 'c'); // need 100, free=10, evict smallest in-window until fits
    expect(r.inWindow.some((p) => p.id === 'c')).toBe(true);
    expect(r.spilled.some((p) => p.id === 'a' || p.id === 'b')).toBe(true);
  });
  it('12: unknown id → unchanged', () => {
    const base = win(tasks(['a', 40]), 540, 720);
    expect(promoteIntoWindow(base, 'zzz')).toEqual(base);
  });
  it('15: inputs not mutated', () => {
    const list = tasks(['a', 40], ['b', 30]);
    const frozen = Object.freeze(list.map((x) => Object.freeze({ ...x })));
    expect(() => fitFocusWindow({ tasks: frozen as never, windowStartMin: 540, windowEndMin: 720 }, 'personal')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest src/engine/__tests__/focusWindow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/engine/focusWindow.ts`**

```ts
import type { FocusWindowResult, FocusWindowPlacement, FocusWindowVerdict } from '../domain/types';

export interface FocusWindowTask {
  id: string;
  label: string;
  honestMin: number; // resolved honest number (round5(guess × M)); never the raw guess
}

export interface FocusWindowInput {
  /** Tasks in PRIORITY order (caller supplies the order = the user's draft order). */
  tasks: readonly FocusWindowTask[];
  windowStartMin: number; // minutes-after-midnight, window start
  windowEndMin: number;   // minutes-after-midnight, window end (> start)
}

/** Window length in minutes, floored at 0 (handles start ≥ end defensively). */
export function focusWindowMinutes(input: { windowStartMin: number; windowEndMin: number }): number {
  return Math.max(0, input.windowEndMin - input.windowStartMin);
}

const place = (t: FocusWindowTask, inWindow: boolean): FocusWindowPlacement => ({
  id: t.id, label: t.label, honestMin: t.honestMin, inWindow,
});

const result = (
  windowMin: number,
  inWindow: FocusWindowPlacement[],
  spilled: FocusWindowPlacement[],
  basis: 'personal' | 'prior',
): FocusWindowResult => {
  const packedMin = inWindow.reduce((s, p) => s + p.honestMin, 0);
  return {
    windowMin, packedMin, inWindow, spilled,
    verdict: spilled.length > 0 ? 'spills' : 'fits',
    fitCount: inWindow.length, totalCount: inWindow.length + spilled.length, basis,
  };
};

/** First-fit pack in priority order: a task goes in-window if it fits the remaining
 *  space, else it spills (and we keep trying later, smaller tasks). Pure. */
export function fitFocusWindow(input: FocusWindowInput, basis: 'personal' | 'prior'): FocusWindowResult {
  const windowMin = focusWindowMinutes(input);
  let remaining = windowMin;
  const inWindow: FocusWindowPlacement[] = [];
  const spilled: FocusWindowPlacement[] = [];
  for (const t of input.tasks) {
    if (t.honestMin <= remaining) {
      inWindow.push(place(t, true));
      remaining -= t.honestMin;
    } else {
      spilled.push(place(t, false));
    }
  }
  return result(windowMin, inWindow, spilled, basis);
}

/** Promote a spilled task into the window, evicting the SMALLEST in-window task(s)
 *  (ties → later-in-order first, so earlier priorities survive) until it fits.
 *  Returns a NEW result; pure. Unknown id or unfittable-even-empty → unchanged. */
export function promoteIntoWindow(res: FocusWindowResult, taskId: string): FocusWindowResult {
  const target = res.spilled.find((p) => p.id === taskId);
  if (!target) return res;
  if (target.honestMin > res.windowMin) return res; // can't honestly fit even in an empty window

  const inWindow = [...res.inWindow];
  const spilled = res.spilled.filter((p) => p.id !== taskId);
  let free = res.windowMin - inWindow.reduce((s, p) => s + p.honestMin, 0);

  while (target.honestMin > free && inWindow.length > 0) {
    // smallest honestMin; ties broken by LATER original index (evict later first)
    let evictIdx = 0;
    for (let i = 1; i < inWindow.length; i += 1) {
      const cur = inWindow[i] as FocusWindowPlacement;
      const best = inWindow[evictIdx] as FocusWindowPlacement;
      if (cur.honestMin < best.honestMin || (cur.honestMin === best.honestMin && i > evictIdx)) evictIdx = i;
    }
    const [evicted] = inWindow.splice(evictIdx, 1);
    if (evicted) { spilled.unshift({ ...evicted, inWindow: false }); free += evicted.honestMin; }
  }
  inWindow.push({ ...target, inWindow: true });
  return result(res.windowMin, inWindow, spilled, res.basis);
}
```

- [ ] **Step 4: Export from `src/engine/index.ts`**

```ts
export { focusWindowMinutes, fitFocusWindow, promoteIntoWindow } from './focusWindow';
export type { FocusWindowTask, FocusWindowInput } from './focusWindow';
```

- [ ] **Step 5: Run to verify pass**

Run: `npx jest src/engine/__tests__/focusWindow.test.ts`
Expected: PASS. (Adjust the case-9 comment/expectation if your arithmetic differs — the assertion that matters is `inWindow === ['a']` for that setup.)

- [ ] **Step 6: Commit**

```bash
git add src/engine/focusWindow.ts src/engine/index.ts src/engine/__tests__/focusWindow.test.ts
git commit -m "feat(engine): add focus-window first-fit packer (pure)"
```

---

### Task 2: Domain types

**Files:** Modify `src/domain/types.ts`

**Interfaces:** Produces `FocusWindowVerdict`, `FocusWindowPlacement`, `FocusWindowResult`. (Do before Task 1 Step 3.)

- [ ] **Step 1: Add the types**

```ts
/** The focus-window fit verdict. Amber-never-red by construction. */
export type FocusWindowVerdict = 'fits' | 'spills';

/** One task placed by the focus-window fit (in-window or spilled). */
export interface FocusWindowPlacement {
  id: string;
  label: string;
  honestMin: number;
  inWindow: boolean;
}

/** Pure result of the focus-window fit (minutes; clock/time-of-day supplied by caller). */
export interface FocusWindowResult {
  windowMin: number;
  packedMin: number;
  inWindow: FocusWindowPlacement[];
  spilled: FocusWindowPlacement[];
  verdict: FocusWindowVerdict;
  fitCount: number;
  totalCount: number;
  basis: 'personal' | 'prior';
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` → clean.
```bash
git add src/domain/types.ts
git commit -m "feat(domain): add focus-window result types"
```

---

### Task 3: `settingsStore` — window start/end (TDD)

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Test: `src/stores/__tests__/settingsStore.test.ts` (add a describe block)

**Interfaces:**
- Produces: `windowStartMin: number | null`, `windowEndMin: number | null` (both null = unset/invite), `setFocusWindow(startMin, endMin): void` (writes both atomically, clamps to [0,1439], guards start<end), `reset()` restores both to null.

- [ ] **Step 1: Write failing tests**

Add to `src/stores/__tests__/settingsStore.test.ts`:

```ts
describe('settingsStore focus window', () => {
  beforeEach(() => useSettingsStore.getState().reset());
  it('defaults to unset (null/null)', () => {
    expect(useSettingsStore.getState().windowStartMin).toBeNull();
    expect(useSettingsStore.getState().windowEndMin).toBeNull();
  });
  it('setFocusWindow stores both', () => {
    useSettingsStore.getState().setFocusWindow(540, 720);
    expect(useSettingsStore.getState().windowStartMin).toBe(540);
    expect(useSettingsStore.getState().windowEndMin).toBe(720);
  });
  it('clamps to [0,1439]', () => {
    useSettingsStore.getState().setFocusWindow(-10, 99999);
    expect(useSettingsStore.getState().windowStartMin).toBe(0);
    expect(useSettingsStore.getState().windowEndMin).toBe(1439);
  });
  it('reset clears to null', () => {
    useSettingsStore.getState().setFocusWindow(540, 720);
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().windowStartMin).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail.** `npx jest src/stores/__tests__/settingsStore.test.ts`

- [ ] **Step 3: Implement** (mirror the merged `dayEndMin`/`clampDayEndMin` pattern)

In `src/stores/settingsStore.ts`, reuse the existing `clampDayEndMin` (rename mentally to a shared clamp, or add `clampMinuteOfDay`). Add to `SettingsState`:

```ts
windowStartMin: number | null;
windowEndMin: number | null;
setFocusWindow: (startMin: number, endMin: number) => void;
```

In `create()`:

```ts
windowStartMin: null,
windowEndMin: null,
setFocusWindow: (startMin, endMin) =>
  set({ windowStartMin: clampDayEndMin(startMin), windowEndMin: clampDayEndMin(endMin) }),
```

In `reset()`, add `windowStartMin: null, windowEndMin: null,`.

(`clampDayEndMin` already clamps to [0,1439] and is in the file from PR #27 — reuse it; if its name reads oddly for a start time, that's fine, it is a minute-of-day clamp.)

- [ ] **Step 4: Run → pass. Commit**

```bash
git add src/stores/settingsStore.ts src/stores/__tests__/settingsStore.test.ts
git commit -m "feat(settings): add focus-window start/end preference"
```

---

### Task 4: Honest-task resolver (shared helper)

**Files:**
- Create: `src/features/planner/resolveHonestTasks.ts`
- Test: `src/features/planner/__tests__/resolveHonestTasks.test.ts`

**Interfaces:**
- Produces: `resolveHonestTasks(input): { id: string; label: string; honestMin: number; done: boolean }[]` and `{ basis: 'personal' | 'prior' }` — the deduped union of plan-draft tasks (carry `durationMin` = honest block, use directly) + Today queued tasks (resolve `round5(guessMin × M)` via `resolveSuggestion`, prior fallback). Done tasks flagged.

This is a pure-ish helper: pass the raw task lists + the stats map in; it does NOT read stores itself (so it's testable). The hook wires stores to it.

- [ ] **Step 1: Write the failing test**

```ts
import { resolveHonestTasks } from '../resolveHonestTasks';

describe('resolveHonestTasks', () => {
  it('uses draft durationMin directly and resolves today guesses', () => {
    const out = resolveHonestTasks({
      draftTasks: [{ id: 'd1', label: 'Deep work', durationMin: 90, status: 'upcoming' }],
      todayTasks: [{ id: 't1', label: 'Email', category: 'email', guessMin: 10, status: 'queued' }],
      statsByCategory: {}, // no stats → prior basis
    });
    expect(out.tasks.find((t) => t.id === 'd1')?.honestMin).toBe(90);
    expect(out.tasks.find((t) => t.id === 't1')?.honestMin).toBeGreaterThan(0);
  });
  it('dedupes today tasks already in the draft by id', () => {
    const out = resolveHonestTasks({
      draftTasks: [{ id: 'x', label: 'X', durationMin: 30, status: 'upcoming' }],
      todayTasks: [{ id: 'x', label: 'X', category: 'admin', guessMin: 20, status: 'queued' }],
      statsByCategory: {},
    });
    expect(out.tasks.filter((t) => t.id === 'x').length).toBe(1);
  });
  it('excludes done tasks from the active set (flagged done)', () => {
    const out = resolveHonestTasks({
      draftTasks: [],
      todayTasks: [{ id: 'd', label: 'Done', category: 'admin', guessMin: 20, status: 'done' }],
      statsByCategory: {},
    });
    expect(out.tasks.find((t) => t.id === 'd')?.done).toBe(true);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** — read `usePlanner.suggestedDuration` (it calls `resolveSuggestion({ guessMinutes, category: cat, recurring: null })` with `cat = statsByCategory[category] ?? { fit:{a:0,b:priorFor(category)}, n:0 }`). Reproduce that resolution. `basis = 'prior'` only when every Today task fell back to priors (no stat with `n>0`) and there are no personal draft tasks. Draft tasks use `durationMin` directly and count as 'personal'. Dedupe Today by id present in draft. Filter the active set to non-done for the fit, but return `done` flags so the caller can show context.

- [ ] **Step 4: Run → pass. Commit**

```bash
git add src/features/planner/resolveHonestTasks.ts src/features/planner/__tests__/resolveHonestTasks.test.ts
git commit -m "feat(planner): add shared honest-task resolver"
```

---

### Task 5: `FillBar` component

**Files:** Create `src/components/FillBar.tsx`

**Interfaces:** Produces `<FillBar fraction fillColor height />` — an animated View track (track `t.colors.surfaceSunken`, fill `fillColor`, `radii.full`), fill width animates `0→fraction` over `t.motion.base` with `easing.standard`, `.get()/.set()`, reduced-motion paints final, entering-only. Model it on `src/components/HonestBand.tsx`'s track/segment approach (Views, not SVG). No unit test (UI).

- [ ] **Step 1: Build it** (reuse HonestBand's animated-width pattern; `fraction` clamped 0..1; `fillColor` passed by the caller so the card chooses primarySoft/accent).
- [ ] **Step 2: typecheck + lint.** `npm run typecheck && npx eslint src/components/FillBar.tsx`
- [ ] **Step 3: Commit.** `git add src/components/FillBar.tsx && git commit -m "feat(components): add animated FillBar"`

---

### Task 6: `useFocusWindow` hook

**Files:**
- Create: `src/features/planner/useFocusWindow.ts`
- Test: `src/features/planner/__tests__/useFocusWindow.test.ts`

**Interfaces:**
- Consumes: `tasksStore`, `planStore` (`draft.tasks`, `removeTask`), `useCalibrationStore` (`statsByCategory`), `settingsStore` (`windowStartMin`/`windowEndMin`/`setFocusWindow`), `resolveHonestTasks`, engine `fitFocusWindow`/`promoteIntoWindow`.
- Produces: `useFocusWindow()` → `{ result: FocusWindowResult | null, hasWindow: boolean, setWindow(startMin,endMin), promote(id) }`. `result` is null when the window is unset (invite). `promote` holds the promoted result in local state so the UI reflects the bump immediately (engine `promoteIntoWindow`, no store write).

- [ ] **Step 1: Write a focused test** (window unset → result null + hasWindow false; window set with tasks → result with verdict; promote(id) moves a spilled id in-window). Seed stores via their harnesses.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** — resolve the union via `resolveHonestTasks`, drop done tasks, keep draft order as priority, call `fitFocusWindow`. `setWindow` calls `settingsStore.setFocusWindow`. `promote` keeps a `useState<FocusWindowResult|null>` overlay.
- [ ] **Step 4: Run → pass. Commit.**

```bash
git add src/features/planner/useFocusWindow.ts src/features/planner/__tests__/useFocusWindow.test.ts
git commit -m "feat(planner): add useFocusWindow hook"
```

---

### Task 7: UI — `FocusWindowCard` + `FocusWindowList` + `FocusWindowLocked`, mounted on BuildView

**Files:**
- Create: `src/features/planner/FocusWindowCard.tsx`, `FocusWindowList.tsx`, `FocusWindowLocked.tsx`
- Modify: `src/features/planner/BuildView.tsx`

**Interfaces:** Consumes `useFocusWindow`, `FillBar`, `FinishTimeWheel` (with `showModes={false}` — merged in PR #27), `ProGate`/`useEntitlement`, `Card`/`AppButton`/`Chip`. Produces the Pro card (states: invite / fits / spills / empty / prior-basis / window-passed per spec §5) + non-Pro `FocusWindowLocked` teaser (§5/§9).

UI — no unit tests; verify typecheck + lint. Build per spec §5 wireframes + §10 copy (exact strings). Requirements:
- Invite (`!hasWindow`): "Mark the hours your head works best. I'll fit the right tasks into them." + one **indigo** `AppButton` "Set your focus window" → opens a two-stop `FinishTimeWheel` sheet ("When does your focus window start?" then "And when does it end?"), end pre-selects start+60 and disallows end ≤ start; on confirm `setWindow(startMin, endMin)`.
- Window chip (set): `{startClock}–{endClock}` via `formatClock`, with an edit glyph, tap re-opens the editor.
- fits: `FillBar` primarySoft, headline "All {n} fit your window" / "{fitCount} of {totalCount} fit your window", verdict line "These fit your focus window with {spare} to spare." No spill list.
- spills: `FillBar` accent (~full), `In your window` list + `Spills past your window` list; each spill row has a ghost "Move up" → `promote(id)`. Verdict "{fitCount} of these fit. The rest can wait." (singular variant per §10).
- empty (window set, no tasks): "No tasks yet. Add some and I'll fit them into {start}–{end}."
- prior-basis caption: "Times from typical patterns. Gets sharper as you log."
- window-passed: "Today's window has passed. This is ready for tomorrow." (no shrink — fit is time-of-day relative, not now-relative).
- Locked (non-Pro): labelled empty band + "Spend your best hours on the right things." + one **indigo** `AppButton` "Fit your focus window" → `router.push({ pathname: '/(modals)/paywall', params: { trigger: 'focus_window' } })`, fire `focus_window_paywall`.
- Mount in `BuildView.tsx`: read the file, place `<ProGate fallback={<FocusWindowLocked/>}><FocusWindowCard/></ProGate>` as its own section after the task list (use the existing `SectionLabel` rhythm; footer keeps `useSafeAreaInsets().bottom`). It does NOT go "below CapacityCard" — that card doesn't exist.
- Banned strings (no-guilt + no-health) per spec §10 must not appear.
- Fire `focus_window_viewed` on mount; `focus_window_set` on window save; `focus_window_promoted` on Move up (Task 8 adds events).

- [ ] **Step 1: Build the three components.**
- [ ] **Step 2: Mount in BuildView (ProGate-d).**
- [ ] **Step 3: typecheck + lint.** `npm run typecheck && npx eslint src/features/planner/FocusWindowCard.tsx src/features/planner/FocusWindowList.tsx src/features/planner/FocusWindowLocked.tsx src/features/planner/BuildView.tsx`
- [ ] **Step 4: Commit.** `git commit -m "feat(planner): add Pro focus-window card, list, and locked teaser"`

---

### Task 8: Analytics + `focus_window` trigger

**Files:** Modify `src/services/analytics.ts`, `src/features/paywall/Paywall.tsx`

- [ ] **Step 1:** Add to `AppEventProps`:

```ts
focus_window_viewed: { verdict: 'fits' | 'spills' | 'unset'; fit_count: number; total_count: number; window_min: number; is_pro: boolean };
focus_window_set: { window_start_min: number; window_end_min: number; window_min: number };
focus_window_spills: { fit_count: number; spill_count: number; window_min: number };
focus_window_promoted: { saved_min: number; evicted_n: number; verdict_after: 'fits' | 'spills' };
focus_window_paywall: { source: 'plan_section' };
```

Add `| 'focus_window'` to the `paywall_view.trigger` union.

- [ ] **Step 2:** Add `'focus_window'` to `Paywall.tsx`'s `Trigger` union + `isTrigger`.
- [ ] **Step 3:** typecheck + lint + commit.

```bash
git add src/services/analytics.ts src/features/paywall/Paywall.tsx
git commit -m "feat(analytics): add focus-window events and trigger"
```

---

### Task 9: Full gate + PR (do NOT merge)

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test` → all green.
- [ ] **Step 2:**

```bash
git push -u origin feat/pro-09-focus-window
gh pr create --title "feat: focus-window planner (Pro)" \
  --body "Pro focus-window: pack honest-numbered tasks into a fixed good-hours window, list spills, one-tap Move up. Pure engine (first-fit + smallest-eviction), kv-only window in settingsStore (no migration), own FillBar + honest-task resolver (04 CapacityBar never existed). No health framing anywhere. Spec: docs/product/specs/09-focus-window-planner.md. Plan: docs/superpowers/plans/2026-06-21-pro-09-focus-window.md. Sim verification pending (founder)."
```

Do NOT merge. Report PR URL, commits, gate output, deviations, and confirm main HEAD unchanged.

---

## Self-Review

**Spec coverage** (vs `docs/product/specs/09-focus-window-planner.md`): engine first-fit + promote ✔ (T1), types ✔ (T2), kv window ✔ (T3), shared resolver ✔ (T4, replaces the never-built 04 helper), bar ✔ (T5, replaces never-built CapacityBar), hook ✔ (T6), card states + locked + BuildView mount ✔ (T7), analytics + trigger ✔ (T8). No-health + no-guilt enforced in constraints + T7.

**Deviations from spec, deliberate:** 04 `CapacityBar`/`resolveHonestTasks`/"below CapacityCard" do not exist (04 dropped) → this plan builds `FillBar` + `resolveHonestTasks` fresh and mounts the section standalone in BuildView. Flagged in the header + T4/T5/T7.

**Placeholder scan:** engine/types/store/resolver carry full code + tests. T5–T7 UI reference the spec wireframe/copy (project allows UI without pixel-repro) but pin every state, token rule, copy source, indigo-vs-amber rule, and banned-string list.

**Type consistency:** `FocusWindowResult`/`FocusWindowPlacement`/`FocusWindowVerdict`, `fitFocusWindow`/`promoteIntoWindow`/`focusWindowMinutes`, `setFocusWindow`, `resolveHonestTasks` shape, `useFocusWindow` return, and the five `focus_window_*` events are consistent T1–T8.
