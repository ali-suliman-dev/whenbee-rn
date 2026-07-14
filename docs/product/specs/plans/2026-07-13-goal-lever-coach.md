# Goal Lever Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the add-sheet goal coach's "Use Xm" apply button (which feeds the engine its own output and escalates 15→25→40→60) with a read-only status + lever card per spec `docs/product/specs/2026-07-13-goal-lever-coach.md`.

**Architecture:** Reshape `loadGoalCoach` in `calibrationStore` to return a rich `GoalCoachInfo` (goal bands, forward-only progress, inside-band count over the last ≤7 logs, time-of-day lever). Rewrite `GoalCoachCard` as a non-interactive card consuming it. Delete `applyHonest` from `useAddTask`. Zero engine changes — everything derives from existing exported engine functions.

**Tech Stack:** React Native (Expo SDK 54), Zustand, Jest + `@testing-library/react-native`, TypeScript strict.

## Global Constraints

- **Conventional Commits; NEVER any AI/co-author attribution** (no `Co-Authored-By`, no "Generated with", no 🤖) — project HARD RULE, overrides all defaults.
- **Never merge** the branch/PR — open the PR and stop. Founder merges.
- Every color/spacing/size value from `src/theme/tokens.ts` via `useTheme()` — no raw numbers/hex. If a token is missing, add it to `tokens.ts`.
- TypeScript `strict` + `noUncheckedIndexedAccess` are on — indexed access returns `T | undefined`; handle it, never `!` unless provably safe.
- No engine changes (`src/engine/` untouched). No timer changes. Anti-chase coach untouched.
- The new card must contain **no `Pressable`, no button, no minutes value, no "Use "/"or keep" text** — this is the point of the whole change.
- Lint gate: `npx eslint <changed files>` after every task; `npm run lint` (0 warnings), `npm run typecheck`, `npm test` must all pass before the PR.
- After editing `useAddTask`/add-task screen, run the add-task suites plus the full suite.

---

### Task 1: Reshape `loadGoalCoach` → `GoalCoachInfo` (store, TDD)

**Files:**
- Modify: `src/stores/calibrationStore.ts` (interface decl ~line 465-467; impl ~line 969-989; extract shared error helper used by `loadGoalLogFeedback` ~line 1002)
- Test: `src/stores/__tests__/calibrationStore.goalCoach.test.ts` (rewrite the `loadGoalCoach` describe; keep the `loadGoalLogFeedback` describe untouched)

**Interfaces:**
- Consumes (already exported from `@/src/engine` via `src/engine/index.ts`): `goalProgress`, `accuracyToErrorBand`, `biggestLever`, `clampRatio`.
- Produces (Tasks 2–3 depend on these exact names):

```ts
export interface GoalCoachInfo {
  /** "goal ±X%" target — accuracyToErrorBand(goal.targetAccuracy). */
  targetBand: number;
  /** Best band reached since the goal began — accuracyToErrorBand(goal.bestAccuracy). */
  bestBand: number;
  /** Forward-only 0..1 meter fill — goalProgress(goal). */
  progress: number;
  /** Of the newest `windowCount` completed logs, how many landed inside targetBand. */
  insideCount: number;
  /** min(7, completed logs available); 0 → caller hides the count line. */
  windowCount: number;
  /** Statistically real time-of-day lever, or null. Bands on the same ±% scale as the goal. */
  lever: { bestValue: string; worstValue: string; bestBand: number; worstBand: number } | null;
}
```

- [ ] **Step 1: Rewrite the `loadGoalCoach` describe block as failing tests**

Replace the existing `describe('loadGoalCoach', …)` in `src/stores/__tests__/calibrationStore.goalCoach.test.ts` with (file header, `freshDb`, `seedStat`, `event`, `morning`/`evening` helpers and the `loadGoalLogFeedback` describe all stay as they are):

```ts
describe('loadGoalCoach', () => {
  it('returns null when the category has no goal', async () => {
    freshDb();
    seedStat('cleaning', 70, 8);
    expect(await useCalibrationStore.getState().loadGoalCoach('cleaning')).toBeNull();
  });

  it('returns null once live sharpness meets the target (reconciled met)', async () => {
    freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25); // target accuracy 75
    seedStat('cleaning', 80, 9); // live sharpness now beats 75 → loadGoal latches met
    expect(await useCalibrationStore.getState().loadGoalCoach('cleaning')).toBeNull();
  });

  it('maps goal fields: bands from accuracy, forward-only progress', async () => {
    freshDb();
    seedStat('cleaning', 70, 8); // baseline accuracy 70
    useCalibrationStore.getState().setGoal('cleaning', 25); // target accuracy 75
    seedStat('cleaning', 72, 9); // best reconciles to 72 → progress (72−70)/(75−70) = 0.4

    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach).not.toBeNull();
    expect(coach!.targetBand).toBe(25);
    expect(coach!.bestBand).toBe(28); // 100 − 72
    expect(coach!.progress).toBeCloseTo(0.4);
  });

  it('counts inside-band logs over the newest ≤7 completed logs', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25); // inside ⇔ error ≤ 25%

    // 4 wide (ratio 2 → error 50%, outside), older; then 4 tight (ratio 1 → 0%, inside), newer.
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: 2_000_000 + i }));
    }
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 15, createdAt: 3_000_000 + i }));
    }

    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    // Window = newest 7 = 4 tight + 3 wide.
    expect(coach!.windowCount).toBe(7);
    expect(coach!.insideCount).toBe(4);
  });

  it('window shrinks to the available completed logs', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    await db.insertTaskEvent(event({ estimateMin: 20, actualMin: 21, createdAt: 2_000_000 })); // ~5% in
    await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: 2_000_001 })); // 50% out
    await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 15, createdAt: 2_000_002 })); // 0% in

    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach!.windowCount).toBe(3);
    expect(coach!.insideCount).toBe(2);
  });

  it('windowCount 0 with a goal but no completed logs', async () => {
    freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach!.windowCount).toBe(0);
    expect(coach!.insideCount).toBe(0);
    expect(coach!.lever).toBeNull();
  });

  it('maps the lever to best/worst values with bands on the goal scale', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    // Mornings ratio 2 → accuracy 50; evenings ratio 1 → accuracy 100. Gap 50 ≥ 12, buckets 4 ≥ 4.
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: morning(i) }));
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 15, createdAt: evening(i) }));
    }

    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach!.lever).toEqual({
      bestValue: 'evenings',
      worstValue: 'mornings',
      bestBand: 0, // 100 − 100
      worstBand: 50, // 100 − 50
    });
  });

  it('lever is null when no time pattern clears the gate', async () => {
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    for (let i = 0; i < 4; i++) {
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: morning(i) }));
      await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 30, createdAt: evening(i) }));
    }
    const coach = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(coach!.lever).toBeNull();
  });

  it('is deterministic for a fixed category — guess churn cannot exist in the API', async () => {
    // The spec's §4 invariant: the coach depends only on categoryId. The API has no
    // guess parameter (type-level guarantee); this documents value-determinism too.
    const db = freshDb();
    seedStat('cleaning', 70, 8);
    useCalibrationStore.getState().setGoal('cleaning', 25);
    await db.insertTaskEvent(event({ estimateMin: 15, actualMin: 15, createdAt: 2_000_000 }));
    const a = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    const b = await useCalibrationStore.getState().loadGoalCoach('cleaning');
    expect(b).toEqual(a);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/stores/__tests__/calibrationStore.goalCoach.test.ts`
Expected: FAIL — old shape has no `bestBand`/`progress`/`insideCount`/`lever` object (`worstValue` property tests removed with the old describe).

- [ ] **Step 3: Implement the reshape in `calibrationStore.ts`**

3a. Add `goalProgress` to the existing engine import (it already imports `accuracyToErrorBand`, `biggestLever`, `clampRatio` — extend that same `from '@/src/engine'` line).

3b. Export the info type near the store's other exported types, and update the interface declaration (~line 462-467), replacing the old return type:

```ts
/** Add-screen goal coach — read-only status for the active goal (spec
 *  2026-07-13-goal-lever-coach): bands + forward-only progress + inside-band
 *  count over the newest ≤7 logs + the time-of-day lever. Depends ONLY on the
 *  category (never the live guess). Null when the category has no active
 *  (un-met) goal. A bounded read; called on category change. */
export interface GoalCoachInfo {
  targetBand: number;
  bestBand: number;
  progress: number;
  insideCount: number;
  windowCount: number;
  lever: { bestValue: string; worstValue: string; bestBand: number; worstBand: number } | null;
}
```

and in the store interface: `loadGoalCoach: (categoryId: string) => Promise<GoalCoachInfo | null>;`

3c. Extract the per-log error helper to module level (next to `timeOfDayBucket`, ~line 500), and delete the local `errOf` inside `loadGoalLogFeedback` in favor of it:

```ts
/** Per-log error on the engine's accuracy scale: min(1, |1 − 1/ratio|). */
function logErrorOf(e: { estimateMin: number; actualMin: number | null }): number {
  const r = clampRatio(e.estimateMin, e.actualMin as number);
  return Math.min(1, Math.abs(1 - 1 / r));
}
```

(In `loadGoalLogFeedback`, `const errOf = …` disappears and its two call sites become `logErrorOf(newest)` / `.map(logErrorOf)`.)

3d. Replace the `loadGoalCoach` implementation (~line 969-989):

```ts
loadGoalCoach: async (categoryId) => {
  // Only coach an active, un-met goal. loadGoal reconciles the monotonic best.
  const goal = get().loadGoal(categoryId);
  if (!goal || goal.met) return null;

  const db = await resolveDb(get, set);
  const taskEventsRepo = makeTaskEventsRepo(db);
  const events = await taskEventsRepo.listByCategory(categoryId, 30); // newest first
  const completed = events.filter((e) => e.status === 'completed' && e.actualMin !== null);

  const targetBand = accuracyToErrorBand(goal.targetAccuracy);
  const window = completed.slice(0, 7);
  const insideCount = window.filter((e) => Math.round(logErrorOf(e) * 100) <= targetBand).length;

  const lever = biggestLever([
    {
      key: 'timeOfDay',
      samples: completed.map((e) => ({
        value: timeOfDayBucket(new Date(e.createdAt).getHours()),
        ratio: clampRatio(e.estimateMin, e.actualMin as number),
      })),
    },
  ]);

  return {
    targetBand,
    bestBand: accuracyToErrorBand(goal.bestAccuracy),
    progress: goalProgress(goal),
    insideCount,
    windowCount: window.length,
    lever: lever
      ? {
          bestValue: lever.bestValue,
          worstValue: lever.worstValue,
          bestBand: 100 - lever.bestAccuracy,
          worstBand: 100 - lever.worstAccuracy,
        }
      : null,
  };
},
```

- [ ] **Step 4: Run the suite**

Run: `npx jest src/stores/__tests__/calibrationStore.goalCoach.test.ts`
Expected: PASS (both describes — `loadGoalLogFeedback` proves the `logErrorOf` extraction kept behavior).

Note: `useAddTask.ts` still compiles against the old shape until Task 3 — that's fine for this task's jest run, but do NOT run `npm run typecheck` yet; it goes green in Task 3.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/stores/calibrationStore.ts src/stores/__tests__/calibrationStore.goalCoach.test.ts
git add src/stores/calibrationStore.ts src/stores/__tests__/calibrationStore.goalCoach.test.ts
git commit -m "feat(goal): reshape loadGoalCoach into read-only GoalCoachInfo"
```

---

### Task 2: Rewrite `GoalCoachCard` (component, TDD)

**Files:**
- Rewrite: `src/features/add-task/GoalCoachCard.tsx`
- Create: `src/features/add-task/__tests__/GoalCoachCard.test.tsx`

**Interfaces:**
- Consumes: `GoalCoachInfo` from `@/src/stores/calibrationStore` (Task 1).
- Produces: `export function GoalCoachCard({ categoryName, info }: { categoryName: string; info: GoalCoachInfo })` — Task 3 wires exactly these props.

- [ ] **Step 1: Write the failing component test**

Create `src/features/add-task/__tests__/GoalCoachCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { GoalCoachCard } from '../GoalCoachCard';
import type { GoalCoachInfo } from '@/src/stores/calibrationStore';

// Read-only card contract (spec 2026-07-13-goal-lever-coach §2): status + lever,
// no interaction, no minutes value, and — the point of the redesign — NO apply button.

const full: GoalCoachInfo = {
  targetBand: 10,
  bestBand: 14,
  progress: 0.64,
  insideCount: 3,
  windowCount: 7,
  lever: { bestValue: 'mornings', worstValue: 'afternoons', bestBand: 18, worstBand: 42 },
};

it('renders bands, count line and the strength-first lever sentence', () => {
  render(<GoalCoachCard categoryName="Focused work" info={full} />);
  expect(screen.getByText('±14%')).toBeTruthy();
  expect(screen.getByText('±10%')).toBeTruthy();
  expect(screen.getByText('goal ±10%')).toBeTruthy();
  expect(screen.getByText('3 of your last 7 logs landed inside the band')).toBeTruthy();
  expect(screen.getByText(/closest to your guess in the mornings/)).toBeTruthy();
  expect(screen.getByText(/±42% in the afternoons/)).toBeTruthy();
});

it('omits the lever row when no lever is real', () => {
  render(<GoalCoachCard categoryName="Focused work" info={{ ...full, lever: null }} />);
  expect(screen.queryByText(/closest to your guess/)).toBeNull();
});

it('omits the count line when there is no log window', () => {
  render(
    <GoalCoachCard categoryName="Focused work" info={{ ...full, insideCount: 0, windowCount: 0 }} />,
  );
  expect(screen.queryByText(/landed inside the band/)).toBeNull();
});

it('pluralizes a single-log window', () => {
  render(
    <GoalCoachCard categoryName="Focused work" info={{ ...full, insideCount: 1, windowCount: 1 }} />,
  );
  expect(screen.getByText('1 of your last 1 log landed inside the band')).toBeTruthy();
});

it('is completely non-interactive — no button, no apply affordance', () => {
  render(<GoalCoachCard categoryName="Focused work" info={full} />);
  expect(screen.queryByText(/Use \d/)).toBeNull();
  expect(screen.queryByText(/or keep/)).toBeNull();
  expect(screen.UNSAFE_queryAllByType(Pressable)).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/add-task/__tests__/GoalCoachCard.test.tsx`
Expected: FAIL — current card requires `targetBand`/`worstValue`/`honestMinutes`/`guessMinutes`/`onApply` props and renders the "Use Xm" `Pressable`.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/features/add-task/GoalCoachCard.tsx`:

```tsx
import { View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { GoalCoachInfo } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// GoalCoachCard — read-only add-sheet goal status (spec 2026-07-13-goal-lever-
// coach). Where the user stands on their active goal (forward-only meter +
// countable inside-band line) and the learned time-of-day lever, strength-first.
// It depends ONLY on the category's goal + logs — never the live guess — and is
// deliberately non-interactive: the old "Use Xm" apply button fed the engine its
// own output (15→25→40→60) and polluted calibration. Never re-add a button here.
// ──────────────────────────────────────────────────────────────────────────────

const BUCKET_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  mornings: 'sunny-outline',
  afternoons: 'partly-sunny-outline',
  evenings: 'moon-outline',
  'late nights': 'cloudy-night-outline',
};

export function GoalCoachCard({
  categoryName,
  info,
}: {
  categoryName: string;
  info: GoalCoachInfo;
}) {
  const t = useTheme();
  const { targetBand, bestBand, progress, insideCount, windowCount, lever } = info;

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[3],
  };
  const headRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const chip: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[0.5],
  };
  const chipText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.amberText,
  };

  const meter: ViewStyle = { gap: t.space[1.5] };
  const meterHead: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  };
  const meterNowRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[1.5] };
  const meterNow: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
  const meterNowLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const meterGoal: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.amberText,
  };
  const track: ViewStyle = {
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const fill: ViewStyle = {
    height: '100%',
    width: `${Math.round(progress * 100)}%`,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };
  const countLine: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  const leverRow: ViewStyle = { flexDirection: 'row', gap: t.space[2.5], alignItems: 'flex-start' };
  const iconWell: ViewStyle = {
    width: t.space[6],
    height: t.space[6],
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const leverLine: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const strong: TextStyle = { color: t.colors.amberText, fontFamily: 'Jakarta-Bold' };

  const logsWord = windowCount === 1 ? 'log' : 'logs';
  const a11y =
    `Goal for ${categoryName}: best within ${bestBand} percent, target ${targetBand} percent.` +
    (windowCount > 0 ? ` ${insideCount} of your last ${windowCount} ${logsWord} inside the band.` : '') +
    (lever
      ? ` You land closest to your guess in the ${lever.bestValue}, within ${lever.bestBand} percent, versus ${lever.worstBand} percent in the ${lever.worstValue}.`
      : '');

  return (
    <View style={card} accessibilityLabel={a11y}>
      <View style={headRow}>
        <AppText style={eyebrow}>GOAL · {categoryName.toUpperCase()}</AppText>
        <View style={chip}>
          <AppText style={chipText}>goal ±{targetBand}%</AppText>
        </View>
      </View>

      <View style={meter}>
        <View style={meterHead}>
          <View style={meterNowRow}>
            <AppText style={meterNow}>±{bestBand}%</AppText>
            <AppText style={meterNowLabel}>your best so far</AppText>
          </View>
          <AppText style={meterGoal}>±{targetBand}%</AppText>
        </View>
        <View style={track}>
          <View style={fill} />
        </View>
        {windowCount > 0 ? (
          <AppText style={countLine}>
            {insideCount} of your last {windowCount} {logsWord} landed inside the band
          </AppText>
        ) : null}
      </View>

      {lever ? (
        <View style={leverRow}>
          <View style={iconWell}>
            <Ionicons
              name={BUCKET_ICON[lever.bestValue] ?? 'sunny-outline'}
              size={t.iconSize.sm}
              color={t.colors.amberText}
            />
          </View>
          <AppText style={leverLine}>
            You land closest to your guess in the <AppText style={strong}>{lever.bestValue}</AppText> —
            within <AppText style={strong}>±{lever.bestBand}%</AppText>, vs ±{lever.worstBand}% in the{' '}
            {lever.worstValue}.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
```

Token facts (verified): `t.progress.track` (6pt) + `t.colors.surfaceSunken` track + `t.colors.accent` fill is the exact meter idiom the category GoalCard already uses (`GoalCard.tsx:132,423-429`). `type.bodySmBold` and every other role used above exist in `src/theme/typography.ts`. Do not add new tokens; do not inline numbers.

- [ ] **Step 4: Run the test**

Run: `npx jest src/features/add-task/__tests__/GoalCoachCard.test.tsx`
Expected: PASS. (If `getByText('±14%')` fails on nested-text matching, split the strings into separate `<AppText>` nodes as shown — they already are — and match exact strings.)

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/add-task/GoalCoachCard.tsx src/features/add-task/__tests__/GoalCoachCard.test.tsx
git add src/features/add-task/GoalCoachCard.tsx src/features/add-task/__tests__/GoalCoachCard.test.tsx
git commit -m "feat(goal): rewrite add-sheet goal coach as read-only status + lever card"
```

Note: the app won't compile end-to-end until Task 3 rewires the call site — commit anyway; the branch is WIP until Task 4's gates.

---

### Task 3: Rewire `useAddTask` + add-task screen; delete `applyHonest`; analytics event

**Files:**
- Modify: `src/services/analytics.ts` (goals section, ~line 186-191)
- Modify: `src/features/add-task/useAddTask.ts` (interface ~lines 47-49, state ~line 195, effect ~lines 198-210, `applyHonest` ~lines 230-233, comment ~line 212-216, return ~line 315)
- Modify: `src/app/(modals)/add-task.tsx` (~lines 334-346)
- Test: existing `src/features/add-task/__tests__/addTaskScreen.test.tsx` must stay green (it doesn't reference the goal coach; the memory DB has no goals so the card never renders there).

**Interfaces:**
- Consumes: `GoalCoachInfo` (Task 1), `GoalCoachCard({ categoryName, info })` (Task 2).
- Produces: `useAddTask` return WITHOUT `applyHonest`; analytics event `goal_coach_shown`.

- [ ] **Step 1: Add the analytics event type**

In `src/services/analytics.ts`, under the `// ── Per-category goals (Pro) ──` section, after `goal_kept`:

```ts
  goal_coach_shown: { category: string; target_band: number; best_band: number; has_lever: boolean };
```

- [ ] **Step 2: Rewire `useAddTask.ts`**

2a. Import the type: add `type GoalCoachInfo` to the existing `@/src/stores/calibrationStore` import.

2b. Interface (lines 46-49): replace

```ts
  /** Active-goal coach info for the current category (or null). */
  goalCoach: { targetBand: number; worstValue: string | null } | null;
  /** Write the honest suggestion into the guess field (the coach "Use Xm" action). */
  applyHonest: () => void;
```

with

```ts
  /** Read-only goal-coach status for the current category (or null). Depends
   *  only on the category — never the live guess (spec 2026-07-13). */
  goalCoach: GoalCoachInfo | null;
```

2c. State + effect (~lines 195-210): state becomes `useState<GoalCoachInfo | null>(null)`; add a once-per-category capture inside the existing `.then`:

```ts
  const goalCoachSeen = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (category === null) {
      setGoalCoach(null);
      return;
    }
    let alive = true;
    void loadGoalCoach(category).then((res) => {
      if (!alive) return;
      setGoalCoach(res);
      if (res && !goalCoachSeen.current.has(category)) {
        goalCoachSeen.current.add(category);
        analytics.capture('goal_coach_shown', {
          category,
          target_band: res.targetBand,
          best_band: res.bestBand,
          has_lever: res.lever !== null,
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [category, loadGoalCoach]);
```

(`useRef` is already imported in this file; if not, extend the react import.)

2d. Delete the `applyHonest` function (lines 230-233) and its entry in the returned object (~line 315). In the `setGuessMin` comment block (~lines 212-216), delete the sentence about `applyHonest` bypassing the coach — the anti-chase logic itself is untouched.

- [ ] **Step 3: Rewire `add-task.tsx`**

Replace the goal-coach block (~lines 334-346):

```tsx
          {/* Goal coach — read-only status + lever for this category's active goal.
              Never renders for free users (goals are Pro-gated at creation) and
              never depends on the guess. */}
          {a.goalCoach ? (
            <GoalCoachCard
              categoryName={a.categories.find((c) => c.id === a.category)?.name ?? ''}
              info={a.goalCoach}
            />
          ) : null}
```

(The old `a.suggestion &&` guard is gone on purpose — the card no longer reads the suggestion.)

- [ ] **Step 4: Run the affected suites**

Run: `npx jest src/features/add-task src/stores/__tests__/calibrationStore.goalCoach.test.ts`
Expected: PASS (screen suite unaffected — no goals seeded there; card suite from Task 2; store suite from Task 1).

- [ ] **Step 5: Typecheck now goes green end-to-end**

Run: `npm run typecheck`
Expected: PASS — this is the step that proves no other consumer of the old shape/`applyHonest` exists.

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/services/analytics.ts src/features/add-task/useAddTask.ts "src/app/(modals)/add-task.tsx"
git add src/services/analytics.ts src/features/add-task/useAddTask.ts "src/app/(modals)/add-task.tsx"
git commit -m "feat(goal): wire read-only goal coach into the add sheet, drop applyHonest"
```

---

### Task 4: Full gates + PR

**Files:** none new — verification + delivery.

- [ ] **Step 1: Full suite + gates**

```bash
npm run lint        # 0 warnings or fail
npm run typecheck
npm test
```
Expected: all PASS. Any failure → fix root cause in the task that owns the file (never skip/quarantine a test), re-run all three.

- [ ] **Step 2: Push branch + open PR (NEVER merge)**

```bash
git push -u origin fix/goal-lever-coach
gh pr create --base main --title "fix(goal): replace add-sheet apply button with read-only lever coach" --body "$(cat <<'EOF'
## What

The add-sheet goal coach's "Use Xm" button wrote the machine's honest number into the guess field; the engine then re-corrected its own output (15 → 25 → 40 → 60, unbounded) and every accepted value trained calibration on a non-gut guess. Spec: docs/product/specs/2026-07-13-goal-lever-coach.md.

The card is now read-only: goal progress (best ±X% vs target, forward-only meter), a countable "N of your last M logs landed inside the band" line, and the learned time-of-day lever (strength-first, no-guilt). It depends only on the category — churning the guess, time chips, or date cannot change it.

## Changes

- `calibrationStore.loadGoalCoach` → rich `GoalCoachInfo` (bands, `goalProgress`, inside-band window ≤7, lever with both bucket bands); shared `logErrorOf` helper with `loadGoalLogFeedback`. Zero engine changes.
- `GoalCoachCard` rewritten non-interactive — no Pressable, no minutes value, no apply affordance (regression-tested).
- `useAddTask`: `applyHonest` deleted; `goal_coach_shown` analytics (once per category per sheet).
- Anti-chase coach untouched.

## Tests

- Store: band/progress mapping, inside-count windows (7-cap, shrink, empty), lever band mapping + gate-null, determinism invariant.
- Component: full render, lever-less, empty-window, singular log, and the no-button contract.
- `npm run lint` / `npm run typecheck` / `npm test` all green.

## Verify on sim

`whenbee:///add-task` → pick a goaled category → card shows meter + lever; churn guess wheel/chips/date → card static; switch category → reloads/hides.
EOF
)"
```

Expected: PR URL printed. **Stop here — do not merge; founder reviews.**
