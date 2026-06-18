# Today Delete & Guess-Led Time — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Today task removable (swipe-to-reveal Delete + long-press sheet, with a first-run cue) and reorder each list row's time so the user's guess is the hero with a quiet `plan ~N min` support line; tone the focus-card gap bar to a striped guess so Start is the only solid indigo.

**Architecture:** UI-only change on the Today screen. No engine/db/domain/store mutations — `useTasksStore.removeTask(id)` already exists. `TaskRow` gains the guess-led time cluster + a `ReanimatedSwipeable` wrapper exposing `onDelete`/`onLongPress`/`peekHint`. The Today screen wires delete to `removeTask`, a long-press `ActionSheetIOS`, and a one-shot kv-gated peek. `GapLine` swaps its solid-indigo guess segment for a token-driven SVG diagonal hatch.

**Tech Stack:** React Native (Expo SDK 54), TypeScript (strict), Zustand, `react-native-gesture-handler` 2.28 (`ReanimatedSwipeable`), `react-native-reanimated` 4, `react-native-svg`, `expo-haptics`, Jest + `@testing-library/react-native`.

## Global Constraints

- Every spacing/size/font/color value MUST come from a `src/theme/tokens.ts` token via `useTheme()` — never inline a raw number or hex. Add a token if one is missing.
- `src/app/**` and `src/components/**` must not import `@/src/services/*` or `@/src/db/*` directly. Routes stay thin; logic lives in features/stores. (`src/features/**` may import the store.)
- Product invariants: no guilt language; amber only ever fills (honey/learned lane); core loop on-device; nothing hardcoded.
- New `tokens.ts` values for the stripe go **nested under the existing `progress` group** (already enumerated in `useTheme.resolveTheme` — do not add a new top-level group, or `t.<key>` is undefined).
- `npm run lint` (0 warnings) + `npm run typecheck` + `npm test` must pass. After editing files, lint just them: `npx eslint <files>`.
- Conventional Commits. NEVER add Co-Authored-By or any AI attribution. NEVER merge or push — open work for founder review only.
- `noUncheckedIndexedAccess` is on — handle `T | undefined` from indexed access; don't silence with `!` unless provably safe.

---

### Task 1: Striped guess segment on the focus-card gap bar

**Files:**
- Modify: `src/theme/tokens.ts` (the `progress` group, ~line 91)
- Modify: `src/features/today/GapLine.tsx`
- Test: `src/features/today/__tests__/GapLine.test.tsx` (create)

**Interfaces:**
- Consumes: existing `GapLine({ guessMin, honestMin, elapsedSec? })`.
- Produces: `GapLine` renders the guess segment as a striped (indigo-hatch-on-`primarySoft`) fill; amber overrun + reveal animation + elapsed marker unchanged. New token `tokens.progress.gapStripe = { lineW, gapW }`.

- [ ] **Step 1: Add the stripe geometry token**

In `src/theme/tokens.ts`, extend the `progress` group (currently `progress: { track: 6, gapTrack: 8, tickW: 3, tickH: 16 }`) to:

```ts
  progress: {
    track: 6, gapTrack: 8, tickW: 3, tickH: 16,
    // gapStripe = the focus-card guess segment's diagonal hatch (indigo lines on
    // primarySoft). Tones the guess down from a solid indigo block so Start is the
    // single filled indigo on Today. lineW = stroke width, gapW = clear gap between.
    gapStripe: { lineW: 2, gapW: 4 },
  },
```

- [ ] **Step 2: Write the failing test**

Create `src/features/today/__tests__/GapLine.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { GapLine } from '@/src/features/today/GapLine';

describe('GapLine', () => {
  it('renders a striped guess segment and an amber overrun segment', () => {
    render(<GapLine guessMin={15} honestMin={35} />);
    expect(screen.getByTestId('gapline-guess')).toBeOnTheScreen();
    expect(screen.getByTestId('gapline-extra')).toBeOnTheScreen();
    // the guess hatch is drawn as an SVG, not a solid View fill
    expect(screen.getByTestId('gapline-guess-hatch')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/features/today/__tests__/GapLine.test.tsx -t "striped guess"`
Expected: FAIL — `Unable to find an element with testID: gapline-guess`.

- [ ] **Step 4: Implement the striped guess segment**

In `src/features/today/GapLine.tsx`: add the svg import at the top, alongside the existing imports:

```tsx
import Svg, { Defs, Pattern, Rect as SvgRect } from 'react-native-svg';
```

Replace the `guessSeg` style + its `<View style={guessSeg} />` usage. The guess segment becomes a `primarySoft` ground that clips a fixed-width SVG hatch (no measurement needed — `overflow:'hidden'` on the segment clips the tile):

```tsx
  const guessSeg: ViewStyle = {
    width: `${guessFrac * 100}%`,
    backgroundColor: t.colors.primarySoft,
    overflow: 'hidden',
    justifyContent: 'center',
  };
  const { lineW, gapW } = t.progress.gapStripe;
  const hatchUnit = lineW + gapW;
```

Then in the returned JSX, swap the plain guess `<View style={guessSeg} />` for:

```tsx
        <View style={guessSeg} testID="gapline-guess">
          <Svg
            testID="gapline-guess-hatch"
            width={300}
            height={t.progress.gapTrack}
            pointerEvents="none"
          >
            <Defs>
              <Pattern
                id="gapHatch"
                width={hatchUnit}
                height={t.progress.gapTrack}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <SvgRect width={lineW} height={t.progress.gapTrack * 2} fill={t.colors.primary} />
              </Pattern>
            </Defs>
            <SvgRect width={300} height={t.progress.gapTrack} fill="url(#gapHatch)" />
          </Svg>
        </View>
```

Add `testID="gapline-extra"` to the existing amber `<Animated.View style={[extraSeg, extraStyle]} />`:

```tsx
        <Animated.View style={[extraSeg, extraStyle]} testID="gapline-extra" />
```

Leave `extraSeg`, `reveal`, `marker`, `markerStyle`, and the elapsed marker untouched.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/features/today/__tests__/GapLine.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck the touched files**

Run: `npx eslint src/theme/tokens.ts src/features/today/GapLine.tsx src/features/today/__tests__/GapLine.test.tsx && npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/theme/tokens.ts src/features/today/GapLine.tsx src/features/today/__tests__/GapLine.test.tsx
git commit -m "feat(today): stripe focus-card guess bar so Start is the lone indigo"
```

---

### Task 2: Guess-led time display in TaskRow

**Files:**
- Modify: `src/features/today/TaskRow.tsx`
- Test: `src/features/today/__tests__/TaskRow.test.tsx`

**Interfaces:**
- Consumes: `tokens` (`fontSize.lg`, `fontSize.sm`, `fontSize.base`, `colors.ink`, `colors.amberText`, `colors.inkSoft`, `space`).
- Produces: `TaskRow` props gain **required** `guessMin: number`. Queued rows show `{guessMin} min` (lead) + `plan ~{honestMin} min` (support, amber number). Done rows show `took {actualMin} min` (lead) + `guessed {guessMin}` (support).

- [ ] **Step 1: Update the existing tests to the new guess-led shape**

Replace the body of `src/features/today/__tests__/TaskRow.test.tsx` with:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TaskRow } from '@/src/features/today/TaskRow';

describe('TaskRow', () => {
  it('queued: leads with the guess, supports with "plan ~N", fires onPress', () => {
    const onPress = jest.fn();
    render(
      <TaskRow title="Buy groceries" categoryLabel="Errands" guessMin={15} honestMin={25} onPress={onPress} />,
    );
    expect(screen.getByText('15')).toBeOnTheScreen();   // guess is the lead number
    expect(screen.getByText('plan ')).toBeOnTheScreen();
    expect(screen.getByText('~25')).toBeOnTheScreen();  // honest is the support number
    expect(screen.getByTestId('taskrow-edge')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Buy groceries'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('done: shows "took N min" lead + "guessed N" support, no edge', () => {
    render(
      <TaskRow title="Writing an email" categoryLabel="Admin & email" guessMin={20} honestMin={30} actualMin={35} done />,
    );
    expect(screen.getByText('took')).toBeOnTheScreen();
    expect(screen.getByText('35')).toBeOnTheScreen();
    expect(screen.getByText('guessed 20')).toBeOnTheScreen();
    expect(screen.queryByTestId('taskrow-edge')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/today/__tests__/TaskRow.test.tsx`
Expected: FAIL — `getByText('plan ')` / `getByText('guessed 20')` not found (and a TS error on missing `guessMin` will surface in typecheck).

- [ ] **Step 3: Add the `guessMin` prop and rebuild the time cluster**

In `src/features/today/TaskRow.tsx`, add `guessMin` to the props interface (after `categoryLabel`):

```tsx
interface TaskRowProps {
  title: string;
  categoryLabel: string;
  /** The user's original guess (minutes) — now the hero figure on every row. */
  guessMin: number;
  /** Learned honest estimate (minutes). Shown as the quiet "plan ~N" support. */
  honestMin: number;
  /** Actual minutes once finished. Shown on done rows when known. */
  actualMin?: number | null;
  done?: boolean;
  onPress?: () => void;
}
```

Update the destructure:

```tsx
export function TaskRow({ title, categoryLabel, guessMin, honestMin, actualMin, done = false, onPress }: TaskRowProps) {
```

Replace the time styles (`timeWrap`, `estNum`, `estUnit`) with:

```tsx
  const timeWrap: ViewStyle = { alignSelf: 'flex-end', alignItems: 'flex-end', gap: t.space[0.5] };
  const lineRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[0.5] };
  const leadNum: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.lg,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  const tookNum: TextStyle = { ...leadNum, fontSize: t.fontSize.base };
  const unit: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const planLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const planNum: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.sm,
    color: t.colors.amberText,
    fontVariant: ['tabular-nums'],
  };
```

Replace the time JSX (the `done ? … : …` block that rendered `~{honestMin}`) with:

```tsx
      {done ? (
        <View style={timeWrap}>
          {actualMin != null ? (
            <View style={lineRow}>
              <Text style={unit}>took </Text>
              <Text style={tookNum}>{actualMin}</Text>
              <Text style={unit}>min</Text>
            </View>
          ) : null}
          <Text style={planLabel}>guessed {guessMin}</Text>
        </View>
      ) : (
        <View style={timeWrap}>
          <View style={lineRow}>
            <Text style={leadNum}>{guessMin}</Text>
            <Text style={unit}>min</Text>
          </View>
          <View style={lineRow}>
            <Text style={planLabel}>plan </Text>
            <Text style={planNum}>~{honestMin}</Text>
            <Text style={unit}> min</Text>
          </View>
        </View>
      )}
```

Update the queued `accessibilityLabel` (in the `Pressable` at the bottom) to read guess-first:

```tsx
      accessibilityLabel={`${title}, ${categoryLabel}, you guessed ${guessMin} minutes, we plan ${honestMin}. Tap to start.`}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/today/__tests__/TaskRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/features/today/TaskRow.tsx src/features/today/__tests__/TaskRow.test.tsx && npm run typecheck`
Expected: no errors. (Typecheck will still report the Today screen not passing `guessMin` — that is fixed in Task 4. If running typecheck now flags only `index.tsx`, proceed; it is resolved in Task 4.)

- [ ] **Step 6: Commit**

```bash
git add src/features/today/TaskRow.tsx src/features/today/__tests__/TaskRow.test.tsx
git commit -m "feat(today): lead task rows with the guess, support with plan ~N min"
```

---

### Task 3: Swipe-to-delete, long-press, and first-run peek on TaskRow

**Files:**
- Modify: `src/features/today/TaskRow.tsx`
- Test: `src/features/today/__tests__/TaskRow.test.tsx`

**Interfaces:**
- Consumes: `react-native-gesture-handler/ReanimatedSwipeable`, `@/src/lib/haptics`, `useReducedMotion`.
- Produces: `TaskRow` props gain `onDelete?: () => void`, `onLongPress?: () => void`, `peekHint?: boolean`. When `onDelete` is set the row is wrapped in a swipeable exposing a red Delete action (testID `taskrow-delete`) that calls `onDelete`. `peekHint` (first-run) briefly opens then closes the swipe once on mount. Long-press anywhere on the row calls `onLongPress`.

- [ ] **Step 1: Write the failing tests**

Append these tests inside the `describe('TaskRow', …)` block in `src/features/today/__tests__/TaskRow.test.tsx`, and add the mock + import at the top of the file:

At the very top of the file (after the existing imports):

```tsx
// Render ReanimatedSwipeable as a passthrough that also mounts its right actions,
// so the Delete affordance is queryable in tests (the real gesture isn't simulated).
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = require('react-native');
  const Mock = ({ children, renderRightActions }: any) => (
    <View>
      {renderRightActions ? renderRightActions(0, 0, { close: () => {} }) : null}
      {children}
    </View>
  );
  return { __esModule: true, default: Mock };
});
```

New tests:

```tsx
  it('renders a Delete action that fires onDelete', () => {
    const onDelete = jest.fn();
    render(
      <TaskRow title="Buy groceries" categoryLabel="Errands" guessMin={15} honestMin={25} onDelete={onDelete} />,
    );
    fireEvent.press(screen.getByTestId('taskrow-delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('fires onLongPress when the row is held', () => {
    const onLongPress = jest.fn();
    render(
      <TaskRow title="Buy groceries" categoryLabel="Errands" guessMin={15} honestMin={25} onPress={() => {}} onLongPress={onLongPress} />,
    );
    fireEvent(screen.getByText('Buy groceries'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/today/__tests__/TaskRow.test.tsx -t "Delete action"`
Expected: FAIL — `Unable to find an element with testID: taskrow-delete`.

- [ ] **Step 3: Implement the swipeable wrapper, Delete action, long-press, and peek**

In `src/features/today/TaskRow.tsx`, add imports:

```tsx
import { useEffect, useRef } from 'react';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { haptics } from '@/src/lib/haptics';
```

Extend the props interface with the three new optional props:

```tsx
  onPress?: () => void;
  /** Delete this task (swipe-revealed Delete tap, or the long-press sheet). */
  onDelete?: () => void;
  /** Long-press the row → present the delete sheet (a11y / discoverable path). */
  onLongPress?: () => void;
  /** First-run only: briefly reveal then re-hide the swipe once, to teach it. */
  peekHint?: boolean;
```

Update the destructure:

```tsx
export function TaskRow({
  title, categoryLabel, guessMin, honestMin, actualMin, done = false, onPress, onDelete, onLongPress, peekHint = false,
}: TaskRowProps) {
```

Add the swipeable ref + peek effect near the other hooks (after `reducedMotion`):

```tsx
  const swipeRef = useRef<SwipeableMethods | null>(null);
  useEffect(() => {
    if (!peekHint || reducedMotion || !onDelete) return;
    const open = setTimeout(() => swipeRef.current?.openRight(), t.motion.fast);
    const close = setTimeout(() => swipeRef.current?.close(), t.motion.fast + t.motion.reveal);
    return () => {
      clearTimeout(open);
      clearTimeout(close);
    };
  }, [peekHint, reducedMotion, onDelete, t.motion]);
```

Add the Delete-action styles (next to the other styles):

```tsx
  const deleteAction: ViewStyle = {
    backgroundColor: t.colors.danger,
    borderTopRightRadius: t.radii.card,
    borderBottomRightRadius: t.radii.card,
    justifyContent: 'center',
    alignItems: 'center',
    width: t.size.control.lg + t.space[5],
    marginLeft: -t.radii.card, // sit flush under the row's rounded right edge
    paddingLeft: t.radii.card,
  };
  const deleteLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.onIndigo, // white on danger — AA
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    marginTop: t.space[1],
  };
```

Add a `renderRightActions` function (above the `content` definition):

```tsx
  function renderRightActions() {
    return (
      <Pressable
        testID="taskrow-delete"
        onPress={() => {
          haptics.medium();
          onDelete?.();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${title}`}
        style={deleteAction}
      >
        <Ionicons name="trash-outline" size={t.iconSize.md} color={t.colors.onIndigo} />
        <Text style={deleteLabel}>Delete</Text>
      </Pressable>
    );
  }
```

Wire `onLongPress` onto the queued `Pressable` (the bottom `return`) and the done branch. Replace the final `return` block:

```tsx
  const interactive = (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${categoryLabel}, you guessed ${guessMin} minutes, we plan ${honestMin}. Tap to start.`}
    >
      {content}
    </Pressable>
  );

  // Done rows aren't startable but are still deletable: a bare long-press wrapper.
  const body =
    done || !onPress ? (
      onLongPress ? (
        <Pressable onLongPress={onLongPress} delayLongPress={300} accessibilityRole="button" accessibilityLabel={`${title}, ${categoryLabel}`}>
          {content}
        </Pressable>
      ) : (
        content
      )
    ) : (
      interactive
    );

  if (!onDelete) return body;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
    >
      {body}
    </ReanimatedSwipeable>
  );
```

Delete the now-unused early `if (done || !onPress) return content;` line and the old trailing `Pressable` return that it preceded (they are replaced by the `body`/`interactive` blocks above).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/today/__tests__/TaskRow.test.tsx`
Expected: PASS (all four tests).

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/features/today/TaskRow.tsx src/features/today/__tests__/TaskRow.test.tsx && npm run typecheck`
Expected: no errors (typecheck may still flag `index.tsx` for the missing `guessMin` — resolved in Task 4).

- [ ] **Step 6: Commit**

```bash
git add src/features/today/TaskRow.tsx src/features/today/__tests__/TaskRow.test.tsx
git commit -m "feat(today): swipe + long-press to delete a task, with a first-run peek"
```

---

### Task 4: Wire the Today screen — guess, delete, long-press sheet, first-run peek

**Files:**
- Modify: `src/app/(tabs)/index.tsx`
- Test: `src/features/today/__tests__/todayScreen.test.tsx`

**Interfaces:**
- Consumes: `TaskRow` (`guessMin`, `onDelete`, `onLongPress`, `peekHint`), `useTasksStore.removeTask`, `@/src/lib/kv`, `@/src/lib/haptics`, `ActionSheetIOS`.
- Produces: every queued + done row is deletable; the focus card is long-press-deletable; the first queued row peeks once on first run.

- [ ] **Step 1: Write the failing test**

Open `src/features/today/__tests__/todayScreen.test.tsx`. Add an assertion that a queued row now shows its guess as the lead and the `plan ~N` support. (Match the existing test's setup for seeding tasks — reuse its store/render harness.) Add inside the most relevant existing `it(...)` that renders with at least one up-next task, or add a new `it`:

```tsx
  it('shows the guess as the lead figure and the plan ~N support on up-next rows', async () => {
    // (reuse this file's existing task-seeding helper so an up-next row exists)
    renderTodayWithTasks([
      { label: 'Write a short email', category: 'admin', guessMin: 15 }, // focus
      { label: 'Clean the kitchen', category: 'cleaning', guessMin: 25 }, // up-next
    ]);
    expect(await screen.findByText('25')).toBeOnTheScreen();
    expect(screen.getByText('plan ')).toBeOnTheScreen();
  });
```

> If `todayScreen.test.tsx` has no reusable seeding helper, follow the existing `beforeEach`/store-setup pattern already in that file; do not invent a new harness.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx -t "guess as the lead"`
Expected: FAIL — `25` / `plan ` not found (rows still render the old `~honestMin`).

- [ ] **Step 3: Add imports + delete/peek wiring in `index.tsx`**

Add to the `react-native` import on line 1:

```tsx
import { View, Text, Pressable, ScrollView, ActionSheetIOS, type ViewStyle, type TextStyle } from 'react-native';
```

Add imports near the other store/lib imports (after line 30):

```tsx
import { useTasksStore } from '@/src/stores/tasksStore';
import { kv } from '@/src/lib/kv';
```

Inside `export default function Today()`, after the `useToday()` destructure, add:

```tsx
  const removeTask = useTasksStore((s) => s.removeTask);

  // First-run peek: teach the hidden swipe once, then never again.
  const [peekFirstRow] = useState(() => kv.getString('today.seenSwipeHint') == null);
  useEffect(() => {
    if (peekFirstRow) kv.set('today.seenSwipeHint', '1');
  }, [peekFirstRow]);

  function deleteTask(id: string) {
    haptics.medium();
    removeTask(id);
  }
  // Long-press route (focus card + a11y): a destructive sheet confirm.
  function promptDelete(id: string, label: string) {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: label, options: ['Delete', 'Cancel'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
      (i) => {
        if (i === 0) deleteTask(id);
      },
    );
  }
```

Add the React imports `useState, useEffect` — update line ~1's React import. If the file imports from `'react'` add them; otherwise add:

```tsx
import { useState, useEffect } from 'react';
```

(Place it with the other top imports.)

- [ ] **Step 4: Pass the new props to the rows**

Replace the up-next `.map` (currently lines ~216-224) with:

```tsx
              {upNext.map((row, idx) => (
                <TaskRow
                  key={row.id}
                  title={row.label}
                  categoryLabel={row.categoryLabel}
                  guessMin={row.guessMin}
                  honestMin={row.honestMin}
                  onPress={() => startRow(row)}
                  onDelete={() => deleteTask(row.id)}
                  onLongPress={() => promptDelete(row.id, row.label)}
                  peekHint={peekFirstRow && idx === 0}
                />
              ))}
```

Replace the done `.map` (currently lines ~231-239) with:

```tsx
              {done.map((row) => (
                <TaskRow
                  key={row.id}
                  title={row.label}
                  categoryLabel={row.categoryLabel}
                  guessMin={row.guessMin}
                  honestMin={row.honestMin}
                  actualMin={row.actualMin}
                  done
                  onDelete={() => deleteTask(row.id)}
                  onLongPress={() => promptDelete(row.id, row.label)}
                />
              ))}
```

- [ ] **Step 5: Make the focus card long-press-deletable**

Wrap the `<FocusCard … />` element (the `focus && summary ?` branch) in a long-press `Pressable`. Replace `<FocusCard … />` with:

```tsx
            <Pressable
              onLongPress={() => promptDelete(focus.id, focus.label)}
              delayLongPress={300}
              accessibilityRole="button"
              accessibilityLabel={`${focus.label}. Long-press to delete.`}
            >
              <FocusCard
                category={focus.category}
                categoryLabel={categoryName(focus.category)}
                taskTitle={focus.label}
                summary={summary}
                finishClock={formatClockMeridiem(projectedFinish(Date.now(), summary.honestMinutes))}
                onStart={() =>
                  router.push({
                    pathname: '/(modals)/timer',
                    params: {
                      taskId: focus.id,
                      label: focus.label,
                      category: focus.category,
                      estimateMin: summary.honestMinutes,
                      guessMin: focus.guessMin,
                    },
                  })
                }
              />
            </Pressable>
```

(The inner Start `Pressable` still handles its own tap; the outer only adds long-press.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx`
Expected: PASS. (If `ActionSheetIOS` is referenced during render and the RN preset lacks it, it is only called inside the `promptDelete` callback — not on render — so no mock is needed. If a test triggers a long-press, mock it: `jest.spyOn(require('react-native').ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});`.)

- [ ] **Step 7: Lint + full typecheck**

Run: `npx eslint "src/app/(tabs)/index.tsx" src/features/today/__tests__/todayScreen.test.tsx && npm run typecheck`
Expected: no errors anywhere (the Task 2 `index.tsx` gap is now closed).

- [ ] **Step 8: Commit**

```bash
git add "src/app/(tabs)/index.tsx" src/features/today/__tests__/todayScreen.test.tsx
git commit -m "feat(today): make every task deletable and rows guess-led"
```

---

### Task 5: Full verification + device check

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass, 0 warnings.

- [ ] **Step 2: Device/sim verification (no CLI tap — observe + screenshot)**

Run `npm run ios`. On the Today screen, verify by eye against the approved mockup (`docs/superpowers/plans/today-delete-and-time-display.html`):
- Up-next rows: guess is the bold lead, `plan ~N min` sits beneath with the `~N` in amber.
- Done rows: `took N min` lead + `guessed N` support.
- First launch (reset the kv / fresh install): the top up-next row peeks left and springs back once; relaunch → no peek.
- Swipe a row left → red Delete reveals; tap it → row removed (medium haptic).
- Long-press a row and the focus card → destructive Delete sheet; Delete removes the task.
- Focus card gap bar: the guess segment reads as a soft indigo hatch (not a solid block); the Start button is the only solid indigo on screen.
- Capture: `xcrun simctl io booted screenshot ~/today-after.png`.

To re-trigger the first-run peek during testing, clear the flag from the app data container or reinstall (the kv key is `today.seenSwipeHint`).

- [ ] **Step 3: Confirm no invariants violated**

- No red appears anywhere on the honey/amber surfaces (delete red is on the swipe action only).
- No guilt copy. `plan ~N` and `guessed N` are neutral.
- No new dependency was added (`git diff package.json` shows no change).

---

## Self-Review

**Spec coverage:**
- Deletable tasks (swipe + long-press + focus card) → Tasks 3 + 4. ✓
- First-run peek cue → Task 3 (peek effect) + Task 4 (kv flag, first-row gating). ✓
- Guess-led `plan ~N min` rows → Task 2. ✓
- Done row `took N` + `guessed N` → Task 2. ✓
- Focus card unchanged except striped gap bar → Task 1 (only `GapLine`). ✓
- Tap-to-confirm deletion (no undo) → Task 3/4 (revealed Delete tap; destructive sheet). ✓
- Tokens nested under `progress`, no enumeration change → Task 1. ✓
- No engine/db/domain/store change → confirmed; `removeTask` pre-exists. ✓

**Placeholder scan:** No TBD/TODO; every code step carries full code. The only soft spot is the `todayScreen.test.tsx` seeding helper (Task 4 Step 1) — instructed to reuse the file's existing harness rather than invent one, because that file's setup is the source of truth.

**Type consistency:** `guessMin: number` added in Task 2 and consumed in Task 4. `onDelete`/`onLongPress`/`peekHint` defined in Task 3 and passed in Task 4 with matching names/types. `renderRightActions`, `swipeRef: SwipeableMethods`, and the `ReanimatedSwipeable` default import are consistent across Task 3. `tokens.progress.gapStripe.{lineW,gapW}` defined in Task 1 Step 1 and read in Step 4.
