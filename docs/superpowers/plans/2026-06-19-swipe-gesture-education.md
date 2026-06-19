# Swipe Gesture Education Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach users the swipe-to-delete gesture via (C2) a left-exit animation when deleting via ActionSheet, and (C4) a one-time floating coach mark on the first done card.

**Architecture:** Two coordinated changes — `TaskRow` gains `isExiting` and `showCoachMark` props that drive Reanimated animations, while `index.tsx` orchestrates deletion state and coach-mark lifecycle. No new files; both existing files grow props and effects.

**Tech Stack:** React Native 0.81 / Fabric, Reanimated 3 (worklet callbacks, `withTiming`, `runOnJS`), `expo-sqlite/kv-store` via `src/lib/kv.ts`

## Global Constraints

- All spacing/color values from `src/theme/tokens.ts` via `useTheme()` — no raw numbers or hex
- Never use the `exiting=` Reanimated layout animation prop (SIGABRT on Fabric) — use `withTiming` on shared values only
- Read/write Reanimated shared values with `.get()` / `.set()` never `.value`
- `'worklet'` directive required in `withTiming` callbacks (they run on UI thread)
- `runOnJS` required to call JS functions from worklet callbacks
- Conventional Commits; no AI/co-author attribution trailers
- Run `npm run lint && npm run typecheck` before every commit
- ActionSheet label changes: "Delete" → "Remove"

---

### Task 1: C2 — Slide-left exit animation (ActionSheet delete path)

**Files:**
- Modify: `src/features/today/TaskRow.tsx`
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Produces: `TaskRow` accepts new optional prop `isExiting?: boolean`; when it becomes `true`, the row slides left off-screen then calls `onDelete`
- Produces: `index.tsx` tracks `deletingId: string | null`; ActionSheet confirm sets this instead of calling `removeTask` directly; `onDelete` on each `TaskRow` calls `deleteTask(id)` (which calls `removeTask`)

---

- [ ] **Step 1: Add imports to `TaskRow.tsx`**

Current import block (lines 1–8):
```tsx
import { useEffect, useRef } from 'react';
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
```

Replace with:
```tsx
import { useEffect, useRef, useCallback } from 'react';
import { Pressable, View, Text, useWindowDimensions, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
```

- [ ] **Step 2: Add `isExiting` prop to `TaskRowProps` interface**

Current interface ends at `peekHint?: boolean;`. Add after it:
```tsx
  /** When true, slide the row left off-screen then call onDelete (teaches swipe direction). */
  isExiting?: boolean;
```

- [ ] **Step 3: Destructure `isExiting` and capture screen width in component body**

Current destructure (line ~47):
```tsx
export function TaskRow({
  title,
  categoryLabel,
  guessMin,
  honestMin,
  actualMin,
  done = false,
  onPress,
  onDelete,
  onLongPress,
  peekHint = false,
}: TaskRowProps) {
```

Replace with:
```tsx
export function TaskRow({
  title,
  categoryLabel,
  guessMin,
  honestMin,
  actualMin,
  done = false,
  onPress,
  onDelete,
  onLongPress,
  peekHint = false,
  isExiting = false,
}: TaskRowProps) {
```

Immediately after the `const reducedMotion = useReducedMotion();` line, add:
```tsx
  const { width: screenWidth } = useWindowDimensions();
```

- [ ] **Step 4: Add exitX shared value + animated style in `TaskRow`**

After the existing `const pressStyle = useAnimatedStyle(...)` line, add:
```tsx
  const exitX = useSharedValue(0);
  const exitStyle = useAnimatedStyle(() => ({ transform: [{ translateX: exitX.get() }] }));
```

- [ ] **Step 5: Add stable `triggerOnDelete` callback + exit `useEffect`**

After the `pressOut` function, add:
```tsx
  const triggerOnDelete = useCallback(() => { onDelete?.(); }, [onDelete]);

  useEffect(() => {
    if (!isExiting) return;
    exitX.set(
      withTiming(
        -screenWidth,
        { duration: t.motion.base, easing: Easing.in(Easing.ease) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(triggerOnDelete)();
        },
      ),
    );
  // exitX and triggerOnDelete are stable refs; screenWidth only changes on rotation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExiting]);
```

- [ ] **Step 6: Apply `exitStyle` to the outermost `Animated.View`**

Current (line ~146):
```tsx
  const content = (
    <Animated.View style={[row, pressStyle]}>
```

Replace with:
```tsx
  const content = (
    <Animated.View style={[row, pressStyle, exitStyle]}>
```

- [ ] **Step 7: Add `deletingId` state to `index.tsx`**

Current state block near line 65:
```tsx
  const [peekFirstRow] = useState(() => kv.getString('today.seenSwipeHint') == null);
```

Add after it:
```tsx
  const [deletingId, setDeletingId] = useState<string | null>(null);
```

- [ ] **Step 8: Update `deleteTask` and `promptDelete` in `index.tsx`**

Current:
```tsx
  function deleteTask(id: string) {
    haptics.medium();
    removeTask(id);
  }
  function promptDelete(id: string, label: string) {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: label, options: ['Delete', 'Cancel'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
      (i) => {
        if (i === 0) deleteTask(id);
      },
    );
  }
```

Replace with:
```tsx
  function deleteTask(id: string) {
    haptics.medium();
    removeTask(id);
    setDeletingId(null);
  }
  function promptDelete(id: string, label: string) {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: label, options: ['Remove', 'Cancel'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
      (i) => {
        if (i === 0) setDeletingId(id);
      },
    );
  }
```

Note: `onDelete` on each `TaskRow` still calls `deleteTask(id)` — that's the callback fired *after* the animation completes. The flow is: ActionSheet confirm → `setDeletingId(id)` → `isExiting` becomes true → animation runs → `runOnJS(triggerOnDelete)()` → `onDelete` prop → `deleteTask(id)` → `removeTask(id)` + `setDeletingId(null)`.

- [ ] **Step 9: Pass `isExiting` to every `TaskRow` in `index.tsx`**

There are two `TaskRow` render sites — up-next rows (line ~273) and done rows (line ~291). Add `isExiting` to both.

Up-next rows, add after `peekHint={peekFirstRow && idx === 0}`:
```tsx
                  isExiting={deletingId === row.id}
```

Done rows, add after `onLongPress={() => promptDelete(row.id, row.label)}`:
```tsx
                  isExiting={deletingId === row.id}
```

- [ ] **Step 10: Lint + typecheck**

```bash
npx eslint src/features/today/TaskRow.tsx src/app/\(tabs\)/index.tsx
npm run typecheck
```

Expected: zero errors, zero warnings.

- [ ] **Step 11: Manual verify on simulator**

```bash
npm run ios
```

1. Add a task, long-press it → "Remove" → confirm → row slides left off-screen. ✓
2. Add a task, swipe left → tap "Remove" → normal swipe exit (unchanged). ✓
3. Lint + typecheck still pass. ✓

- [ ] **Step 12: Commit**

```bash
git add src/features/today/TaskRow.tsx src/app/\(tabs\)/index.tsx
git commit -m "feat(today): animate long-press deletes sliding left to teach swipe gesture"
```

---

### Task 2: C4 — Just-in-time coach mark

**Files:**
- Modify: `src/features/today/TaskRow.tsx`
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `TaskRow.isExiting?: boolean` from Task 1
- Produces: `TaskRow` accepts `showCoachMark?: boolean` and `onCoachMarkDismiss?: () => void`
- Produces: `index.tsx` exports `dismissCoachMark` internally; first done row receives `showCoachMark` + `onCoachMarkDismiss`

---

- [ ] **Step 1: Add `showCoachMark` + `onCoachMarkDismiss` props to `TaskRowProps`**

After `isExiting?: boolean;`:
```tsx
  /** Show "← swipe to remove" coach overlay (first done row, first session). */
  showCoachMark?: boolean;
  /** Called when the swipeable begins opening — parent dismisses the coach mark. */
  onCoachMarkDismiss?: () => void;
```

- [ ] **Step 2: Destructure new props in `TaskRow`**

Add to destructure after `isExiting = false,`:
```tsx
  showCoachMark = false,
  onCoachMarkDismiss,
```

- [ ] **Step 3: Add coach mark shared value + animated style**

After the `exitStyle` lines from Task 1:
```tsx
  const markOpacity = useSharedValue(0);
  const markStyle = useAnimatedStyle(() => ({ opacity: markOpacity.get() }));
```

- [ ] **Step 4: Add coach mark fade-in `useEffect`**

After the exit `useEffect` from Task 1:
```tsx
  useEffect(() => {
    if (showCoachMark) {
      markOpacity.set(withTiming(1, { duration: t.motion.base }));
    } else {
      markOpacity.set(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCoachMark]);
```

- [ ] **Step 5: Add coach mark styles to `TaskRow`**

After the `deleteLabel` style block:
```tsx
  const coachWrap: ViewStyle = {
    position: 'absolute',
    right: t.space[3],
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    pointerEvents: 'none',
  };
  const coachPill: ViewStyle = {
    backgroundColor: t.colors.inverseSurface,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
  };
  const coachLabel: TextStyle = {
    color: t.colors.inverseText,
    fontSize: t.fontSize.xs,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    letterSpacing: 0.2,
  };
```

- [ ] **Step 6: Render coach mark inside `content`**

Inside `content` (`Animated.View` with `[row, pressStyle, exitStyle]`), after the done/queued time block closes and before the closing `</Animated.View>`, add:
```tsx
      {showCoachMark ? (
        <Animated.View style={[coachWrap, markStyle]}>
          <View style={coachPill}>
            <Text style={coachLabel}>← swipe to remove</Text>
          </View>
        </Animated.View>
      ) : null}
```

- [ ] **Step 7: Wire `onCoachMarkDismiss` to `onSwipeableWillOpen`**

Current `ReanimatedSwipeable` render (bottom of file):
```tsx
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

Replace with:
```tsx
  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={() => onCoachMarkDismiss?.()}
    >
      {body}
    </ReanimatedSwipeable>
  );
```

- [ ] **Step 8: Add `showCoachMark` state + `dismissCoachMark` to `index.tsx`**

After the `deletingId` state line from Task 1:
```tsx
  const [showCoachMark, setShowCoachMark] = useState(
    () => kv.getString('today.seenCoachMarkV1') == null,
  );

  const dismissCoachMark = useCallback(() => {
    setShowCoachMark(false);
    kv.set('today.seenCoachMarkV1', '1');
  }, []);
```

Add `useCallback` to the existing import from `react` (line 9):
```tsx
import { useState, useEffect, useCallback } from 'react';
```

- [ ] **Step 9: Add 4-second auto-dismiss `useEffect` to `index.tsx`**

After the existing `peekFirstRow` `useEffect`:
```tsx
  const hasDone = done.length > 0;
  useEffect(() => {
    if (!showCoachMark || !hasDone) return;
    const timer = setTimeout(dismissCoachMark, 4000);
    return () => clearTimeout(timer);
  // dismissCoachMark is stable (useCallback with no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCoachMark, hasDone]);
```

- [ ] **Step 10: Call `dismissCoachMark` inside `deleteTask`**

Current `deleteTask`:
```tsx
  function deleteTask(id: string) {
    haptics.medium();
    removeTask(id);
    setDeletingId(null);
  }
```

Replace with:
```tsx
  function deleteTask(id: string) {
    haptics.medium();
    dismissCoachMark();
    removeTask(id);
    setDeletingId(null);
  }
```

- [ ] **Step 11: Pass `showCoachMark` + `onCoachMarkDismiss` to first done `TaskRow`**

Done rows render block (line ~291). Add to the first done row only by checking `idx`:

Change the done rows map from:
```tsx
              {done.map((row) => (
                <TaskRow
                  key={row.id}
                  ...
                  isExiting={deletingId === row.id}
                />
              ))}
```

To:
```tsx
              {done.map((row, idx) => (
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
                  isExiting={deletingId === row.id}
                  showCoachMark={showCoachMark && idx === 0}
                  onCoachMarkDismiss={dismissCoachMark}
                />
              ))}
```

- [ ] **Step 12: Lint + typecheck**

```bash
npx eslint src/features/today/TaskRow.tsx src/app/\(tabs\)/index.tsx
npm run typecheck
```

Expected: zero errors, zero warnings.

- [ ] **Step 13: Manual verify on simulator**

Reset coach mark state to test from scratch:
```bash
# Reset KV so seenCoachMarkV1 is unset — fastest is to wipe app data
xcrun simctl terminate booted com.whenbee.app
xcrun simctl get_app_container booted com.whenbee.app data
# then delete Documents/SQLite/ExpoSQLiteStorage in that path
xcrun simctl launch booted com.whenbee.app
```

Verify:
1. Complete a task → done row appears → coach mark pill fades in "← swipe to remove". ✓
2. Wait 4s → pill disappears. ✓
3. Kill + relaunch app → no pill (KV persisted). ✓
4. Reset KV again → complete task → immediately swipe the done row → pill disappears as swipe opens. ✓
5. Reset KV again → complete task → long-press → "Remove" → confirm → pill disappears + row slides left. ✓

- [ ] **Step 14: Commit**

```bash
git add src/features/today/TaskRow.tsx src/app/\(tabs\)/index.tsx
git commit -m "feat(today): add just-in-time coach mark on first done row to teach swipe-to-delete"
```
