# Honest-Day capacity chip — honest "open" time + footer redesign

**Date:** 2026-06-25
**Status:** Approved (direction C)
**Area:** `src/engine/honestDayLoad.ts`, `src/features/today/CapacityChip.tsx`, `src/features/today/useDayCapacity.ts` (consumer only)

## Problem

The expanded CapacityChip footer has three issues the founder flagged:

1. **"Xh free" is internally inconsistent — reads as bullshit.**
   `freeMin = max(0, WAKING_WINDOW_MIN − eventMin)` (`honestDayLoad.ts:25`) subtracts **only meetings** from the fixed 14h window. But the *empty part of the bar* is `window − tasks − meetings`. With tasks 1h50m + meetings 5h24m in a 14h day:
   - empty bar = `840 − 110 − 324 = 406m = 6h 46m`
   - label = `840 − 324 = 516m → "8h free"`

   They disagree by **exactly the task minutes**. The number does not match the bar the user is looking at, so it reads as fabricated.

2. **"Pad my calendar"** is a tiny underlined link — reads like a legal footer, not the one Pro action in the card.

3. **The × dismiss** floats alone at bottom-left, orphaned and easy to mis-tap.

`freeMin` is **correct for the verdict math** (`snug` = tasks crowding the time available *for tasks*, i.e. after meetings). The bug is only that `freeMin` is also shown to the user as the headline number, where it means the wrong thing.

## Design

### Engine (`honestDayLoad.ts`)

Add a display-only field; **do not change `freeMin`** (verdict logic and its tests depend on it):

```ts
openMin: number; // max(0, wakingWindowMin − committedMin) — the real leftover, = the empty bar
```

`committedMin = taskMin + eventMin` already exists, so `openMin = max(0, wakingWindowMin − committedMin)`.

- `verdict` and `freeMin` semantics: **unchanged.**
- `openMin` is what the UI shows as the leftover. It always equals the empty segment of the bar, so number and visual reconcile.

### UI (`CapacityChip.tsx`) — footer toolbar (direction C)

Collapsed header row gains the dismiss:

```
⚡  Honest day 7h 14m · fits          ⌄   ✕
```

- `✕` moves up beside the chevron (one home, top-right). Session dismiss, unchanged behavior.

Expanded body:

```
[ ████ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ················· ]   ← tasks | meetings | open (empty track)
● tasks 1h 50m   ● meetings 5h 24m
────────────────────────────────────────
6h 46m open                  [ ▦ Pad calendar ]   ← toolbar row
```

- Legend: tasks + meetings only (unchanged).
- New hairline divider (`t.colors.hairline`).
- **Toolbar row:** `space-between`. Left = `<b>{fmtHm(openMin)}</b> open` (`inkSoft` with `ink` value). Right = "Pad calendar" pill — `primaryChip` bg, `primary` text, `radii.full`, calendar glyph. Replaces the underlined link.
- Copy: **"open"** not "free" (calendar language; "free" implies leisure). The label "Xh free" string is retired.
- The `over` amber nudge and the denied/off settings nudge stay where they are (above the toolbar).
- Naming: rename the `honestLink` style usage to the pill; remove the standalone bottom `× ` Pressable from the expanded body.

### Invariants honored

- No guilt / no red — amber-only verdict untouched.
- Tokens only — pill uses `primaryChip` / `primary` / `radii.full`; no new raw values. If a token is missing it's added to `tokens.ts`.
- One primary CTA per screen — Pad is a **tinted pill**, not filled indigo, so it never competes with the screen's Start CTA.
- Pro-gate — free path (teaser) untouched; `openMin` only renders on the Pro path.

## Testing

- **Engine (TDD):** new case asserting `openMin = max(0, window − committed)` and `openMin = 0` when over. Existing `freeMin`/verdict cases must stay green.
- **Component:** update `CapacityChip.test.tsx` — assert "open" copy + Pad pill present (Pro), still absent on free path; the old "Nh free" assertion is replaced.

## Out of scope

- "From now till bedtime" dynamic window (rejected: needs a clock, can go negative, harder to verify).
- Changing the fixed 14h waking window.
- The honest-day write modal itself (`(modals)/honest-day.tsx`) — destination unchanged.
