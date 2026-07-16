# Onboarding Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the onboarding quiz actually drive the honest number — every answer does real work, no path can leave the app uncalibrated — and fix the app-wide disabled-button treatment.

**Architecture:** The quiz already computes `m0` (`seedMultiplierFor`) and writes it to `settingsStore.archetypeSeed`; today only the Patterns card label reads it. We add a pure engine function `seededPriorFor(categoryId, seed)` that personalizes the population prior while a category is cold, and thread `archetypeSeed` into the honest-number call sites. `sink` becomes a per-category bump inside that function (the named area gets extra weight, so two archetypes diverge per-category, not just globally). `focus` becomes a *stated* pre-data focus block — surfaced as stated, never injected as evidence into `focusWindowLearn`'s confidence gates. The skip button is removed (quiz mandatory), with a default-category floor in `complete()` as belt-and-braces.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React Native 0.81 / Expo SDK 54, expo-router 6, Zustand, Jest.

## Global Constraints

- **Product invariants (never violate):** No guilt, ever — amber never becomes red, no streaks, no shame mechanics. Honey/sharpness is monotonic — tier never goes backward. Core loop is on-device-only — no network call in guess → timer → learn. Pricing is read from RevenueCat, never hardcoded.
- **TDD is required for all logic-layer code** (engine, db, stores, services, `src/lib/*`). Write the failing test first.
- **`src/engine/` is PURE TypeScript** — no React, RN, Expo, no `Date.now()`, no `Math.random()`.
- **Every spacing/size/font/color value MUST come from a token** in `src/theme/tokens.ts` via `useTheme()`. If a needed value doesn't exist, add it to `tokens.ts` — never inline a raw number or hex.
- **Light and dark palettes share identical key order** in `tokens.ts`. Any key added to one must be added to the other, in the same position.
- **Layer rule (ESLint-enforced):** `src/app/**` and `src/components/**` must not import `@/src/services/*` or `@/src/db/*`. Route through a store, provider, or feature hook.
- **Conventional Commits. NEVER add `Co-Authored-By` or any AI-attribution trailer** (project policy).
- **Run before every commit:** `npm run lint` (0 warnings), `npm run typecheck`, `npm test`.
- **User-facing copy** must pass `conversion-psychology` + `humanizer` — no guilt/shame language, no AI-slop tells.
- **Explicitly OUT of scope** (founder decision, 2026-07-15): the `flex:1` dead-space layout change (CTA stays pinned bottom, near the thumb) and the `Reveal.tsx` `FadeInDown` → `FadeIn` animation change (founder wants the current entrance kept).

---

## File Structure

**Engine (pure):**
- `src/engine/priors.ts` — MODIFY. Add `seededPriorFor(categoryId, seed)`. Owns prior personalization.
- `src/engine/archetypeSeed.ts` — MODIFY. Add `sinkCategoryFor(sink)`. Owns quiz→seed math.
- `src/engine/constants.ts` — MODIFY. Add `ARCHETYPE_SEED_SINK_BUMP`, `POPULATION_MEAN_M`.
- `src/engine/index.ts` — MODIFY. Re-export the new symbols.
- `src/domain/types.ts` — MODIFY. Add `ArchetypeSeed` type (the contract).

**Theme:**
- `src/theme/tokens.ts` — MODIFY. Add `controlDisabled` / `onControlDisabled` / `controlDisabledEdge` to both palettes.
- `src/components/AppButton.tsx` — MODIFY. Disabled = inert face, not dimmed label.

**Onboarding:**
- `src/features/onboarding/QuizStepScreen.tsx` — MODIFY. Remove skip; add radiogroup a11y.
- `src/features/onboarding/quizQuestions.ts` — MODIFY. Rename the `meetings` option to map to a real category.
- `src/features/onboarding/useOnboarding.ts` — MODIFY. Category floor in `complete()`.
- `src/features/onboarding/usePersonalize.ts` — MODIFY. Move `quiz_completed` capture out.
- `src/features/onboarding/categories.ts` — MODIFY. Add `DEFAULT_CATEGORY_IDS`, `sinkPreselect`.
- `src/features/onboarding/StepProgress.tsx` — MODIFY. `accessibilityValue`; kill the stale `total = 3`.
- `src/features/onboarding/QuizOption.tsx` — MODIFY. `role="radio"`.
- `src/app/(onboarding)/categories.tsx` — MODIFY. Preselect from `sink`; Settings hint copy; inline error.
- `src/app/(onboarding)/ready.tsx` — MODIFY. First-run handoff; double-tap guard.
- `src/app/(onboarding)/welcome.tsx` / `reveal.tsx` — MODIFY. Double-tap guard.

**Honest-number call sites (thread the seed):**
- `src/features/add-task/useAddTask.ts:168`, `src/features/today/useToday.ts:102`, `src/features/today/useDayPlan.ts:98`, `src/features/today/useDayCapacity.ts:66`, `src/features/planner/resolveHonestTasks.ts:69`, `src/features/quick-tasks/useQuickTasks.ts:36`, `src/stores/calibrationStore.ts:1250`.

**Focus (stated block):**
- `src/features/planner/statedFocusBlock.ts` — CREATE. Maps `focus` → a stated coarse block. Pure.

**Shared:**
- `src/lib/useOnce.ts` — CREATE. The double-tap / fire-once guard.

---

### Task 1: Disabled-control tokens

**Files:**
- Modify: `src/theme/tokens.ts` (dark palette ~`:346`, light palette ~`:262`)
- Test: `src/theme/__tests__/tokens.test.ts`

**Interfaces:**
- Produces: `t.colors.controlDisabled: string`, `t.colors.onControlDisabled: string`, `t.colors.controlDisabledEdge: string` — consumed by Task 2.

Measured contrast (computed, not estimated):

| Mode | Face | Label | Ratio |
|---|---|---|---|
| dark | `#292B3C` | `rgba(244,241,234,0.40)` | **3.28:1** |
| light | `#E9E4F6` | `#6E7183` | **3.88:1** |

Face-vs-page separation is low in both (dark 1.3:1, light 1.12:1), so the disabled pill also needs a hairline border to hold its shape — that's `controlDisabledEdge`.

- [ ] **Step 1: Write the failing test**

```ts
// src/theme/__tests__/tokens.test.ts
import { tokens } from '../tokens';

describe('disabled control tokens', () => {
  it('exposes a disabled face, ink, and edge in both palettes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const c = tokens.colors[mode];
      expect(typeof c.controlDisabled).toBe('string');
      expect(typeof c.onControlDisabled).toBe('string');
      expect(typeof c.controlDisabledEdge).toBe('string');
    }
  });

  it('never reuses the live primary as the disabled face', () => {
    for (const mode of ['light', 'dark'] as const) {
      const c = tokens.colors[mode];
      expect(c.controlDisabled).not.toBe(c.primary);
    }
  });

  it('keeps light and dark key order identical', () => {
    expect(Object.keys(tokens.colors.light)).toEqual(Object.keys(tokens.colors.dark));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/tokens.test.ts -t "disabled control tokens"`
Expected: FAIL — `expect(typeof undefined).toBe('string')`

- [ ] **Step 3: Add the tokens to BOTH palettes, same position**

In the **dark** palette, immediately after the `onIndigo` line:

```ts
      onIndigo: '#14151D', // dark text on the lighter dark-mode indigo (AA)
      // ── disabled controls ──
      // A disabled pill mutes its FACE, never its label: onIndigo is a DARK ink,
      // so dimming it toward the bright indigo makes it sink into the fill
      // (1.92:1) instead of greying out. Inert face + legible label = 3.28:1.
      controlDisabled: '#292B3C', // = surfaceRaised — visibly inert, not the live indigo
      onControlDisabled: 'rgba(244,241,234,0.40)', // = inkFaint — 3.28:1 on controlDisabled
      controlDisabledEdge: 'rgba(255,255,255,0.08)', // = hairline — the face is only 1.3:1 off bg
      onAmber: '#20233A',
```

In the **light** palette, at the identical position (immediately after its `onIndigo` line):

```ts
      onIndigo: '#FFFFFF',
      // ── disabled controls ── (see the dark palette for the rationale)
      controlDisabled: '#E9E4F6', // inert lavender-grey — reads off white AND off the cream bg
      onControlDisabled: '#6E7183', // 3.88:1 on controlDisabled
      controlDisabledEdge: '#DAD5C9', // = hairline
      onAmber: '#20233A',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/tokens.test.ts -t "disabled control tokens"`
Expected: PASS (3 tests)

- [ ] **Step 5: Verify `useTheme` exposes them**

Run: `npx tsc --noEmit`
Expected: no errors. (`colors` is an existing group resolved wholesale by `resolveTheme` — new *keys* need no `useTheme` change; a new *group* would. If `t.colors.controlDisabled` is `undefined` at runtime, check `resolveTheme` in `src/theme/useTheme.ts`.)

- [ ] **Step 6: Commit**

```bash
git add src/theme/tokens.ts src/theme/__tests__/tokens.test.ts
git commit -m "feat(theme): add disabled-control face/ink/edge tokens"
```

---

### Task 2: AppButton — disabled is an inert pill, app-wide

**Files:**
- Modify: `src/components/AppButton.tsx:100-118` (the `bg`/`fg`/`edge` maps), `:200-220` (the content `opacity`)
- Test: `src/components/__tests__/AppButton.test.tsx`

**Interfaces:**
- Consumes: `t.colors.controlDisabled`, `t.colors.onControlDisabled`, `t.colors.controlDisabledEdge` (Task 1).
- Produces: every `<AppButton disabled>` in the app renders the inert treatment. No API change.

This is the single highest-leverage fix: `AppButton` is the shared primitive, so one change fixes **every** disabled button in the app — onboarding, `add-task.tsx`, `settings.tsx`, `retro.tsx`, `categories.tsx`, `Paywall.tsx`, `ReportBuilder.tsx`, `RoutineBuildView.tsx`, `StepEditorSheet.tsx`, `FocusWindowEditorSheet.tsx`, `HonestDayPreview.tsx`, `FounderReserveCard.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/__tests__/AppButton.test.tsx
import { render } from '@testing-library/react-native';
import { AppButton } from '../AppButton';
import { tokens } from '@/src/theme/tokens';

const faceOf = (tree: ReturnType<typeof render>) =>
  tree.getByTestId('appbutton-face').props.style;
const flat = (s: unknown): Record<string, unknown> =>
  Object.assign({}, ...[s].flat(Infinity).filter(Boolean) as object[]);

describe('AppButton disabled treatment', () => {
  it('mutes the FACE to the disabled token, not the live primary', () => {
    const tree = render(<AppButton label="Next" variant="indigo" disabled onPress={() => {}} />);
    expect(flat(faceOf(tree)).backgroundColor).toBe(tokens.colors.dark.controlDisabled);
  });

  it('keeps the label at full opacity (the face carries the disabled signal)', () => {
    const tree = render(<AppButton label="Next" variant="indigo" disabled onPress={() => {}} />);
    expect(flat(tree.getByTestId('appbutton-content').props.style).opacity).toBe(1);
  });

  it('uses the live primary face when enabled', () => {
    const tree = render(<AppButton label="Next" variant="indigo" onPress={() => {}} />);
    expect(flat(faceOf(tree)).backgroundColor).toBe(tokens.colors.dark.primary);
  });

  it('still marks itself disabled to assistive tech', () => {
    const tree = render(<AppButton label="Next" disabled onPress={() => {}} />);
    expect(tree.getByRole('button').props.accessibilityState).toEqual({ disabled: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/AppButton.test.tsx -t "disabled treatment"`
Expected: FAIL — no `appbutton-face` testID; `backgroundColor` is `#8275F0`.

- [ ] **Step 3: Resolve the disabled face/ink/edge**

Replace the `bg` / `fg` / `edge` maps at `AppButton.tsx:100-118`:

```tsx
  const bg: Record<NewVariant, string> = {
    indigo: t.colors.primary,
    amber: t.colors.accent,
    ghost: tone === 'sunken' ? t.colors.surfaceSunken : t.colors.surface,
    danger: t.colors.danger,
  };
  const fg: Record<NewVariant, string> = {
    indigo: t.colors.onIndigo,
    amber: t.colors.onAmber,
    ghost: t.colors.ink,
    danger: t.colors.onIndigo,   // was '#FFFFFF' — hardcoded hex, now a token
  };
  const edge: Record<NewVariant, string> = {
    indigo: t.colors.primaryEdge,
    amber: t.colors.accentEdge,
    ghost: 'transparent',
    danger: t.colors.dangerEdge,
  };

  // A disabled control mutes its FACE, never its label. onIndigo/onAmber are DARK
  // inks — fading them toward a bright fill makes them sink in (1.92:1) rather
  // than grey out. Inert face + full-opacity label reads as 3.28:1 and is
  // unmistakably not the live control.
  const faceColor  = disabled ? t.colors.controlDisabled      : bg[resolved];
  const labelColor = disabled ? t.colors.onControlDisabled    : fg[resolved];
  const edgeColor  = disabled ? t.colors.controlDisabledEdge  : edge[resolved];
```

- [ ] **Step 4: Apply them and drop the blanket opacity**

In `pillContainer`, swap the face and comment:

```tsx
  const pillContainer: ViewStyle = {
    height: PILL_H,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: faceColor,
    // Disabled mutes the FACE (see faceColor above). Never put opacity on the
    // face or wrapper: it composites the whole pill and the edge stops reading
    // as an edge.
    // Android drops the corner clip on press-layer promotion, squaring the pill.
    // overflow:hidden pins the rounded clip. (Edge is a sibling, not clipped.)
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: padX,
    // The disabled face sits only ~1.3:1 off the page — a hairline holds its shape.
    ...(isGhost || disabled
      ? { borderWidth: t.borderWidth.hairline, borderColor: disabled ? edgeColor : t.colors.border }
      : null),
  };
```

Then the render body — add the testIDs and remove the content dim:

```tsx
      {/* Solid colored depth edge behind FILLED pills only. A disabled pill is
          flat: it is not a live coin, so it gets no raised edge. */}
      {isGhost || disabled ? null : <View style={edgeBase} />}

      <Animated.View testID="appbutton-face" style={[pillContainer, pillStyle]}>
        <View
          testID="appbutton-content"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space[2],
            opacity: 1,
          }}
        >
          {icon ?? null}
          <AppText
            style={{
              fontSize: labelSize,
              fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
              color: labelColor,
```

Also update `edgeBase`'s color to use `edgeColor`, and the stale comment at `:171-175` is now replaced by the block above.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/components/__tests__/AppButton.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Verify no other component hand-rolls a disabled pill**

Run: `grep -rn "opacity.disabled" src/ --include="*.tsx" --include="*.ts" | grep -v __tests__`
Expected: no remaining hits that style a *button face*. `t.opacity.disabled` may legitimately remain on non-button elements (dimmed rows, inert glyphs) — leave those. If a hit styles a pressable pill's fill, port it to the `faceColor` pattern above and note it in the commit body.

- [ ] **Step 7: Screenshot-verify on the simulator**

```bash
xcrun simctl openurl booted "whenbee:///(onboarding)/quiz/0"
sleep 3
xcrun simctl io booted screenshot /tmp/disabled-fix.png
```

Expected: "Next →" renders as a **flat dark-grey pill with a hairline border and a legible label** — visibly inert, unmistakably not the live indigo. Look at it. If it still reads as a live button, stop and fix before committing.

- [ ] **Step 8: Full suite + lint**

Run: `npx eslint src/components/AppButton.tsx && npm run typecheck && npm test`
Expected: 0 warnings, 0 type errors, all tests pass. `AppButton` is used app-wide — a snapshot elsewhere may need updating. Update it only if the new output is correct.

- [ ] **Step 9: Commit**

```bash
git add src/components/AppButton.tsx src/components/__tests__/AppButton.test.tsx
git commit -m "fix(ui): disabled buttons mute the face, not the label

The disabled pill kept a 100%-opaque indigo face and dimmed only its
label. Because onIndigo is a dark ink, dimming it toward bright indigo
made it sink into the fill: 1.92:1 in dark mode. It read as a live
button that ignored taps.

Disabled now resolves an inert face (controlDisabled) with a
full-opacity label (onControlDisabled) at 3.28:1, plus a hairline and
no raised coin edge. Applies to every AppButton in the app."
```

---

### Task 3: A disabled CTA says why

**Files:**
- Modify: `src/features/onboarding/QuizStepScreen.tsx:141-149`, `src/app/(onboarding)/categories.tsx:151-165`
- Test: `src/features/onboarding/__tests__/QuizStepScreen.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed downstream.

Today the one state where the CTA is disabled is the one state with zero guidance: `categories.tsx:152` renders its helper card only when `picked.length > 0`.

Copy (shaped by `conversion-psychology` + `humanizer` — plain, no guilt, no exclamation, matches the "no right answer here" register already on the screen):
- Quiz: **"Pick one to continue"**
- Categories: **"Pick at least one to continue"**

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/onboarding/__tests__/QuizStepScreen.test.tsx
it('tells the user why Next is disabled, and stops once they answer', () => {
  const tree = render(<QuizStepScreen step={0} />);
  expect(tree.getByText('Pick one to continue')).toBeTruthy();

  fireEvent.press(tree.getByText('About right'));
  expect(tree.queryByText('Pick one to continue')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/onboarding/__tests__/QuizStepScreen.test.tsx -t "why Next is disabled"`
Expected: FAIL — "Unable to find an element with text: Pick one to continue"

- [ ] **Step 3: Add the reason line above the quiz CTA**

In `QuizStepScreen.tsx`, immediately before the `<AppButton label="Next →" …>`:

```tsx
      {answer === undefined ? (
        <AppText
          style={{
            fontSize: t.fontSize.sm,
            color: t.colors.inkFaint,
            textAlign: 'center',
            marginBottom: t.space[2],
          }}
        >
          Pick one to continue
        </AppText>
      ) : null}
```

- [ ] **Step 4: Add the reason line above the categories CTA**

In `src/app/(onboarding)/categories.tsx`, immediately before the `<AppButton label="Continue →" …>`:

```tsx
      {picked.length === 0 ? (
        <AppText
          style={{
            fontSize: t.fontSize.sm,
            color: t.colors.inkFaint,
            textAlign: 'center',
            marginBottom: t.space[2],
          }}
        >
          Pick at least one to continue
        </AppText>
      ) : null}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/features/onboarding/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/onboarding/QuizStepScreen.tsx src/app/\(onboarding\)/categories.tsx src/features/onboarding/__tests__/QuizStepScreen.test.tsx
git commit -m "feat(onboarding): say why the CTA is disabled"
```

---

### Task 4: `seededPriorFor` — the quiz reaches the honest number

**Files:**
- Modify: `src/engine/constants.ts:114-118`, `src/engine/priors.ts`, `src/domain/types.ts`, `src/engine/index.ts`
- Test: `src/engine/__tests__/priors.test.ts`

**Interfaces:**
- Consumes: `CATEGORY_PRIORS`, `priorFor`, `RATIO_CEIL` (existing).
- Produces:
  - `type ArchetypeSeed = { m0: number; sink?: SinkAnswer; source: 'quiz'; tookAt: number }` (in `src/domain/types.ts`)
  - `seededPriorFor(categoryId: string, seed: ArchetypeSeed | undefined): number` (in `src/engine/priors.ts`)
  - `POPULATION_MEAN_M: number`, `ARCHETYPE_SEED_SINK_BUMP: number` (in `src/engine/constants.ts`)
  - `sinkCategoryFor(sink: SinkAnswer): string` (in `src/engine/archetypeSeed.ts`, Task 5)

**Why this shape:** `m0` is a whole-person read; the category prior carries the shape (cooking 1.5 vs creative 2.4). So we **scale** the category prior by how far the person sits from the population mean — we never replace it. `GLOBAL_PRIOR = 1.8` is the existing population fallback, so it is the honest mean to divide by.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/priors.test.ts
import { seededPriorFor, priorFor } from '../priors';
import { RATIO_CEIL } from '../constants';

const seed = (m0: number, sink?: 'meetings' | 'chores' | 'errands' | 'deepwork') =>
  ({ m0, sink, source: 'quiz' as const, tookAt: 0 });

describe('seededPriorFor', () => {
  it('falls back to the population prior with no seed (the pre-quiz path)', () => {
    expect(seededPriorFor('admin', undefined)).toBe(priorFor('admin'));
  });

  it('separates a Dreamer from a Steady Reader on the same category', () => {
    const dreamer = seededPriorFor('admin', seed(3.0));
    const steady = seededPriorFor('admin', seed(1.15));
    expect(dreamer).toBeGreaterThan(steady);
  });

  it('keeps the category shape — a Dreamer still expects cooking to be faster than creative', () => {
    const s = seed(3.0);
    expect(seededPriorFor('cooking', s)).toBeLessThan(seededPriorFor('creative', s));
  });

  it('leaves an average person on the population prior', () => {
    // m0 === GLOBAL_PRIOR (1.8) → the scale factor is 1
    expect(seededPriorFor('admin', seed(1.8))).toBeCloseTo(priorFor('admin'), 5);
  });

  it('never exceeds the ratio ceiling', () => {
    expect(seededPriorFor('creative', seed(6.0))).toBeLessThanOrEqual(RATIO_CEIL);
  });

  it('never returns a non-positive multiplier', () => {
    expect(seededPriorFor('calls', seed(0.1))).toBeGreaterThan(0);
  });

  it('bumps the category the user named as their time sink', () => {
    const withSink = seededPriorFor('cleaning', seed(2.1, 'chores'));
    const without = seededPriorFor('cleaning', seed(2.1));
    expect(withSink).toBeGreaterThan(without);
  });

  it('bumps ONLY the named sink category', () => {
    const s = seed(2.1, 'chores');
    expect(seededPriorFor('cooking', s)).toBe(seededPriorFor('cooking', seed(2.1)));
  });

  it('is pure — same inputs, same output', () => {
    expect(seededPriorFor('admin', seed(2.4, 'deepwork'))).toBe(seededPriorFor('admin', seed(2.4, 'deepwork')));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/priors.test.ts`
Expected: FAIL — `seededPriorFor is not a function`

- [ ] **Step 3: Add the constants**

In `src/engine/constants.ts`, after `ARCHETYPE_SEED_PSEUDO`:

```ts
/** The population's average multiplier — the point where a quiz seed neither
 *  stretches nor shrinks a category prior. Equal to GLOBAL_PRIOR by definition:
 *  that IS our population fallback. */
export const POPULATION_MEAN_M = GLOBAL_PRIOR;
/** Q3 'where does time run away' — the named category gets this extra weight.
 *  Deliberately gentle: it is a self-report, not a measurement. */
export const ARCHETYPE_SEED_SINK_BUMP = 1.12;
```

- [ ] **Step 4: Add the type to the domain contract**

In `src/domain/types.ts`:

```ts
/** A self-reported read from the onboarding quiz. Anchors a cold category's
 *  prior until real logs outweigh it. Never a measurement — always decays out. */
export type SinkAnswer = 'meetings' | 'chores' | 'errands' | 'deepwork';
export type ArchetypeSeed = {
  m0: number;
  /** Q3's answer — bumps only the mapped category. */
  sink?: SinkAnswer;
  source: 'quiz';
  tookAt: number;
};
```

- [ ] **Step 5: Write the implementation**

In `src/engine/priors.ts`:

```ts
import { GLOBAL_PRIOR, POPULATION_MEAN_M, ARCHETYPE_SEED_SINK_BUMP, RATIO_CEIL } from './constants';
import { sinkCategoryFor } from './archetypeSeed';
import type { ArchetypeSeed } from '@/src/domain/types';

/**
 * The population prior for `categoryId`, personalized by the quiz seed.
 *
 * m0 is a whole-person read; the category prior carries the shape (cooking is
 * quicker than creative for everyone). So we SCALE the category prior by how
 * far this person sits from the population mean — never replace it. A person at
 * the mean gets exactly priorFor(). The seed is only ever an anchor: as real
 * logs arrive, blendWithPrior() weights them over this and the seed washes out.
 */
export function seededPriorFor(categoryId: string, seed: ArchetypeSeed | undefined): number {
  const prior = priorFor(categoryId);
  if (seed === undefined) return prior;
  const scaled = prior * (seed.m0 / POPULATION_MEAN_M);
  const bumped = seed.sink !== undefined && sinkCategoryFor(seed.sink) === categoryId
    ? scaled * ARCHETYPE_SEED_SINK_BUMP
    : scaled;
  return Math.min(Math.max(bumped, 1 / RATIO_CEIL), RATIO_CEIL);
}
```

- [ ] **Step 6: Export it**

In `src/engine/index.ts`, extend the existing priors export:

```ts
export { priorFor, seededPriorFor, CATEGORY_PRIORS, CATEGORY_NAMES, GLOBAL_PRIOR } from './priors';
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest src/engine/__tests__/priors.test.ts`
Expected: PASS (9 tests). The sink tests will fail until Task 5 lands `sinkCategoryFor` — implement Task 5's Step 3 first if you are doing these out of order.

- [ ] **Step 8: Commit**

```bash
git add src/engine/priors.ts src/engine/constants.ts src/engine/index.ts src/domain/types.ts src/engine/__tests__/priors.test.ts
git commit -m "feat(engine): seededPriorFor — the quiz seed personalizes a cold prior"
```

---

### Task 5: `sink` maps to a real category

**Files:**
- Modify: `src/engine/archetypeSeed.ts`, `src/features/onboarding/quizQuestions.ts:28-70`, `src/features/onboarding/categories.ts`
- Test: `src/engine/__tests__/archetypeSeed.test.ts`

**Interfaces:**
- Consumes: `SinkAnswer` (Task 4).
- Produces: `sinkCategoryFor(sink: SinkAnswer): string` — consumed by Task 4's `seededPriorFor` and Task 8's preselect.

**The mapping.** Real category ids are `getting_ready, cleaning, admin, email, errands, writing, creative, calls, commute, cooking` (`priors.ts:8-19`). Three options map cleanly. "Meetings" has no home — the nearest is `calls` (prior 1.3). Rather than invent a new population prior (the priors are verbatim from `01-FOUNDATION.md §3.5` and are not ours to make up), **relabel the option to match the category it maps to**.

| Answer | Option label | → category | prior |
|---|---|---|---|
| `meetings` | "Calls & meetings" *(was "Meetings")* | `calls` | 1.3 |
| `chores` | "Chores" | `cleaning` | 2.0 |
| `errands` | "Errands" | `errands` | 1.8 |
| `deepwork` | "Deep work" | `creative` | 2.4 |

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/archetypeSeed.test.ts
import { sinkCategoryFor } from '../archetypeSeed';
import { CATEGORY_PRIORS } from '../priors';

describe('sinkCategoryFor', () => {
  it('maps every sink answer to a real, priced category', () => {
    for (const s of ['meetings', 'chores', 'errands', 'deepwork'] as const) {
      expect(CATEGORY_PRIORS[sinkCategoryFor(s)]).toBeDefined();
    }
  });

  it('maps each answer to its intended category', () => {
    expect(sinkCategoryFor('meetings')).toBe('calls');
    expect(sinkCategoryFor('chores')).toBe('cleaning');
    expect(sinkCategoryFor('errands')).toBe('errands');
    expect(sinkCategoryFor('deepwork')).toBe('creative');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/archetypeSeed.test.ts -t "sinkCategoryFor"`
Expected: FAIL — `sinkCategoryFor is not a function`

- [ ] **Step 3: Implement the map**

In `src/engine/archetypeSeed.ts`:

```ts
import type { SinkAnswer } from '@/src/domain/types';

/** Q3's answer → the category it names. Every value MUST exist in
 *  CATEGORY_PRIORS: an unpriced id would silently fall back to GLOBAL_PRIOR and
 *  the bump would land on nothing. The option LABELS are worded to match these
 *  categories — keep them in sync (quizQuestions.ts). */
const SINK_CATEGORY: Record<SinkAnswer, string> = {
  meetings: 'calls',
  chores: 'cleaning',
  errands: 'errands',
  deepwork: 'creative',
};

export function sinkCategoryFor(sink: SinkAnswer): string {
  return SINK_CATEGORY[sink];
}
```

- [ ] **Step 4: Relabel the "Meetings" option**

In `src/features/onboarding/quizQuestions.ts`, in the `sink` question's options, change the `meetings` option's label:

```ts
      { value: 'meetings', label: 'Calls & meetings', glyph: 'sink_meetings' },
```

Leave the `value` and the glyph id alone — only the user-facing label changes.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/engine/__tests__/archetypeSeed.test.ts && npx jest src/engine/__tests__/priors.test.ts`
Expected: PASS — including Task 4's two sink tests.

- [ ] **Step 6: Commit**

```bash
git add src/engine/archetypeSeed.ts src/features/onboarding/quizQuestions.ts src/engine/__tests__/archetypeSeed.test.ts
git commit -m "feat(engine): map the sink answer to a real category"
```

---

### Task 6: Persist `sink` on the seed

**Files:**
- Modify: `src/stores/settingsStore.ts:78`, `src/features/onboarding/usePersonalize.ts:39-46`
- Test: `src/features/onboarding/__tests__/usePersonalize.test.ts`

**Interfaces:**
- Consumes: `ArchetypeSeed` (Task 4), `SinkAnswer` (Task 4).
- Produces: `settingsStore.archetypeSeed` now carries `sink` — read by Task 7.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/onboarding/__tests__/usePersonalize.test.ts
it('persists the sink answer on the seed so the engine can bump that category', () => {
  const { result } = renderHook(() => usePersonalize());
  act(() => {
    result.current.saveQuiz({ pace: 'lot', mid: 'rabbit', sink: 'deepwork', focus: 'morning' });
  });
  expect(useSettingsStore.getState().archetypeSeed).toMatchObject({ sink: 'deepwork', source: 'quiz' });
});

it('omits sink when the question was not answered', () => {
  const { result } = renderHook(() => usePersonalize());
  act(() => { result.current.saveQuiz({ pace: 'lot' }); });
  expect(useSettingsStore.getState().archetypeSeed?.sink).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/onboarding/__tests__/usePersonalize.test.ts -t "sink"`
Expected: FAIL — `sink` is not on the persisted object.

- [ ] **Step 3: Widen the store's type**

In `src/stores/settingsStore.ts:78`, replace the inline shape with the domain type:

```ts
  archetypeSeed?: ArchetypeSeed;
```

and import it: `import type { ArchetypeSeed } from '@/src/domain/types';`

- [ ] **Step 4: Write the sink through**

In `src/features/onboarding/usePersonalize.ts`, in `saveQuiz`:

```ts
    setArchetypeSeed({ m0, sink: answers.sink, source: 'quiz', tookAt: Date.now() });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/features/onboarding/__tests__/usePersonalize.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/stores/settingsStore.ts src/features/onboarding/usePersonalize.ts src/features/onboarding/__tests__/usePersonalize.test.ts
git commit -m "feat(onboarding): persist the sink answer on the archetype seed"
```

---

### Task 7: Thread the seed into every honest-number call site

**Files:**
- Modify: `src/features/add-task/useAddTask.ts:168`, `src/features/today/useToday.ts:102`, `src/features/today/useDayPlan.ts:98`, `src/features/today/useDayCapacity.ts:66`, `src/features/planner/resolveHonestTasks.ts:69`, `src/features/quick-tasks/useQuickTasks.ts:36`, `src/db/repositories/categoryStatsRepo.ts:18`, `src/stores/calibrationStore.ts:1250`
- Test: `src/features/add-task/__tests__/useAddTask.seed.test.ts`

**Interfaces:**
- Consumes: `seededPriorFor` (Task 4), `settingsStore.archetypeSeed` (Task 6).
- Produces: the first honest number differs by archetype. Nothing downstream depends on new names.

**This is the payoff task.** Do `useAddTask` first — it is the decision moment and the one the user sees first.

`resolveHonestTasks.ts` and `categoryStatsRepo.ts` are not hooks; pass the seed in as a parameter rather than reaching into the store (engine/db layers stay pure — see the layer rule).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/add-task/__tests__/useAddTask.seed.test.ts
import { renderHook } from '@testing-library/react-native';
import { useAddTask } from '../useAddTask';
import { useSettingsStore } from '@/src/stores/settingsStore';

const setSeed = (m0: number) =>
  useSettingsStore.setState({ archetypeSeed: { m0, source: 'quiz', tookAt: 0 } });

describe('useAddTask honest suggestion — cold start', () => {
  it('gives a Dreamer a longer first honest number than a Steady Reader', () => {
    setSeed(3.0);
    const { result: dreamer } = renderHook(() => useAddTask());
    act(() => { dreamer.current.setCategory('admin'); dreamer.current.setGuessMin(15); });
    const dreamerHonest = dreamer.current.suggestion!.honestMinutes;

    setSeed(1.15);
    const { result: steady } = renderHook(() => useAddTask());
    act(() => { steady.current.setCategory('admin'); steady.current.setGuessMin(15); });

    expect(dreamerHonest).toBeGreaterThan(steady.current.suggestion!.honestMinutes);
  });

  it('matches the unseeded population behavior when no quiz was taken', () => {
    useSettingsStore.setState({ archetypeSeed: undefined });
    const { result } = renderHook(() => useAddTask());
    act(() => { result.current.setCategory('admin'); result.current.setGuessMin(15); });
    expect(result.current.suggestion!.honestMinutes).toBe(Math.round(15 * 2.2));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/add-task/__tests__/useAddTask.seed.test.ts`
Expected: FAIL — the two numbers are equal (both 33). **This failure IS Blocker 1 reproduced.** Confirm you see it before fixing.

- [ ] **Step 3: Thread the seed through `useAddTask`**

In `src/features/add-task/useAddTask.ts`, add the selector near the other store reads:

```ts
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);
```

and at `:168`:

```ts
    const prior = cached?.priorMult ?? seededPriorFor(category, archetypeSeed);
```

Add `archetypeSeed` to the `useMemo` dependency array at `:172`:

```ts
  }, [category, guessMin, statsByCategory, archetypeSeed]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/add-task/__tests__/useAddTask.seed.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit the payoff**

```bash
git add src/features/add-task/useAddTask.ts src/features/add-task/__tests__/useAddTask.seed.test.ts
git commit -m "fix(calibration): the quiz seed reaches the add-task honest number

archetypeSeed had two readers, both the Patterns card label. Every
honest-number path resolved priorFor(category), so a Dreamer and a
Steady Reader guessing 15m on admin both got 35m. The reveal's claim
- 'now you know by how much' - was not wired to anything."
```

- [ ] **Step 6: Repeat for the remaining hook call sites**

For each of `useToday.ts:102`, `useDayPlan.ts:98`, `useDayCapacity.ts:66`, `useQuickTasks.ts:36`: add the `archetypeSeed` selector, swap `priorFor(x)` → `seededPriorFor(x, archetypeSeed)`, and add `archetypeSeed` to the memo deps. Each is the identical shape as Step 3.

- [ ] **Step 7: Repeat for the non-hook call sites (pass the seed in)**

`resolveHonestTasks.ts:69` — add a `seed: ArchetypeSeed | undefined` parameter to the function signature and use `seededPriorFor(category, seed)`. Update its callers to pass `useSettingsStore.getState().archetypeSeed`.

`categoryStatsRepo.ts:18` and `calibrationStore.ts:1250` — same: the repo takes the seed as an argument; the store reads it from `useSettingsStore.getState()` and passes it down. **Do not import a store into the db layer.**

- [ ] **Step 8: Verify the whole suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 0 warnings, 0 type errors, all pass. Existing engine tests that assert exact honest numbers may need a seed of `undefined` added — that is the correct fix, not changing the expected number.

- [ ] **Step 9: Verify on the simulator (the real proof)**

Reset onboarding, run it twice — once answering "A lot longer" + "rabbit holes", once "About right" + "stay on track" — then add the same task (`admin`, guess 15) each time and compare the honest number.

```bash
xcrun simctl get_app_container booted com.whenbee.app data   # then delete Documents/SQLite/* to reset
xcrun simctl launch booted com.whenbee.app
```

Expected: **two different honest numbers.** If they match, the seed is not reaching the suggestion — stop.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "fix(calibration): thread the archetype seed through every honest-number path"
```

---

### Task 8: `focus` becomes a stated pre-data block

**Files:**
- Create: `src/features/planner/statedFocusBlock.ts`
- Test: `src/features/planner/__tests__/statedFocusBlock.test.ts`

**Interfaces:**
- Consumes: `focus` from `onboardingStore.quizAnswers`.
- Produces: `statedFocusBlock(focus: FocusAnswer | undefined): StatedFocusBlock | null` where `StatedFocusBlock = { startMin: number; endMin: number; label: string; source: 'stated' }`.

**Why not feed the learner.** `focusWindowLearn.ts` is a tuned statistical engine — permutation strength, confidence gates, "don't reveal until sure". Injecting a self-report as *evidence* would let it claim a confidence it has not earned, which breaks the honesty of the whole surface. So the stated answer is a **separate, clearly-labelled artifact** that shows on day 1 and is *replaced* (never blended) the moment the learner clears its gates. This matches the approved `focus-window reveal-early` direction: coarse block first, confidence meter, learned data wins.

Blocks use the same waking-minute space as the learner: `FW_WAKING_START_MIN = 330` (05:30), `FW_WAKING_END_MIN` (see `constants.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/planner/__tests__/statedFocusBlock.test.ts
import { statedFocusBlock } from '../statedFocusBlock';
import * as C from '@/src/engine/constants';

describe('statedFocusBlock', () => {
  it('returns null when the question was not answered', () => {
    expect(statedFocusBlock(undefined)).toBeNull();
  });

  it('returns null for "it varies" — no claim to make', () => {
    expect(statedFocusBlock('varies')).toBeNull();
  });

  it('puts the morning block in the morning', () => {
    const b = statedFocusBlock('morning')!;
    expect(b.startMin).toBeGreaterThanOrEqual(C.FW_WAKING_START_MIN);
    expect(b.endMin).toBeLessThanOrEqual(12 * 60);
    expect(b.startMin).toBeLessThan(b.endMin);
  });

  it('puts the evening block after midday', () => {
    const b = statedFocusBlock('evening')!;
    expect(b.startMin).toBeGreaterThanOrEqual(12 * 60);
    expect(b.endMin).toBeLessThanOrEqual(C.FW_WAKING_END_MIN);
  });

  it('always marks itself as stated, never learned', () => {
    expect(statedFocusBlock('morning')!.source).toBe('stated');
    expect(statedFocusBlock('evening')!.source).toBe('stated');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/planner/__tests__/statedFocusBlock.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/features/planner/statedFocusBlock.ts
import * as C from '@/src/engine/constants';

export type FocusAnswer = 'morning' | 'evening' | 'varies';
export type StatedFocusBlock = { startMin: number; endMin: number; label: string; source: 'stated' };

/**
 * The user's SELF-REPORTED focus window, as a coarse block.
 *
 * This never enters focusWindowLearn: that engine earns its confidence from
 * logged startLocalMinute events and permutation strength, and a self-report is
 * not evidence. This block exists so the answer does visible work on day 1, and
 * it is REPLACED (not blended) the moment the learner clears its gates.
 * 'varies' makes no claim, so it returns null rather than a fake block.
 */
export function statedFocusBlock(focus: FocusAnswer | undefined): StatedFocusBlock | null {
  if (focus === undefined || focus === 'varies') return null;
  if (focus === 'morning') {
    return { startMin: 9 * 60, endMin: 11 * 60, label: 'You said mornings', source: 'stated' };
  }
  return { startMin: 19 * 60, endMin: 21 * 60, label: 'You said evenings', source: 'stated' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/planner/__tests__/statedFocusBlock.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Surface it where the focus window shows pre-data**

In the focus-window surface, when the learner has no window yet and `statedFocusBlock(...)` is non-null, render the block with its `label` and a line that keeps the claim honest:

> **"You said mornings — I'll check that against your timers."**

The learned window replaces it entirely once available. Never show both.

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/statedFocusBlock.ts src/features/planner/__tests__/statedFocusBlock.test.ts
git commit -m "feat(planner): the stated focus answer shows as a day-1 coarse block"
```

---

### Task 9: Remove the skip button — the quiz is mandatory

**Files:**
- Modify: `src/features/onboarding/QuizStepScreen.tsx:68-71` (delete `skip`), `:79` (delete the button)
- Modify: `src/features/onboarding/categories.ts` (add `DEFAULT_CATEGORY_IDS`), `src/features/onboarding/useOnboarding.ts:35-44`
- Modify: `src/services/analytics.ts:37-42` (retire `quiz_skipped`)
- Test: `src/features/onboarding/__tests__/useOnboarding.test.ts`, `src/features/onboarding/__tests__/analytics.funnel.test.ts`

**Interfaces:**
- Produces: `DEFAULT_CATEGORY_IDS: readonly string[]` — consumed by `complete()`.

**Founder decision (2026-07-15):** the quiz is mandatory. The old skip was rational *because the quiz did nothing*; now that the answers drive the number, skipping costs the user their own accuracy. It is 4 taps, no typing, no account. **Watch `quiz_started → quiz_completed` after ship** — if a bounce appears, revisit.

The default-category floor stays anyway as belt-and-braces: nothing else in the app can ever write an empty tracked list, and `categoriesStore.ts:22-24` already documents "the app needs at least one".

- [ ] **Step 1: Write the failing test**

```ts
// src/features/onboarding/__tests__/useOnboarding.test.ts
import { DEFAULT_CATEGORY_IDS } from '../categories';

describe('complete() category floor', () => {
  it('never writes an empty tracked list', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => { result.current.complete(); });   // nothing picked
    expect(useCategoriesStore.getState().categories.length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to the default set when nothing was picked', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => { result.current.complete(); });
    expect(useCategoriesStore.getState().categories.map((c) => c.id)).toEqual([...DEFAULT_CATEGORY_IDS]);
  });

  it('keeps the user picks when there are any', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => { result.current.togglePick('cooking'); result.current.complete(); });
    expect(useCategoriesStore.getState().categories.map((c) => c.id)).toEqual(['cooking']);
  });
});
```

```tsx
// src/features/onboarding/__tests__/QuizStepScreen.test.tsx
it('offers no skip — the quiz is the product', () => {
  const tree = render(<QuizStepScreen step={0} />);
  expect(tree.queryByText('Skip to my type')).toBeNull();
  expect(tree.queryByText(/skip/i)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/onboarding/__tests__/useOnboarding.test.ts src/features/onboarding/__tests__/QuizStepScreen.test.tsx`
Expected: FAIL — the skip button renders; `categories` is `[]`.

- [ ] **Step 3: Add the default set**

In `src/features/onboarding/categories.ts`:

```ts
/** The floor for complete(): if a user somehow reaches the end with nothing
 *  picked, they still get a tracked set. An empty tracked list is unrecoverable
 *  in the UI — calibrationStore.hydrate iterates ONLY tracked categories, so
 *  statsByCategory would stay {} forever and every log would vanish from view. */
export const DEFAULT_CATEGORY_IDS = ['getting_ready', 'cleaning', 'admin'] as const;
```

- [ ] **Step 4: Apply the floor in `complete()`**

In `src/features/onboarding/useOnboarding.ts`:

```ts
  const complete = () => {
    const ids = picked.length > 0 ? picked : [...DEFAULT_CATEGORY_IDS];
    setCategories(ids.map((id) => ({ id, name: nameFor(id), adaptSpeed: 'balanced' as const })));
    markCompleted();
    trackOnboardingCompleted({ categories_picked: picked.length, custom_category_added: hasCustom });
  };
```

- [ ] **Step 5: Delete the skip button and its handler**

In `QuizStepScreen.tsx`, delete the `skip` function (`:68-71`) and the `<AppButton label="Skip to my type" …>` (`:79`) plus its now-unused row wrapper. Delete the `trackQuizSkipped` import.

- [ ] **Step 6: Retire the event**

In `src/services/analytics.ts`, remove `quiz_skipped` from the event union and delete `trackQuizSkipped`. Update `analytics.funnel.test.ts` to drop it from the expected funnel.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest src/features/onboarding/`
Expected: PASS

- [ ] **Step 8: Verify the flow on the simulator**

Reset the app data, run onboarding start to finish. Expected: no skip affordance anywhere; every quiz step requires an answer; you land on Today with a non-empty honeycomb.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(onboarding): the quiz is mandatory; complete() can never write an empty category list

Skip pushed straight to ready, bypassing reveal AND categories, so
complete() wrote picked=[]. calibrationStore.hydrate iterates only
tracked categories, so statsByCategory stayed {} forever: logs landed
in the db and never surfaced. No error, no empty state - the user's
honest number just never learned.

Skip is gone (the answers now drive the number, so skipping only costs
the user accuracy) and complete() floors to a default set regardless."
```

---

### Task 10: Categories — preselect from `sink`, and say where areas live later

**Files:**
- Modify: `src/app/(onboarding)/categories.tsx:38-60, 96-165`
- Test: `src/app/(onboarding)/__tests__/categories.test.tsx`

**Interfaces:**
- Consumes: `sinkCategoryFor` (Task 5), `onboardingStore.quizAnswers.sink`.

Two changes: the `sink` answer preselects its category (the user already told us — asking again is a duplicate), and the screen tells the user areas are editable later (founder request).

**Name the right path.** Editing/resetting/removing an area lives in the **Whenbee tab**, not Settings: `WhenbeeHub.tsx:80` pushes `/category/[category]`, whose detail screen renders `ManageAreaCard` (reset + delete). Settings → `/categories` (`settings.tsx:312`) is the *add* surface only. The copy must name the tab, not Settings.

Copy (via `conversion-psychology` + `humanizer` — plain, reassuring, no exclamation, no guilt):
> **"Change or remove these any time in the Whenbee tab."**

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/(onboarding)/__tests__/categories.test.tsx
it('preselects the area the user named as their time sink', () => {
  useOnboardingStore.setState({ quizAnswers: { pace: 'lot', sink: 'chores' } });
  const tree = render(<CategoriesScreen />);
  expect(tree.getByLabelText('Cleaning').props.accessibilityState.selected).toBe(true);
});

it('preselects nothing when sink was not answered', () => {
  useOnboardingStore.setState({ quizAnswers: { pace: 'lot' } });
  const tree = render(<CategoriesScreen />);
  expect(tree.getByText('Pick at least one to continue')).toBeTruthy();
});

it('tells the user areas are editable later, naming the real path', () => {
  const tree = render(<CategoriesScreen />);
  expect(tree.getByText('Change or remove these any time in the Whenbee tab.')).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/\(onboarding\)/__tests__/categories.test.tsx`
Expected: FAIL — nothing preselected; hint text absent.

- [ ] **Step 3: Preselect on mount**

In `categories.tsx`, after the store reads:

```ts
  const sink = useOnboardingStore((s) => s.quizAnswers.sink);
  // The user already named this area on quiz/2. Asking again would be the same
  // question twice — preselect it and let them adjust.
  useEffect(() => {
    if (sink === undefined) return;
    const id = sinkCategoryFor(sink);
    if (!isPicked(id)) togglePick(id);
    // Mount-only: re-running would fight the user un-picking it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: Add the Settings hint**

Below the chip grid, above the footer card:

```tsx
      <AppText style={{ fontSize: t.fontSize.sm, color: t.colors.inkFaint }}>
        Change or remove these any time in the Whenbee tab.
      </AppText>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/app/\(onboarding\)/__tests__/categories.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/\(onboarding\)/categories.tsx src/app/\(onboarding\)/__tests__/categories.test.tsx
git commit -m "feat(onboarding): preselect the named time sink; point to the Whenbee tab for later edits"
```

---

### Task 11: Double-tap guard + honest analytics

**Files:**
- Create: `src/lib/useOnce.ts`
- Modify: `src/app/(onboarding)/welcome.tsx:91`, `src/features/onboarding/QuizStepScreen.tsx:63-66`, `src/app/(onboarding)/categories.tsx:168-171`, `src/app/(onboarding)/reveal.tsx:52`, `src/app/(onboarding)/ready.tsx:37-41`
- Modify: `src/features/onboarding/usePersonalize.ts:45` (move the capture out of `saveQuiz`)
- Test: `src/lib/__tests__/useOnce.test.ts`, `src/features/onboarding/__tests__/analytics.funnel.test.ts`

**Interfaces:**
- Produces: `useOnce(fn: () => void): () => void` — a handler that runs at most once per mount.

`router.push` does not dedupe: a double-tap stacks two identical screens, and on `ready` it fires `onboarding_completed` twice. Separately, back-swiping `reveal → quiz/3 → reveal` re-mounts `reveal`, re-running its `useEffect([])` and re-firing both `reveal_shown` and `saveQuiz`'s internal `quiz_completed`. **Today's activation numbers are inflated; this task is what makes them trustworthy.**

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/useOnce.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useOnce } from '../useOnce';

it('runs the handler once, however many times it is called', () => {
  const fn = jest.fn();
  const { result } = renderHook(() => useOnce(fn));
  act(() => { result.current(); result.current(); result.current(); });
  expect(fn).toHaveBeenCalledTimes(1);
});

it('gives a fresh mount a fresh shot', () => {
  const fn = jest.fn();
  const a = renderHook(() => useOnce(fn));
  act(() => { a.result.current(); });
  a.unmount();
  const b = renderHook(() => useOnce(fn));
  act(() => { b.result.current(); });
  expect(fn).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/useOnce.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/lib/useOnce.ts
import { useCallback, useRef } from 'react';

/** Wraps a handler so it fires at most once per mount. router.push does not
 *  dedupe, so a double-tap stacks duplicate screens — and on a terminal CTA it
 *  double-fires analytics. Guard every nav CTA with this. */
export function useOnce(fn: () => void): () => void {
  const fired = useRef(false);
  return useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    fn();
  }, [fn]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/useOnce.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Guard every onboarding CTA**

Each CTA's handler becomes `const onPress = useOnce(() => { … })`. Apply to `welcome.tsx:91`, `QuizStepScreen.tsx:63-66`, `categories.tsx:168-171`, `reveal.tsx:52`, `ready.tsx:37-41`.

- [ ] **Step 6: Stop `saveQuiz` from firing `quiz_completed` on every re-mount**

Remove the `analytics.capture('quiz_completed', …)` from inside `saveQuiz` (`usePersonalize.ts:45`) — `saveQuiz` is a data write and should not own an event. Fire it from `reveal.tsx`'s effect instead, guarded so a back-swipe round-trip does not re-count:

```ts
  const seenRef = useRef<string | null>(null);
  useEffect(() => {
    const key = JSON.stringify(answers);
    if (seenRef.current === key) return;   // same answers, re-mount → not a new completion
    seenRef.current = key;
    trackQuizCompleted({ archetype: reveal.title });
    trackRevealShown();
  }, [answers, reveal]);
```

- [ ] **Step 7: Write the regression test**

```ts
// src/features/onboarding/__tests__/analytics.funnel.test.ts
it('counts one completion per user, not one per tap', () => {
  const { result } = renderHook(() => useReadyScreen());
  act(() => { result.current.onPress(); result.current.onPress(); });
  expect(capture).toHaveBeenCalledWith('onboarding_completed', expect.anything());
  expect(capture.mock.calls.filter(([e]) => e === 'onboarding_completed')).toHaveLength(1);
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest src/features/onboarding/ src/lib/`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "fix(onboarding): guard every CTA against double-taps; stop double-counting the funnel"
```

---

### Task 12: "Time my first thing" actually times the first thing

**Files:**
- Modify: `src/app/(onboarding)/ready.tsx:37-41`
- Test: `src/app/(onboarding)/__tests__/ready.test.tsx`

**Interfaces:**
- Consumes: `useOnce` (Task 11).

The CTA promises a timer and delivers a generic Today screen. The aha moment is **guess → start → honest number**; it should happen in the first session. The 2-tap path a user finds on their own (FAB → play) starts a naked timer with `guessMin: 0` — no guess, no calibration.

`(modals)` routes live on the root stack and need `(tabs)` anchored beneath them (see `unstable_settings` in `src/app/_layout.tsx`), so `replace` to tabs first, then `push` the modal — that keeps the back/dismiss target correct.

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/(onboarding)/__tests__/ready.test.tsx
it('hands off into the add-task sheet, not a bare tab screen', () => {
  const tree = render(<ReadyScreen />);
  fireEvent.press(tree.getByText('Time my first thing →'));
  expect(replace).toHaveBeenCalledWith('/(tabs)');
  expect(push).toHaveBeenCalledWith('/(modals)/add-task');
});

it('completes onboarding before handing off', () => {
  const tree = render(<ReadyScreen />);
  fireEvent.press(tree.getByText('Time my first thing →'));
  expect(useOnboardingStore.getState().completed).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/\(onboarding\)/__tests__/ready.test.tsx`
Expected: FAIL — `push` was never called.

- [ ] **Step 3: Hand off for real**

```tsx
  const onStart = useOnce(() => {
    saveName(nickname.trim() || undefined);
    complete();
    // Anchor (tabs) beneath first: (modals) live on the root stack, so pushing
    // the sheet without the anchor traps the user in the drawer on dismiss.
    router.replace('/(tabs)');
    router.push('/(modals)/add-task');
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/\(onboarding\)/__tests__/ready.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify on the simulator — this is the whole point**

Reset app data, run onboarding to the end, tap "Time my first thing →". Expected: the add-task sheet opens with the title field focused. Type a task, set a guess, and confirm the honest number reflects the archetype you answered as. Dismiss the sheet and confirm you land on Today, not trapped.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(onboarding\)/ready.tsx src/app/\(onboarding\)/__tests__/ready.test.tsx
git commit -m "feat(onboarding): 'Time my first thing' opens add-task instead of a bare tab"
```

---

### Task 13: Accessibility — radios, progress value, hit targets

**Files:**
- Modify: `src/features/onboarding/QuizOption.tsx:139-140`, `src/features/onboarding/QuizStepScreen.tsx:104-139`, `src/features/onboarding/StepProgress.tsx:13, 20-22, 51`
- Test: `src/features/onboarding/__tests__/a11y.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/onboarding/__tests__/a11y.test.tsx
it('exposes quiz options as radios in a group', () => {
  const tree = render(<QuizStepScreen step={0} />);
  expect(tree.getByRole('radiogroup')).toBeTruthy();
  const radios = tree.getAllByRole('radio');
  expect(radios).toHaveLength(4);
  expect(radios[0].props.accessibilityState.checked).toBe(false);
});

it('marks the chosen option checked', () => {
  const tree = render(<QuizStepScreen step={0} />);
  fireEvent.press(tree.getByText('About right'));
  expect(tree.getAllByRole('radio')[0].props.accessibilityState.checked).toBe(true);
});

it('gives the progress bar a value, not just a label', () => {
  const tree = render(<StepProgress current={2} total={7} />);
  expect(tree.getByRole('progressbar').props.accessibilityValue).toEqual({ min: 0, max: 7, now: 3 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/onboarding/__tests__/a11y.test.tsx`
Expected: FAIL — role is `button`; `accessibilityValue` is undefined.

- [ ] **Step 3: Make options radios**

`QuizOption.tsx:139-140`:

```tsx
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
```

`QuizStepScreen.tsx` — wrap the options container:

```tsx
      <View accessibilityRole="radiogroup" style={optionsWrap}>
```

- [ ] **Step 4: Give the progress bar its value**

`StepProgress.tsx`:

```tsx
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current + 1} of ${total}`}
      accessibilityValue={{ min: 0, max: total, now: current + 1 }}
      style={row}
    >
```

Delete the stale `total = 3` default (every caller passes `ONBOARDING_TOTAL`) and fix the docstring at `:13` — it says "Three hairline pills"; there are 7. Replace the raw `height: 4` at `:51` with a token.

- [ ] **Step 5: Fix the skip target** — N/A

The 32pt "Skip to my type" target is deleted in Task 9. Nothing to do; confirm no other `size="xs"` `AppButton` remains in onboarding: `grep -rn 'size="xs"' src/app/\(onboarding\) src/features/onboarding`

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/features/onboarding/__tests__/a11y.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix(a11y): quiz options are radios; the progress bar reports its value"
```

---

### Task 14: Custom category stops swallowing input

**Files:**
- Modify: `src/app/(onboarding)/categories.tsx:48-56, 129-133`
- Test: `src/app/(onboarding)/__tests__/categories.test.tsx`

Today `commitCustom` requires `name.length > 0 && id.length > 0 && !isPicked(id)` and silently no-ops otherwise: `"🎉"` slugifies to `''` and vanishes; a duplicate of an already-picked seed vanishes; `"Deep work"` and `"Deep-work"` collide on one slug and the second vanishes. `onSubmitEditing` and `onBlur` both commit, and double-add is prevented only incidentally by the `!isPicked` guard — load-bearing by accident.

Copy: **"Already tracking that one"** / **"Try letters or numbers"**.

- [ ] **Step 1: Write the failing test**

```tsx
it('says so instead of swallowing a duplicate', () => {
  const tree = render(<CategoriesScreen />);
  fireEvent.press(tree.getByText('Add your own'));
  fireEvent.changeText(tree.getByLabelText('New category name'), 'Cleaning');
  fireEvent(tree.getByLabelText('New category name'), 'submitEditing');
  expect(tree.getByText('Already tracking that one')).toBeTruthy();
});

it('says so instead of swallowing an unslugifiable name', () => {
  const tree = render(<CategoriesScreen />);
  fireEvent.press(tree.getByText('Add your own'));
  fireEvent.changeText(tree.getByLabelText('New category name'), '🎉');
  fireEvent(tree.getByLabelText('New category name'), 'submitEditing');
  expect(tree.getByText('Try letters or numbers')).toBeTruthy();
});

it('keeps the input open when a commit fails', () => {
  const tree = render(<CategoriesScreen />);
  fireEvent.press(tree.getByText('Add your own'));
  fireEvent.changeText(tree.getByLabelText('New category name'), '🎉');
  fireEvent(tree.getByLabelText('New category name'), 'submitEditing');
  expect(tree.queryByLabelText('New category name')).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/\(onboarding\)/__tests__/categories.test.tsx -t "swallow"`
Expected: FAIL — no error text.

- [ ] **Step 3: Return a result instead of a silent no-op**

```tsx
  const [customError, setCustomError] = useState<string | null>(null);

  const commitCustom = () => {
    const name = customName.trim();
    if (name.length === 0) { setAdding(false); setCustomError(null); return; }  // empty = cancel, not an error
    const id = slugify(name);
    if (id.length === 0) { setCustomError('Try letters or numbers'); return; }
    if (isPicked(id)) { setCustomError('Already tracking that one'); return; }
    togglePick(id, name);
    setCustomName('');
    setCustomError(null);
    setAdding(false);
  };
```

- [ ] **Step 4: One commit trigger, and show the error**

Drop `onBlur={commitCustom}` — keep only `onSubmitEditing`. (Both fired on submit; the double-add was prevented by luck.) Render the error under the input:

```tsx
      {customError ? (
        <AppText style={{ fontSize: t.fontSize.sm, color: t.colors.amberText }}>{customError}</AppText>
      ) : null}
```

Amber, never `danger` — a typo is not a failure (product invariant: no guilt).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/app/\(onboarding\)/__tests__/categories.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(onboarding): custom category names report why they were rejected"
```

---

### Task 15: Stale comments and token violations

**Files:**
- Modify: `src/features/onboarding/StepProgress.tsx:13`, `src/features/onboarding/ArchetypeReveal.tsx:224-225`, `src/features/onboarding/useOnboarding.ts:8`, `src/stores/onboardingStore.ts`
- Modify: `src/app/(onboarding)/welcome.tsx:41,44,51,54,64`, `categories.tsx:71,93`, `ready.tsx:57,66`, `QuizStepScreen.tsx:115`, `src/components/Chip.tsx:200`

Docs that lie are worse than no docs — a future reader trusts them.

- [ ] **Step 1: Fix the lying comments**

- `StepProgress.tsx:13` — "Three hairline pills" → seven (`ONBOARDING_TOTAL`).
- `ArchetypeReveal.tsx:224-225` — "never loops" → it loops forever (`withRepeat(…, -1, false)` at `:109`). Say so.
- `useOnboarding.ts:8` — "the 3-step flow" → 7 (6 once Task 9's skip removal settles the count; state the real number).
- `onboardingStore.ts` — remove the `hasOnboarded` "public alias" claim; no such alias exists, only `completed`.

- [ ] **Step 2: Replace raw values with tokens**

- `letterSpacing: -0.75 / -0.6` → `t.letterSpacing.tight` (`welcome.tsx:44,54`, `categories.tsx:93`, `ready.tsx:57`)
- `lineHeight: t.fontSize['2xl'] * 1.1` → `t.fontSize['2xl'] * t.lineHeight.tight` (`welcome.tsx:41,51`); `* 1.5` → `* t.lineHeight.relaxed` (`welcome.tsx:64`, `ready.tsx:66`)
- `StepProgress.tsx:51` `height: 4` → `t.space[1]`
- `categories.tsx:71` `minWidth: 120` → add `t.size.chipMinWidth = 120` to `tokens.ts` and use it
- `QuizStepScreen.tsx:115` `width: '47%'` → add `t.size.quizTileWidth = '47%'` to `tokens.ts` and use it
- `Chip.tsx:200` `hitSlop={6}` → `t.size.hitSlop` (= 8)

- [ ] **Step 3: Verify nothing shifted visually**

```bash
xcrun simctl openurl booted "whenbee:///(onboarding)/welcome"
sleep 3 && xcrun simctl io booted screenshot /tmp/tokens-after.png
```

Compare against a before-shot. `-0.75 → -0.5` letter-spacing is a real (small) change to the headline; look at it and confirm it still reads well. If tighter was deliberate, add a `t.letterSpacing.display = -0.75` token instead of retuning the headline.

- [ ] **Step 4: Lint + test + commit**

```bash
npm run lint && npm test
git add -A
git commit -m "refactor(onboarding): tokens for raw values; correct the stale comments"
```

---

### Task 16: Carve out the animation rule for the onboarding CTA

**Files:**
- Modify: `CLAUDE.md` (the "Animation — HARD RULE (no tacky entrances)" section)

**Founder decision (2026-07-15):** the `Reveal.tsx` `FadeInDown` entrance stays. As written, the rule forbids it — so every future agent will re-flag `welcome.tsx:87` / `categories.tsx:163` / `ready.tsx:148` and "fix" a thing that is deliberate. Amend the rule to say what we actually mean.

This task changes **only** the rule text. `Reveal.tsx` is not touched.

- [ ] **Step 1: Amend the bullet**

In `CLAUDE.md`, in the Animation hard-rule list, replace the "Never animate buttons" bullet with:

```markdown
- **Never animate buttons** in/out/up/down on entrance — with one deliberate exception: the **onboarding CTA** (`Reveal.tsx`'s staggered `FadeInDown`, used by `welcome.tsx` / `categories.tsx` / `ready.tsx`). That entrance is intentional and approved (founder, 2026-07-15) — do NOT "fix" it to `FadeIn`. Everywhere else a button appears at full opacity, full size. Don't fade, slide, or pop it in.
```

- [ ] **Step 2: Verify the rule now matches the code**

Run: `grep -rn "FadeInDown" src/features/onboarding/Reveal.tsx`
Expected: the import and usage are present and the rule above explicitly permits them.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: carve the onboarding CTA out of the button-entrance animation rule

The rule forbade the Reveal.tsx FadeInDown entrance that ships on
welcome/categories/ready. It is deliberate and approved, so the rule -
not the code - was wrong. Without this, every agent re-flags it."
```

---

### Task 17: Update the audit to match reality

**Files:**
- Modify: `docs/product/12-ONBOARDING-AUDIT.md`, `docs/product/12-ONBOARDING-AUDIT.html`

The audit is the record. It must reflect the decisions actually taken, or the next reader re-litigates them.

- [ ] **Step 1: Record the founder decisions**

- **Blocker 2** — change "cut or wire" to **wire**: `sink` → per-category bump (Task 5), `focus` → stated block (Task 8). Both questions stay.
- **Blocker 3** — the fix is now **skip removed entirely** (Task 9), floor retained as belt-and-braces.
- **Finding 8 (dead space)** — REMOVED. Founder decision 2026-07-15: the CTA stays pinned at the bottom, near the thumb. Note that `space-between` would not have moved it, so the finding can return if the objection was only about placement.
- **Finding 9 (FadeInDown)** — REMOVED. Founder wants the current entrance kept.
- Correct the disabled-contrast figure: the fix measures **3.28:1**, not 3.1:1.

- [ ] **Step 2: Re-render and eyeball the HTML**

```bash
npx playwright screenshot --viewport-size=1180,900 --full-page \
  "file://$(pwd)/docs/product/12-ONBOARDING-AUDIT.html" /tmp/audit-after.png
open docs/product/12-ONBOARDING-AUDIT.html
```

- [ ] **Step 3: Commit**

```bash
git add docs/product/12-ONBOARDING-AUDIT.md docs/product/12-ONBOARDING-AUDIT.html
git commit -m "docs: fold the onboarding-audit decisions back into the audit"
```

---

## Open questions for the founder

1. **CLAUDE.md animation rule.** Keeping `FadeInDown` on the CTAs contradicts the documented hard rule ("Never animate buttons in/out/up/down on entrance"). Leave the rule and every future agent re-flags this. Amend the rule to carve out the onboarding CTA, or leave it and accept the noise?
2. **Quiz length after wiring.** All four questions now do real work, so the flow stays at 7 screens. Still the right trade for a mandatory quiz, or trim `focus` and ship 6?
3. **`meetings` → `calls`.** Task 5 relabels the option "Calls & meetings" to match the existing `calls` prior (1.3) rather than invent a `meetings` prior. If meetings deserve their own population prior, that number needs to come from `01-FOUNDATION.md`, not from us.

## Verification gate before the PR

- `npm run lint` — 0 warnings
- `npm run typecheck` — 0 errors
- `npm test` — all pass
- **Simulator, full cold run:** reset data → onboarding start to finish → confirm no skip exists, the add-task sheet opens from the final CTA, and two different archetypes produce two different honest numbers for the same guess.
- **Never merge.** Open the PR and stop.
