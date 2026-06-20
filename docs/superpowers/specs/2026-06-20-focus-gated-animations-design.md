# Focus-gated animations — design

**Date:** 2026-06-20
**Status:** Approved, pre-implementation
**Scope:** Stop animations from playing while their screen is off-focus, and defer celebration animations until the user actually lands on the screen so none are ever missed.

## Problem

Animations across the app fire the instant their driving value changes — not when the user is looking. Two distinct failures:

1. **Missed celebrations.** State-transition animations (the honey ring growing on the Whenbee screen when calibration crosses a tier, the "Today's honey set" seal, honeycomb fills, companion stage-lift) play immediately on the store change. That change usually happens while the user is on the timer modal, the reward modal, another tab, or an onboarding step. Tab screens stay **mounted** when blurred (Expo Router default), so the animation runs in the background and the user walks in after it has finished. The headline case: log a task → the ring growth the user wants to witness on the Whenbee (WNB) screen has already played.

2. **Wasted work.** Roughly a dozen infinite ambient loops (`withRepeat(..., -1)`: bee flutter/blink/glance, avatar bob, Pro-card shimmer, glyph flaps, ray-burst spin, NOW-pulse, rest-breath) run forever with no focus or visibility gate, burning CPU/GPU/battery off-screen and on inactive tabs.

Audited inventory of both classes is in the investigation that preceded this design (RitualSeal, HoneyRing, Honeycomb, WhenbeeAvatar, BeeMascot, ProUpsellCard, BeeGlyph, LockGlyph, RayBurst, ReasonGlyph, CoinBadge, RunningFocusCard, HoneyTrail, RailNode, timer).

## Key insight

The animations themselves are correct. `HoneyRing.tsx:73` already animates the ring **old→new**; `RitualSeal`, `HoneyBar`, `ReclaimDeposit` all animate from a start state. Only the **timing of the trigger** is wrong. So the fix is not an animation rewrite — it is to gate *when* the trigger is allowed to fire on screen focus.

Both bug classes reduce to one question: **what value has the user actually witnessed on a focused screen?**

## Design

Two small reusable hooks in `src/hooks/` (dir already exists). Both build on `expo-router`'s focus primitives, which are already used (`useToday.ts:88`, `usePatterns.ts:397`) and already test-mocked. No new dependencies.

> Verify in implementation: `useIsFocused` is re-exported by `expo-router`. If not, import from `@react-navigation/native` (expo-router is built on it).

### Hook 1 — `useFocusedValue<T>(value): T` (deferred celebrations)

Returns `value` only while the screen is focused; otherwise the last value seen while focused. Inputs "freeze" off-screen, so the consumer's existing old→new animation plays exactly when the user lands on the screen.

```ts
function useFocusedValue<T>(value: T): T {
  const isFocused = useIsFocused();
  const seen = useRef(value);
  if (isFocused) seen.current = value; // adopt latest only while watched
  return seen.current;
}
```

- Applied at the **feature/screen (view-model / HUD) layer**, never inside leaf SVG components. Leaf components stay presentational and keep their current animate-from-old logic. One-line change per call site.
- If the driving value advances more than one step while the user is away, on arrival they see **one** clean old→latest transition — the net change as a single celebration, not N replays.
- Reward-modal payoff (`HoneyBar`, `ReclaimDeposit`) is already gated to the modal mount — the user always sees it — and is **left untouched**.

Call sites:
- `WhenbeeHub`: `const shownSharpness = useFocusedValue(vm.leadSharpness)` → feeds `HoneyRing` + `Honeycomb` (the ring-grows case).
- `WhenbeeHub`: gate `sealed` and `stage` the same way → seal stamp/ripple/motes and companion stage-lift wait for focus.
- `TodayHud`: `useFocusedValue(done)` → RitualSeal "honey set" waits for the Today tab.

### Hook 2 — `useAmbientMotion(active, run)` (cosmetic loops)

Runs repeating ambient motion only while focused; cancels and rests on blur. Generalizes the one loop in the app that already cleans up correctly (`RailNode.tsx:54`).

```ts
function useAmbientMotion(active: boolean, run: () => () => void) {
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      return run(); // run() starts the loop(s), returns a canceller
    }, [active]),
  );
}
```

- `run` sets the shared value(s) and returns a cancel function — supports multi-loop leaves (BeeMascot's flutter + blink + glance in one call).
- `active = !reducedMotion && animated`. When inactive, no loop starts (reduced-motion behavior preserved).
- The canceller resets each shared value to its **rest** value (e.g. opacity 1), so a blurred component is not frozen mid-pulse.

## Mapping — every animation lands in one bucket

| Bucket | Mechanism | Components |
|---|---|---|
| **A. Deferred celebration** (never miss) | `useFocusedValue` at screen layer | HoneyRing growth + seal compound, Honeycomb cells, HoneycombStrip pips, RitualSeal seal, WhenbeeAvatar stage-lift |
| **B. Ambient loop** (pause off-focus) | `useAmbientMotion` in leaf | RitualSeal rest-breath, RunningFocusCard NOW-pulse, BeeMascot ×3, WhenbeeAvatar bob/wobble, HoneyTrail halo, ProUpsellCard crest/shimmer, BeeGlyph, LockGlyph, RayBurst, ReasonGlyph, CoinBadge bob, Timer pulse, RailNode (already clean — adopt for consistency) |
| **C. Mount `entering=`** (FadeInDown chips, HoneyTrail enter) | leave as-is | their screens mount **focused** (reward modal / onboarding step); low risk, YAGNI |

## Edge cases

- **Multi-tier jump while away** → single net old→latest transition, not N replays.
- **Reduced motion** → `active=false`, snaps to final with no motion; existing behavior preserved.
- **Loop rest on blur** → canceller resets to rest value, not a frozen mid-frame.
- **Array inputs** (`cells`) → gate the derived value at the view-model; leaf equality unchanged.
- **Never focuses** → on first focus the user gets the latest value, correct.

## Testing (TDD — logic layer, required)

- `useFocusedValue`: mock `useIsFocused` → value frozen while blurred, adopts latest on focus, returns latest on first focus.
- `useAmbientMotion`: mock `useFocusEffect` (run-immediately, mirroring existing test mocks) + spy `cancelAnimation` → no start when `active=false`; canceller runs on cleanup.
- Existing component/snapshot tests (e.g. `FocusCard.test.tsx`) must stay green.

## Non-goals

- No scroll-into-view (viewport) gating — no heavy loop lives in a long scroll list except `ProUpsellCard`, which focus already covers.
- No animation choreography/timing changes — durations stay in `tokens.ts`.
- No new dependencies.

## Invariants respected

- No guilt/shame mechanics, no streaks. Honey/sharpness stays monotonic (`HoneyRing` only animates forward; `useFocusedValue` never moves a value backward — it only delays adopting the latest).
- Core loop stays on-device-only; no network.
- All durations/easings remain theme tokens.
