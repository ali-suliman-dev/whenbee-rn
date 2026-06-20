# Focus-Gated Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop animations from playing while their screen is off-focus, and defer celebration animations until the user lands on the screen, so none are ever missed.

**Architecture:** Three small reusable hooks in `src/hooks/`. `useIsScreenFocused` exposes a focus boolean built on expo-router's `useNavigation`. `useFocusedValue` freezes a value while the screen is blurred so celebration animations (honey-ring growth, the Today seal, honeycomb fills) replay when the user arrives. `useAmbientMotion` runs infinite ambient loops only while focused, cancelling and resting them on blur. Celebration animations are gated at the screen/view-model layer; ambient loops are converted in their leaf components.

**Tech Stack:** React Native, Expo SDK 54, expo-router, react-native-reanimated 3 (`.get()/.set()` shared-value API), Jest + @testing-library/react-native.

## Global Constraints

- All durations/easings come from `src/theme/tokens.ts` via `useTheme()` — never inline a raw number or hex. This plan adds **no** new animation timings.
- Read/write reanimated shared values with `.get()/.set()`, never `.value`.
- TypeScript strict + `noUncheckedIndexedAccess` + `noImplicitOverride` are on. Handle `T | undefined` from indexed access.
- TDD is required for logic-layer code (the three hooks). UI call-site conversions are verified by lint + typecheck + existing tests, not new unit tests.
- Lint gate is zero-warning: `npm run lint` runs `eslint . --max-warnings=0`. The repo uses the flat `eslint.config.js` (no `.eslintrc.js`). Match the existing `// eslint-disable-next-line react-hooks/exhaustive-deps` convention where stable theme tokens are read inside hook deps.
- Conventional Commits. **Never** add `Co-Authored-By` or any AI-attribution trailer. Use the `/init-cmt` skill for commits.
- **Never merge.** Deliver via a worktree + PR; the founder reviews and merges by hand.
- Product invariants: no guilt/streaks; honey/sharpness stays monotonic (this work only *delays* adopting the latest value — it never moves a value backward); core loop stays on-device (no network).

---

### Task 1: `useIsScreenFocused` hook

**Files:**
- Create: `src/hooks/useIsScreenFocused.ts`
- Test: `src/hooks/__tests__/useIsScreenFocused.test.tsx`

**Interfaces:**
- Consumes: `useNavigation` from `expo-router` (returns a navigation object exposing `isFocused(): boolean` and `addListener(type, cb): () => void`).
- Produces: `useIsScreenFocused(): boolean` — `true` when the nearest screen is focused, re-rendering on focus/blur.

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/__tests__/useIsScreenFocused.test.tsx
import { renderHook, act } from '@testing-library/react-native';
import { useIsScreenFocused } from '../useIsScreenFocused';

type Listener = () => void;

function makeNavigation(initialFocused: boolean) {
  const listeners: Record<string, Listener[]> = { focus: [], blur: [] };
  return {
    isFocused: () => initialFocused,
    addListener: (type: string, cb: Listener) => {
      listeners[type] = [...(listeners[type] ?? []), cb];
      return () => {
        listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
      };
    },
    emit: (type: string) => (listeners[type] ?? []).forEach((l) => l()),
  };
}

const nav = makeNavigation(false);
jest.mock('expo-router', () => ({ useNavigation: () => nav }));

test('starts from navigation.isFocused() and flips on focus/blur events', () => {
  const { result } = renderHook(() => useIsScreenFocused());
  expect(result.current).toBe(false);

  act(() => nav.emit('focus'));
  expect(result.current).toBe(true);

  act(() => nav.emit('blur'));
  expect(result.current).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/hooks/__tests__/useIsScreenFocused.test.tsx`
Expected: FAIL — cannot find module `../useIsScreenFocused`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useIsScreenFocused.ts
import { useEffect, useState } from 'react';
import { useNavigation } from 'expo-router';

/**
 * Tracks whether the nearest navigation screen is focused. Re-renders on
 * focus/blur so consumers can gate animations on visibility. Built on
 * expo-router's useNavigation (the repo's navigation-hook source) rather than
 * importing useIsFocused from a transitive @react-navigation package.
 */
export function useIsScreenFocused(): boolean {
  const navigation = useNavigation();
  const [focused, setFocused] = useState(() => navigation.isFocused());

  useEffect(() => {
    setFocused(navigation.isFocused());
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  return focused;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/hooks/__tests__/useIsScreenFocused.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/hooks/useIsScreenFocused.ts src/hooks/__tests__/useIsScreenFocused.test.tsx && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useIsScreenFocused.ts src/hooks/__tests__/useIsScreenFocused.test.tsx
git commit -m "feat(hooks): add useIsScreenFocused"
```

---

### Task 2: `useFocusedValue` hook

**Files:**
- Create: `src/hooks/useFocusedValue.ts`
- Test: `src/hooks/__tests__/useFocusedValue.test.tsx`

**Interfaces:**
- Consumes: `useIsScreenFocused(): boolean` from Task 1.
- Produces: `useFocusedValue<T>(value: T): T` — returns `value` while focused; otherwise the last value seen while focused.

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/__tests__/useFocusedValue.test.tsx
import { renderHook } from '@testing-library/react-native';
import { useFocusedValue } from '../useFocusedValue';

let focused = true;
jest.mock('../useIsScreenFocused', () => ({ useIsScreenFocused: () => focused }));

test('freezes value while blurred and adopts the latest on refocus', () => {
  focused = true;
  const { result, rerender } = renderHook(({ v }) => useFocusedValue(v), {
    initialProps: { v: 'raw' },
  });
  expect(result.current).toBe('raw');

  // Blur, then the source value advances twice while off-screen.
  focused = false;
  rerender({ v: 'settling' });
  expect(result.current).toBe('raw'); // frozen — not yet seen
  rerender({ v: 'honest' });
  expect(result.current).toBe('raw'); // still frozen

  // Refocus: adopt the latest (single net transition, not a replay of each step).
  focused = true;
  rerender({ v: 'honest' });
  expect(result.current).toBe('honest');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/hooks/__tests__/useFocusedValue.test.tsx`
Expected: FAIL — cannot find module `../useFocusedValue`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useFocusedValue.ts
import { useRef } from 'react';
import { useIsScreenFocused } from './useIsScreenFocused';

/**
 * Returns `value` while the screen is focused; otherwise the last value seen
 * while focused. Inputs "freeze" off-screen so a consumer's existing
 * old→new animation plays exactly when the user lands on the screen. If the
 * value advances several steps while blurred, the consumer sees one net
 * transition on arrival, never a backlog of replays.
 */
export function useFocusedValue<T>(value: T): T {
  const isFocused = useIsScreenFocused();
  const seen = useRef(value);
  if (isFocused) {
    seen.current = value; // adopt the latest only while the user is watching
  }
  return seen.current;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/hooks/__tests__/useFocusedValue.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/hooks/useFocusedValue.ts src/hooks/__tests__/useFocusedValue.test.tsx && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFocusedValue.ts src/hooks/__tests__/useFocusedValue.test.tsx
git commit -m "feat(hooks): add useFocusedValue for deferred celebrations"
```

---

### Task 3: `useAmbientMotion` hook

**Files:**
- Create: `src/hooks/useAmbientMotion.ts`
- Test: `src/hooks/__tests__/useAmbientMotion.test.tsx`

**Interfaces:**
- Consumes: `useFocusEffect` from `expo-router` (runs a callback on focus; its returned function runs on blur/unmount).
- Produces: `useAmbientMotion(active: boolean, run: () => () => void): void`. `run` starts the loop(s) and returns a canceller that resets the shared value(s) to rest. Callers MUST pass a `run` stabilised with `useCallback`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/__tests__/useAmbientMotion.test.tsx
import { renderHook } from '@testing-library/react-native';
import { useAmbientMotion } from '../useAmbientMotion';

// Mock useFocusEffect to run the setup immediately (mirrors a screen gaining
// focus) and expose the returned cleanup so the test can fire "blur".
let cleanup: (() => void) | void;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    cleanup = cb();
  },
}));

test('runs while active and cancels on blur; does nothing when inactive', () => {
  const cancel = jest.fn();
  const run = jest.fn(() => cancel);

  // Active → run() is called on focus.
  renderHook(() => useAmbientMotion(true, run));
  expect(run).toHaveBeenCalledTimes(1);
  // Blur fires the cleanup → canceller runs.
  cleanup?.();
  expect(cancel).toHaveBeenCalledTimes(1);

  // Inactive → run() is never called.
  run.mockClear();
  renderHook(() => useAmbientMotion(false, run));
  expect(run).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/hooks/__tests__/useAmbientMotion.test.tsx`
Expected: FAIL — cannot find module `../useAmbientMotion`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useAmbientMotion.ts
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Runs repeating ambient motion only while the screen is focused. On focus and
 * when `active` is true, calls `run()` to start the loop(s); on blur or unmount,
 * calls the canceller `run()` returned (which should reset shared values to
 * rest). Pass a `run` stabilised with useCallback so the loop is not restarted
 * on every render.
 */
export function useAmbientMotion(active: boolean, run: () => () => void): void {
  useFocusEffect(
    useCallback(() => {
      if (!active) return undefined;
      return run();
    }, [active, run]),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/hooks/__tests__/useAmbientMotion.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/hooks/useAmbientMotion.ts src/hooks/__tests__/useAmbientMotion.test.tsx && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAmbientMotion.ts src/hooks/__tests__/useAmbientMotion.test.tsx
git commit -m "feat(hooks): add useAmbientMotion for focus-gated loops"
```

---

### Task 4: Defer the Today ritual seal (bucket A)

**Files:**
- Modify: `src/app/(tabs)/index.tsx:187`

**Interfaces:**
- Consumes: `useFocusedValue` (Task 2).

This is the Today tab screen. It passes `ritualDone={done.length > 0}` to `TodayHud`, which feeds `RitualSeal`'s `done` prop. Freezing this boolean means the seal choreography (`RitualSeal.tsx:79-85`) holds until the Today tab is focused — so logging via the timer/reward modal no longer burns the seal off-screen.

- [ ] **Step 1: Add the import**

Add to the imports at the top of `src/app/(tabs)/index.tsx`:

```tsx
import { useFocusedValue } from '@/src/hooks/useFocusedValue';
```

- [ ] **Step 2: Gate the value**

Find the component body where `done` is available (the same scope as line 187). Add, near the other derived values:

```tsx
const ritualDone = useFocusedValue(done.length > 0);
```

Then change line 187 from:

```tsx
              ritualDone={done.length > 0}
```

to:

```tsx
              ritualDone={ritualDone}
```

- [ ] **Step 3: Typecheck + lint + existing tests**

Run: `npm run typecheck && npx eslint "src/app/(tabs)/index.tsx" && npx jest src/components/honeycomb/__tests__/TodayHud.test.tsx src/features/today`
Expected: PASS (TodayHud test passes `ritualDone` directly and is unaffected).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "fix(today): defer ritual seal until the Today tab is focused"
```

---

### Task 5: Defer the Whenbee hub celebrations — ring, seal, stage (bucket A)

**Files:**
- Modify: `src/features/whenbee/WhenbeeHub.tsx:104-116`

**Interfaces:**
- Consumes: `useFocusedValue` (Task 2).

`HoneyRing` already animates the ring fill old→new (`HoneyRing.tsx:79`) and stamps the seal when `sealed` flips. Freezing `leadSharpness`, `tier === 'Honest'`, and `companion.stage` means the ring growth, seal ceremony, and stage-driven float amplitude all wait for the Whenbee tab to be focused — the headline "I want to witness the ring grow" case.

- [ ] **Step 1: Add the import**

Add to the imports at the top of `src/features/whenbee/WhenbeeHub.tsx`:

```tsx
import { useFocusedValue } from '@/src/hooks/useFocusedValue';
```

- [ ] **Step 2: Gate the values**

In the component body, before the `return`, add:

```tsx
const shownSharpness = useFocusedValue(vm.leadSharpness);
const shownSealed = useFocusedValue(vm.tier === 'Honest');
const shownStage = useFocusedValue(vm.companion.stage);
```

- [ ] **Step 3: Feed the gated values into the hero**

Replace lines 104-116 (the `HoneyRing` block) with:

```tsx
        <HoneyRing sharpness={shownSharpness} sealed={shownSealed}>
          <WhenbeeAvatar
            stage={shownStage}
            seed={vm.companion.seed}
            driftHealth={vm.companion.driftHealth}
            name={vm.companion.name ?? undefined}
            glow={false}
            size={t.companion.ringBee}
            backdrop="soft"
            animated
          />
        </HoneyRing>
        <RingBadge sharpness={shownSharpness} />
```

- [ ] **Step 4: Typecheck + lint + tests**

Run: `npm run typecheck && npx eslint src/features/whenbee/WhenbeeHub.tsx && npx jest src/features/whenbee`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/whenbee/WhenbeeHub.tsx
git commit -m "fix(whenbee): defer ring growth, seal and stage until the hub is focused"
```

---

### Task 6: Defer the Today honeycomb fill (bucket A)

**Files:**
- Modify: `src/app/(tabs)/index.tsx:138-146` (the `cells` array passed to the honeycomb)

**Interfaces:**
- Consumes: `useFocusedValue` (Task 2). Import already added in Task 4.

The Today honeycomb cells are built from `statsByCategory` and each cell fills on a sharpness change (`Honeycomb.tsx:87`, `HoneycombStrip.tsx:63`). Freezing the `cells` reference while blurred holds the fill until the Today tab is focused; on focus the array updates and the per-cell animation plays.

- [ ] **Step 1: Gate the cells array**

In `src/app/(tabs)/index.tsx`, locate where `cells` is built (around lines 138-146) and assigned to a const (e.g. `const cells = ...`). Immediately after that const, add:

```tsx
const shownCells = useFocusedValue(cells);
```

Then change the prop on the honeycomb component (the JSX that consumes `cells`) from `cells={cells}` to:

```tsx
        cells={shownCells}
```

> If `cells` is currently inlined into the JSX rather than a named const, first extract it to `const cells = ...` above the `return`, then apply the two lines above.

- [ ] **Step 2: Typecheck + lint + tests**

Run: `npm run typecheck && npx eslint "src/app/(tabs)/index.tsx" && npx jest "src/app" src/components/honeycomb`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "fix(today): defer honeycomb fill until the Today tab is focused"
```

---

### Task 7: Focus-gate the RitualSeal resting breath (bucket B)

**Files:**
- Modify: `src/features/today/RitualSeal.tsx:60-87`

**Interfaces:**
- Consumes: `useAmbientMotion` (Task 3).

The seal choreography (the `done` branch) stays exactly as-is — it is already gated upstream by Task 4. Only the resting `restBreath` infinite loop (line 67) moves to `useAmbientMotion` so it pauses off the Today tab.

- [ ] **Step 1: Add the import**

```tsx
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
```

- [ ] **Step 2: Remove the rest-breath loop from the choreography effect**

In the `useEffect` (lines 60-87), inside the `if (!done) { ... }` block, delete the `restBreath` loop so the block becomes:

```tsx
    if (!done) {
      border.set(0); honey.set(0); mark.set(0); bloom.set(0); spark.set(0);
      return;
    }
```

(The `reduced ? restBreath.set(0) : withRepeat(...)` lines are removed; the choreography branch's `restBreath.set(0)` on line 80 stays.)

- [ ] **Step 3: Add the focus-gated rest-breath loop**

Add `cancelAnimation` to the reanimated import on line 4-12, then after the choreography `useEffect`, add:

```tsx
  useAmbientMotion(
    !done && !reduced,
    useCallback(() => {
      restBreath.set(withRepeat(withTiming(1, { duration: t.motion.halo, easing: e.calm }), -1, true));
      return () => {
        cancelAnimation(restBreath);
        restBreath.set(0);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [done, reduced]),
  );
```

Add `useCallback` to the `react` import on line 2 (`import { useCallback, useEffect, useRef } from 'react';`) and `cancelAnimation` to the reanimated import.

- [ ] **Step 4: Typecheck + lint + tests**

Run: `npm run typecheck && npx eslint src/features/today/RitualSeal.tsx && npx jest src/features/today/__tests__/FocusCard.test.tsx src/features/today`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/today/RitualSeal.tsx
git commit -m "fix(today): pause the ritual-seal resting breath off the Today tab"
```

---

### Task 8: Focus-gate the RunningFocusCard NOW pulse (bucket B)

**Files:**
- Modify: `src/features/today/RunningFocusCard.tsx:76-89`

**Interfaces:**
- Consumes: `useAmbientMotion` (Task 3).

- [ ] **Step 1: Add imports**

Add `cancelAnimation` to the reanimated import (lines 3-11) and:

```tsx
import { useCallback } from 'react';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
```

(`RunningFocusCard` already imports `useEffect, useState` from `react` on line 1 — extend it to `import { useCallback, useEffect, useState } from 'react';`.)

- [ ] **Step 2: Replace the pulse useEffect**

Replace lines 77-89 (the `useEffect` that starts the pulse) with:

```tsx
  useAmbientMotion(
    !reduced,
    useCallback(() => {
      pulse.set(
        withRepeat(
          withSequence(
            withTiming(t.opacity.pressed, { duration: t.motion.pulse }),
            withTiming(1, { duration: t.motion.pulse }),
          ),
          -1,
          false,
        ),
      );
      return () => {
        cancelAnimation(pulse);
        pulse.set(1);
      };
    }, [reduced, pulse, t.motion.pulse, t.opacity.pressed]),
  );
```

- [ ] **Step 3: Typecheck + lint + tests**

Run: `npm run typecheck && npx eslint src/features/today/RunningFocusCard.tsx && npx jest src/features/today`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/today/RunningFocusCard.tsx
git commit -m "fix(today): pause the running-card NOW pulse off the Today tab"
```

---

### Task 9: Focus-gate the BeeMascot micro-life (bucket B)

**Files:**
- Modify: `src/components/BeeMascot.tsx:138-170`

**Interfaces:**
- Consumes: `useAmbientMotion` (Task 3).

Three loops (flutter, blink, look) move into one `useAmbientMotion` call returning a single canceller.

- [ ] **Step 1: Add imports**

Add `cancelAnimation` to the reanimated import, plus:

```tsx
import { useCallback } from 'react';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
```

- [ ] **Step 2: Replace the loops useEffect**

Replace the `useEffect` at lines 139-170 with:

```tsx
  useAmbientMotion(
    Boolean(animated) && !reduced,
    useCallback(() => {
      flutter.set(withRepeat(withTiming(1, { duration: m.beeWingBuzz, easing: m.easing.calm }), -1, true));
      blink.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: m.beeBlink, easing: m.easing.calm }),
            withTiming(0, { duration: m.beeBlink, easing: m.easing.calm }),
            withDelay(m.beeBlinkGap, withTiming(0, { duration: 0 })),
          ),
          -1,
        ),
      );
      look.set(
        withRepeat(
          withSequence(
            withDelay(m.beeLookHold, withTiming(1, { duration: m.beeLook, easing: m.easing.calm })),
            withDelay(m.beeLookHold, withTiming(-1, { duration: m.beeLook, easing: m.easing.calm })),
            withDelay(m.beeLookHold, withTiming(0, { duration: m.beeLook, easing: m.easing.calm })),
          ),
          -1,
        ),
      );
      return () => {
        cancelAnimation(flutter);
        cancelAnimation(blink);
        cancelAnimation(look);
        flutter.set(0);
        blink.set(0);
        look.set(0);
      };
    }, [animated, reduced, flutter, blink, look, m]),
  );
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/components/BeeMascot.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/BeeMascot.tsx
git commit -m "fix(bee): pause BeeMascot micro-life loops when off-screen"
```

---

### Task 10: Focus-gate the WhenbeeAvatar float + wobble (bucket B)

**Files:**
- Modify: `src/features/whenbee/WhenbeeAvatar.tsx:130-157`

**Interfaces:**
- Consumes: `useAmbientMotion` (Task 3).

The one-shot mount lift (`appear` spring) stays in its own effect; only the `bob` and `wobble` infinite loops become ambient.

- [ ] **Step 1: Add imports**

Add `cancelAnimation` to the reanimated import, plus:

```tsx
import { useCallback } from 'react';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
```

- [ ] **Step 2: Reduce the existing effect to the mount lift only**

Replace the `useEffect` at lines 130-157 with:

```tsx
  useEffect(() => {
    if (reducedMotion) return;
    // Mount lift: spring up + fade in (Playful, a touch of overshoot → joy).
    appear.set(withSpring(1, t.motion.spring));
  }, [reducedMotion, appear, t.motion.spring]);
```

- [ ] **Step 3: Add the focus-gated float + wobble loops**

Immediately after, add:

```tsx
  useAmbientMotion(
    !reducedMotion,
    useCallback(() => {
      bob.set(
        withDelay(
          t.motion.reveal,
          withRepeat(withTiming(1, { duration: t.motion.float, easing: t.motion.easing.calm }), -1, true),
        ),
      );
      if (curious) {
        wobble.set(
          withRepeat(withTiming(1, { duration: t.motion.float, easing: t.motion.easing.calm }), -1, true),
        );
      }
      return () => {
        cancelAnimation(bob);
        cancelAnimation(wobble);
        bob.set(0);
        wobble.set(0);
      };
    }, [reducedMotion, curious, bob, wobble, t.motion.reveal, t.motion.float, t.motion.easing.calm]),
  );
```

- [ ] **Step 4: Typecheck + lint + tests**

Run: `npm run typecheck && npx eslint src/features/whenbee/WhenbeeAvatar.tsx && npx jest src/features/whenbee`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/whenbee/WhenbeeAvatar.tsx
git commit -m "fix(whenbee): pause companion float and wobble when off-screen"
```

---

### Task 11: Focus-gate the HoneyTrail "you are here" halo (bucket B)

**Files:**
- Modify: `src/components/HoneyTrail.tsx:61-67` (inside the `Node` sub-component)

**Interfaces:**
- Consumes: `useAmbientMotion` (Task 3).

- [ ] **Step 1: Add imports**

Add `cancelAnimation` to the reanimated import, plus:

```tsx
import { useCallback } from 'react';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
```

- [ ] **Step 2: Replace the pulse useEffect**

Replace lines 62-67 (the `useEffect` starting the halo pulse) with:

```tsx
  useAmbientMotion(
    state === 'now' && lively && !reduced,
    useCallback(() => {
      pulse.set(
        withRepeat(withTiming(1, { duration: t.motion.halo, easing: t.motion.easing.calm }), -1, false),
      );
      return () => {
        cancelAnimation(pulse);
        pulse.set(0);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, lively, reduced, pulse, t.motion]),
  );
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/components/HoneyTrail.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/HoneyTrail.tsx
git commit -m "fix(onboarding): pause the honey-trail halo when off-screen"
```

---

### Task 12: Focus-gate the ProUpsellCard crest + shimmer (bucket B)

**Files:**
- Modify: `src/components/ProUpsellCard.tsx:93-118`

**Interfaces:**
- Consumes: `useAmbientMotion` (Task 3).

- [ ] **Step 1: Add imports**

Add `cancelAnimation` to the reanimated import, plus:

```tsx
import { useCallback } from 'react';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
```

- [ ] **Step 2: Replace the loops useEffect**

Replace lines 93-118 with:

```tsx
  useAmbientMotion(
    !reducedMotion,
    useCallback(() => {
      crestScale.set(
        withRepeat(
          withSequence(
            withTiming(1.07, { duration: 1800, easing: t.motion.easing.calm }),
            withTiming(1.0, { duration: 1800, easing: t.motion.easing.calm }),
          ),
          -1,
          false,
        ),
      );
      shimmerX.set(
        withRepeat(
          withSequence(
            withTiming(400, { duration: 700, easing: t.motion.easing.out }),
            withDelay(4500, withTiming(-320, { duration: 0 })),
          ),
          -1,
          false,
        ),
      );
      return () => {
        cancelAnimation(crestScale);
        cancelAnimation(shimmerX);
        crestScale.set(1);
        shimmerX.set(-320);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reducedMotion]),
  );
```

> The `1800`, `400`, `700`, `4500`, `-320` literals are pre-existing in this file and out of scope for this plan — copy them verbatim. (Flag for a separate tokens cleanup later.)

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/components/ProUpsellCard.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProUpsellCard.tsx
git commit -m "fix(pro): pause the upsell-card crest and shimmer when off-screen"
```

---

### Task 13: Focus-gate the onboarding glyphs — BeeGlyph + LockGlyph (bucket B)

**Files:**
- Modify: `src/components/BeeGlyph.tsx:54-66`
- Modify: `src/components/LockGlyph.tsx:39-51`

**Interfaces:**
- Consumes: `useAmbientMotion` (Task 3).

- [ ] **Step 1: BeeGlyph — add imports**

Add `cancelAnimation` to the reanimated import, plus:

```tsx
import { useCallback } from 'react';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
```

- [ ] **Step 2: BeeGlyph — replace the flap useEffect**

Replace lines 54-66 with:

```tsx
  useAmbientMotion(
    Boolean(animated) && !reduced,
    useCallback(() => {
      flap.set(
        withRepeat(
          withTiming(1, { duration: t.motion.honeyFill, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
      return () => {
        cancelAnimation(flap);
        flap.set(0);
      };
    }, [animated, reduced, flap, t.motion.honeyFill]),
  );
```

- [ ] **Step 3: LockGlyph — add imports**

Add `cancelAnimation` to the reanimated import, plus:

```tsx
import { useCallback } from 'react';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
```

- [ ] **Step 4: LockGlyph — replace the open useEffect**

Replace lines 39-51 with:

```tsx
  useAmbientMotion(
    !reduced,
    useCallback(() => {
      open.set(
        withRepeat(
          withTiming(1, { duration: t.motion.honeyFill, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
      return () => {
        cancelAnimation(open);
        open.set(0);
      };
    }, [reduced, open, t.motion.honeyFill]),
  );
```

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/components/BeeGlyph.tsx src/components/LockGlyph.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/BeeGlyph.tsx src/components/LockGlyph.tsx
git commit -m "fix(onboarding): pause bee and lock glyph loops when off-screen"
```

---

### Task 14: Focus-gate the reward burst — RayBurst + CoinBadge + ReasonGlyph (bucket B)

**Files:**
- Modify: `src/components/bee/RayBurst.tsx:67-70`
- Modify: `src/components/bee/CoinBadge.tsx:50-65`
- Modify: `src/features/reward/ReasonGlyph.tsx:64-73`

**Interfaces:**
- Consumes: `useAmbientMotion` (Task 3).

These render inside the reward modal (focused while shown), so this is mostly consistency + stops a loop surviving a lingering modal. Same pattern.

- [ ] **Step 1: RayBurst — convert the spin**

Add `cancelAnimation` to the reanimated import and `import { useCallback } from 'react';` + `import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';`. Replace lines 67-70 with:

```tsx
  useAmbientMotion(
    !reducedMotion,
    useCallback(() => {
      spin.set(withRepeat(withTiming(360, { duration: t.motion.drift, easing: Easing.linear }), -1, false));
      return () => {
        cancelAnimation(spin);
        spin.set(0);
      };
    }, [reducedMotion, spin, t.motion.drift]),
  );
```

- [ ] **Step 2: CoinBadge — split mount-pop from ambient bob**

Add the same imports. Replace lines 50-65 with:

```tsx
  useEffect(() => {
    if (reducedMotion) return;
    // Pop-in: scale + opacity settle with a touch of overshoot (Playful).
    appear.set(withSpring(1, t.motion.spring));
  }, [reducedMotion, appear, t.motion.spring]);

  useAmbientMotion(
    !reducedMotion,
    useCallback(() => {
      bob.set(
        withDelay(
          t.motion.reveal + delay,
          withRepeat(
            withTiming(1, { duration: t.motion.float, easing: t.motion.easing.calm }),
            -1,
            true,
          ),
        ),
      );
      return () => {
        cancelAnimation(bob);
        bob.set(0);
      };
    }, [reducedMotion, bob, t.motion.reveal, t.motion.float, t.motion.easing.calm, delay]),
  );
```

- [ ] **Step 3: ReasonGlyph — convert the glide**

Add the same imports. Replace lines 64-73 with:

```tsx
  useAmbientMotion(
    arrowAmbient,
    useCallback(() => {
      glide.set(0); // begin tucked at the doorway
      glide.set(
        withRepeat(withTiming(1, { duration: GLIDE_MS, easing: Easing.inOut(Easing.sin) }), -1, true),
      );
      return () => {
        cancelAnimation(glide);
        glide.set(1);
      };
    }, [arrowAmbient, glide]),
  );
```

- [ ] **Step 4: Typecheck + lint + tests**

Run: `npm run typecheck && npx eslint src/components/bee/RayBurst.tsx src/components/bee/CoinBadge.tsx src/features/reward/ReasonGlyph.tsx && npx jest src/features/reward`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/bee/RayBurst.tsx src/components/bee/CoinBadge.tsx src/features/reward/ReasonGlyph.tsx
git commit -m "fix(reward): focus-gate ray-burst, coin-bob and reason-glyph loops"
```

---

### Task 15: Focus-gate + modernise the timer live dot (bucket B)

**Files:**
- Modify: `src/app/(modals)/timer.tsx:75-88`

**Interfaces:**
- Consumes: `useAmbientMotion` (Task 3).

This screen uses the legacy `.value` API; modernise to `.set()/.get()` per repo convention while converting.

- [ ] **Step 1: Add imports**

Add `cancelAnimation` to the reanimated import, plus `import { useCallback } from 'react';` and `import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';`.

- [ ] **Step 2: Replace the pulse useEffect and the style**

Replace lines 77-88 with:

```tsx
  useAmbientMotion(
    !reducedMotion,
    useCallback(() => {
      pulse.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: t.motion.pulse }),
            withTiming(0.4, { duration: t.motion.pulse }),
          ),
          -1,
          false,
        ),
      );
      return () => {
        cancelAnimation(pulse);
        pulse.set(1);
      };
    }, [reducedMotion, pulse, t.motion.pulse]),
  );
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));
```

- [ ] **Step 3: Typecheck + lint + tests**

Run: `npm run typecheck && npx eslint "src/app/(modals)/timer.tsx" && npx jest "src/app"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(modals)/timer.tsx"
git commit -m "fix(timer): focus-gate the live dot and use the .set() shared-value API"
```

---

### Task 16: Focus-gate the RailNode halo (bucket B)

**Files:**
- Modify: `src/features/planner/RailNode.tsx:50-72`

**Interfaces:**
- Consumes: `useAmbientMotion` (Task 3).

This effect already cancels correctly; convert it to the shared hook so it also pauses off-focus, matching every other loop.

- [ ] **Step 1: Add imports**

Add `import { useCallback } from 'react';` and `import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';`. (`cancelAnimation` is already imported on line 4.)

- [ ] **Step 2: Replace the pulse useEffect**

Replace the `useEffect` at lines 50-72 with:

```tsx
  useAmbientMotion(
    state === 'now' && !reducedMotion,
    useCallback(() => {
      cancelAnimation(haloScale);
      haloScale.set(
        withRepeat(
          withTiming(1.6, { duration: t.motion.halo, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
      return () => {
        cancelAnimation(haloScale);
        haloScale.set(1);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, reducedMotion]),
  );
```

- [ ] **Step 3: Typecheck + lint + tests**

Run: `npm run typecheck && npx eslint src/features/planner/RailNode.tsx && npx jest src/features/planner`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/planner/RailNode.tsx
git commit -m "fix(planner): pause the rail-node halo when off-screen"
```

---

### Task 17: Full-suite verification + PR

**Files:** none (verification + delivery).

- [ ] **Step 1: Full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green, zero warnings.

- [ ] **Step 2: Device smoke (manual, per CLAUDE.md device flow)**

Verify on the simulator/device:
- Log a task via the timer, dismiss the reward modal, land on **Today** → the "Today's honey set ✦" seal plays *now*, not already-done.
- Switch to the **Whenbee** tab after crossing a tier → the honey ring grows on arrival.
- Leave the Today tab while a timer runs → return → the NOW dot resumes (not frozen mid-pulse).

- [ ] **Step 3: Open the PR (never merge)**

Push the branch and open a PR for founder review. Do not merge.

```bash
git push -u origin <branch>
gh pr create --title "fix(animations): focus-gate ambient loops and defer celebrations" --body "<summary + the device-smoke checklist above>"
```

---

## Self-Review

**Spec coverage:**
- Hook 1 `useFocusedValue` → Task 2. ✓
- Hook 2 `useAmbientMotion` → Task 3. ✓ (plus the `useIsScreenFocused` dependency the spec implied but didn't name → Task 1.)
- Bucket A (HoneyRing growth + seal, Honeycomb, RitualSeal seal, stage) → Tasks 4, 5, 6. ✓ Note: the spec listed "WhenbeeAvatar stage-lift" under bucket A; the audit found no dedicated stage-up *transition* animation, so Task 5 gates the `stage` value (so float amplitude updates on focus) and Task 10 handles its loops — there is no missed celebration to replay. Documented here rather than inventing an animation.
- Bucket B (all listed loops) → Tasks 7-16. ✓
- Bucket C (entering= chips, trail enter) → intentionally untouched per spec. ✓

**Placeholder scan:** No TBD/TODO. The one "if cells is inlined" branch in Task 6 gives the exact extraction step. The pre-existing magic numbers in ProUpsellCard are copied verbatim with an explicit out-of-scope note.

**Type consistency:** `useIsScreenFocused(): boolean`, `useFocusedValue<T>(value: T): T`, `useAmbientMotion(active: boolean, run: () => () => void): void` are used identically across all consuming tasks. `run` always returns a canceller; every consumer's canceller calls `cancelAnimation` then resets to the documented rest value.

**Open verification carried into execution:** confirmed during planning that `expo-router` exports `useFocusEffect` + `useNavigation` (not `useIsFocused`) — Task 1 builds the focus boolean from `useNavigation`, so no transitive `@react-navigation` import is needed.
