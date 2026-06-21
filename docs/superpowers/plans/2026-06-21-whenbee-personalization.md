# "Whenbee knows you" — Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add name + time-of-day greeting, an illustrated onboarding time-style quiz that seeds a provisional archetype shown Day-0 and refined by real data, a skipper placeholder hero, and a thin-data fix for the accuracy chart.

**Architecture:** Pure-TS engine helpers (seed mapping, provisional blend, greeting, raised chart gate) under `src/engine/`; persisted state (`displayName`, `archetypeSeed`) in `settingsStore` via KV; a new optional onboarding `personalize` step composed of small focused components in `src/features/onboarding/`; the provisional/placeholder hero states extend the redesign's `ArchetypeHero`/`deriveArchetype`; the greeting renders on Home via a small `useGreeting` hook. Everything on-device, tokens-only.

**Tech Stack:** React Native (Expo SDK 54), TypeScript (strict + `noUncheckedIndexedAccess`), Zustand + `zustandKv`, react-native-svg 15, react-native-reanimated 4, Jest. Theming via `src/theme/tokens.ts` + `useTheme()`.

**Spec:** `docs/superpowers/specs/2026-06-21-whenbee-personalization-design.md`. Research: `docs/product/specs/12-name-greeting-personalization.md`.

## Global Constraints

- **Stacks on the Patterns redesign** (branch `worktree-patterns-redesign`). This worktree is already based on its HEAD; `ArchetypeHero`, `deriveArchetype`, `ProgressChart`, `buildAccuracySeries` exist. The PR bases on that branch, merges after PR #30.
- **Product invariants:** no guilt/shame, no streaks; **amber never red**; honey/sharpness monotonic; all personalization **on-device** (no network); pricing from RevenueCat. **The quiz never asks for durations** — only self-perceived style/bias.
- **The name is "Whenbee"** everywhere — never "Wemby".
- **Name personalization rules (doc 12):** optional + skippable + nickname + editable; greeting never shows "undefined"; the name is used **sparingly** (a density guard), warmth-only, never a behavioral callback.
- **Tokens only:** every color/spacing/size/font/radius/motion value from a `useTheme()` token. New token group → matching line in `resolveTheme` (`src/theme/useTheme.ts`) or `t.<key>` is undefined.
- **Engine purity:** `src/engine/**` is pure TS — no React/RN/Expo, no `Date.now()`/clock. The hour is read in a hook and passed into `greetingFor`.
- **Reanimated/Fabric:** entering-only (no `exiting`); shared values via `.get()/.set()`; reduced-motion falls back to still end states.
- **Pressable gotcha:** visuals on an inner `View`; `Pressable` stays a bare touch wrapper (see `Chip`).
- **Illustrated chips** match `src/features/reward/ReasonGlyph.tsx` exactly: 24-box, ~1.6px strokes, rounded joins, indigo body (`colors.primary`/`primarySoft`) + amber accent (`colors.accent`), one-shot meaning-mapped select animation, reduced-motion-guarded to a still end state.
- **Analytics events are a typed map** (`AppEventProps` in `src/services/analytics.ts`) — every new event must be added there or `capture()` won't type-check.
- TDD for all logic (engine + store + derivations): failing test first. UI gets a render test. Visual/illustration tasks additionally require **screenshot verification** on the sim.
- Commits: Conventional Commits, **NO AI/co-author attribution**. Plain `git` (not init-cmt). **Never merge** — open a PR, founder merges.
- Gate before PR: `npm run lint && npm run typecheck && npm test` all green.

---

### Task 1: Engine — archetype seed mapping + provisional blend

Pure functions: quiz answers → a seed multiplier, and (seed + data-so-far) → the multiplier the provisional archetype uses.

**Files:**
- Create: `src/engine/archetypeSeed.ts`
- Modify: `src/engine/constants.ts`
- Modify: `src/engine/index.ts`
- Test: `src/engine/__tests__/archetypeSeed.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface QuizAnswers { pace: 'about' | 'bit' | 'lot' | 'lose'; mid?: 'track' | 'rabbit'; focus?: 'morning' | 'evening' | 'varies'; }
  export function seedMultiplierFor(a: QuizAnswers): number;
  export function provisionalArchetypeMultiplier(seedM: number, dataRatios: number[]): number;
  ```

- [ ] **Step 1: Add constants**

In `src/engine/constants.ts`, append after the accuracy-trend block:
```ts
// ── Archetype quiz seed (provisional time-personality before data) ───────────
/** Seed multiplier per Q1 pace answer (self-perceived bias, NOT a duration). */
export const ARCHETYPE_SEED_PACE = { about: 1.15, bit: 1.5, lot: 2.1, lose: 3.0 } as const;
/** Q2 'rabbit holes' multiplies the seed by this (capped at RATIO_CEIL). */
export const ARCHETYPE_SEED_RABBIT_BUMP = 1.15;
/** Seed acts as a prior worth this many pseudo-logs; real logs wash it out. */
export const ARCHETYPE_SEED_PSEUDO = 5;
```

- [ ] **Step 2: Write the failing test**

Create `src/engine/__tests__/archetypeSeed.test.ts`:
```ts
import { seedMultiplierFor, provisionalArchetypeMultiplier } from '../archetypeSeed';

describe('seedMultiplierFor', () => {
  it('maps each pace answer to its band', () => {
    expect(seedMultiplierFor({ pace: 'about' })).toBeCloseTo(1.15);
    expect(seedMultiplierFor({ pace: 'lose' })).toBeCloseTo(3.0);
  });
  it('bumps the seed when mid-task goes to rabbit holes', () => {
    expect(seedMultiplierFor({ pace: 'bit', mid: 'rabbit' })).toBeGreaterThan(seedMultiplierFor({ pace: 'bit' }));
  });
  it('never exceeds the ratio ceiling', () => {
    expect(seedMultiplierFor({ pace: 'lose', mid: 'rabbit' })).toBeLessThanOrEqual(6);
  });
});

describe('provisionalArchetypeMultiplier', () => {
  it('returns the seed when there is no data', () => {
    expect(provisionalArchetypeMultiplier(2.1, [])).toBeCloseTo(2.1);
  });
  it('pulls toward the data as logs accumulate', () => {
    // seed says 3.0, but the data runs ~1.0 (perfect) — blend lands between, nearer data as n grows
    const few = provisionalArchetypeMultiplier(3.0, [1, 1, 1]);
    const many = provisionalArchetypeMultiplier(3.0, Array(20).fill(1));
    expect(few).toBeGreaterThan(many); // more data → closer to 1.0
    expect(many).toBeLessThan(3.0);
    expect(many).toBeGreaterThan(1.0);
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npx jest src/engine/__tests__/archetypeSeed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/engine/archetypeSeed.ts`:
```ts
// Archetype quiz seed — PURE TS. Maps self-perceived style answers to a provisional
// multiplier, and blends that seed (as a prior) with real log ratios so the
// provisional time-personality moves toward the truth as data accumulates. The quiz
// asks about BIAS/STYLE, never durations, so this never substitutes for calibration.
import { ARCHETYPE_SEED_PACE, ARCHETYPE_SEED_RABBIT_BUMP, ARCHETYPE_SEED_PSEUDO, RATIO_CEIL } from './constants';

export interface QuizAnswers {
  pace: 'about' | 'bit' | 'lot' | 'lose';
  mid?: 'track' | 'rabbit';
  focus?: 'morning' | 'evening' | 'varies';
}

export function seedMultiplierFor(a: QuizAnswers): number {
  let m = ARCHETYPE_SEED_PACE[a.pace];
  if (a.mid === 'rabbit') m *= ARCHETYPE_SEED_RABBIT_BUMP;
  return Math.min(RATIO_CEIL, m);
}

/** Geometric-mean blend of the seed (worth ARCHETYPE_SEED_PSEUDO pseudo-logs) with
 *  the real data's log-mean. Mirrors the engine's log-space blend-with-prior. */
export function provisionalArchetypeMultiplier(seedM: number, dataRatios: number[]): number {
  const k = ARCHETYPE_SEED_PSEUDO;
  const n = dataRatios.length;
  const seedLog = Math.log(seedM);
  if (n === 0) return seedM;
  const dataLog = dataRatios.reduce((s, r) => s + Math.log(r), 0) / n;
  const blended = (k * seedLog + n * dataLog) / (k + n);
  return Math.exp(blended);
}
```

- [ ] **Step 5: Export**

In `src/engine/index.ts`, add:
```ts
export { seedMultiplierFor, provisionalArchetypeMultiplier } from './archetypeSeed';
export type { QuizAnswers } from './archetypeSeed';
```

- [ ] **Step 6: Run, verify pass**

Run: `npx jest src/engine/__tests__/archetypeSeed.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Lint + commit**

Run: `npx eslint src/engine/archetypeSeed.ts src/engine/constants.ts src/engine/index.ts src/engine/__tests__/archetypeSeed.test.ts`
```bash
git add src/engine/archetypeSeed.ts src/engine/constants.ts src/engine/index.ts src/engine/__tests__/archetypeSeed.test.ts
git commit -m "feat(engine): add archetype quiz seed mapping and provisional blend"
```

---

### Task 2: Engine — `greetingFor`

Pure time-of-day greeting with an optional name. The hour is passed in (no clock in the engine).

**Files:**
- Create: `src/engine/greeting.ts`
- Modify: `src/engine/index.ts`
- Test: `src/engine/__tests__/greeting.test.ts`

**Interfaces:**
- Produces: `export function greetingFor(hour: number, name?: string): string;`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/greeting.test.ts`:
```ts
import { greetingFor } from '../greeting';

describe('greetingFor', () => {
  it('buckets morning/afternoon/evening (doc 12 boundaries)', () => {
    expect(greetingFor(6)).toBe('Good morning');
    expect(greetingFor(13)).toBe('Good afternoon');
    expect(greetingFor(19)).toBe('Good evening');
    expect(greetingFor(2)).toBe('Good evening'); // 17:00–04:59 is evening
  });
  it('appends a name when given', () => {
    expect(greetingFor(6, 'Ali')).toBe('Good morning, Ali');
  });
  it('never emits a trailing comma or "undefined" without a name', () => {
    expect(greetingFor(6)).not.toMatch(/undefined|,\s*$/);
    expect(greetingFor(6, '')).toBe('Good morning'); // empty name = no name
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/engine/__tests__/greeting.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/engine/greeting.ts`:
```ts
// greetingFor — PURE TS time-of-day greeting (doc 12 boundaries). Caller passes the
// local hour (the clock read stays in a hook). Name is optional and appended only
// when non-empty; never renders "undefined". Warmth only — no behavioral content.
export function greetingFor(hour: number, name?: string): string {
  const part = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening';
  const base = `Good ${part}`;
  const trimmed = name?.trim();
  return trimmed ? `${base}, ${trimmed}` : base;
}
```

- [ ] **Step 4: Export + run**

In `src/engine/index.ts`, add `export { greetingFor } from './greeting';`
Run: `npx jest src/engine/__tests__/greeting.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/engine/greeting.ts src/engine/index.ts src/engine/__tests__/greeting.test.ts`
```bash
git add src/engine/greeting.ts src/engine/index.ts src/engine/__tests__/greeting.test.ts
git commit -m "feat(engine): add greetingFor time-of-day greeting"
```

---

### Task 3: Chart thin-data fix — raise the sparkline gate

Make `buildAccuracySeries` require enough logs that each of its 6 buckets holds ≥2, so `ProgressChart` shows the calm 2-point fallback until the sparkline is non-noisy.

**Files:**
- Modify: `src/engine/constants.ts:` (the `ACCURACY_TREND_MIN_LOGS` line)
- Modify: `src/engine/__tests__/accuracyTrend.test.ts`
- Test: `src/engine/__tests__/accuracyTrend.test.ts`

**Interfaces:**
- Consumes/Produces: unchanged signatures; only the gate value changes (6 → 12).

- [ ] **Step 1: Update the failing test first**

In `src/engine/__tests__/accuracyTrend.test.ts`, change the gate assertions to the new threshold: the "returns null below the gate" case should use **11** logs (now below 12), and the equal-bucket case should use **12**:
```ts
  it('returns null below the min-log gate', () => {
    expect(buildAccuracySeries(perfect(11))).toBeNull(); // was 5
  });

  it('buckets ordered ratios into an accuracy series', () => {
    const out = buildAccuracySeries(perfect(12)); // was 12 already — keep
    expect(out).not.toBeNull();
    expect(out!.points).toHaveLength(6);
    ...
  });
```
(Adjust any other case that assumed the old 6-log floor — e.g. the positive/negative-delta cases must use ≥12 ratios.)

- [ ] **Step 2: Run, verify the gate test fails**

Run: `npx jest src/engine/__tests__/accuracyTrend.test.ts`
Expected: FAIL — `buildAccuracySeries(perfect(11))` still returns a series (gate is 6).

- [ ] **Step 3: Raise the gate**

In `src/engine/constants.ts`, change:
```ts
export const ACCURACY_TREND_MIN_LOGS = 12; // was 6 — each of 6 buckets needs >=2 logs to read non-noisy
```

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/engine/__tests__/accuracyTrend.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm ProgressChart still falls back cleanly**

Run: `npx jest src/features/patterns/__tests__/ProgressChart.test.tsx`
Expected: PASS (its fallback test already covers `trend: null` → 2-point line).

- [ ] **Step 6: Lint + commit**

Run: `npx eslint src/engine/constants.ts src/engine/__tests__/accuracyTrend.test.ts`
```bash
git add src/engine/constants.ts src/engine/__tests__/accuracyTrend.test.ts
git commit -m "fix(patterns): raise accuracy-sparkline gate to 12 logs to kill thin-data noise"
```

---

### Task 4: Store — `displayName` + `archetypeSeed`

Persisted personalization state in `settingsStore`.

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Test: `src/stores/__tests__/settingsStore.test.ts` (create if absent)

**Interfaces:**
- Produces on `useSettingsStore`: `displayName?: string`, `setDisplayName(name: string | undefined)`, `archetypeSeed?: { m0: number; source: 'quiz'; tookAt: number }`, `setArchetypeSeed(seed)`, and both cleared by `reset()`.

- [ ] **Step 1: Write the failing test**

Create `src/stores/__tests__/settingsStore.test.ts`:
```ts
import { useSettingsStore } from '../settingsStore';

beforeEach(() => useSettingsStore.getState().reset());

it('stores and clears a display name', () => {
  useSettingsStore.getState().setDisplayName('Ali');
  expect(useSettingsStore.getState().displayName).toBe('Ali');
  useSettingsStore.getState().setDisplayName(undefined);
  expect(useSettingsStore.getState().displayName).toBeUndefined();
});

it('stores an archetype seed and reset clears both', () => {
  useSettingsStore.getState().setArchetypeSeed({ m0: 2.1, source: 'quiz', tookAt: 1 });
  useSettingsStore.getState().setDisplayName('Ali');
  useSettingsStore.getState().reset();
  expect(useSettingsStore.getState().archetypeSeed).toBeUndefined();
  expect(useSettingsStore.getState().displayName).toBeUndefined();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/stores/__tests__/settingsStore.test.ts`
Expected: FAIL — `setDisplayName` is not a function.

- [ ] **Step 3: Implement**

In `src/stores/settingsStore.ts`, extend the interface and store. Add to `SettingsState`:
```ts
  /** Optional nickname for greetings/companion lines. No name = greeting only. */
  displayName?: string;
  setDisplayName: (name: string | undefined) => void;
  /** Provisional archetype seed from the onboarding quiz; washes out as data grows. */
  archetypeSeed?: { m0: number; source: 'quiz'; tookAt: number };
  setArchetypeSeed: (seed: { m0: number; source: 'quiz'; tookAt: number }) => void;
```
Add to the store body (inside `create`):
```ts
      displayName: undefined,
      setDisplayName: (displayName) => set({ displayName: displayName?.trim() ? displayName.trim() : undefined }),
      archetypeSeed: undefined,
      setArchetypeSeed: (archetypeSeed) => set({ archetypeSeed }),
```
And extend `reset`:
```ts
      reset: () => set({ colorMode: 'system', remindersEnabled: false, dailyRitualEnabled: false, displayName: undefined, archetypeSeed: undefined }),
```

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/stores/__tests__/settingsStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/stores/settingsStore.ts src/stores/__tests__/settingsStore.test.ts`
```bash
git add src/stores/settingsStore.ts src/stores/__tests__/settingsStore.test.ts
git commit -m "feat(settings): persist displayName and archetype quiz seed"
```

---

### Task 5: Provisional archetype in `deriveArchetype`

Below the earned gate, return a provisional `ArchetypeCard` from the blended seed; with no seed, return null (placeholder territory). Earned path unchanged.

**Files:**
- Modify: `src/features/patterns/usePatterns.ts`
- Test: `src/features/patterns/__tests__/usePatterns.test.ts`

**Interfaces:**
- Consumes: `seedMultiplierFor` (not needed here), `provisionalArchetypeMultiplier`, the seed shape `{ m0: number }`.
- Produces: `ArchetypeCard` gains `provisional: boolean`; `deriveArchetype(data, seed?)` accepts an optional `seed?: { m0: number }` and `derivePatterns(data, nowMs, seed?)` threads it.

- [ ] **Step 1: Write the failing test**

In `src/features/patterns/__tests__/usePatterns.test.ts`, add (using the file's existing `makeData`/`log` factories):
```ts
import { provisionalArchetypeMultiplier } from '@/src/engine'; // for reference if needed

it('returns a provisional archetype from the quiz seed when data is thin', () => {
  const data = makeData({ logs: [log({ category: 'admin' })] }); // 1 completed log, below gate
  const view = derivePatterns(data, Date.now(), { m0: 1.5 });
  expect(view.archetype).not.toBeNull();
  expect(view.archetype!.provisional).toBe(true);
});

it('returns null archetype with no seed and thin data', () => {
  const data = makeData({ logs: [log({ category: 'admin' })] });
  const view = derivePatterns(data, Date.now());
  expect(view.archetype).toBeNull();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/features/patterns/__tests__/usePatterns.test.ts -t "provisional archetype"`
Expected: FAIL — `derivePatterns` ignores the seed / `provisional` undefined.

- [ ] **Step 3: Implement**

In `src/features/patterns/usePatterns.ts`:

Add `provisionalArchetypeMultiplier` to the `@/src/engine` import. Add `provisional: boolean;` to the `ArchetypeCard` interface.

In `deriveArchetype`, change the signature and add the provisional branch. The earned branch must set `provisional: false`. Replace the function head + the null return:
```ts
export function deriveArchetype(data: PatternsData, seed?: { m0: number }): ArchetypeCard | null {
  const personal = data.categories.filter((c) => c.n >= PERSONAL_MIN_LOGS);
  const totalLogs = personal.reduce((sum, c) => sum + c.n, 0);
  const earned = personal.length >= ARCHETYPE_MIN_CATEGORIES && totalLogs >= ARCHETYPE_MIN_LOGS;

  if (!earned) {
    if (!seed) return null;
    // Provisional: blend the quiz seed with whatever completed-log ratios exist.
    const ratios = ratiosOf(completedLogs(data.logs));
    return archetypeFor(provisionalArchetypeMultiplier(seed.m0, ratios), true);
  }
  const avg = personal.reduce((sum, c) => sum + c.mEffective, 0) / personal.length;
  return archetypeFor(avg, false);
}
```
Extract the existing ladder into a helper `archetypeFor(avg: number, provisional: boolean): ArchetypeCard` (move the title/blurb if/else into it, returning `{ title, blurb, averageMultiplier: avg, provisional }`). Place it directly above `deriveArchetype`.

Thread the seed through `derivePatterns`:
```ts
export function derivePatterns(data: PatternsData, nowMs: number, seed?: { m0: number }): PatternsView {
  ...
    archetype: deriveArchetype(data, seed),
  ...
}
```
And in the `usePatterns` hook, read the seed from settings and pass it. Add near the top of the hook:
```ts
  const archetypeSeed = useSettingsStore((s) => s.archetypeSeed);
```
(import `useSettingsStore` from `@/src/stores/settingsStore`), and in `refresh`:
```ts
    setView(derivePatterns(data, nowRef.current, archetypeSeed ? { m0: archetypeSeed.m0 } : undefined));
```
Add `archetypeSeed` to the `refresh` `useCallback` deps.

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/features/patterns/__tests__/usePatterns.test.ts`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Lint + typecheck + commit**

Run: `npx eslint src/features/patterns/usePatterns.ts src/features/patterns/__tests__/usePatterns.test.ts && npm run typecheck`
```bash
git add src/features/patterns/usePatterns.ts src/features/patterns/__tests__/usePatterns.test.ts
git commit -m "feat(patterns): provisional archetype from the quiz seed below the earned gate"
```

---

### Task 6: `ArchetypeHero` provisional marker + `ArchetypePlaceholder`

**Files:**
- Modify: `src/features/patterns/Archetype.tsx`
- Test: `src/features/patterns/__tests__/Archetype.test.tsx`

**Interfaces:**
- Consumes: `ArchetypeCard` (now with `provisional`).
- Produces: `ArchetypeHero` reads `card.provisional` and renders a "Provisional · still learning" pill; `export function ArchetypePlaceholder({ onTakeQuiz }: { onTakeQuiz: () => void }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Add to `src/features/patterns/__tests__/Archetype.test.tsx`:
```tsx
import { ArchetypeHero, ArchetypePlaceholder } from '../Archetype';

it('shows a provisional marker when the card is provisional', () => {
  const { getAllByText } = render(
    <ArchetypeHero card={{ title: 'The Gentle Optimist', blurb: 'x', averageMultiplier: 1.5, provisional: true }} />,
  );
  expect(getAllByText(/still learning/i).length).toBeGreaterThan(0);
});

it('renders the placeholder invite with a quiz CTA', () => {
  const onTakeQuiz = jest.fn();
  const { getByText } = render(<ArchetypePlaceholder onTakeQuiz={onTakeQuiz} />);
  fireEvent.press(getByText(/take the 20-sec quiz/i));
  expect(onTakeQuiz).toHaveBeenCalled();
});
```
(ensure `fireEvent` is imported from `@testing-library/react-native`.)

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/features/patterns/__tests__/Archetype.test.tsx`
Expected: FAIL — `ArchetypePlaceholder` not exported; no provisional marker.

- [ ] **Step 3: Implement**

In `src/features/patterns/Archetype.tsx`:

Add a provisional pill inside `ArchetypeHero`, rendered only when `card.provisional`. Place it under the multiplier row:
```tsx
{card.provisional ? (
  <View style={{ alignSelf: 'flex-start', backgroundColor: t.colors.surfaceSunken, paddingHorizontal: t.space[2.5], paddingVertical: t.space[1], borderRadius: t.radii.full }}>
    <Text style={{ ...(type.micro as unknown as TextStyle), color: t.colors.inkSoft }}>Provisional · still learning</Text>
  </View>
) : null}
```
(`ArchetypeHero` already destructures `card`; reference `card.provisional`. Add `View`/`Text`/`type`/`TextStyle` to imports if not present.)

Add the placeholder export at the bottom of the file:
```tsx
export function ArchetypePlaceholder({ onTakeQuiz }: { onTakeQuiz: () => void }) {
  const t = useTheme();
  const cardStyle: ViewStyle = {
    borderRadius: t.radii.card, borderCurve: 'continuous', backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.share, borderColor: t.colors.border, padding: t.space[5], gap: t.space[2],
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  return (
    <View style={cardStyle}>
      <Text style={eyebrow}>YOUR TIME PERSONALITY</Text>
      <Text style={titleStyle}>Meet your time personality</Text>
      <Text style={body}>Take the 20-sec quiz, or keep logging and I&apos;ll figure it out.</Text>
      <View style={{ alignSelf: 'flex-start', marginTop: t.space[2] }}>
        <AppButton label="Take the 20-sec quiz" variant="ghost" size="md" onPress={onTakeQuiz} />
      </View>
    </View>
  );
}
```
(`AppButton`, `ViewStyle`, `useTheme`, `type` are already imported by the hero; add any missing.)

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/features/patterns/__tests__/Archetype.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/patterns/Archetype.tsx src/features/patterns/__tests__/Archetype.test.tsx`
```bash
git add src/features/patterns/Archetype.tsx src/features/patterns/__tests__/Archetype.test.tsx
git commit -m "feat(patterns): ArchetypeHero provisional marker + ArchetypePlaceholder invite"
```

---

### Task 7: Route — render the placeholder when below the gate

**Files:**
- Modify: `src/app/(tabs)/patterns.tsx`
- Test: `src/features/patterns/__tests__/patternsScreen.test.tsx`

**Interfaces:**
- Consumes: `ArchetypePlaceholder` (Task 6). Navigates to the re-openable quiz via `router.push('/(modals)/archetype-quiz')` (the modal route is built in Task 12).

- [ ] **Step 1: Update the screen test**

In `src/features/patterns/__tests__/patternsScreen.test.tsx`, add a case: with non-empty but thin data and no archetype, the placeholder shows. Reuse the file's `setPatternsData` helper:
```tsx
it('shows the archetype placeholder for a logged-but-unearned user', async () => {
  setPatternsData({
    nameOf: (id) => id,
    categories: [{ categoryId: 'admin', n: 1, mEffective: 2.0, sharpness: 20 }],
    logs: [{ category: 'admin', estimateMin: 10, actualMin: 20, status: 'completed' as const, source: 'timed' as const, createdAt: NOW - DAY }],
  });
  render(<Patterns />);
  await waitFor(() => expect(screen.getByText('Meet your time personality')).toBeOnTheScreen());
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/features/patterns/__tests__/patternsScreen.test.tsx -t "placeholder"`
Expected: FAIL — placeholder not rendered.

- [ ] **Step 3: Implement**

In `src/app/(tabs)/patterns.tsx`: import `ArchetypePlaceholder` from `'@/src/features/patterns/Archetype'` and `router` from `'expo-router'`. Replace the identity block:
```tsx
            {/* 1 · IDENTITY */}
            {view.archetype ? (
              <Animated.View entering={rise()}><ArchetypeHero card={view.archetype} /></Animated.View>
            ) : (
              <Animated.View entering={rise()}>
                <ArchetypePlaceholder onTakeQuiz={() => router.push('/(modals)/archetype-quiz')} />
              </Animated.View>
            )}
```
(The placeholder shows whenever there's no archetype card — earned or provisional — and the screen is past the empty state. It naturally disappears once a seed or earned data produces a card.)

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/features/patterns/__tests__/patternsScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck + commit**

Run: `npx eslint "src/app/(tabs)/patterns.tsx" src/features/patterns/__tests__/patternsScreen.test.tsx && npm run typecheck`
> Typecheck may flag the `/(modals)/archetype-quiz` route as unknown until Task 12 creates it. If so, leave the call as written and note it; it resolves when Task 12 lands. (expo-router typed routes regenerate on the route file's creation.)
```bash
git add "src/app/(tabs)/patterns.tsx" src/features/patterns/__tests__/patternsScreen.test.tsx
git commit -m "feat(patterns): show ArchetypePlaceholder invite when archetype is unearned"
```

---

### Task 8: `ArchetypeQuizGlyph` — the illustrated answer glyphs (craft + screenshot-verify)

The two-tone SVG glyph set for the quiz chips, modeled exactly on `ReasonGlyph`. **This is a design-craft task** — invoke `svg-animations` + `motion-design` + `emil-design-eng`, draw each glyph, and **screenshot-verify on the sim** that they match the reward-chip style before committing.

**Files:**
- Create: `src/features/onboarding/ArchetypeQuizGlyph.tsx`
- Test: `src/features/onboarding/__tests__/ArchetypeQuizGlyph.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type QuizGlyphKind =
    | 'pace_about' | 'pace_bit' | 'pace_lot' | 'pace_lose'
    | 'mid_track' | 'mid_rabbit'
    | 'focus_morning' | 'focus_evening' | 'focus_varies';
  export function ArchetypeQuizGlyph({ kind, active, size }: { kind: QuizGlyphKind; active: boolean; size?: number }): JSX.Element;
  ```

**Glyph contract (mirror `src/features/reward/ReasonGlyph.tsx` exactly):** 24-box `viewBox="0 0 24 24"`, stroke width `1.6`, rounded line caps/joins, indigo body fill `t.colors.primarySoft` + stroke `t.colors.primary`, amber accent `t.colors.accent`. Each plays a **one-shot, meaning-mapped** select animation via a shared value (`active` true → animate, reduced-motion → still). Meaning map:
- `pace_about` → a tidy target/✓ (a small confirm pop)
- `pace_bit` → a clock with a short over-arc (the arc ticks out)
- `pace_lot` → a clock with a long over-arc (arc sweeps further)
- `pace_lose` → a loose spiral/tangle (gentle unspool)
- `mid_track` → a straight arrow (nudges forward)
- `mid_rabbit` → a branching/forking path (the branch springs)
- `focus_morning` → a sun (rays expand)
- `focus_evening` → a moon (soft tilt)
- `focus_varies` → a half-sun/horizon (a small rock)

- [ ] **Step 1: Write the render test (covers all kinds)**

Create `src/features/onboarding/__tests__/ArchetypeQuizGlyph.test.tsx`:
```tsx
import { render } from '@testing-library/react-native';
import { ArchetypeQuizGlyph, type QuizGlyphKind } from '../ArchetypeQuizGlyph';

const kinds: QuizGlyphKind[] = ['pace_about','pace_bit','pace_lot','pace_lose','mid_track','mid_rabbit','focus_morning','focus_evening','focus_varies'];

it('renders every glyph kind without crashing, active and inactive', () => {
  for (const kind of kinds) {
    expect(render(<ArchetypeQuizGlyph kind={kind} active={false} />).toJSON()).toBeTruthy();
    expect(render(<ArchetypeQuizGlyph kind={kind} active />).toJSON()).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/features/onboarding/__tests__/ArchetypeQuizGlyph.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement, using `ReasonGlyph` as the template**

Read `src/features/reward/ReasonGlyph.tsx` and copy its structure verbatim — the imports, the `BOX`/`SW` consts, the shared-value + `useAnimatedStyle` + reduced-motion `useEffect` switch, and the `<Svg viewBox>` body — substituting the 9 `QuizGlyphKind` shapes and their one-shot animations per the meaning map above. One fully-worked example to match the house style (the `pace_about` target with a confirm pop):
```tsx
{kind === 'pace_about' ? (
  <>
    <Circle cx={12} cy={12} r={7} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
    <Path d="M8.5 12.2 L11 14.6 L15.6 9.6" fill="none" stroke={amber} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </>
) : null}
```
with, in the select `useEffect`, `case 'pace_about': scale.set(withSequence(withTiming(1.18, { duration: pop }), withSpring(1, spring))); break;`. Draw the remaining 8 in the same idiom. **Every color from `t.colors`; box/stroke are the shared geometry consts (not theme tokens, matching ReasonGlyph's `BOX`/`SW`).**

- [ ] **Step 4: Run the test + screenshot-verify**

Run: `npx jest src/features/onboarding/__tests__/ArchetypeQuizGlyph.test.tsx` → PASS.
Then render the 9 glyphs on the sim (a temporary harness screen or the quiz screen from Task 9) and `xcrun simctl io booted screenshot` — confirm they read as one coherent set in the reward-chip style (indigo body + amber accent, 24-box weight). Iterate until they satisfy the design eye. Do not commit until the screenshot looks right.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/onboarding/ArchetypeQuizGlyph.tsx src/features/onboarding/__tests__/ArchetypeQuizGlyph.test.tsx`
```bash
git add src/features/onboarding/ArchetypeQuizGlyph.tsx src/features/onboarding/__tests__/ArchetypeQuizGlyph.test.tsx
git commit -m "feat(onboarding): add ArchetypeQuizGlyph illustrated answer set"
```

---

### Task 9: `TimeStyleQuiz` — the question flow with illustrated chips

A reusable component (used in onboarding AND the re-open modal) that runs the 2–3 questions and returns the answers.

**Files:**
- Create: `src/features/onboarding/TimeStyleQuiz.tsx`
- Test: `src/features/onboarding/__tests__/TimeStyleQuiz.test.tsx`

**Interfaces:**
- Consumes: `Chip` (`@/src/components/Chip`), `ArchetypeQuizGlyph` (Task 8), `QuizAnswers` (`@/src/engine`).
- Produces: `export function TimeStyleQuiz({ onComplete, onSkip }: { onComplete: (a: QuizAnswers) => void; onSkip: () => void }): JSX.Element`. Calls `onComplete` once Q1 is answered and the user advances past the optional Q2/Q3 (or taps "See my type").

- [ ] **Step 1: Write the failing test**

Create `src/features/onboarding/__tests__/TimeStyleQuiz.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { TimeStyleQuiz } from '../TimeStyleQuiz';

it('collects answers and completes with at least the pace', () => {
  const onComplete = jest.fn();
  const { getByText } = render(<TimeStyleQuiz onComplete={onComplete} onSkip={jest.fn()} />);
  fireEvent.press(getByText('A bit longer'));   // Q1
  fireEvent.press(getByText('Stay on track'));  // Q2
  fireEvent.press(getByText('Mornings'));        // Q3
  fireEvent.press(getByText('See my type'));     // finish
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ pace: 'bit', mid: 'track', focus: 'morning' }));
});

it('can complete from just the first question', () => {
  const onComplete = jest.fn();
  const { getByText } = render(<TimeStyleQuiz onComplete={onComplete} onSkip={jest.fn()} />);
  fireEvent.press(getByText('I lose track'));
  fireEvent.press(getByText('See my type'));
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ pace: 'lose' }));
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/features/onboarding/__tests__/TimeStyleQuiz.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/onboarding/TimeStyleQuiz.tsx`. Use the `Chip` + glyph + `FadeInDown` stagger pattern from `src/features/reward/ReasonChips.tsx` (read it for the exact chip-row idiom). Structure: an array of 3 questions, each `{ key, prompt, options: { value, label, glyph }[] }`; render the current question's prompt + a chip row; tapping a chip records the answer and advances (Q1→Q2→Q3); a "See my type" button is enabled once `pace` is set; a "Skip" text button calls `onSkip`. Every value from tokens; reduced-motion guarded. Question data:
```ts
const QUESTIONS = [
  { key: 'pace', prompt: 'When you plan your day, things usually take…', options: [
    { value: 'about', label: 'About right', glyph: 'pace_about' },
    { value: 'bit', label: 'A bit longer', glyph: 'pace_bit' },
    { value: 'lot', label: 'A lot longer', glyph: 'pace_lot' },
    { value: 'lose', label: 'I lose track', glyph: 'pace_lose' },
  ] },
  { key: 'mid', prompt: 'Mid-task, you usually…', options: [
    { value: 'track', label: 'Stay on track', glyph: 'mid_track' },
    { value: 'rabbit', label: 'Fall down rabbit holes', glyph: 'mid_rabbit' },
  ] },
  { key: 'focus', prompt: 'You focus best…', options: [
    { value: 'morning', label: 'Mornings', glyph: 'focus_morning' },
    { value: 'evening', label: 'Evenings', glyph: 'focus_evening' },
    { value: 'varies', label: 'It varies', glyph: 'focus_varies' },
  ] },
] as const;
```
Render each chip as:
```tsx
<Chip label={opt.label} icon={<ArchetypeQuizGlyph kind={opt.glyph} active={answers[q.key] === opt.value} />} selected={answers[q.key] === opt.value} onPress={() => choose(q.key, opt.value)} />
```
On finish, build the `QuizAnswers` object from collected answers and call `onComplete`.

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/features/onboarding/__tests__/TimeStyleQuiz.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/onboarding/TimeStyleQuiz.tsx src/features/onboarding/__tests__/TimeStyleQuiz.test.tsx`
```bash
git add src/features/onboarding/TimeStyleQuiz.tsx src/features/onboarding/__tests__/TimeStyleQuiz.test.tsx
git commit -m "feat(onboarding): add TimeStyleQuiz illustrated question flow"
```

---

### Task 10: `ArchetypeReveal` — the reveal moment (craft + screenshot-verify)

The animated "You're The Gentle Optimist" payoff. Invoke `creating-reanimated-animations` + `motion-design` + `emil-design-eng`; **screenshot-verify**.

**Files:**
- Create: `src/features/onboarding/ArchetypeReveal.tsx`
- Test: `src/features/onboarding/__tests__/ArchetypeReveal.test.tsx`

**Interfaces:**
- Consumes: `ArchetypeCard` (the provisional card), `seedMultiplierFor` is upstream; this only renders.
- Produces: `export function ArchetypeReveal({ title, blurb, multiplier, onContinue }: { title: string; blurb: string; multiplier: number; onContinue: () => void }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `src/features/onboarding/__tests__/ArchetypeReveal.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ArchetypeReveal } from '../ArchetypeReveal';

it('reveals the archetype and continues', () => {
  const onContinue = jest.fn();
  const { getByText } = render(<ArchetypeReveal title="The Gentle Optimist" blurb="You lean hopeful." multiplier={1.5} onContinue={onContinue} />);
  expect(getByText('The Gentle Optimist')).toBeTruthy();
  fireEvent.press(getByText(/continue|see my day|let's go/i));
  expect(onContinue).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/features/onboarding/__tests__/ArchetypeReveal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/onboarding/ArchetypeReveal.tsx`. Reuse `ArchetypeHero`'s visual language (the bee glyph + amber glow + title + multiplier + blurb) on a centered card, with a **Premium** entrance choreography (motion-design): the bee/glow rises and settles, the title fades+rises after, the multiplier counts/pops, then a "Continue →" `AppButton` (`fullWidth`). All durations/easings from `t.motion.*`; reduced-motion → still. Add an eyebrow "YOUR TIME PERSONALITY" and, since this is the provisional reveal, a quiet "I'll sharpen this as you log" line (`type.caption`, `inkSoft`) — warmth, no guilt.

- [ ] **Step 4: Run the test + screenshot-verify**

Run: `npx jest src/features/onboarding/__tests__/ArchetypeReveal.test.tsx` → PASS.
Render on the sim and `xcrun simctl io booted screenshot` — confirm the reveal reads as a delightful, calm payoff (not peppy), matching the hero styling. Iterate before committing.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/onboarding/ArchetypeReveal.tsx src/features/onboarding/__tests__/ArchetypeReveal.test.tsx`
```bash
git add src/features/onboarding/ArchetypeReveal.tsx src/features/onboarding/__tests__/ArchetypeReveal.test.tsx
git commit -m "feat(onboarding): add ArchetypeReveal payoff animation"
```

---

### Task 11: `NameAsk` — the optional nickname field

**Files:**
- Create: `src/features/onboarding/NameAsk.tsx`
- Test: `src/features/onboarding/__tests__/NameAsk.test.tsx`

**Interfaces:**
- Produces: `export function NameAsk({ onContinue }: { onContinue: (name: string | undefined) => void }): JSX.Element`. A `TextInput` (nickname), a "Continue" and a prominent "Skip" — Skip calls `onContinue(undefined)`; Continue calls `onContinue(trimmedOrUndefined)`.

- [ ] **Step 1: Write the failing test**

Create `src/features/onboarding/__tests__/NameAsk.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { NameAsk } from '../NameAsk';

it('passes a typed name on continue and undefined on skip', () => {
  const onContinue = jest.fn();
  const { getByLabelText, getByText, rerender } = render(<NameAsk onContinue={onContinue} />);
  fireEvent.changeText(getByLabelText('Your name'), 'Ali');
  fireEvent.press(getByText('Continue'));
  expect(onContinue).toHaveBeenCalledWith('Ali');

  const onContinue2 = jest.fn();
  rerender(<NameAsk onContinue={onContinue2} />);
  fireEvent.press(getByText('Skip'));
  expect(onContinue2).toHaveBeenCalledWith(undefined);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/features/onboarding/__tests__/NameAsk.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/onboarding/NameAsk.tsx`. Use the `categories.tsx` input idiom (`TextInput` with tokenized style, `placeholderTextColor`, `accessibilityLabel="Your name"`), Whenbee's-voice prompt "What should I call you?" + subtext "Totally optional — I'm happy with no name too." A `Continue` `AppButton` (passes `value.trim() || undefined`) and a `Skip` ghost/text button (passes `undefined`). Tokens only; `maxLength` a sensible token-free constant is fine as a literal `24` for input length (matches `MAX_CUSTOM_NAME` convention — import that const if you prefer).

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/features/onboarding/__tests__/NameAsk.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/onboarding/NameAsk.tsx src/features/onboarding/__tests__/NameAsk.test.tsx`
```bash
git add src/features/onboarding/NameAsk.tsx src/features/onboarding/__tests__/NameAsk.test.tsx
git commit -m "feat(onboarding): add optional NameAsk nickname step"
```

---

### Task 12: `personalize` onboarding step + re-open modal + analytics + routing

Compose `NameAsk → TimeStyleQuiz → ArchetypeReveal` into the new onboarding step, persist results, insert it in the flow, bump `StepProgress`, and expose the quiz as a reusable modal route.

**Files:**
- Create: `src/app/(onboarding)/personalize.tsx`
- Create: `src/app/(modals)/archetype-quiz.tsx`
- Create: `src/features/onboarding/usePersonalize.ts` (shared logic: persist name + seed, compute the reveal card)
- Modify: `src/app/(onboarding)/categories.tsx` (Continue → `/(onboarding)/personalize`)
- Modify: `src/app/(onboarding)/ready.tsx` (`StepProgress current={3}` + `total={4}`)
- Modify: `src/app/(onboarding)/welcome.tsx` (`StepProgress … total={4}` if it renders one)
- Modify: `src/services/analytics.ts` (add event types)
- Test: `src/features/onboarding/__tests__/usePersonalize.test.ts`

**Interfaces:**
- Consumes: `useSettingsStore` (`setDisplayName`, `setArchetypeSeed`), `seedMultiplierFor`, `deriveArchetype`-style `archetypeFor` (reuse via a thin local mapping), `NameAsk`, `TimeStyleQuiz`, `ArchetypeReveal`.
- Produces: `usePersonalize()` → `{ saveName(name?), saveQuiz(answers) → { title, blurb, multiplier } }`.

- [ ] **Step 1: Add analytics event types**

In `src/services/analytics.ts`, add to the `AppEventProps` interface (near the lifecycle block):
```ts
  personalize_shown: Record<string, never>;
  name_set: { length: number };
  name_skipped: Record<string, never>;
  quiz_completed: { archetype: string };
  quiz_skipped: Record<string, never>;
  archetype_reopened: Record<string, never>;
```

- [ ] **Step 2: Write the failing test for `usePersonalize`**

Create `src/features/onboarding/__tests__/usePersonalize.test.ts`:
```ts
import { renderHook, act } from '@testing-library/react-native';
import { usePersonalize } from '../usePersonalize';
import { useSettingsStore } from '@/src/stores/settingsStore';

beforeEach(() => useSettingsStore.getState().reset());

it('persists the seed and returns a reveal card from quiz answers', () => {
  const { result } = renderHook(() => usePersonalize());
  let card: { title: string; multiplier: number } | undefined;
  act(() => { card = result.current.saveQuiz({ pace: 'lot', mid: 'rabbit' }); });
  expect(useSettingsStore.getState().archetypeSeed?.m0).toBeGreaterThan(2);
  expect(card!.title.length).toBeGreaterThan(0);
});

it('persists a name and clears on undefined', () => {
  const { result } = renderHook(() => usePersonalize());
  act(() => result.current.saveName('Ali'));
  expect(useSettingsStore.getState().displayName).toBe('Ali');
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npx jest src/features/onboarding/__tests__/usePersonalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `usePersonalize`**

Create `src/features/onboarding/usePersonalize.ts`:
```ts
import { useSettingsStore } from '@/src/stores/settingsStore';
import { seedMultiplierFor, type QuizAnswers } from '@/src/engine';

// Maps a seed multiplier to the same 4-rung ladder deriveArchetype uses, so the
// reveal label matches what Patterns will show. Kept in lockstep with the engine
// ladder thresholds (Steady<1.3, Gentle<1.8, Sprint<2.6, Dreamer>=2.6).
function rungFor(m: number): { title: string; blurb: string } {
  if (m < 1.3) return { title: 'The Steady Reader', blurb: 'Your guesses land close to reality. Quietly rare.' };
  if (m < 1.8) return { title: 'The Gentle Optimist', blurb: 'You lean hopeful, then mostly catch up. A little padding does it.' };
  if (m < 2.6) return { title: 'The Sprint Optimist', blurb: 'Your mind moves fast; the doing takes a touch longer. Now you know by how much.' };
  return { title: 'The Dreamer', blurb: 'Big plans, generous timelines. Your honest numbers keep them grounded.' };
}

export function usePersonalize() {
  const setDisplayName = useSettingsStore((s) => s.setDisplayName);
  const setArchetypeSeed = useSettingsStore((s) => s.setArchetypeSeed);
  return {
    saveName: (name?: string) => setDisplayName(name),
    saveQuiz: (answers: QuizAnswers) => {
      const m0 = seedMultiplierFor(answers);
      // tookAt is passed by the caller via Date.now() at the screen layer; store a stamp here.
      setArchetypeSeed({ m0, source: 'quiz', tookAt: Date.now() });
      const { title, blurb } = rungFor(m0);
      return { title, blurb, multiplier: m0 };
    },
  };
}
```
> Note: `Date.now()` here is in the hook layer (allowed — not the engine). The `rungFor` copy is duplicated from `deriveArchetype`'s ladder intentionally to keep the engine pure and the reveal self-contained; both reference the same thresholds (a comment in each points to the other). If the founder prefers a single source, a later refactor can extract the ladder to the engine — out of scope here.

- [ ] **Step 5: Run, verify pass**

Run: `npx jest src/features/onboarding/__tests__/usePersonalize.test.ts`
Expected: PASS.

- [ ] **Step 6: Build the `personalize` screen**

Create `src/app/(onboarding)/personalize.tsx` mirroring `categories.tsx`'s shell (`Screen` + `OnboardingBackdrop` + `StepProgress current={2} total={4}` + `useSafeAreaInsets`). Local state machine: `phase: 'name' | 'quiz' | 'reveal'`. Render `NameAsk` (phase name) → on continue `saveName(name)`, `analytics.capture('name_set'|'name_skipped', …)`, go to quiz → `TimeStyleQuiz` (phase quiz) → on complete `const card = saveQuiz(answers); analytics.capture('quiz_completed', { archetype: card.title }); setReveal(card); go to reveal`; on skip `analytics.capture('quiz_skipped'); router.push('/(onboarding)/ready')` → `ArchetypeReveal` (phase reveal) → `onContinue` pushes `/(onboarding)/ready`. Fire `analytics.capture('personalize_shown')` once on mount. Everything skippable to `ready`.

- [ ] **Step 7: Build the re-open modal**

Create `src/app/(modals)/archetype-quiz.tsx`: a modal that renders `TimeStyleQuiz` then `ArchetypeReveal`, using `usePersonalize`; on complete it `analytics.capture('archetype_reopened')`, saves the seed, shows the reveal, and dismisses (`router.back()`) on continue. (Reached from the placeholder hero CTA in Task 7 and from Settings in Task 15.)

- [ ] **Step 8: Wire routing + StepProgress**

In `categories.tsx`, change the Continue `onPress` to `router.push('/(onboarding)/personalize')` and its `StepProgress` to `total={4}`. In `ready.tsx`, set `StepProgress current={3} total={4}`. In `welcome.tsx`, if it renders `StepProgress`, set `total={4}`.

- [ ] **Step 9: Full gate for the flow**

Run: `npm run typecheck && npx jest src/features/onboarding && npx eslint "src/app/(onboarding)/personalize.tsx" "src/app/(modals)/archetype-quiz.tsx" src/features/onboarding "src/app/(onboarding)/categories.tsx" "src/app/(onboarding)/ready.tsx" src/services/analytics.ts`
Expected: green.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(onboarding)/personalize.tsx" "src/app/(modals)/archetype-quiz.tsx" src/features/onboarding/usePersonalize.ts src/features/onboarding/__tests__/usePersonalize.test.ts "src/app/(onboarding)/categories.tsx" "src/app/(onboarding)/ready.tsx" "src/app/(onboarding)/welcome.tsx" src/services/analytics.ts
git commit -m "feat(onboarding): add personalize step (name + quiz + reveal) and re-open modal"
```

---

### Task 13: Home greeting — `useGreeting` + render on Today

**Files:**
- Create: `src/features/today/useGreeting.ts`
- Modify: `src/app/(tabs)/index.tsx`
- Test: `src/features/today/__tests__/useGreeting.test.ts`

**Interfaces:**
- Consumes: `greetingFor` (`@/src/engine`), `useSettingsStore` (`displayName`).
- Produces: `useGreeting(): string` — the greeting line for Home (reads the local hour + name + the sparing density rule).

- [ ] **Step 1: Write the failing test**

Create `src/features/today/__tests__/useGreeting.test.ts`:
```ts
import { renderHook } from '@testing-library/react-native';
import { useGreeting } from '../useGreeting';
import { useSettingsStore } from '@/src/stores/settingsStore';

beforeEach(() => useSettingsStore.getState().reset());

it('returns a bare greeting with no name', () => {
  const { result } = renderHook(() => useGreeting());
  expect(result.current).toMatch(/^Good (morning|afternoon|evening)$/);
});

it('includes the name when one is set', () => {
  useSettingsStore.getState().setDisplayName('Ali');
  const { result } = renderHook(() => useGreeting());
  expect(result.current).toMatch(/, Ali$/);
});
```
> The density rule (name only a fraction of opens) is hard to unit-test deterministically; for the hook test we assert the name appears when set. The density variation is verified on device (Step 4). Keep the hook deterministic-per-render: include the name based on a stable per-day signal (see Step 3) so a single render in the test is stable.

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/features/today/__tests__/useGreeting.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/today/useGreeting.ts`:
```ts
import { useSettingsStore } from '@/src/stores/settingsStore';
import { greetingFor } from '@/src/engine';

// Home greeting. Reads the local hour (clock lives here, not the engine) and the
// optional name. Sparing density (doc 12): the name is appended on a fraction of
// opens, keyed to the day so it's stable within a session — warm like a friend,
// never on every render. With no name it falls back to the bare greeting.
export function useGreeting(): string {
  const name = useSettingsStore((s) => s.displayName);
  const now = new Date();
  const hour = now.getHours();
  if (!name) return greetingFor(hour);
  // Use the name roughly every other day (stable per calendar day, not per render).
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  const useName = dayIndex % 2 === 0;
  return greetingFor(hour, useName ? name : undefined);
}
```
> For the test's "includes the name when set" to be deterministic regardless of the run date, make the density rule include the name when EITHER `dayIndex % 2 === 0` OR a test override; simplest deterministic approach that still varies in production: key on `hour % 2` is NOT stable per day. Use `dayIndex % 2`. If the test lands on an odd day it would fail — to avoid flakiness, the test should set the rule on: change the test to assert containment across two consecutive day indices, OR (preferred) export the density decision as a pure helper `shouldUseName(dayIndex: number)` and unit-test THAT, while `useGreeting` asserts only the no-name and name-present-at-all behavior by temporarily forcing inclusion. Implement `shouldUseName` as a named export and have the name test call `greetingFor` indirectly by checking the hook returns the name on an even day index via jest fake timers set to a fixed even-day date. Use `jest.useFakeTimers().setSystemTime(new Date('2026-06-22T09:00:00'))` (an even dayIndex) in the name test.

- [ ] **Step 4: Render on Home + screenshot-verify**

In `src/app/(tabs)/index.tsx`, render the greeting at the top of the screen (above the existing header content), styled with `type` tokens (`type.title`/`heading` per the screen's hierarchy) and `t.colors.ink`. Keep it quiet (no exclamation). Verify on the sim with a name set and cleared; `xcrun simctl io booted screenshot`.

- [ ] **Step 5: Test + lint + commit**

Run: `npx jest src/features/today/__tests__/useGreeting.test.ts && npx eslint src/features/today/useGreeting.ts "src/app/(tabs)/index.tsx" src/features/today/__tests__/useGreeting.test.ts && npm run typecheck`
```bash
git add src/features/today/useGreeting.ts "src/app/(tabs)/index.tsx" src/features/today/__tests__/useGreeting.test.ts
git commit -m "feat(today): add time-of-day greeting with sparing name density"
```

---

### Task 14: Whenbee name-density guard (companion lines)

A small pure rule so Whenbee's companion copy uses the name rarely, at earned moments only.

**Files:**
- Create: `src/features/whenbee/nameDensity.ts`
- Test: `src/features/whenbee/__tests__/nameDensity.test.ts`

**Interfaces:**
- Produces: `export function shouldUseName(context: 'greeting' | 'milestone' | 'return' | 'routine'): boolean;` — true only for `milestone` and `return` (the earned moments); false for routine lines.

- [ ] **Step 1: Write the failing test**

Create `src/features/whenbee/__tests__/nameDensity.test.ts`:
```ts
import { shouldUseName } from '../nameDensity';

it('uses the name only at earned moments', () => {
  expect(shouldUseName('milestone')).toBe(true);
  expect(shouldUseName('return')).toBe(true);
  expect(shouldUseName('routine')).toBe(false);
  expect(shouldUseName('greeting')).toBe(false);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/features/whenbee/__tests__/nameDensity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/whenbee/nameDensity.ts`:
```ts
// Name-density guard (doc 12 rule 5): Whenbee names you like a close friend —
// only at meaningful moments (a milestone, a return after a gap), never in routine
// lines or on every surface. Overuse reads as a sales script and erodes the bond.
export function shouldUseName(context: 'greeting' | 'milestone' | 'return' | 'routine'): boolean {
  return context === 'milestone' || context === 'return';
}
```

- [ ] **Step 4: Run, verify pass + lint + commit**

Run: `npx jest src/features/whenbee/__tests__/nameDensity.test.ts && npx eslint src/features/whenbee/nameDensity.ts src/features/whenbee/__tests__/nameDensity.test.ts`
```bash
git add src/features/whenbee/nameDensity.ts src/features/whenbee/__tests__/nameDensity.test.ts
git commit -m "feat(whenbee): add name-density guard for sparing companion name use"
```

---

### Task 15: Settings — edit name + re-take quiz

**Files:**
- Modify: `src/app/settings.tsx`
- Test: `src/app/__tests__/settings.test.tsx` (extend if present; else a focused render test)

**Interfaces:**
- Consumes: `useSettingsStore` (`displayName`, `setDisplayName`), `router` (to `/(modals)/archetype-quiz`).

- [ ] **Step 1: Write the failing test**

Add to the settings test (create `src/app/__tests__/settings.test.tsx` if absent), asserting a name field and a re-take entry render:
```tsx
import { render, fireEvent } from '@testing-library/react-native';
import Settings from '@/src/app/settings';
import { useSettingsStore } from '@/src/stores/settingsStore';

it('edits the display name from settings', () => {
  useSettingsStore.getState().reset();
  const { getByLabelText } = render(<Settings />);
  fireEvent.changeText(getByLabelText('Your name'), 'Ali');
  expect(useSettingsStore.getState().displayName).toBe('Ali');
});
```
> If `Settings` pulls navigation/router context that the test env lacks, wrap or mock `expo-router` as the other screen tests do (`jest.mock('expo-router', …)`). Match the existing settings test's harness if one exists.

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/app/__tests__/settings.test.tsx`
Expected: FAIL — no "Your name" field.

- [ ] **Step 3: Implement**

In `src/app/settings.tsx`, add a "Your name" row: a `TextInput` (`accessibilityLabel="Your name"`, tokenized) bound to `displayName`, writing through `setDisplayName` on change (empty → clears). Add a "Re-take time-style quiz" row that `router.push('/(modals)/archetype-quiz')`. Follow the file's existing settings-row styling; tokens only.

- [ ] **Step 4: Run, verify pass + gate + commit**

Run: `npx jest src/app/__tests__/settings.test.tsx && npx eslint "src/app/settings.tsx" "src/app/__tests__/settings.test.tsx" && npm run typecheck`
```bash
git add "src/app/settings.tsx" "src/app/__tests__/settings.test.tsx"
git commit -m "feat(settings): edit display name and re-take the time-style quiz"
```

---

### Task 16: Device verification + PR

**Files:** none (verification + PR).

- [ ] **Step 1: Build & launch**

Run: `npm run ios` and wait for the dev client to boot.

- [ ] **Step 2: Verify onboarding personalization (dark + reduced-motion)**

Reset onboarding per CLAUDE.md (delete `Documents/SQLite/ExpoSQLiteStorage` + `whenbee.db` in the app data container, relaunch). Walk `welcome → categories → personalize → ready`. Confirm: name field skippable; quiz chips render with the illustrated glyphs (match the reward-chip style); the reveal lands calmly; the archetype hero shows **provisional** on first Patterns open. Screenshot each (`xcrun simctl io booted screenshot`). Repeat with Reduce Motion on — no crash, still end states.

- [ ] **Step 3: Verify hero states + greeting + chart**

Confirm: skipping the quiz shows the placeholder hero with a working "Take the 20-sec quiz" CTA (opens the modal); Home shows the greeting (with and without a name set in Settings); the accuracy chart shows the calm 2-point line under 12 logs (no spiky contradiction). Screenshot.

- [ ] **Step 4: Full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green, 0 warnings.

- [ ] **Step 5: Open the PR (base = the patterns branch; do NOT merge)**

```bash
git push -u origin worktree-whenbee-personalization
gh pr create --base worktree-patterns-redesign --head worktree-whenbee-personalization --title "feat(personalization): Whenbee knows you — name, greeting, time-style quiz + provisional archetype" --body "$(cat <<'EOF'
Adds the "Whenbee knows you" personalization: an optional onboarding step (name + an illustrated time-style mini-quiz) that seeds a **provisional archetype** shown Day-0 and refined by real data; a skipper placeholder hero; a Home time-of-day greeting with sparing name density; and a thin-data fix for the accuracy chart.

**Stacked on PR #30 (Patterns redesign)** — base is `worktree-patterns-redesign`; merge #30 first. The chart fix touches redesign-only code, which is why it ships here.

Spec: docs/superpowers/specs/2026-06-21-whenbee-personalization-design.md
Plan: docs/superpowers/plans/2026-06-21-whenbee-personalization.md
Research: docs/product/specs/12-name-greeting-personalization.md (corrected to "Whenbee")

Invariants honored: no guilt/streaks; amber never red; on-device; quiz asks style not durations; pricing from RevenueCat. Verified on iOS sim (dark + reduced-motion). lint + typecheck + test green.
EOF
)"
```
**Stop. The founder reviews and merges.**

---

## Self-Review

**Spec coverage:** §2.1 onboarding step → Tasks 11,12; §2.2 ladder → reused in 5,12; §2.3 illustrated chips → Tasks 8,9; §2.4 provisional→earned → Tasks 1,5,6; §2.5 placeholder → Tasks 6,7; §2.6 name+greeting → Tasks 2,4,13,14; §2.7 chart fix → Task 3; re-open quiz → Task 12; Settings → Task 15; analytics → Task 12; device verify → Task 16. All spec sections map to a task.

**Placeholder scan:** No "TBD/TODO". The two illustration/animation tasks (8, 10) are craft tasks with a fully-specified contract (box, stroke, palette, per-glyph animation, reduced-motion), one worked example, the exact template file (`ReasonGlyph`), and a screenshot-verify gate — not vague placeholders. The `useGreeting` density-test flakiness is called out with a concrete fix (fake timers on an even day index).

**Type consistency:** `QuizAnswers` (Task 1) is consumed identically in Tasks 9, 12. `seedMultiplierFor`/`provisionalArchetypeMultiplier` signatures match across 1, 5, 12. `ArchetypeCard.provisional` added in 5, consumed in 6. `archetypeFor(avg, provisional)` introduced in Task 5 and referenced there only. `QuizGlyphKind` values in Task 8 match the `glyph` strings in Task 9's question data. `ArchetypePlaceholder({ onTakeQuiz })` (Task 6) matches the call in Task 7. Greeting `greetingFor(hour, name?)` consistent across 2, 13. Analytics event names added in Task 12 Step 1 match their `capture()` call sites.
