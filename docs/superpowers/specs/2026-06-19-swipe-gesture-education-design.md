# Swipe-to-Delete Gesture Education

**Date:** 2026-06-19
**Status:** Approved

## Problem

The swipe-to-delete gesture on TaskRow is not discoverable. Users who only use the long-press → ActionSheet path never learn the swipe shortcut exists.

## Solution

Two complementary patterns, each grounded in published research:

- **C2 — Exit animation alignment** (Apple WWDC 2018 "Designing Fluid Interfaces", 59:35): animate long-press deletes exiting left. Teaches the swipe gesture direction for free, via the explicit delete path the user already uses.
- **C4 — Just-in-time coach mark** (NNG coach mark research): one floating tooltip on the first done card, first session the user has any done tasks. Disappears after 4s, on swipe-open, or on any delete. Never repeats.

## Scope

Files changed:
- `src/app/(tabs)/index.tsx` — state + orchestration
- `src/features/today/TaskRow.tsx` — animation + coach mark rendering

## C2 — Slide-left exit animation

### Trigger

Long-press → ActionSheet → "Remove" confirm only.
Swipe-to-delete path is excluded — `ReanimatedSwipeable` already exits left naturally.

### ActionSheet label

Change "Delete" → "Remove" to match the swipe panel label (consistent vocabulary).

### State

```ts
// index.tsx
const [deletingId, setDeletingId] = useState<string | null>(null);
```

### Flow

1. ActionSheet "Remove" confirmed → `setDeletingId(id)` (no `removeTask` yet)
2. `TaskRow` receives `isExiting={deletingId === row.id}`
3. `TaskRow` `useEffect` watches `isExiting`:
   - fires `withTiming` on a `exitX` shared value → translateX to `-SCREEN_WIDTH`
   - duration: `t.motion.base` (220ms)
   - easing: `Easing.in(Easing.ease)`
   - callback: `runOnJS(onDelete)()` on complete
4. `onDelete` → `deleteTask(id)` → `removeTask(id)` + `setDeletingId(null)`

### TaskRow changes

- New prop: `isExiting?: boolean`
- New shared value: `exitX = useSharedValue(0)`
- New animated style: `{ transform: [{ translateX: exitX.get() }] }` — applied to the outermost `Animated.View`
- `useEffect([isExiting])`: when `isExiting` becomes true, start the timed exit

**Safe on Fabric:** uses `withTiming` on `translateX` via `useAnimatedStyle`. Does NOT use the forbidden `exiting=` layout animation prop.

## C4 — Just-in-time coach mark

### KV key

`today.seenCoachMarkV1` — separate from `today.seenSwipeHint` (peek animation).

### State

```ts
// index.tsx
const [showCoachMark, setShowCoachMark] = useState(
  () => kv.getString('today.seenCoachMarkV1') == null
);
```

### Dismiss conditions (any one suffices)

1. 4-second auto-timeout
2. User begins a swipe on any TaskRow (`onSwipeableWillOpen` callback)
3. Any delete fires (`deleteTask`)

All paths call the same `dismissCoachMark()`:

```ts
function dismissCoachMark() {
  if (!showCoachMark) return;
  setShowCoachMark(false);
  kv.set('today.seenCoachMarkV1', '1');
}
```

### Where it appears

Only the **first done row** (`idx === 0` in the done list), and only when `showCoachMark && done.length > 0`. Queued rows excluded — done rows are the "review" moment, not the "about to start" moment.

### TaskRow changes

- New prop: `showCoachMark?: boolean`
- New prop: `onCoachMarkDismiss?: () => void` — called when swipe begins (`onSwipeableWillOpen`)
- Renders an absolutely-positioned pill overlay when `showCoachMark` is true:
  - Text: `"← swipe to remove"`
  - Positioned: vertically centred, right-inset `t.space[3]` from card edge
  - Style: `backgroundColor: t.colors.inverseSurface`, `color: t.colors.inverseText` (light pill on dark card — matches existing toast token pattern)
  - Font: `t.fontWeight.bold`, `t.fontSize.xs`
  - Fade-in: `withTiming` on `opacity` from 0 → 1, `t.motion.base`
  - No fade-out managed by TaskRow — parent removes the prop, causing unmount

### ReanimatedSwipeable wiring

Pass `onSwipeableWillOpen` to the `ReanimatedSwipeable` in TaskRow. When it fires, call `onCoachMarkDismiss?.()`.

## What does NOT change

- `peekHint` / `today.seenSwipeHint` logic — untouched
- Swipe-delete animation — untouched
- Done row opacity (0.7) — untouched
- Any other screen or component

## Tests

No new unit tests required (animation timing + UI-only props). Existing `GapLine.test.tsx` and TaskRow snapshot tests should still pass. Manual verify: simulator screenshot after change.
