# Today cards batch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the three Today cards on one visual language, make the landing card collapsible, lighten the hunch-card amber, and let free users see the calendar offer.

**Spec:** `docs/product/specs/2026-07-26-today-cards-batch.md` (approved 2026-07-26)

**Architecture:** Pure logic first (copy modules + a duration helper in `src/lib` / `src/features/today/*.ts`), then the components consume it. `StatColumn` is extracted from `DaySoFarCard` into a shared component so recap and today can never drift again. Nothing touches the engine.

**Tech Stack:** React Native 0.81 / Expo SDK 54, TypeScript strict, Zustand, `expo-sqlite/kv-store` via `src/lib/kv.ts`, Jest + @testing-library/react-native, Reanimated.

## Global Constraints

- **Every spacing/size/font/color value comes from a token** in `src/theme/tokens.ts` via `useTheme()`. If a value doesn't exist, add it to `tokens.ts` and consume the token. Never inline a raw number or hex.
- **A new token group needs a matching line in `useTheme`'s `resolveTheme`** or `t.<key>` is `undefined` at runtime.
- **No guilt, ever.** Amber never becomes red. Running under is not a win, running over is not a loss.
- **No fabricated data.** Every rendered value must be measured. No ghost/placeholder bar segments.
- **Animation:** opacity fades only. No `translateY` entrance on content, no spring/bounce/overshoot, no `exiting` layout animations (Fabric SIGABRT). Durations from `t.motion.*`.
- **`borderWidth.hairline` is 0 by design.** For a divider that renders, use `t.borderWidth.chip` (1) or `StyleSheet.hairlineWidth` — match whatever the file already does.
- **Pressable is a bare touch wrapper.** Visual style goes on an inner `View`; `style={({pressed}) => …}` silently renders nothing under the React Compiler + nativewind combo.
- **Reanimated shared values use `.get()`/`.set()`, never `.value`.**
- **TypeScript:** `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride`. Indexed access returns `T | undefined` — handle it, don't `!`.
- **Layer rule (ESLint-enforced):** `src/app/**` and `src/components/**` must not import `@/src/services/*` or `@/src/db/*`. Route through a store/provider/feature hook.
- **Commits:** Conventional Commits. **NEVER** add `Co-Authored-By`, "Generated with Claude", 🤖, or any AI attribution. Project policy, no exceptions.
- **Verify every task:** `npx eslint <changed files>` (flat config `eslint.config.js`, there is no `.eslintrc.js`), `npm run typecheck`, `npx jest <suite>`, and `npm test` before the final commit.
- **Never merge, never open a PR mid-plan.** One PR at the very end.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/time.ts` | add `fmtDelta()` — worded signed duration | 1 |
| `src/features/today/StatColumn.tsx` | **new** — shared stat column, extracted from `DaySoFarCard` | 2 |
| `src/features/today/DaySoFarCard.tsx` | drops its local `StatColumn`, imports the shared one | 2 |
| `src/features/today/useDayRecap.ts` | adds `guessedMin` + `honestMin` to `DayRecap` | 3 |
| `src/features/today/dayRecapCopy.ts` | **new** — pure recap headline/scale copy | 3 |
| `src/features/today/DayRecapCard.tsx` | hybrid H1 layout | 4 |
| `src/features/today/landingCollapse.ts` | **new** — pure kv read/write for the collapse flag | 5 |
| `src/features/today/HonestLandingCard.tsx` | collapsible + legend + free upsell | 5, 7 |
| `src/theme/tokens.ts` | `colors.honeyText` (light + dark) | 6 |
| `src/features/shared/HonestSuggestionCard.tsx` | honey value at `titleSm` bold | 6 |
| `src/features/today/honestLandingCopy.ts` | legend + upsell strings, "booked" wording | 7 |
| `src/features/whenbee/AreaRow.tsx` | multiplier one size up | 8 |

---

### Task 1: `fmtDelta` — worded signed duration

**Files:**
- Modify: `src/lib/time.ts` (add after `fmtHm`, ~line 139)
- Test: `src/lib/__tests__/time.test.ts` (add a `describe` block; if the file lives elsewhere, find it with `npx jest --listTests | grep time`)

**Interfaces:**
- Consumes: `fmtHm(totalMin: number): string` — already in `src/lib/time.ts`
- Produces: `fmtDelta(deltaMin: number): { text: string; direction: 'over' | 'under' | 'even' }`

**Why:** A `+35m` / `−35m` reads as a score. `35m over` reads as a fact. The spec forbids the signed form.

- [ ] **Step 1: Write the failing test**

```ts
import { fmtDelta } from '@/src/lib/time';

describe('fmtDelta', () => {
  it('words a positive delta as over', () => {
    expect(fmtDelta(35)).toEqual({ text: '35m over', direction: 'over' });
  });

  it('words a negative delta as under, without a minus sign', () => {
    expect(fmtDelta(-20)).toEqual({ text: '20m under', direction: 'under' });
  });

  it('crosses the hour boundary via fmtHm', () => {
    expect(fmtDelta(65)).toEqual({ text: '1h 5m over', direction: 'over' });
    expect(fmtDelta(-120)).toEqual({ text: '2h under', direction: 'under' });
  });

  it('reports zero as even with no duration', () => {
    expect(fmtDelta(0)).toEqual({ text: 'even', direction: 'even' });
  });

  it('rounds fractional minutes before wording them', () => {
    expect(fmtDelta(34.6)).toEqual({ text: '35m over', direction: 'over' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest -t "fmtDelta"`
Expected: FAIL — `fmtDelta is not a function`

- [ ] **Step 3: Write the implementation**

Add to `src/lib/time.ts`, directly below `fmtHm`:

```ts
/**
 * A duration gap stated as a fact, never a score. `+35m` reads as a grade;
 * `35m over` reads as something that happened. Direction lives in the word,
 * so no caller ever renders a leading + or −.
 */
export function fmtDelta(deltaMin: number): {
  text: string;
  direction: 'over' | 'under' | 'even';
} {
  const rounded = Math.round(deltaMin);
  if (rounded === 0) return { text: 'even', direction: 'even' };
  if (rounded > 0) return { text: `${fmtHm(rounded)} over`, direction: 'over' };
  return { text: `${fmtHm(-rounded)} under`, direction: 'under' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest -t "fmtDelta"` — expect PASS (5 tests)
Run: `npx jest src/lib` — expect the existing time tests still green

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/lib/time.ts
git add src/lib/time.ts src/lib/__tests__/time.test.ts
git commit -m "feat(time): add fmtDelta for worded duration gaps"
```

---

### Task 2: Extract the shared `StatColumn`

**Files:**
- Create: `src/features/today/StatColumn.tsx`
- Modify: `src/features/today/DaySoFarCard.tsx:27-97` (delete the local component + its interface), `:186-188` (imports unchanged usage)
- Test: `src/features/today/__tests__/StatColumn.test.tsx` (new)

**Interfaces:**
- Produces:
  ```ts
  export interface StatColumnProps {
    value: string;
    unit?: string;
    label: string;
    dotColor?: string;
    divided?: boolean;
  }
  export function StatColumn(props: StatColumnProps): React.ReactElement;
  ```

**Why:** `DayRecapCard` and `DaySoFarCard` each grew their own stat column and drifted apart — different label case, different gaps, no column rules on one. One component is what stops that recurring.

**Move it verbatim.** Do not "improve" it while moving. `DaySoFarCard`'s existing tests must pass unchanged afterward; that is the proof the move was clean.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react-native';
import { StatColumn } from '@/src/features/today/StatColumn';

describe('StatColumn', () => {
  it('renders the value and its label', () => {
    render(<StatColumn value="2h 45m" label="HONEST" />);
    expect(screen.getByText('2h 45m')).toBeTruthy();
    expect(screen.getByText('HONEST')).toBeTruthy();
  });

  it('renders an optional unit suffix beside the value', () => {
    render(<StatColumn value="4" unit="tasks" label="LOGGED" />);
    expect(screen.getByText('tasks')).toBeTruthy();
  });

  it('omits the unit element when no unit is given', () => {
    render(<StatColumn value="4" label="LOGGED" />);
    expect(screen.queryByText('tasks')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/today/__tests__/StatColumn.test.tsx`
Expected: FAIL — cannot resolve `@/src/features/today/StatColumn`

- [ ] **Step 3: Create the file**

Cut lines 27–97 of `src/features/today/DaySoFarCard.tsx` (the header comment, `StatColumnProps`, and `StatColumn`) into `src/features/today/StatColumn.tsx` unchanged, adding the imports it needs and exporting both symbols:

```tsx
// src/features/today/StatColumn.tsx
// Stat column — value stacked over its label. Every column shares the exact
// same element shape / gap / zero per-column margins so the baselines line up
// (the one-spacing-source-per-axis rule). Shared by DaySoFarCard and
// DayRecapCard so the two can never drift apart again.

import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

export interface StatColumnProps { /* …verbatim from DaySoFarCard… */ }

export function StatColumn({ value, unit, label, dotColor, divided = false }: StatColumnProps) {
  /* …verbatim body from DaySoFarCard… */
}
```

- [ ] **Step 4: Point `DaySoFarCard` at it**

Delete the now-empty local definition and add:

```tsx
import { StatColumn } from './StatColumn';
```

- [ ] **Step 5: Run tests to verify**

Run: `npx jest src/features/today/__tests__/StatColumn.test.tsx` — expect PASS (3)
Run: `npx jest src/features/today/__tests__/DaySoFarCard.test.tsx` — expect PASS, **unchanged**. If any assertion had to change, the move was not verbatim; revert and redo.

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/features/today/StatColumn.tsx src/features/today/DaySoFarCard.tsx
git add src/features/today/StatColumn.tsx src/features/today/DaySoFarCard.tsx src/features/today/__tests__/StatColumn.test.tsx
git commit -m "refactor(today): extract shared StatColumn from DaySoFarCard"
```

---

### Task 3: Recap data + copy

**Files:**
- Modify: `src/features/today/useDayRecap.ts:10-51`
- Create: `src/features/today/dayRecapCopy.ts`
- Test: `src/features/today/__tests__/useDayRecap.test.ts` (extend), `src/features/today/__tests__/dayRecapCopy.test.ts` (new)

**Interfaces:**
- Consumes: `fmtDelta` (Task 1), `fmtHm` from `@/src/lib/time`
- Produces:
  - `DayRecap` gains `guessedMin: number` and `honestMin: number`
  - `recapHeadline(recap: Pick<DayRecap, 'doneCount' | 'vsGuessMin'>): { lead: string; gap: string | null; trail: string; direction: 'over' | 'under' | 'even' | 'empty' }`
  - `recapScale(guessedMin: number, honestMin: number): { left: string; right: string }`

**Why the two new fields:** the card shows GUESSED beside HONEST, so both numbers must come from the *same* set of tasks or the row won't add up to the headline. `realFocusMin` sums every done task (null `actualMin` → 0) while `vsGuessMin` only counts tasks whose `actualMin` is known — comparing those two directly is a bug waiting to happen. `guessedMin` and `honestMin` are both restricted to done tasks with a known `actualMin`. `realFocusMin` stays untouched for any other consumer.

- [ ] **Step 1: Write the failing hook test**

Append to `src/features/today/__tests__/useDayRecap.test.ts`, following the existing setup pattern in that file (reuse its store seeding helper — read the top of the file first):

```ts
it('sums guessedMin and honestMin over done tasks with a known actualMin', async () => {
  // Seed yesterday with: done guess 20 actual 30, done guess 15 actual 20,
  // done guess 40 actual null (excluded), queued guess 60 (excluded).
  // …use the same seeding helper the other tests in this file use…
  expect(result.current?.guessedMin).toBe(35);
  expect(result.current?.honestMin).toBe(50);
  expect(result.current?.vsGuessMin).toBe(15);
});
```

- [ ] **Step 2: Write the failing copy test**

```ts
import { recapHeadline, recapScale } from '@/src/features/today/dayRecapCopy';

describe('recapHeadline', () => {
  it('words an over day without a plus sign', () => {
    expect(recapHeadline({ doneCount: 4, vsGuessMin: 35 })).toEqual({
      lead: 'Ran ', gap: '35m over', trail: ' the day you pictured.', direction: 'over',
    });
  });

  it('words an under day', () => {
    expect(recapHeadline({ doneCount: 3, vsGuessMin: -20 })).toEqual({
      lead: 'Came in ', gap: '20m under', trail: ' the day you pictured.', direction: 'under',
    });
  });

  it('has no gap span when the day landed even', () => {
    expect(recapHeadline({ doneCount: 2, vsGuessMin: 0 })).toEqual({
      lead: 'Landed right on the day you pictured.', gap: null, trail: '', direction: 'even',
    });
  });

  it('reports an empty day with no gap span', () => {
    expect(recapHeadline({ doneCount: 0, vsGuessMin: 0 })).toEqual({
      lead: 'Nothing logged that day.', gap: null, trail: '', direction: 'empty',
    });
  });

  it('crosses the hour boundary', () => {
    expect(recapHeadline({ doneCount: 5, vsGuessMin: 65 }).gap).toBe('1h 5m over');
  });
});

describe('recapScale', () => {
  it('labels both ends of the gap bar', () => {
    expect(recapScale(130, 165)).toEqual({ left: 'guessed 2h 10m', right: 'real 2h 45m' });
  });
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `npx jest src/features/today/__tests__/dayRecapCopy.test.ts src/features/today/__tests__/useDayRecap.test.ts`
Expected: FAIL — module not found / `guessedMin` undefined

- [ ] **Step 4: Add the fields**

In `src/features/today/useDayRecap.ts`, add to the `DayRecap` interface:

```ts
  /** Sum of guessMin over done tasks with a known actualMin. Pairs with honestMin. */
  guessedMin: number;
  /** Sum of actualMin over done tasks with a known actualMin. Pairs with guessedMin. */
  honestMin: number;
```

and to the body, beside the existing reducers:

```ts
  const logged = done.filter((t) => t.actualMin != null);
  const guessedMin = logged.reduce((sum, t) => sum + t.guessMin, 0);
  const honestMin = logged.reduce((sum, t) => sum + (t.actualMin ?? 0), 0);
```

Return them alongside the existing fields.

- [ ] **Step 5: Write the copy module**

```ts
// src/features/today/dayRecapCopy.ts
// Pure copy for the past-day recap card. No React, no clock, no store access.
//
// No guilt: running over is a fact the model learns from, running under is not
// a prize. Neither branch praises or scolds — "the day you pictured" is what
// they're measured against, because a picture is something you had, not a
// target you missed.

import { fmtDelta, fmtHm } from '@/src/lib/time';

export interface RecapHeadline {
  /** Text before the gap span. Carries the whole line when `gap` is null. */
  lead: string;
  /** The emphasised gap phrase ("35m over"), or null when there isn't one. */
  gap: string | null;
  /** Text after the gap span. Empty when `gap` is null. */
  trail: string;
  direction: 'over' | 'under' | 'even' | 'empty';
}

export function recapHeadline(recap: { doneCount: number; vsGuessMin: number }): RecapHeadline {
  if (recap.doneCount === 0) {
    return { lead: 'Nothing logged that day.', gap: null, trail: '', direction: 'empty' };
  }
  const delta = fmtDelta(recap.vsGuessMin);
  if (delta.direction === 'even') {
    return { lead: 'Landed right on the day you pictured.', gap: null, trail: '', direction: 'even' };
  }
  return {
    lead: delta.direction === 'over' ? 'Ran ' : 'Came in ',
    gap: delta.text,
    trail: ' the day you pictured.',
    direction: delta.direction,
  };
}

/** The two ends of the gap bar, named so the bar needs no legend. */
export function recapScale(guessedMin: number, honestMin: number): { left: string; right: string } {
  return { left: `guessed ${fmtHm(guessedMin)}`, right: `real ${fmtHm(honestMin)}` };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/features/today/__tests__/dayRecapCopy.test.ts src/features/today/__tests__/useDayRecap.test.ts`
Expected: PASS. Existing `useDayRecap` assertions must still pass untouched.

- [ ] **Step 7: Lint + commit**

```bash
npx eslint src/features/today/dayRecapCopy.ts src/features/today/useDayRecap.ts
git add src/features/today/dayRecapCopy.ts src/features/today/useDayRecap.ts src/features/today/__tests__/dayRecapCopy.test.ts src/features/today/__tests__/useDayRecap.test.ts
git commit -m "feat(today): add recap guessed/honest totals and headline copy"
```

---

### Task 4: `DayRecapCard` — hybrid H1 layout

**Files:**
- Modify: `src/features/today/DayRecapCard.tsx` (replace its local `StatColumn` + stats row; keep the header, divider, disclosure and task list exactly as they are)
- Test: `src/features/today/__tests__/DayRecapCard.test.tsx`

**Interfaces:**
- Consumes: `StatColumn` (Task 2), `recapHeadline` / `recapScale` (Task 3), `fmtHm` from `@/src/lib/time`, `DayRecap` with `guessedMin` / `honestMin` (Task 3)

**Target anatomy, top to bottom:**

```
SAT · JUL 25                          eyebrow — type.eyebrowSm / inkFaint
Ran 35m over the day you pictured.    headline — type.bodyLg / ink; gap span in accent
▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒                       gap bar
guessed 2h 10m         real 2h 45m    scale — type.micro / inkFaint
──────────────────────────────────
4 tasks │ 2h 10m       │ 2h 45m       StatColumn ×3
LOGGED  │ ● GUESSED    │ ● HONEST
──────────────────────────────────
ALL TASKS · SAT                     ⌄ existing disclosure — DO NOT TOUCH
```

**Rules:**
- The eyebrow currently uses `type.eyebrow` + `inkSoft`. Change to `type.eyebrowSm` + `t.colors.inkFaint` to match `DaySoFarCard`.
- Gap span colour: `t.colors.accent` when `direction === 'over'`; `t.colors.inkSoft` when `'under'`. **Never `danger`.** Under is not a win and over is not a loss.
- Bar: reuse `DaySoFarCard`'s divider convention (`t.borderWidth.chip`). Track `t.colors.surfaceSunken`, height `t.capacity.barH`, radius `t.radii.full`. Guessed segment `t.colors.primary` with `flex: guessedMin`; overhang `t.colors.accent` with `flex: Math.max(0, honestMin - guessedMin)`; remainder `flex: Math.max(0, guessedMin - honestMin)` unstyled. Guard `Math.max(1, …)` on the total so a zero-minute day can't divide by zero.
- Stat dots: GUESSED `t.colors.primary`, HONEST `t.colors.accent`, LOGGED none. GUESSED and HONEST get `divided`, LOGGED does not.
- **No amber footline.** The headline already states the gap.
- **Empty day** (`doneCount === 0`): headline only. No bar, no scale, no stat row, no divider, **no disclosure row** — return right after the header.
- Keep the entering-only `FadeIn` on the expanded task list. Add no new animation.

- [ ] **Step 1: Write the failing tests**

Extend `src/features/today/__tests__/DayRecapCard.test.tsx` — read the existing `makeRecap` / `makeRow` helpers first and extend `makeRecap`'s defaults with `guessedMin: 75, honestMin: 90`:

```tsx
it('states the gap in words, never with a plus sign', () => {
  render(<DayRecapCard recap={makeRecap({ guessedMin: 130, honestMin: 165, vsGuessMin: 35 })} rows={[makeRow()]} />);
  expect(screen.getByText('35m over')).toBeTruthy();
  expect(screen.queryByText('+35m')).toBeNull();
});

it('formats durations in hours and minutes past the hour', () => {
  render(<DayRecapCard recap={makeRecap({ guessedMin: 130, honestMin: 165 })} rows={[makeRow()]} />);
  expect(screen.getByText('2h 10m')).toBeTruthy();
  expect(screen.getByText('2h 45m')).toBeTruthy();
  expect(screen.queryByText('165m')).toBeNull();
});

it('labels the stat columns like the day-so-far card', () => {
  render(<DayRecapCard recap={makeRecap()} rows={[makeRow()]} />);
  expect(screen.getByText('LOGGED')).toBeTruthy();
  expect(screen.getByText('GUESSED')).toBeTruthy();
  expect(screen.getByText('HONEST')).toBeTruthy();
});

it('renders headline only on a day with nothing logged', () => {
  render(<DayRecapCard recap={makeRecap({ doneCount: 0, plannedCount: 0, guessedMin: 0, honestMin: 0, vsGuessMin: 0 })} rows={[]} />);
  expect(screen.getByText('Nothing logged that day.')).toBeTruthy();
  expect(screen.queryByText('LOGGED')).toBeNull();
  expect(screen.queryByTestId('recap-bar')).toBeNull();
});

it('renders no overhang segment when the day came in under', () => {
  render(<DayRecapCard recap={makeRecap({ guessedMin: 120, honestMin: 100, vsGuessMin: -20 })} rows={[makeRow()]} />);
  expect(screen.getByText('20m under')).toBeTruthy();
  expect(screen.queryByTestId('recap-seg-over')).toBeNull();
});
```

Delete the two now-obsolete tests asserting the `+`/no-`+` prefix on `vsGuessMin` and the one asserting `90m` — the behaviour they pin is exactly what this task removes.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/features/today/__tests__/DayRecapCard.test.tsx`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Implement**

Delete the local `StatColumn` + `StatColumnProps` (lines 38–77) and import the shared one. Replace the stats row with the anatomy above. Give the bar `testID="recap-bar"` and the overhang segment `testID="recap-seg-over"`.

- [ ] **Step 4: Run tests**

Run: `npx jest src/features/today/__tests__/DayRecapCard.test.tsx` — expect PASS
Run: `npx jest src/features/today` — expect the whole today suite green

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/today/DayRecapCard.tsx
git add src/features/today/DayRecapCard.tsx src/features/today/__tests__/DayRecapCard.test.tsx
git commit -m "feat(today): recap card reads like the day-so-far card"
```

---

### Task 5: `HonestLandingCard` — collapsible

**Files:**
- Create: `src/features/today/landingCollapse.ts`
- Modify: `src/features/today/HonestLandingCard.tsx`
- Test: `src/features/today/__tests__/landingCollapse.test.ts` (new), `src/features/today/__tests__/HonestLandingCard.test.tsx` (extend — locate it first; if absent, create it following `DaySoFarCard.test.tsx`'s shape)

**Interfaces:**
- Produces:
  ```ts
  export const LANDING_COLLAPSE_KEY = 'today.landing.collapsed';
  export function readLandingCollapsed(): boolean;   // default false = open on first run
  export function writeLandingCollapsed(v: boolean): void;
  ```

**Rules:**
- Collapsed renders the disc, headline and chevron. Expanded adds bar, scale, divider, footer — i.e. everything the card renders today, unchanged.
- The **header row** is the touch target; the chevron is the affordance. `Pressable` stays a bare wrapper — visual style on the inner `View`.
- Chevron: `Ionicons` `chevron-down`, rotating 180° over `t.motion.base` with an ease-out curve. Reanimated shared value via `.get()`/`.set()`. Respect reduced motion → jump to the final state.
- Body entrance: `FadeIn.duration(t.motion.base)`. **No slide, no spring.** Plain unmount on collapse — no `exiting`.
- `landing.kind === 'past'` already renders no bar, so there is nothing to hide: render **no chevron and no toggle** in that state, always expanded.
- Persist through `kv`. Default **open** on first run.
- `accessibilityRole="button"` + `accessibilityState={{ expanded }}` on the header, mirroring `DayRecapCard`'s disclosure.

- [ ] **Step 1: Write the failing kv test**

```ts
import { kv } from '@/src/lib/kv';
import { LANDING_COLLAPSE_KEY, readLandingCollapsed, writeLandingCollapsed } from '@/src/features/today/landingCollapse';

describe('landingCollapse', () => {
  beforeEach(() => kv.delete(LANDING_COLLAPSE_KEY));

  it('defaults to expanded on a fresh install', () => {
    expect(readLandingCollapsed()).toBe(false);
  });

  it('round-trips a collapsed choice', () => {
    writeLandingCollapsed(true);
    expect(readLandingCollapsed()).toBe(true);
  });

  it('round-trips back to expanded', () => {
    writeLandingCollapsed(true);
    writeLandingCollapsed(false);
    expect(readLandingCollapsed()).toBe(false);
  });

  it('treats a corrupt stored value as expanded', () => {
    kv.set(LANDING_COLLAPSE_KEY, 'not-a-bool');
    expect(readLandingCollapsed()).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing component tests**

```tsx
it('hides the bar and footer when collapsed', () => {
  writeLandingCollapsed(true);
  render(<HonestLandingCard {...props} />);
  expect(screen.getByText(/Roughly done/)).toBeTruthy();
  expect(screen.queryByTestId('landing-bar')).toBeNull();
});

it('reveals the bar when the header is pressed', () => {
  writeLandingCollapsed(true);
  render(<HonestLandingCard {...props} />);
  fireEvent.press(screen.getByRole('button', { name: /roughly done/i }));
  expect(screen.getByTestId('landing-bar')).toBeTruthy();
});

it('renders no toggle in the past state', () => {
  render(<HonestLandingCard {...pastProps} />);
  expect(screen.queryByRole('button', { name: /roughly done/i })).toBeNull();
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx jest src/features/today/__tests__/landingCollapse.test.ts src/features/today/__tests__/HonestLandingCard.test.tsx`

- [ ] **Step 4: Implement `landingCollapse.ts`**

```ts
// src/features/today/landingCollapse.ts
// Whether the Today landing card is collapsed. One flag, synchronous kv, so the
// card renders in its remembered state on the first frame — a card that expands
// a beat after mount reads as a glitch.
//
// Default is EXPANDED: the card has to teach itself once before someone can
// decide they'd rather have it small.

import { kv } from '@/src/lib/kv';

export const LANDING_COLLAPSE_KEY = 'today.landing.collapsed';

export function readLandingCollapsed(): boolean {
  return kv.getString(LANDING_COLLAPSE_KEY) === '1';
}

export function writeLandingCollapsed(collapsed: boolean): void {
  kv.set(LANDING_COLLAPSE_KEY, collapsed ? '1' : '0');
}
```

- [ ] **Step 5: Implement the card changes**

`useState` seeded from `readLandingCollapsed()`; toggle calls `haptics.light()` then `writeLandingCollapsed`. Wrap the existing bar/scale/divider/footer block in the collapse condition.

- [ ] **Step 6: Run tests**

Run: `npx jest src/features/today` — expect green.

- [ ] **Step 7: Lint + commit**

```bash
npx eslint src/features/today/landingCollapse.ts src/features/today/HonestLandingCard.tsx
git add src/features/today/landingCollapse.ts src/features/today/HonestLandingCard.tsx src/features/today/__tests__/
git commit -m "feat(today): make the honest landing card collapsible"
```

---

### Task 6: Honey amber

**Files:**
- Modify: `src/theme/tokens.ts` (light `colors` block ~line 310, dark ~line 406), `src/features/shared/HonestSuggestionCard.tsx:110-115`
- Test: `src/features/shared/__tests__/HonestSuggestionCard.test.tsx`

**Rules:**
- Add `honeyText: '#B87A16'` to the **light** palette, next to `amberText`. Add `honeyText: '#EEAE4D'` to the **dark** palette (same as dark `amberText` — dark mode already reads light amber on a deep ground).
- Comment it with why: `#B87A16` is **3.6:1 on white — AA-large only**, so it is valid **only** on bold text at 18px or larger.
- `sentenceValue` in `HonestSuggestionCard`: `color` → `t.colors.honeyText`, `fontSize` → `t.fontSize.titleSm`, `fontWeight` → `t.fontWeight.bold`.
- **Do not touch any other `amberText` usage.** It has ~a dozen small-text consumers (overrun clock, footer bold spans, the ⚡ glyph) and swapping those silently breaks AA.
- Check `src/theme/useTheme.ts` — if `colors` is enumerated key-by-key in `resolveTheme` rather than spread, add the `honeyText` line or `t.colors.honeyText` is `undefined` at runtime.

- [ ] **Step 1: Write the failing test**

```tsx
it('renders the honest value in honey at the larger bold size', () => {
  render(<HonestSuggestionCard honestMinutes={30} guessMinutes={15} preEstimate range={{ lowMinutes: 20, highMinutes: 45 }} />);
  const value = screen.getByText(/20–45/);
  expect(value.props.style).toEqual(
    expect.objectContaining({ color: '#B87A16', fontSize: 18, fontWeight: '700' }),
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/shared/__tests__/HonestSuggestionCard.test.tsx`

- [ ] **Step 3: Add the token, then apply it**

- [ ] **Step 4: Run tests**

Run: `npx jest src/features/shared` then `npx jest src/theme` — expect green.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/theme/tokens.ts src/features/shared/HonestSuggestionCard.tsx
git add src/theme/tokens.ts src/features/shared/HonestSuggestionCard.tsx src/features/shared/__tests__/HonestSuggestionCard.test.tsx
git commit -m "feat(theme): add honeyText and lift the hunch card value"
```

---

### Task 7: Calendar legend + free upsell

**Files:**
- Modify: `src/features/today/honestLandingCopy.ts`, `src/features/today/HonestLandingCard.tsx`
- Test: `src/features/today/__tests__/honestLandingCopy.test.ts`, `src/features/today/__tests__/HonestLandingCard.test.tsx`

**Interfaces:**
- Consumes: `fmtHm`; the existing bar geometry in `HonestLandingCard` (`taskInDayMs`, `meetMs`, `overMs`)
- Produces:
  ```ts
  export function landingLegend(a: { taskMin: number; bookedMin: number; overMin: number })
    : Array<{ key: 'tasks' | 'booked' | 'over'; value: string; label: string }>;
  export function landingUpsell(): { text: string; action: string };
  ```
- `LandingAction` gains `'connect-calendar'`

**Rules — legend:**
- Rendered **only when `bookedMin > 0`**, directly **under** the existing now/day-end scale row — under, never replacing it, so the bar keeps its anchor in time.
- Entries in bar order: tasks (`t.colors.primary`), booked (`t.colors.primaryEdge`), over (`t.colors.accent`). The `over` entry appears only when `overMin > 0`.
- **The word is "booked."** Never "meetings", "scheduled", "commitments", or "events". Also update the existing footer string `'Pad calendar'` branch to read `{fmtHm(bookedMin)} already booked today`.
- **Derive the legend from the same values the segments use.** Do not recompute from props — two sources can disagree, and then the picture lies.

**Rules — free upsell:**
- Text: `Optimistic — your calendar isn't in it`. Action: `Add it`.
- Small lock glyph in `t.colors.accent` before the text; text `t.colors.inkSoft`; action `t.colors.primary`.
- Quiet text action, **never** a filled button — the screen's one primary CTA stays the FAB.
- Must stay on one line: `numberOfLines={1}` on the text, `flex: 1`, action `flex: 0 0 auto`.
- **Shown when:** `!isPro` **AND** calendar events are off **AND** there is at least one queued task (`landing.kind !== 'empty'`).
- **Never when:** `landing.kind === 'past'`, or the day is empty.
- **Never render a placeholder bar segment for it.** The free bar shows only what tasks justify. A ghost slice would be invented data and the number under it would be wrong until they paid.

- [ ] **Step 1: Write the failing copy tests**

```ts
describe('landingLegend', () => {
  it('names calendar time booked, never meetings', () => {
    const legend = landingLegend({ taskMin: 95, bookedMin: 120, overMin: 0 });
    expect(legend).toEqual([
      { key: 'tasks', value: '1h 35m', label: 'tasks' },
      { key: 'booked', value: '2h', label: 'booked' },
    ]);
    expect(JSON.stringify(legend)).not.toMatch(/meeting/i);
  });

  it('adds the over entry only when the day runs past its end', () => {
    const legend = landingLegend({ taskMin: 400, bookedMin: 255, overMin: 40 });
    expect(legend.map((e) => e.key)).toEqual(['tasks', 'booked', 'over']);
  });

  it('returns nothing when no calendar time exists', () => {
    expect(landingLegend({ taskMin: 95, bookedMin: 0, overMin: 0 })).toEqual([]);
  });
});

describe('landingUpsell', () => {
  it('names the limit of the number on screen without blaming anyone', () => {
    expect(landingUpsell()).toEqual({
      text: "Optimistic — your calendar isn't in it",
      action: 'Add it',
    });
  });
});
```

- [ ] **Step 2: Write the failing component tests**

```tsx
it('offers the calendar to a free user with tasks queued', () => {
  mockEntitlement({ isPro: false });
  render(<HonestLandingCard {...props} eventMinAhead={0} />);
  expect(screen.getByText(/your calendar isn't in it/)).toBeTruthy();
});

it('never offers it on a past day', () => {
  mockEntitlement({ isPro: false });
  render(<HonestLandingCard {...pastProps} eventMinAhead={0} />);
  expect(screen.queryByText(/your calendar isn't in it/)).toBeNull();
});

it('never offers it to a Pro user with calendar on', () => {
  mockEntitlement({ isPro: true });
  render(<HonestLandingCard {...props} eventMinAhead={120} />);
  expect(screen.queryByText(/your calendar isn't in it/)).toBeNull();
});

it('renders no bar segment for the un-purchased calendar', () => {
  mockEntitlement({ isPro: false });
  render(<HonestLandingCard {...props} eventMinAhead={0} />);
  expect(screen.queryByTestId('landing-seg-meet')).toBeNull();
});

it('shows the legend once calendar time exists', () => {
  mockEntitlement({ isPro: true });
  render(<HonestLandingCard {...props} eventMinAhead={120} />);
  expect(screen.getByText('booked')).toBeTruthy();
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx jest src/features/today/__tests__/honestLandingCopy.test.ts src/features/today/__tests__/HonestLandingCard.test.tsx`

- [ ] **Step 4: Implement copy, then the card**

- [ ] **Step 5: Run tests**

Run: `npx jest src/features/today` — expect green.

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/features/today/honestLandingCopy.ts src/features/today/HonestLandingCard.tsx
git add src/features/today/honestLandingCopy.ts src/features/today/HonestLandingCard.tsx src/features/today/__tests__/
git commit -m "feat(today): explain the landing bar and offer calendar to free users"
```

---

### Task 8: `AreaRow` multiplier size

**Files:**
- Modify: `src/features/whenbee/AreaRow.tsx:54-61`

**Why:** the indigo `2.1×` sat at `fontSize.sm` (12) beside a `fontSize.base` (14) category name, so the learned multiplier — the row's actual payload — read as a footnote to its own label.

- [ ] **Step 1: Apply**

```ts
  const multText: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.base,
    color: t.colors.primary,
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  };
```

`minWidth` goes 34 → 40 because `2.1×` at 14 bold clips at 34.

- [ ] **Step 2: Verify**

Run: `npx eslint src/features/whenbee/AreaRow.tsx` then `npx jest src/features/whenbee` — expect 57 passing.

- [ ] **Step 3: Commit**

```bash
git add src/features/whenbee/AreaRow.tsx
git commit -m "fix(whenbee): size the area multiplier to match its row"
```

---

### Task 9: Full verification + PR

- [ ] **Step 1: Full gate**

```bash
npm run lint && npm run typecheck && npm test
```

All three must pass. A flaky failure is a real bug — reproduce and fix the race, never re-run until green.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin <branch>
gh pr create --title "feat(today): recap stats, collapsible landing, honey amber, calendar legend" --body "<summary + spec link + verification notes>"
```

**⛔ DO NOT MERGE.** Open the PR and stop. The founder reviews and merges every PR by hand. No `gh pr merge`, no merge button, no exceptions.

PR body must note: **device verification still owed** — the founder verifies on Android before merge.
