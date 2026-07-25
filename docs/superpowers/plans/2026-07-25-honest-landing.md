# Honest Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free day-capacity verdict (which divides by a fixed 14-hour window and therefore always reads "· fits") with an honest landing time computed from now, the queued honest minutes, and the user's own end-of-day.

**Architecture:** A new pure engine function `honestLanding` walks the queued tasks forward from `nowMs` and returns the landing epoch, the overage, and the task that crosses end-of-day. A feature hook (`useHonestLanding`) feeds it store data plus a minute heartbeat. A new component (`HonestLandingCard`) renders four states in the anatomy the current chip already uses. The Pro path folds calendar minutes into the same function.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React Native 0.81 + Expo SDK 54, Zustand stores, Jest.

**Spec:** [`docs/superpowers/specs/2026-07-25-honest-landing-design.md`](../specs/2026-07-25-honest-landing-design.md)
**Mock (the shipped shape is direction D):** [`docs/product/mocks/day-capacity-v2-2026-07-25.html`](../../product/mocks/day-capacity-v2-2026-07-25.html)

## Global Constraints

- **Every spacing/size/font/color value comes from a token** in `src/theme/tokens.ts` via `useTheme()`. Never inline a raw number or hex. If a value doesn't exist, add it to `tokens.ts` and consume the token.
- **`src/engine/` is pure**: no React, no React Native, no Expo, no `Date.now()`. `nowMs` is always a parameter.
- **`src/app/**` and `src/components/**` must not import `@/src/services/*` or `@/src/db/*`.** Route through a store, provider, or feature hook. ESLint enforces this.
- **No guilt, ever.** Amber never becomes red. No streaks, no shame copy.
- **Free path never reads the calendar.** `eventMinAhead` is `0` for non-Pro and `getCalendar()` is never called on that path.
- **Pro-gate leak rule:** routine minutes stay out of the free landing — hide the gated value *and its position*.
- **No animation on content entrance** beyond opacity. No spring, no bounce, no translate-in.
- **TDD is required** for engine, hooks, stores, `src/lib/*`. Write the test first.
- **Conventional Commits. Never add `Co-Authored-By` or any AI-attribution trailer.**
- Run `npx eslint <files>` (flat `eslint.config.js`, there is no `.eslintrc.js`) plus `npm test` before considering any task done.

---

### Task 1: Fix `formatClockMeridiem` for 24-hour users

The landing card renders clock times everywhere, so this bug is directly in the path. `formatClockMeridiem` appends "am"/"pm" unconditionally, but `formatClock` respects the app-wide `hour12Default` set at boot from the device's 24-Hour Time toggle. A 24h user currently gets `21:50pm`.

**Files:**
- Modify: `src/lib/time.ts:31-35`
- Test: `src/lib/__tests__/time.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatClockMeridiem(epochMs: number): string` — unchanged signature, now returns `"21:50"` when the app is in 24-hour mode and `"9:50pm"` in 12-hour mode.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/time.test.ts`:

```ts
import { formatClockMeridiem, setClockHour12 } from '@/src/lib/time';

describe('formatClockMeridiem', () => {
  afterEach(() => setClockHour12(true)); // restore the module default

  test('12-hour mode keeps the meridiem', () => {
    setClockHour12(true);
    const at = new Date(2026, 6, 25, 21, 50).getTime();
    expect(formatClockMeridiem(at)).toBe('9:50pm');
  });

  test('24-hour mode drops the meridiem instead of appending it to a 24h clock', () => {
    setClockHour12(false);
    const at = new Date(2026, 6, 25, 21, 50).getTime();
    expect(formatClockMeridiem(at)).toBe('21:50');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/lib/__tests__/time.test.ts -t "24-hour mode"`
Expected: FAIL — received `"21:50pm"`, expected `"21:50"`.

- [ ] **Step 3: Write the minimal implementation**

Replace `src/lib/time.ts:31-35` with:

```ts
/** Local clock with meridiem in 12h mode ("5:00pm"); bare 24h clock ("17:00") otherwise. */
export function formatClockMeridiem(epochMs: number, hour12 = hour12Default): string {
  if (!hour12) return formatClock(epochMs, false);
  const d = new Date(epochMs);
  const meridiem = d.getHours() < 12 ? 'am' : 'pm';
  return `${formatClock(epochMs, true)}${meridiem}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/__tests__/time.test.ts`
Expected: PASS. Then run the full suite — this function has six existing callers (`settings.tsx`, `(tabs)/index.tsx`, `useDayEndSetting.ts`, `HonestDayPreview.tsx`): `npm test`. Expected: PASS, no snapshot churn (tests default to 12h).

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/lib/time.ts src/lib/__tests__/time.test.ts
git add src/lib/time.ts src/lib/__tests__/time.test.ts
git commit -m "fix(time): formatClockMeridiem no longer appends am/pm to a 24-hour clock"
```

---

### Task 2: Engine — `honestLanding`

**Files:**
- Create: `src/engine/honestLanding.ts`
- Modify: `src/engine/index.ts` (append the export beside the existing `honestDayLoad` line)
- Test: `src/engine/__tests__/honestLanding.test.ts`

**Interfaces:**
- Consumes: `MS_PER_MIN` from `src/engine/constants.ts` (already used by `planner.ts`).
- Produces:
  - `honestLanding(input: LandingInput): LandingResult`
  - `interface LandingTask { id: string; label: string; honestMin: number }`
  - `interface LandingInput { nowMs: number; dayEndMs: number; tasks: readonly LandingTask[]; eventMinAhead?: number }`
  - `type LandingKind = 'clear' | 'over' | 'past' | 'empty'`
  - `interface LandingResult { kind: LandingKind; landingMs: number | null; overMin: number; openMin: number; remainingMin: number; tail: LandingTask | null; ends: readonly TaskEnd[] }`
  - `interface TaskEnd { id: string; endMs: number }`

`ends` is the per-row cumulative finish for every task, in the same order as `tasks`. Task 7 renders it on the Up Next rows; computing it here means the component never re-walks the list.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/__tests__/honestLanding.test.ts`:

```ts
// src/engine/__tests__/honestLanding.test.ts
import { honestLanding, type LandingTask } from '@/src/engine';

const MIN = 60_000;
// A fixed, readable clock: 7:10pm on 2026-07-25, end of day 9:00pm.
const NOW = new Date(2026, 6, 25, 19, 10).getTime();
const DAY_END = new Date(2026, 6, 25, 21, 0).getTime();

const task = (id: string, honestMin: number): LandingTask => ({ id, label: id, honestMin });

test('empty when nothing is queued', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [] });
  expect(r.kind).toBe('empty');
  expect(r.landingMs).toBeNull();
  expect(r.remainingMin).toBe(0);
  expect(r.tail).toBeNull();
  expect(r.ends).toEqual([]);
});

test('clear — lands before end of day, openMin is the gap to dayEnd', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [task('a', 45), task('b', 25)] });
  expect(r.kind).toBe('clear');
  expect(r.remainingMin).toBe(70);
  expect(r.landingMs).toBe(NOW + 70 * MIN); // 8:20pm
  expect(r.openMin).toBe(40); // 8:20pm → 9:00pm
  expect(r.overMin).toBe(0);
  expect(r.tail).toBeNull();
});

test('over — lands past end of day; tail is the task that CROSSES it, in order', () => {
  // 45 + 25 + 90 = 160 min from 7:10pm → 9:50pm. 'c' is the block spanning 9:00pm.
  const r = honestLanding({
    nowMs: NOW,
    dayEndMs: DAY_END,
    tasks: [task('a', 45), task('b', 25), task('c', 90)],
  });
  expect(r.kind).toBe('over');
  expect(r.landingMs).toBe(NOW + 160 * MIN);
  expect(r.overMin).toBe(50);
  expect(r.openMin).toBe(0);
  expect(r.tail?.id).toBe('c');
});

test('tail is chosen by execution order, NOT by largest block', () => {
  // The 90-min task runs FIRST and is the one crossing 9:00pm; the later 30-min
  // task is not the tail even though a largest-first drop would pick the 90.
  const r = honestLanding({
    nowMs: NOW,
    dayEndMs: DAY_END,
    tasks: [task('big', 90), task('small', 30), task('last', 60)],
  });
  expect(r.kind).toBe('over');
  expect(r.tail?.id).toBe('small'); // 90 ends 8:40, +30 ends 9:10 → 'small' crosses
});

test('a task ending exactly at end of day is clear, not over', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [task('a', 110)] });
  expect(r.kind).toBe('clear');
  expect(r.openMin).toBe(0);
  expect(r.overMin).toBe(0);
  expect(r.tail).toBeNull();
});

test('past — now is already at or beyond end of day, whatever is queued', () => {
  const late = new Date(2026, 6, 25, 22, 30).getTime();
  const r = honestLanding({ nowMs: late, dayEndMs: DAY_END, tasks: [task('a', 115)] });
  expect(r.kind).toBe('past');
  expect(r.remainingMin).toBe(115);
  expect(r.overMin).toBe(90); // minutes since dayEnd
  expect(r.landingMs).toBe(late + 115 * MIN);
});

test('past also covers now exactly on the boundary', () => {
  const r = honestLanding({ nowMs: DAY_END, dayEndMs: DAY_END, tasks: [task('a', 10)] });
  expect(r.kind).toBe('past');
  expect(r.overMin).toBe(0);
});

test('eventMinAhead pushes the landing out and can flip clear to over', () => {
  const r = honestLanding({
    nowMs: NOW,
    dayEndMs: DAY_END,
    tasks: [task('a', 60)],
    eventMinAhead: 90,
  });
  expect(r.kind).toBe('over');
  expect(r.remainingMin).toBe(60); // remainingMin is TASK minutes only
  expect(r.landingMs).toBe(NOW + 150 * MIN); // 9:40pm
  expect(r.overMin).toBe(40);
});

test('ends carries a cumulative finish per task, in input order', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [task('a', 45), task('b', 25)] });
  expect(r.ends).toEqual([
    { id: 'a', endMs: NOW + 45 * MIN },
    { id: 'b', endMs: NOW + 70 * MIN },
  ]);
});

test('negative or zero honest minutes never move the clock backwards', () => {
  const r = honestLanding({ nowMs: NOW, dayEndMs: DAY_END, tasks: [task('a', -30), task('b', 20)] });
  expect(r.remainingMin).toBe(20);
  expect(r.landingMs).toBe(NOW + 20 * MIN);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/engine/__tests__/honestLanding.test.ts`
Expected: FAIL — `honestLanding` is not exported from `@/src/engine`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/honestLanding.ts`:

```ts
// PURE. The forward day read: walk the queued tasks from `now` at their honest
// minutes and report what time the day actually ends. No window, no fraction —
// a landing time can't collapse the way a shrinking denominator does.
//
// Deliberately NOT planner.ts's backward model: that one solves "when must I
// start to hit a deadline" and adds a per-task buffer. Honest minutes already
// carry the personal multiplier, so a buffer on top would double-count the very
// bias the multiplier exists to correct.
import { MS_PER_MIN } from './constants';

export interface LandingTask {
  id: string;
  label: string;
  /** Honest minutes for this task (guess × M_eff, already rounded). */
  honestMin: number;
}

export interface TaskEnd {
  id: string;
  /** Epoch ms this task finishes, given everything before it runs first. */
  endMs: number;
}

export interface LandingInput {
  nowMs: number;
  /** Epoch ms of the user's end of day (from `dayEndEpochFor`). */
  dayEndMs: number;
  /** Queued tasks in execution order. */
  tasks: readonly LandingTask[];
  /** Timed calendar minutes still ahead of now. Pro only; 0 for free users. */
  eventMinAhead?: number;
}

export type LandingKind =
  | 'clear' // lands at or before dayEnd
  | 'over' // lands after dayEnd
  | 'past' // now is already at/after dayEnd
  | 'empty'; // nothing queued and no events ahead

export interface LandingResult {
  kind: LandingKind;
  /** Epoch ms the last task finishes. `null` only when kind === 'empty'. */
  landingMs: number | null;
  /** Minutes past dayEnd — the overshoot when 'over', the time since dayEnd when 'past'. */
  overMin: number;
  /** Minutes between landing and dayEnd. 0 unless 'clear'. */
  openMin: number;
  /** Total honest minutes still queued (tasks only — events are not "your" work). */
  remainingMin: number;
  /** First task whose block crosses dayEnd, in execution order. `null` unless 'over'. */
  tail: LandingTask | null;
  /** Cumulative finish per task, same order as `tasks`. */
  ends: readonly TaskEnd[];
}

const EMPTY: LandingResult = {
  kind: 'empty',
  landingMs: null,
  overMin: 0,
  openMin: 0,
  remainingMin: 0,
  tail: null,
  ends: [],
};

export function honestLanding({
  nowMs,
  dayEndMs,
  tasks,
  eventMinAhead = 0,
}: LandingInput): LandingResult {
  const eventMin = Math.max(0, eventMinAhead);
  const remainingMin = tasks.reduce((sum, t) => sum + Math.max(0, t.honestMin), 0);

  if (remainingMin === 0 && eventMin === 0) return EMPTY;

  // Events are committed time that has to happen alongside the tasks, so they
  // push the whole chain out. They get no row of their own in `ends`.
  const landingMs = nowMs + (remainingMin + eventMin) * MS_PER_MIN;

  const ends: TaskEnd[] = [];
  let cursor = nowMs;
  let tail: LandingTask | null = null;
  for (const t of tasks) {
    cursor += Math.max(0, t.honestMin) * MS_PER_MIN;
    ends.push({ id: t.id, endMs: cursor });
    if (tail === null && cursor > dayEndMs) tail = t;
  }

  if (nowMs >= dayEndMs) {
    return {
      kind: 'past',
      landingMs,
      overMin: Math.round((nowMs - dayEndMs) / MS_PER_MIN),
      openMin: 0,
      remainingMin,
      tail: null,
      ends,
    };
  }

  if (landingMs > dayEndMs) {
    return {
      kind: 'over',
      landingMs,
      overMin: Math.round((landingMs - dayEndMs) / MS_PER_MIN),
      openMin: 0,
      remainingMin,
      tail,
      ends,
    };
  }

  return {
    kind: 'clear',
    landingMs,
    overMin: 0,
    openMin: Math.round((dayEndMs - landingMs) / MS_PER_MIN),
    remainingMin,
    tail: null,
    ends,
  };
}
```

Note the `tail` scan uses task-only time while `landingMs` includes events. That is intentional: `tail` answers "which task lands after 9", which is a fact about the task list. When events are present and push everything past `dayEndMs`, the card falls back to the headline alone (Task 8 covers that footer).

- [ ] **Step 4: Export from the engine barrel**

Append to `src/engine/index.ts`, directly under the existing `honestDayLoad` export line:

```ts
export { honestLanding } from './honestLanding';
export type {
  LandingInput,
  LandingResult,
  LandingKind,
  LandingTask,
  TaskEnd,
} from './honestLanding';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/engine/__tests__/honestLanding.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
npx eslint src/engine/honestLanding.ts src/engine/index.ts src/engine/__tests__/honestLanding.test.ts
npm run typecheck
git add src/engine/honestLanding.ts src/engine/index.ts src/engine/__tests__/honestLanding.test.ts
git commit -m "feat(engine): add honestLanding — forward day read with a real landing time"
```

---

### Task 3: Engine — the cold-start landing range

Before a category has `CONFIDENCE_HONEST_MIN_LOGS` logs, its honest number rests on a seeded prior. A single clock time there is false precision, so the card shows a range instead (spec state 3).

**Files:**
- Modify: `src/engine/honestLanding.ts` (append; do not restructure what Task 2 wrote)
- Modify: `src/engine/index.ts`
- Test: `src/engine/__tests__/honestLanding.test.ts` (append)

**Interfaces:**
- Consumes: `honestLanding` and `LandingResult` from Task 2.
- Produces: `landingRange(input: LandingRangeInput): LandingRangeResult` with
  `interface LandingRangeInput { nowMs: number; lowMin: number; highMin: number; eventMinAhead?: number }`
  and `interface LandingRangeResult { lowMs: number; highMs: number }`.

The caller sums each task's existing `honestRangeFor` band (`src/engine/confidence.ts:91`) into `lowMin`/`highMin`; this function only turns those totals into two clock instants, so it stays trivially testable.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/honestLanding.test.ts`:

```ts
import { landingRange } from '@/src/engine';

test('landingRange projects a summed band onto the clock', () => {
  const r = landingRange({ nowMs: NOW, lowMin: 180, highMin: 260 });
  expect(r.lowMs).toBe(NOW + 180 * MIN); // 10:10pm
  expect(r.highMs).toBe(NOW + 260 * MIN); // 11:30pm
});

test('landingRange folds events into both edges and never inverts', () => {
  const r = landingRange({ nowMs: NOW, lowMin: 90, highMin: 40, eventMinAhead: 30 });
  expect(r.lowMs).toBe(NOW + 70 * MIN); // low/high swapped back: 40 + 30
  expect(r.highMs).toBe(NOW + 120 * MIN); // 90 + 30
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/engine/__tests__/honestLanding.test.ts -t landingRange`
Expected: FAIL — `landingRange` is not exported from `@/src/engine`.

- [ ] **Step 3: Write the implementation**

Append to `src/engine/honestLanding.ts`:

```ts
export interface LandingRangeInput {
  nowMs: number;
  /** Summed lower edge of every task's honest range, in minutes. */
  lowMin: number;
  /** Summed upper edge, in minutes. */
  highMin: number;
  eventMinAhead?: number;
}

export interface LandingRangeResult {
  lowMs: number;
  highMs: number;
}

/**
 * Projects a summed honest band onto the clock. Used only before the categories
 * in play have enough logs for a single time to be honest. Edges are sorted, so
 * a caller that hands them over in the wrong order still gets a sane range.
 */
export function landingRange({
  nowMs,
  lowMin,
  highMin,
  eventMinAhead = 0,
}: LandingRangeInput): LandingRangeResult {
  const events = Math.max(0, eventMinAhead);
  const low = Math.max(0, Math.min(lowMin, highMin)) + events;
  const high = Math.max(0, Math.max(lowMin, highMin)) + events;
  return { lowMs: nowMs + low * MS_PER_MIN, highMs: nowMs + high * MS_PER_MIN };
}
```

- [ ] **Step 4: Export from the barrel**

Add to the `honestLanding` export block in `src/engine/index.ts`:

```ts
export { landingRange } from './honestLanding';
export type { LandingRangeInput, LandingRangeResult } from './honestLanding';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/engine/__tests__/honestLanding.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
npx eslint src/engine/honestLanding.ts src/engine/index.ts src/engine/__tests__/honestLanding.test.ts
npm run typecheck
git add src/engine/honestLanding.ts src/engine/index.ts src/engine/__tests__/honestLanding.test.ts
git commit -m "feat(engine): add landingRange for the cold-start landing band"
```

---

### Task 4: Hook — `useHonestLanding`

**Files:**
- Create: `src/features/today/useHonestLanding.ts`
- Test: `src/features/today/__tests__/useHonestLanding.test.ts`

**Interfaces:**
- Consumes: `honestLanding`, `landingRange`, `LandingResult`, `LandingTask` (Tasks 2–3); `resolveSuggestion`, `seededPriorFor`, `honestRangeFor` from `@/src/engine`; `dayEndEpochFor` from `@/src/lib/time`; `useDayTasksStore`, `useCalibrationStore`, `useSettingsStore`, `useEntitlement`.
- Produces: `useHonestLanding(): HonestLandingResult` where

```ts
export interface HonestLandingResult {
  landing: LandingResult;
  /** Non-null only while the categories in play are still cold. */
  range: { lowMs: number; highMs: number } | null;
  /** Logs still needed before the range collapses to one time. 0 when warm. */
  logsToWarm: number;
  /** Epoch ms of the user's end of day, for the card's bar geometry. */
  dayEndMs: number;
  /** The tick this result was computed at — the card formats clocks from it. */
  nowMs: number;
}
```

Task 6 consumes `landing`, `range`, `logsToWarm`, `dayEndMs`. Task 7 consumes `landing.ends`. Task 8 supplies `eventMinAhead` from the existing `useDayCapacity` result.

- [ ] **Step 1: Write the failing test**

Create `src/features/today/__tests__/useHonestLanding.test.ts`:

```ts
// Verifies the two things the hook owns that the engine can't: the minute
// heartbeat, and the free-path gate that keeps routines/calendar out.
import { renderHook, act } from '@testing-library/react-native';
import { useHonestLanding } from '@/src/features/today/useHonestLanding';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

const NOW = new Date(2026, 6, 25, 19, 10).getTime();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  useSettingsStore.setState({ dayEndMin: 21 * 60 }); // 9:00pm
  useEntitlement.setState({ isPro: false });
  useDayTasksStore.setState({
    selectedDate: '2026-07-25',
    dayTasks: [
      { id: 'a', label: 'Finish invoice batch', category: 'admin', guessMin: 30, status: 'queued' },
      { id: 'b', label: 'Draft the deck', category: 'deep', guessMin: 60, status: 'queued' },
      { id: 'c', label: 'Standup', category: 'meetings', guessMin: 30, status: 'completed' },
    ],
  } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

test('only queued tasks feed the landing', () => {
  const { result } = renderHook(() => useHonestLanding());
  expect(result.current.landing.ends).toHaveLength(2); // the completed row is out
});

test('the landing re-computes as the clock advances past a minute', () => {
  const { result } = renderHook(() => useHonestLanding());
  const first = result.current.nowMs;

  act(() => {
    jest.setSystemTime(NOW + 61_000);
    jest.advanceTimersByTime(61_000);
  });

  expect(result.current.nowMs).toBeGreaterThan(first);
});

test('the heartbeat is cleared on unmount', () => {
  const clearSpy = jest.spyOn(global, 'clearInterval');
  const { unmount } = renderHook(() => useHonestLanding());
  unmount();
  expect(clearSpy).toHaveBeenCalled();
  clearSpy.mockRestore();
});

test('dayEndMs comes from the user setting, not a constant window', () => {
  useSettingsStore.setState({ dayEndMin: 22 * 60 }); // 10:00pm
  const { result } = renderHook(() => useHonestLanding());
  expect(new Date(result.current.dayEndMs).getHours()).toBe(22);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/today/__tests__/useHonestLanding.test.ts`
Expected: FAIL — cannot resolve `useHonestLanding`.

- [ ] **Step 3: Write the implementation**

Create `src/features/today/useHonestLanding.ts`:

```ts
// ──────────────────────────────────────────────────────────────────────────────
// useHonestLanding — feeds the pure `honestLanding` engine read from the stores
// and keeps it honest as the clock moves.
//
// The engine is clock-free, so `nowMs` is state here: a landing time is wrong the
// moment the minute rolls over. One interval per mounted card, cleared on unmount.
//
// Free-path gate: routine blocks and calendar minutes are Pro. They must not
// enter the free landing — the Pro-gate rule hides a gated value AND its position,
// and a landing time that silently included them would leak both.
// Spec: docs/superpowers/specs/2026-07-25-honest-landing-design.md
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import {
  honestLanding,
  landingRange,
  resolveSuggestion,
  seededPriorFor,
  honestRangeFor,
  CONFIDENCE_HONEST_MIN_LOGS,
  type LandingResult,
  type LandingTask,
} from '@/src/engine';
import { dayEndEpochFor } from '@/src/lib/time';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

/** The landing text reads in whole minutes, so one tick a minute is exact enough. */
export const LANDING_TICK_MS = 60_000;

export interface HonestLandingResult {
  landing: LandingResult;
  range: { lowMs: number; highMs: number } | null;
  logsToWarm: number;
  dayEndMs: number;
  nowMs: number;
}

export function useHonestLanding(eventMinAhead = 0): HonestLandingResult {
  const dayTasks = useDayTasksStore((s) => s.dayTasks);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const dayEndMin = useSettingsStore((s) => s.dayEndMin);
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);
  const isPro = useEntitlement((s) => s.isPro);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), LANDING_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Honest minutes per queued task — mirrors the resolver useToday / useDayCapacity
  // already use, so the card and the rows can never disagree.
  const { tasks, coldLogsNeeded, lowMin, highMin } = useMemo(() => {
    const queued = dayTasks.filter((t) => t.status === 'queued');
    const out: LandingTask[] = [];
    let low = 0;
    let high = 0;
    let needed = 0;

    for (const t of queued) {
      const cached = statsByCategory[t.category];
      const cat = cached
        ? { fit: cached.fit, n: cached.n }
        : { fit: { a: 0, b: seededPriorFor(t.category, archetypeSeed) }, n: 0 };
      const suggestion = resolveSuggestion({
        guessMinutes: t.guessMin,
        category: cat,
        recurring: null,
      });
      out.push({ id: t.id, label: t.label, honestMin: suggestion.honestMinutes });

      const band = honestRangeFor({
        honestMinutes: suggestion.honestMinutes,
        guessMinutes: t.guessMin,
        clampedRatios: cached?.clampedRatios ?? [],
      });
      low += band.lowMinutes;
      high += band.highMinutes;
      needed = Math.max(needed, Math.max(0, CONFIDENCE_HONEST_MIN_LOGS - (cached?.n ?? 0)));
    }

    return { tasks: out, coldLogsNeeded: needed, lowMin: low, highMin: high };
  }, [dayTasks, statsByCategory, archetypeSeed]);

  const dayEndMs = useMemo(() => dayEndEpochFor(nowMs, dayEndMin), [nowMs, dayEndMin]);

  // Calendar minutes are Pro-only and arrive from useDayCapacity; a free caller
  // passes nothing and the default 0 keeps them out of the math entirely.
  const events = isPro ? Math.max(0, eventMinAhead) : 0;

  const landing = useMemo(
    () => honestLanding({ nowMs, dayEndMs, tasks, eventMinAhead: events }),
    [nowMs, dayEndMs, tasks, events],
  );

  const range = useMemo(
    () =>
      coldLogsNeeded > 0 && landing.kind !== 'empty'
        ? landingRange({ nowMs, lowMin, highMin, eventMinAhead: events })
        : null,
    [coldLogsNeeded, landing.kind, nowMs, lowMin, highMin, events],
  );

  return { landing, range, logsToWarm: coldLogsNeeded, dayEndMs, nowMs };
}
```

- [ ] **Step 4: Verify `CONFIDENCE_HONEST_MIN_LOGS` and `honestRangeFor` are exported from the barrel**

Run: `grep -n "CONFIDENCE_HONEST_MIN_LOGS\|honestRangeFor" src/engine/index.ts`
If either is missing, add it to `src/engine/index.ts` (constants re-export block for the first, the `./confidence` export line for the second). Do not import from the leaf modules directly — everything the app uses goes through the barrel.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/features/today/__tests__/useHonestLanding.test.ts`
Expected: PASS, 4 tests. If the store `setState` shapes drift from the real store types, fix the test fixture — do not loosen the hook.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
npx eslint src/features/today/useHonestLanding.ts src/features/today/__tests__/useHonestLanding.test.ts
npm run typecheck
git add src/features/today/useHonestLanding.ts src/features/today/__tests__/useHonestLanding.test.ts
git commit -m "feat(today): add useHonestLanding with a minute heartbeat and a free-path gate"
```

---

### Task 5: Copy module for the landing card

Splitting the strings out keeps the component about layout and makes the copy testable — the same split `daySoFar.ts` already uses for `countLine` / `gapMilestone`.

**Files:**
- Create: `src/features/today/honestLandingCopy.ts`
- Test: `src/features/today/__tests__/honestLandingCopy.test.ts`

**Interfaces:**
- Consumes: `LandingResult` (Task 2); `fmtHm`, `formatClockMeridiem` from `@/src/lib/time`.
- Produces:
  - `landingHeadline(landing: LandingResult, opts: HeadlineOpts): HeadlineCopy`
  - `interface HeadlineOpts { rangeLowMs?: number; rangeHighMs?: number; variant?: 'd' | 'dAlt' }`
  - `interface HeadlineCopy { lead: string; clock: string; trail: string }` — the component renders `clock` in amber when `landing.kind === 'over'` and in ink otherwise.
  - `landingFooter(landing: LandingResult, ctx: FooterCtx): FooterCopy`
  - `interface FooterCtx { doneCount: number; doneHonestMin: number; logsToWarm: number; dayEndShort: string }` — `dayEndShort` is the user's end-of-day spoken short ("9", "17:00") for the tail sentence
  - `interface FooterCopy { text: string; boldSpan: string | null; action: string }`

- [ ] **Step 1: Write the failing test**

Create `src/features/today/__tests__/honestLandingCopy.test.ts`:

```ts
import { landingHeadline, landingFooter } from '@/src/features/today/honestLandingCopy';
import type { LandingResult, LandingTask } from '@/src/engine';

const NOW = new Date(2026, 6, 25, 19, 10).getTime();
const MIN = 60_000;
const tail: LandingTask = { id: 'c', label: 'Draft the deck', honestMin: 90 };

const over: LandingResult = {
  kind: 'over',
  landingMs: NOW + 160 * MIN, // 9:50pm
  overMin: 50,
  openMin: 0,
  remainingMin: 160,
  tail,
  ends: [],
};

test('over headline leads with the landing, then the cost — no "by", no second clock', () => {
  const c = landingHeadline(over, {});
  expect(c.lead).toBe('Done ');
  expect(c.clock).toBe('~9:50pm');
  expect(c.trail).toBe(' · 50m past your day');
});

test('the D-alt variant is a string swap, not a different shape', () => {
  const c = landingHeadline(over, { variant: 'dAlt' });
  expect(c.lead).toBe('');
  expect(c.clock).toBe('~9:50pm');
  expect(c.trail).toBe(". That's 50m past your day.");
});

test('clear headline states the slack instead of a cost', () => {
  const clear: LandingResult = {
    kind: 'clear',
    landingMs: NOW + 105 * MIN,
    overMin: 0,
    openMin: 600,
    remainingMin: 105,
    tail: null,
    ends: [],
  };
  const c = landingHeadline(clear, {});
  expect(c.trail).toBe(' · 10h still open');
});

test('cold start reads as a range and never claims one time', () => {
  const c = landingHeadline(over, { rangeLowMs: NOW + 200 * MIN, rangeHighMs: NOW + 280 * MIN });
  expect(c.lead).toBe('Roughly done ');
  expect(c.clock).toBe('10:30pm – 11:50pm');
  expect(c.trail).toBe('');
});

test('past headline states the fact without a scold', () => {
  const past: LandingResult = {
    kind: 'past',
    landingMs: NOW,
    overMin: 90,
    openMin: 0,
    remainingMin: 115,
    tail: null,
    ends: [],
  };
  const c = landingHeadline(past, {});
  expect(c.lead).toBe('Your day ended ');
  expect(c.clock).toBe('1h 30m ago');
  expect(c.trail).toBe(' · 1h 55m still queued');
});

test('over footer names the tail task, it does not restate the overage', () => {
  const f = landingFooter(over, { doneCount: 2, doneHonestMin: 75, logsToWarm: 0, dayEndShort: '9' });
  expect(f.text).toBe('Draft the deck lands after 9');
  expect(f.boldSpan).toBe('Draft the deck');
  expect(f.action).toBe('Move it');
});

test('cold-start footer counts the real logs left', () => {
  const f = landingFooter(over, { doneCount: 0, doneHonestMin: 0, logsToWarm: 4, dayEndShort: '9' });
  expect(f.text).toBe('4 more logs and this tightens');
  expect(f.action).toBe('Start one');
});

test('clear footer with nothing logged offers growth, not a cut', () => {
  const clear: LandingResult = {
    kind: 'clear',
    landingMs: NOW,
    overMin: 0,
    openMin: 600,
    remainingMin: 105,
    tail: null,
    ends: [],
  };
  const f = landingFooter(clear, { doneCount: 0, doneHonestMin: 0, logsToWarm: 0, dayEndShort: '9' });
  expect(f.text).toBe('Nothing logged yet');
  expect(f.action).toBe('Add a task');
});

test('past footer offers tomorrow and says "logged", never "banked"', () => {
  const past: LandingResult = {
    kind: 'past',
    landingMs: NOW,
    overMin: 90,
    openMin: 0,
    remainingMin: 115,
    tail: null,
    ends: [{ id: 'a', endMs: NOW }, { id: 'b', endMs: NOW }],
  };
  const f = landingFooter(past, { doneCount: 2, doneHonestMin: 75, logsToWarm: 0, dayEndShort: '9' });
  expect(f.text).toBe('2 done · 1h 15m logged');
  expect(f.action).toBe('Move 2 to tomorrow');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/today/__tests__/honestLandingCopy.test.ts`
Expected: FAIL — cannot resolve `honestLandingCopy`.

- [ ] **Step 3: Write the implementation**

Create `src/features/today/honestLandingCopy.ts`:

```ts
// Every user-facing string on the landing card. Kept out of the component so the
// copy is unit-testable and so a wording change never touches layout.
//
// Rules baked in here (audited 2026-07-25, spec §"Copy decisions worth keeping"):
//   · "Done ~9:50pm", never "Done by" — this is a forecast, not a promise.
//   · "past your day", never "past your 9:00" — one clock reading per line.
//   · Name the tail task; don't restate the overage the headline just gave.
//   · "logged", never "banked" (Reclaim vocabulary, cut as off-thesis).
//   · "tightens", never "narrows" (that's the Pro confidence-band verb).
//   · No scold in any state. The past-end-of-day line is a fact plus an offer.
import { fmtHm, formatClockMeridiem } from '@/src/lib/time';
import type { LandingResult } from '@/src/engine';

export interface HeadlineOpts {
  rangeLowMs?: number;
  rangeHighMs?: number;
  /** 'd' (default) = "Done ~9:50pm · 50m past your day". 'dAlt' = clock first. */
  variant?: 'd' | 'dAlt';
}

export interface HeadlineCopy {
  lead: string;
  /** The emphasised span — amber on 'over', ink otherwise. */
  clock: string;
  trail: string;
}

export interface FooterCtx {
  doneCount: number;
  doneHonestMin: number;
  logsToWarm: number;
  /** The user's end of day, spoken short ("9", "17:00"), for the tail sentence. */
  dayEndShort: string;
}

export interface FooterCopy {
  text: string;
  /** The span within `text` rendered semibold, or null. */
  boldSpan: string | null;
  action: string;
}

export function landingHeadline(
  landing: LandingResult,
  { rangeLowMs, rangeHighMs, variant = 'd' }: HeadlineOpts,
): HeadlineCopy {
  if (landing.kind === 'past') {
    return {
      lead: 'Your day ended ',
      clock: `${fmtHm(landing.overMin)} ago`,
      trail: ` · ${fmtHm(landing.remainingMin)} still queued`,
    };
  }

  // Cold start wins over the exact-time forms: a seeded prior can't name a minute.
  if (rangeLowMs !== undefined && rangeHighMs !== undefined) {
    return {
      lead: 'Roughly done ',
      clock: `${formatClockMeridiem(rangeLowMs)} – ${formatClockMeridiem(rangeHighMs)}`,
      trail: '',
    };
  }

  const clock = `~${formatClockMeridiem(landing.landingMs ?? 0)}`;

  if (landing.kind === 'clear') {
    return { lead: 'Done ', clock, trail: ` · ${fmtHm(landing.openMin)} still open` };
  }

  if (variant === 'dAlt') {
    return { lead: '', clock, trail: `. That's ${fmtHm(landing.overMin)} past your day.` };
  }
  return { lead: 'Done ', clock, trail: ` · ${fmtHm(landing.overMin)} past your day` };
}

export function landingFooter(
  landing: LandingResult,
  { doneCount, doneHonestMin, logsToWarm, dayEndShort }: FooterCtx,
): FooterCopy {
  if (logsToWarm > 0) {
    return {
      text: `${logsToWarm} more logs and this tightens`,
      boldSpan: `${logsToWarm} more logs`,
      action: 'Start one',
    };
  }

  if (landing.kind === 'past') {
    return {
      text: `${doneCount} done · ${fmtHm(doneHonestMin)} logged`,
      boldSpan: fmtHm(doneHonestMin),
      action: `Move ${landing.ends.length} to tomorrow`,
    };
  }

  if (landing.kind === 'over' && landing.tail) {
    // "lands after 9" — the end-of-day hour spoken the way a person would say it.
    return {
      text: `${landing.tail.label} lands after ${dayEndShort}`,
      boldSpan: landing.tail.label,
      action: 'Move it',
    };
  }

  if (doneCount === 0) {
    return { text: 'Nothing logged yet', boldSpan: null, action: 'Add a task' };
  }
  return {
    text: `${doneCount} done · ${fmtHm(doneHonestMin)} logged`,
    boldSpan: fmtHm(doneHonestMin),
    action: 'Add a task',
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/features/today/__tests__/honestLandingCopy.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx eslint src/features/today/honestLandingCopy.ts src/features/today/__tests__/honestLandingCopy.test.ts
npm run typecheck
git add src/features/today/honestLandingCopy.ts src/features/today/__tests__/honestLandingCopy.test.ts
git commit -m "feat(today): add the honest-landing copy module"
```

---

### Task 6: `HonestLandingCard` component

**Files:**
- Create: `src/features/today/HonestLandingCard.tsx`
- Test: `src/features/today/__tests__/HonestLandingCard.test.tsx`
- Modify: `src/theme/tokens.ts` (only if `capacity.barH` needs the taller bar — see Step 3)

**Interfaces:**
- Consumes: `HonestLandingResult` (Task 4); `landingHeadline`, `landingFooter` (Task 5); `useTheme`, `type` from the theme layer.
- Produces: `<HonestLandingCard result={…} doneCount={…} doneHonestMin={…} onAction={…} />` with

```ts
export interface HonestLandingCardProps {
  result: HonestLandingResult;
  doneCount: number;
  doneHonestMin: number;
  /** Fires the footer action. The kind tells the caller which route to take. */
  onAction: (kind: 'move-tail' | 'add-task' | 'start-one' | 'move-to-tomorrow') => void;
}
```

Anatomy, matching the mock exactly: icon disc + one-line headline row, bar, scale row, hairline, footer row. Nothing here animates on entrance except opacity.

- [ ] **Step 1: Write the failing test**

Create `src/features/today/__tests__/HonestLandingCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { HonestLandingCard } from '@/src/features/today/HonestLandingCard';
import type { HonestLandingResult } from '@/src/features/today/useHonestLanding';

const NOW = new Date(2026, 6, 25, 19, 10).getTime();
const MIN = 60_000;
const DAY_END = new Date(2026, 6, 25, 21, 0).getTime();

const base = (over: Partial<HonestLandingResult['landing']> = {}): HonestLandingResult => ({
  landing: {
    kind: 'over',
    landingMs: NOW + 160 * MIN,
    overMin: 50,
    openMin: 0,
    remainingMin: 160,
    tail: { id: 'c', label: 'Draft the deck', honestMin: 90 },
    ends: [],
    ...over,
  },
  range: null,
  logsToWarm: 0,
  dayEndMs: DAY_END,
  nowMs: NOW,
});

test('renders the landing headline and the tail footer when over', () => {
  render(
    <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
  );
  expect(screen.getByText(/9:50pm/)).toBeTruthy();
  expect(screen.getByText(/Draft the deck lands after 9/)).toBeTruthy();
});

test('renders nothing at all on an empty day', () => {
  const empty = base({ kind: 'empty', landingMs: null, remainingMin: 0, tail: null });
  const { toJSON } = render(
    <HonestLandingCard result={empty} doneCount={0} doneHonestMin={0} onAction={jest.fn()} />,
  );
  expect(toJSON()).toBeNull();
});

test('past end of day renders NO bar — a 100% amber bar would read as a scold', () => {
  const past = base({ kind: 'past', overMin: 90, remainingMin: 115, tail: null });
  render(
    <HonestLandingCard result={past} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
  );
  expect(screen.queryByTestId('landing-bar')).toBeNull();
  expect(screen.getByText(/Your day ended/)).toBeTruthy();
});

test('the over bar has both an in-day and an overflow segment', () => {
  render(
    <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
  );
  expect(screen.getByTestId('landing-seg-in')).toBeTruthy();
  expect(screen.getByTestId('landing-seg-over')).toBeTruthy();
});

test('the clear bar has no overflow segment', () => {
  const clear = base({ kind: 'clear', landingMs: NOW + 60 * MIN, overMin: 0, openMin: 50, tail: null });
  render(
    <HonestLandingCard result={clear} doneCount={0} doneHonestMin={0} onAction={jest.fn()} />,
  );
  expect(screen.queryByTestId('landing-seg-over')).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/today/__tests__/HonestLandingCard.test.tsx`
Expected: FAIL — cannot resolve `HonestLandingCard`.

- [ ] **Step 3: Confirm the bar token before writing styles**

Run: `grep -n "capacity:" src/theme/tokens.ts`
Current: `capacity: { barH: 6, iconDisc: 20, segRadius: 3, pillPadX: 8 }`.

The mock's bar is 10pt. Change that one value to `barH: 10` in `tokens.ts` — the only other consumer is the Pro expanded bar in `CapacityChip.tsx:203`, which is the same bar and should match. Do not add a second bar-height token.

- [ ] **Step 4: Write the implementation**

Create `src/features/today/HonestLandingCard.tsx`:

```tsx
// ──────────────────────────────────────────────────────────────────────────────
// HonestLandingCard — the free Today day-read. Replaces the capacity verdict,
// which divided by a fixed 14h window and therefore always said "fits".
//
// Anatomy (deliberately the old chip's, so it sits in the card rhythm rather
// than becoming the loudest thing on the screen):
//   ⚡ disc · one-line headline
//   bar: now → landing, indigo up to end-of-day, amber past it
//   scale: now · dayEnd · landing
//   hairline
//   footer: fact left, one quiet action right
//
// 'past' renders NO bar on purpose: past end-of-day the bar could only be 100%
// amber, which turns the calmest state into the loudest — a guilt signal by
// accident, and the no-guilt invariant outranks visual consistency.
// Spec: docs/superpowers/specs/2026-07-25-honest-landing-design.md
// ──────────────────────────────────────────────────────────────────────────────

import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatClockMeridiem } from '@/src/lib/time';
import { landingHeadline, landingFooter } from './honestLandingCopy';
import type { HonestLandingResult } from './useHonestLanding';

export type LandingAction = 'move-tail' | 'add-task' | 'start-one' | 'move-to-tomorrow';

export interface HonestLandingCardProps {
  result: HonestLandingResult;
  doneCount: number;
  doneHonestMin: number;
  onAction: (kind: LandingAction) => void;
}

function actionKindFor(result: HonestLandingResult): LandingAction {
  if (result.logsToWarm > 0) return 'start-one';
  if (result.landing.kind === 'past') return 'move-to-tomorrow';
  if (result.landing.kind === 'over' && result.landing.tail) return 'move-tail';
  return 'add-task';
}

export function HonestLandingCard({
  result,
  doneCount,
  doneHonestMin,
  onAction,
}: HonestLandingCardProps): React.ReactElement | null {
  const t = useTheme();
  const { landing, range, logsToWarm, dayEndMs, nowMs } = result;

  if (landing.kind === 'empty') return null;

  const isOver = landing.kind === 'over';
  const showBar = landing.kind !== 'past';

  const headline = landingHeadline(landing, {
    rangeLowMs: range?.lowMs,
    rangeHighMs: range?.highMs,
  });
  const footer = landingFooter(landing, {
    doneCount,
    doneHonestMin,
    logsToWarm,
    dayEndShort: formatClockMeridiem(dayEndMs).replace(/:00(am|pm)?$/, ''),
  });

  // Bar geometry — every span is measured minutes, nothing is invented.
  // 'over': now → landing, with the end-of-day boundary as the colour change.
  // 'clear': now → end-of-day, filled only as far as the landing.
  const spanEndMs = isOver ? (landing.landingMs ?? dayEndMs) : dayEndMs;
  const totalMs = Math.max(1, spanEndMs - nowMs);
  const inDayMs = Math.max(0, Math.min(dayEndMs, landing.landingMs ?? nowMs) - nowMs);
  const overMs = isOver ? Math.max(0, (landing.landingMs ?? dayEndMs) - dayEndMs) : 0;
  const restMs = Math.max(0, totalMs - inDayMs - overMs);

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingTop: t.space[3.5] ?? t.space[3],
    paddingBottom: t.space[3],
  };
  const topRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const disc: ViewStyle = {
    width: t.capacity.iconDisc,
    height: t.capacity.iconDisc,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accentChip,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const headText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const clockText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: isOver ? t.colors.amberText : t.colors.ink,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    fontVariant: ['tabular-nums'],
  };
  const track: ViewStyle = {
    height: t.capacity.barH,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.capacity.segRadius,
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: t.space[3],
  };
  const scaleRow: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: t.space[1.5],
  };
  const scaleText: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };
  const divider: ViewStyle = {
    height: t.borderWidth.hairline || 1,
    backgroundColor: t.colors.hairline,
    marginTop: t.space[3],
  };
  const footRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: t.space[2.5],
  };
  const footText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, flex: 1 };
  const footBold: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: isOver ? t.colors.amberText : t.colors.ink,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };
  const actionText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.primary,
  };

  // Split the footer text around its bold span so the emphasis lands inline.
  const [beforeBold, afterBold] = footer.boldSpan
    ? (footer.text.split(footer.boldSpan) as [string, string])
    : [footer.text, ''];

  return (
    <View style={card} testID="honest-landing">
      <View style={topRow}>
        <View style={disc}>
          <Ionicons name="flash" size={t.iconSize.xs} color={t.colors.amberText} />
        </View>
        <Text style={headText} numberOfLines={2}>
          {headline.lead}
          <Text style={clockText}>{headline.clock}</Text>
          {headline.trail}
        </Text>
      </View>

      {showBar ? (
        <>
          <View style={track} testID="landing-bar">
            {inDayMs > 0 ? (
              <View
                testID="landing-seg-in"
                style={{ flex: inDayMs, backgroundColor: t.colors.primary }}
              />
            ) : null}
            {overMs > 0 ? (
              <View
                testID="landing-seg-over"
                style={{ flex: overMs, backgroundColor: t.colors.accent }}
              />
            ) : null}
            {restMs > 0 ? <View style={{ flex: restMs }} /> : null}
          </View>
          <View style={scaleRow}>
            <Text style={scaleText}>now · {formatClockMeridiem(nowMs)}</Text>
            <Text style={scaleText}>{formatClockMeridiem(dayEndMs)}</Text>
            {isOver && landing.landingMs ? (
              <Text style={scaleText}>{formatClockMeridiem(landing.landingMs)}</Text>
            ) : null}
          </View>
        </>
      ) : null}

      <View style={divider} />
      <View style={footRow}>
        <Text style={footText} numberOfLines={1}>
          {beforeBold}
          {footer.boldSpan ? <Text style={footBold}>{footer.boldSpan}</Text> : null}
          {afterBold}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={footer.action}
          onPress={() => onAction(actionKindFor(result))}
          hitSlop={t.size.hitSlop}
        >
          <Text style={actionText}>{footer.action} →</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Resolve every token this file touches**

Run: `grep -n "space:\|borderWidth:\|micro\|captionBold" src/theme/tokens.ts src/theme/typography.ts | head -20`

`t.space[3.5]` is used above with a fallback because the 4-based scale may not define it. If `3.5` is absent, either add `3.5: 14` to the `space` scale in `tokens.ts` **and** remove the `?? t.space[3]` fallback, or drop to `t.space[3]` outright. Do not leave the `??` in the shipped file — a fallback in a style is a token that was never decided. Same check for `type.micro` and `type.captionBold`: if a role is missing from `typography.ts`, add it there rather than inlining a size.

Per `useTheme` enumeration: any NEW token group added to `tokens.ts` needs a matching line in `resolveTheme` or `t.<key>` is undefined at runtime. Adding a key to an existing group (`space`, `capacity`) needs no such change.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/features/today/__tests__/HonestLandingCard.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 7: Lint, typecheck, commit**

```bash
npx eslint src/features/today/HonestLandingCard.tsx src/features/today/__tests__/HonestLandingCard.test.tsx src/theme/tokens.ts
npm run typecheck
git add src/features/today/HonestLandingCard.tsx src/features/today/__tests__/HonestLandingCard.test.tsx src/theme/tokens.ts
git commit -m "feat(today): add HonestLandingCard — the four landing states"
```

---

### Task 7: Wire the card into Today, replacing the free capacity path

**Files:**
- Modify: `src/app/(tabs)/index.tsx:349-354` (the `<CapacityChip cap={cap} />` block)
- Modify: `src/features/today/CapacityChip.tsx:60-125` (delete the free branch)
- Test: `src/features/today/__tests__/todayScreen.test.tsx` (extend)

**Interfaces:**
- Consumes: `useHonestLanding` (Task 4), `HonestLandingCard` + `LandingAction` (Task 6), the existing `cap` from `useDayCapacity`, and `useDayTasksStore.getState().moveToTomorrow` (already used at `index.tsx:~493`).
- Produces: no new exports. `CapacityChip` becomes Pro-only.

- [ ] **Step 1: Write the failing test**

Add to `src/features/today/__tests__/todayScreen.test.tsx`:

```tsx
test('a free user sees the landing card, never the capacity verdict', async () => {
  useEntitlement.setState({ isPro: false });
  renderTodayScreen(); // the existing helper in this file
  expect(await screen.findByTestId('honest-landing')).toBeTruthy();
  expect(screen.queryByTestId('capacity-free')).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx -t "landing card"`
Expected: FAIL — `honest-landing` not found; `capacity-free` still rendered.

- [ ] **Step 3: Render the card in Today**

In `src/app/(tabs)/index.tsx`, add the imports beside the existing Today feature imports:

```tsx
import { HonestLandingCard, type LandingAction } from '@/src/features/today/HonestLandingCard';
import { useHonestLanding } from '@/src/features/today/useHonestLanding';
```

Beside the existing `const cap = useDayCapacity()` call (around `:265`):

```tsx
// Timed calendar minutes still ahead of now — 0 for free users, because
// useDayCapacity never fetches the calendar on that path.
const eventMinAhead = useMemo(
  () =>
    cap.events.reduce(
      (sum, e) => sum + Math.max(0, (e.endMs - Math.max(Date.now(), e.startMs)) / 60_000),
      0,
    ),
  [cap.events],
);
const landing = useHonestLanding(eventMinAhead);

const onLandingAction = useCallback(
  (kind: LandingAction) => {
    if (kind === 'add-task' || kind === 'start-one') {
      router.push('/(modals)/add-task');
      return;
    }
    if (kind === 'move-tail' && landing.landing.tail) {
      void useDayTasksStore.getState().moveToTomorrow(landing.landing.tail.id);
      return;
    }
    if (kind === 'move-to-tomorrow') {
      for (const end of landing.landing.ends) {
        void useDayTasksStore.getState().moveToTomorrow(end.id);
      }
    }
  },
  [landing],
);
```

Replace the `<CapacityChip cap={cap} />` block at `:349-354` with the split below. Pro stays on `CapacityChip` **only until Task 11**, which migrates it onto the same card — this task is scoped to the free path so a reviewer can gate the two independently.

```tsx
{!isPastDay && totalCount > 0 ? (
  isPro ? (
    <CapacityChip cap={cap} />
  ) : (
    <HonestLandingCard
      result={landing}
      doneCount={done.length}
      doneHonestMin={done.reduce((sum, r) => sum + (r.actualMin ?? r.honestMin), 0)}
      onAction={onLandingAction}
    />
  )
) : null}
```

If `isPro` is not already in scope in this component, read it the way the rest of the file does: `const isPro = useEntitlement((s) => s.isPro);`.

- [ ] **Step 4: Delete the free branch from `CapacityChip`**

Remove `src/features/today/CapacityChip.tsx:60-125` in full — the entire `if (!isPro2) { … }` block, including the `freeWrap` / `freeDisc` / `freeLabel` / `freeSuffixStyle` locals and the `capacity-free` testID. Replace it with:

```tsx
  // Free users get HonestLandingCard instead — this component is Pro-only now.
  if (!isPro2) return null;
```

Delete the now-stale free-path lines from the file's header comment block (`:22-24`) and note that the component is Pro-only.

- [ ] **Step 5: Run the tests**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx src/features/today/__tests__/CapacityChip.test.tsx`
Expected: PASS. `CapacityChip.test.tsx` almost certainly has free-path cases asserting on `capacity-free` — delete those specific tests (the behaviour moved to `HonestLandingCard.test.tsx`, which already covers it). Do not weaken the Pro-path assertions.

- [ ] **Step 6: Full suite, lint, typecheck, commit**

```bash
npm test
npx eslint "src/app/(tabs)/index.tsx" src/features/today/CapacityChip.tsx src/features/today/__tests__/todayScreen.test.tsx src/features/today/__tests__/CapacityChip.test.tsx
npm run typecheck
git add "src/app/(tabs)/index.tsx" src/features/today/CapacityChip.tsx src/features/today/__tests__
git commit -m "feat(today): free path renders the honest landing instead of the capacity verdict"
```

---

### Task 8: Per-row honest end times

The headline is only checkable if the list agrees with it. Each Up Next row gains `· ends ~7:55`, and the tail row renders that clause in amber.

**Files:**
- Modify: `src/features/today/TaskRow.tsx:31-61` (props), `:266-274` (the category subtitle row)
- Modify: `src/app/(tabs)/index.tsx` (the `upNext.map` block around `:478`)
- Test: `src/features/today/__tests__/TaskRow.test.tsx`

**Interfaces:**
- Consumes: `landing.ends` (Task 2) and `landing.tail` via the `landing` object already in scope from Task 7.
- Produces: two new optional `TaskRowProps` — `endsAtLabel?: string` and `isTail?: boolean`.

- [ ] **Step 1: Write the failing test**

Add to `src/features/today/__tests__/TaskRow.test.tsx`:

```tsx
test('a queued row shows its honest end time beside the category', () => {
  render(
    <TaskRow
      title="Finish invoice batch"
      categoryLabel="Admin"
      guessMin={30}
      honestMin={45}
      endsAtLabel="ends ~7:55pm"
    />,
  );
  expect(screen.getByText(/ends ~7:55pm/)).toBeTruthy();
});

test('the tail row marks its end time as the one past end of day', () => {
  render(
    <TaskRow
      title="Draft the deck"
      categoryLabel="Deep work"
      guessMin={60}
      honestMin={90}
      endsAtLabel="ends ~9:50pm"
      isTail
    />,
  );
  expect(screen.getByTestId('taskrow-ends-tail')).toBeTruthy();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/today/__tests__/TaskRow.test.tsx -t "end time"`
Expected: FAIL — no matching text; `endsAtLabel` is not a prop.

- [ ] **Step 3: Add the props**

In `src/features/today/TaskRow.tsx`, append to `TaskRowProps` (after `carriedFrom`):

```ts
  /** Honest finish clock for this row, e.g. "ends ~7:55pm". Queued rows only. */
  endsAtLabel?: string;
  /** True when this is the row that crosses the user's end of day — amber clause. */
  isTail?: boolean;
```

Destructure both in the component signature alongside `carriedFrom`.

- [ ] **Step 4: Render it in the subtitle row**

Replace the subtitle `<View>` at `:266-274` with:

```tsx
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[0.5] }}>
          <Text style={catText}>{categoryLabel}</Text>
          {!done && carriedFrom ? (
            <Text style={catText}>
              {'· from '}
              {shortWeekday(carriedFrom)}
            </Text>
          ) : null}
          {!done && endsAtLabel ? (
            <Text
              testID={isTail ? 'taskrow-ends-tail' : 'taskrow-ends'}
              style={isTail ? { ...catText, color: t.colors.amberText } : catText}
            >
              {'· '}
              {endsAtLabel}
            </Text>
          ) : null}
        </View>
```

- [ ] **Step 5: Pass the labels from Today**

In `src/app/(tabs)/index.tsx`, build a lookup beside `onLandingAction`:

```tsx
const endsById = useMemo(
  () => new Map(landing.landing.ends.map((e) => [e.id, formatClockMeridiem(e.endMs)])),
  [landing.landing.ends],
);
```

In the `upNext.map` block, add to the `<TaskRow …>` props:

```tsx
  endsAtLabel={endsById.has(row.id) ? `ends ~${endsById.get(row.id)}` : undefined}
  isTail={landing.landing.tail?.id === row.id}
```

`formatClockMeridiem` is already imported in this file (`:30`).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/features/today/__tests__/TaskRow.test.tsx src/features/today/__tests__/todayScreen.test.tsx`
Expected: PASS.

- [ ] **Step 7: Lint, typecheck, commit**

```bash
npx eslint src/features/today/TaskRow.tsx "src/app/(tabs)/index.tsx" src/features/today/__tests__/TaskRow.test.tsx
npm run typecheck
git add src/features/today/TaskRow.tsx "src/app/(tabs)/index.tsx" src/features/today/__tests__/TaskRow.test.tsx
git commit -m "feat(today): show each queued row's honest end time, amber on the tail"
```

---

### Task 9: Guard the free path against calendar and routine leakage

The spec's hardest invariant is that the free landing contains no gated data. This task adds the regression tests that keep it that way — no production code changes unless a test fails.

**Files:**
- Test: `src/features/today/__tests__/useHonestLanding.test.ts` (extend)

**Interfaces:**
- Consumes: `useHonestLanding` (Task 4), the `getCalendar` service mock.
- Produces: nothing.

- [ ] **Step 1: Write the tests**

Append to `src/features/today/__tests__/useHonestLanding.test.ts`:

```ts
import { getCalendar } from '@/src/services/calendar';

jest.mock('@/src/services/calendar', () => ({
  getCalendar: jest.fn(() => ({
    requestReadAccess: jest.fn(async () => true),
    getEventsForDay: jest.fn(async () => []),
  })),
}));

test('a free user\'s landing never reads the calendar', () => {
  useEntitlement.setState({ isPro: false });
  renderHook(() => useHonestLanding(120)); // caller passes minutes; the gate must drop them
  expect(getCalendar).not.toHaveBeenCalled();
});

test('event minutes passed to a free user are ignored, not folded in', () => {
  useEntitlement.setState({ isPro: false });
  const { result: free } = renderHook(() => useHonestLanding(120));
  useEntitlement.setState({ isPro: true });
  const { result: pro } = renderHook(() => useHonestLanding(120));
  expect(pro.current.landing.landingMs).toBeGreaterThan(free.current.landing.landingMs ?? 0);
});
```

- [ ] **Step 2: Run the tests**

Run: `npx jest src/features/today/__tests__/useHonestLanding.test.ts`
Expected: PASS, 6 tests. If either fails, the gate at `useHonestLanding`'s `const events = isPro ? … : 0` is wrong — fix the hook, never the test.

- [ ] **Step 3: Lint and commit**

```bash
npx eslint src/features/today/__tests__/useHonestLanding.test.ts
git add src/features/today/__tests__/useHonestLanding.test.ts
git commit -m "test(today): lock the free landing against calendar and routine leakage"
```

---

### Task 10: D-alt headline behind a Developer toggle

The founder approved a second headline wording for on-device comparison. It is a string swap, not a layout — it rides the same component, stored in KV exactly like the paywall variant.

**Files:**
- Create: `src/features/today/useLandingVariant.ts`
- Modify: `src/features/today/HonestLandingCard.tsx` (read the variant)
- Modify: `src/app/settings.tsx` (Developer section)
- Test: `src/features/today/__tests__/useLandingVariant.test.ts`

**Interfaces:**
- Consumes: `kv` from `@/src/lib/kv`; `landingHeadline`'s `variant` option (Task 5).
- Produces: `useLandingVariant(): { variant: LandingVariant; setVariant: (v: LandingVariant) => void }`, `getLandingVariant()`, `setLandingVariant()`, `type LandingVariant = 'd' | 'dAlt'`, `LANDING_VARIANT_KEY = 'today.landingVariant'`.

- [ ] **Step 1: Write the failing test**

Create `src/features/today/__tests__/useLandingVariant.test.ts`:

```ts
import { getLandingVariant, setLandingVariant, LANDING_VARIANT_KEY } from '@/src/features/today/useLandingVariant';
import { kv } from '@/src/lib/kv';

afterEach(() => kv.delete(LANDING_VARIANT_KEY));

test('defaults to the approved D headline', () => {
  expect(getLandingVariant()).toBe('d');
});

test('round-trips the alternate through KV', () => {
  setLandingVariant('dAlt');
  expect(getLandingVariant()).toBe('dAlt');
});

test('an unknown stored value falls back to D rather than rendering nothing', () => {
  kv.set(LANDING_VARIANT_KEY, 'nonsense');
  expect(getLandingVariant()).toBe('d');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/today/__tests__/useLandingVariant.test.ts`
Expected: FAIL — cannot resolve `useLandingVariant`.

- [ ] **Step 3: Write the implementation**

Create `src/features/today/useLandingVariant.ts`, mirroring `usePaywallVariant.ts` exactly:

```ts
// ──────────────────────────────────────────────────────────────────────────────
// useLandingVariant — which headline wording HonestLandingCard renders, kept in
// KV so the founder can flip it from Settings → Developer and compare both on
// device. Default: 'd' ("Done ~9:50pm · 50m past your day").
// Spec: docs/superpowers/specs/2026-07-25-honest-landing-design.md
// ──────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react';
import { kv } from '@/src/lib/kv';

export type LandingVariant = 'd' | 'dAlt';

export const LANDING_VARIANT_KEY = 'today.landingVariant';

export function getLandingVariant(): LandingVariant {
  return kv.getString(LANDING_VARIANT_KEY) === 'dAlt' ? 'dAlt' : 'd';
}

export function setLandingVariant(variant: LandingVariant): void {
  kv.set(LANDING_VARIANT_KEY, variant);
}

export function useLandingVariant(): {
  variant: LandingVariant;
  setVariant: (v: LandingVariant) => void;
} {
  const [variant, setVariantState] = useState<LandingVariant>(getLandingVariant);
  const setVariant = useCallback((v: LandingVariant) => {
    setLandingVariant(v);
    setVariantState(v);
  }, []);
  return { variant, setVariant };
}
```

- [ ] **Step 4: Read it in the card**

In `HonestLandingCard.tsx`, add `import { useLandingVariant } from './useLandingVariant';`, call `const { variant } = useLandingVariant();` beside `useTheme()`, and pass it through:

```tsx
  const headline = landingHeadline(landing, {
    rangeLowMs: range?.lowMs,
    rangeHighMs: range?.highMs,
    variant,
  });
```

- [ ] **Step 5: Add the Settings row**

In `src/app/settings.tsx`, find the Developer section that already hosts the paywall variant control and add a matching two-option row labelled "Landing headline" with options `Done ~9:50pm` (`'d'`) and `9:50pm. That's…` (`'dAlt'`), wired to `useLandingVariant`. Match the surrounding row component and spacing exactly — do not introduce a new control style.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/features/today/__tests__/useLandingVariant.test.ts src/features/today/__tests__/HonestLandingCard.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full verification and commit**

```bash
npm test
npm run lint
npm run typecheck
git add src/features/today/useLandingVariant.ts src/features/today/HonestLandingCard.tsx src/app/settings.tsx src/features/today/__tests__/useLandingVariant.test.ts
git commit -m "feat(today): add the D-alt landing headline behind a Developer toggle"
```

---

### Task 11: Pro adopts the landing card

The spec's Pro rule is "same component, more data" — a Pro user who denies calendar
permission should degrade to the free card, not to a broken one. Task 7 left Pro on
`CapacityChip` so the free path could ship reviewable on its own; this task closes it.

**Files:**
- Modify: `src/features/today/HonestLandingCard.tsx` (meetings segment + `pad-calendar` action)
- Modify: `src/app/(tabs)/index.tsx` (drop the `isPro` fork added in Task 7)
- Modify: `src/features/today/CapacityChip.tsx` (delete — see Step 5)
- Test: `src/features/today/__tests__/HonestLandingCard.test.tsx` (extend)

**Interfaces:**
- Consumes: `HonestLandingResult` (Task 4), `LandingAction` (Task 6).
- Produces: `LandingAction` gains `'pad-calendar'`; `HonestLandingCardProps` gains
  `eventMinAhead?: number` (defaults to 0) so the card can size the meetings segment.

- [ ] **Step 1: Write the failing test**

Append to `src/features/today/__tests__/HonestLandingCard.test.tsx`:

```tsx
test('Pro with meetings renders a third bar segment and the Pad calendar action', () => {
  const onAction = jest.fn();
  render(
    <HonestLandingCard
      result={base()}
      doneCount={2}
      doneHonestMin={75}
      eventMinAhead={90}
      onAction={onAction}
    />,
  );
  expect(screen.getByTestId('landing-seg-meet')).toBeTruthy();
  expect(screen.getByLabelText('Pad calendar')).toBeTruthy();
});

test('Pro without meetings is byte-for-byte the free card', () => {
  const withZero = render(
    <HonestLandingCard
      result={base()}
      doneCount={2}
      doneHonestMin={75}
      eventMinAhead={0}
      onAction={jest.fn()}
    />,
  ).toJSON();
  expect(screen.queryByTestId('landing-seg-meet')).toBeNull();
  expect(withZero).toBeTruthy();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/today/__tests__/HonestLandingCard.test.tsx -t "Pro"`
Expected: FAIL — `landing-seg-meet` not found; `eventMinAhead` is not a prop.

- [ ] **Step 3: Add the meetings segment**

In `HonestLandingCard.tsx`, extend the type and props:

```tsx
export type LandingAction =
  | 'move-tail'
  | 'add-task'
  | 'start-one'
  | 'move-to-tomorrow'
  | 'pad-calendar';
```

Add `eventMinAhead = 0` to the destructured props (declare it as `eventMinAhead?: number` in
`HonestLandingCardProps`), then compute the segment beside the existing geometry:

```tsx
  // Meetings are committed time inside the same span — they take their slice out
  // of the in-day segment rather than extending the bar.
  const meetMs = Math.max(0, Math.min(eventMinAhead * 60_000, inDayMs));
  const taskInDayMs = Math.max(0, inDayMs - meetMs);
```

Render it between the in-day and overflow segments, and change the in-day segment to use
`taskInDayMs`:

```tsx
            {taskInDayMs > 0 ? (
              <View
                testID="landing-seg-in"
                style={{ flex: taskInDayMs, backgroundColor: t.colors.primary }}
              />
            ) : null}
            {meetMs > 0 ? (
              <View
                testID="landing-seg-meet"
                style={{ flex: meetMs, backgroundColor: t.colors.primaryEdge }}
              />
            ) : null}
```

- [ ] **Step 4: Add the Pad calendar action**

In `actionKindFor`, the Pro case takes precedence over `add-task` only — never over the
tail offer, which is the more useful action when the day is over:

```tsx
function actionKindFor(result: HonestLandingResult, hasMeetings: boolean): LandingAction {
  if (result.logsToWarm > 0) return 'start-one';
  if (result.landing.kind === 'past') return 'move-to-tomorrow';
  if (result.landing.kind === 'over' && result.landing.tail) return 'move-tail';
  if (hasMeetings) return 'pad-calendar';
  return 'add-task';
}
```

Pass `eventMinAhead > 0` as the second argument at the call site. When the resolved kind is
`'pad-calendar'`, the footer action label is `'Pad calendar'` — add that to `landingFooter`'s
`'clear'` branch in `honestLandingCopy.ts` by threading a `hasMeetings: boolean` through
`FooterCtx`, and add a copy test asserting the label.

- [ ] **Step 5: Drop the fork and delete `CapacityChip`**

In `src/app/(tabs)/index.tsx`, replace the `isPro ? <CapacityChip …> : <HonestLandingCard …>`
fork from Task 7 with a single unconditional card that also passes `eventMinAhead`:

```tsx
{!isPastDay && totalCount > 0 ? (
  <HonestLandingCard
    result={landing}
    doneCount={done.length}
    doneHonestMin={done.reduce((sum, r) => sum + (r.actualMin ?? r.honestMin), 0)}
    eventMinAhead={eventMinAhead}
    onAction={onLandingAction}
  />
) : null}
```

Handle `'pad-calendar'` in `onLandingAction` with `router.push({ pathname: '/(modals)/honest-day' })`
— the same route `CapacityChip.tsx:405` used.

Then delete `src/features/today/CapacityChip.tsx` and `src/features/today/__tests__/CapacityChip.test.tsx`,
and remove the import from `index.tsx`.

**Before deleting, check for other consumers:** run
`grep -rn "CapacityChip" src` and confirm only `index.tsx` and its own test reference it.
If anything else does, stop and report it rather than deleting.

**`useCapacityWidgetPublisher` still consumes `DayLoadResult` from `useDayCapacity`.** Leave
`useDayCapacity`, `honestDayLoad`, and `WAKING_WINDOW_MIN` in place — the presence widget is
under an add-only constraint and its migration is explicitly out of scope (spec §Open).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS. Any test still importing `CapacityChip` must be deleted, not stubbed.

- [ ] **Step 7: Lint, typecheck, commit**

```bash
npm run lint
npm run typecheck
git add -A src/features/today "src/app/(tabs)/index.tsx"
git commit -m "feat(today): Pro renders the landing card with a meetings segment"
```

---

## Device verification (not automated — do this before the PR)

The simulator can't be tapped from the CLI, and this card's whole job is to be right at a specific time of day. Verify on the device with the `whenbee-device` skill:

1. Set End of day to a time ~30 minutes out (Settings → End of day).
2. Queue two tasks whose honest total exceeds that gap → the card must read `over`, name the tail task, and the tail row must show its end time in amber.
3. Wait past the minute boundary → the landing time must advance without leaving the screen.
4. Move the tail to tomorrow → the card must flip to `clear` and the amber must disappear.
5. Let the clock pass End of day → the card must switch to `Your day ended …`, render **no bar**, and offer `Move N to tomorrow`.
6. Set the device to 24-Hour Time → every clock on the card reads `21:50`, never `21:50pm` (Task 1).

Remember: every timer you actually stop logs a real event into the founder's calibration. Use the capture sheet's "Skip for now" to abandon test runs, and report which categories you touched.
</content>
