# Patterns Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Patterns tab into a clear visual spine — a hero identity, labelled sections, earning dials for forming insights, and a loud Pro earning home — without touching the engine, db, or free/Pro boundary.

**Architecture:** Every card stays a pure read-only projection over the calibration engine (`usePatterns.ts` derivations are unchanged in math). We add presentation: a shared `Gauge` primitive (the repeating motif), a `PatternsHero` (archetype as gauge identity, earned/forming states), a `PatternsSection` wrapper, `FormingDial` (progress-to-insight), and `ProReadinessCard` (Pro as readiness, not a wall). `usePatterns` gains three derived, pure presentation fields. The prediction card (S7) leaves Patterns; the Timer keeps its already-synced honest number with a copy-only reword.

**Tech Stack:** React Native 0.81 (Fabric) · Expo SDK 54 · TypeScript (strict, `noUncheckedIndexedAccess`) · Zustand · Jest + `@testing-library/react-native`. Theme via `useTheme()` over `src/theme/tokens.ts`.

## Global Constraints

- **Every spacing/size/font/color value MUST come from a theme token** in `src/theme/tokens.ts` via `useTheme()`. No inline hex/number. Add a token if missing.
- **Amber-never-red.** No red on user behaviour. Amber = honey/ripen/optimism only (`colors.accent`).
- **No streak/fail/missed/guilt language.** No "you should". No n-of-1 / quantified-self / audit jargon.
- **No gradients in dark mode** — solid surfaces + hairlines.
- **Engine math, db schema, and the Model B free/Pro boundary do NOT change.** Patterns is mostly free; only S3/S4 (accuracy + context correlations) and S12 ("what steals your time") are Pro, gated by `ProGate`.
- **Routes stay thin** — no business logic in `src/app/`; logic lives in `src/features/*` + `src/stores/*`.
- **`src/app/**` and `src/components/**` must not import `src/services/*` or `src/db/*`.**
- **Pressable gotcha:** put visual style on an inner `View`; keep `Pressable` a bare touch wrapper. No function-form `style` on `Pressable`.
- **Reduce Motion:** any animated fill must set instantly when reduce-motion is on.
- **Lint is zero-warning:** `npm run lint` (eslint `--max-warnings=0`), `npm run typecheck`, `npm test` must all pass before a task is done.
- **Commits:** Conventional Commits. **Never** add `Co-Authored-By` or any AI attribution.

---

## File Structure

**Create**
- `src/components/Gauge.tsx` — shared horizontal gauge/bar primitive (value 0–1, optional tick, indigo/amber tone).
- `src/components/__tests__/Gauge.test.tsx`
- `src/features/patterns/PatternsSection.tsx` — labelled section wrapper.
- `src/features/patterns/PatternsHero.tsx` — archetype hero (earned + forming).
- `src/features/patterns/FormingDial.tsx` — conic progress ring + "N more …" copy.
- `src/features/patterns/ProReadinessCard.tsx` — Pro earning-home card.

**Modify**
- `src/features/patterns/usePatterns.ts` — add `heroForming`, `forming`, `proReadiness` to `PatternsView`; drop `prediction`. New constants + pure derivations + tests.
- `src/features/patterns/__tests__/*` — add derivation tests; update screen test.
- `src/app/(tabs)/patterns.tsx` — rebuilt to the new spine.
- `src/features/patterns/PatternsEmpty.tsx` — restyle (single calm hero, geometric motif).
- `src/features/patterns/BiggestSurprise.tsx` — re-skin guess/actual to `Gauge` mini-bars.
- `src/app/(modals)/timer.tsx` — copy-only reword of the during-run reframe to the S7 "I bet" framing.

**Delete**
- `src/features/patterns/PredictionCard.tsx` (S7 leaves Patterns).
- `src/features/patterns/Archetype.tsx` (folded into `PatternsHero`).
- `src/features/patterns/StealsYourTimeLocked.tsx`, `AccuracyCorrelationsLocked.tsx`, `ContextCorrelationsLocked.tsx` (replaced by `ProReadinessCard`).

---

## Task 1: `Gauge` primitive

**Files:**
- Create: `src/components/Gauge.tsx`
- Test: `src/components/__tests__/Gauge.test.tsx`

**Interfaces:**
- Produces: `Gauge({ value, tickAt?, tone?, accessibilityLabel? })` where `value: number` (0–1, clamped), `tickAt?: number` (0–1), `tone?: 'indigo' | 'amber'` (default `'indigo'`), `accessibilityLabel?: string`. Also exports `gaugePositionForMultiplier(m: number): number` returning `clamp((m - 1) / 2, 0, 1)` (1× → 0, 3×+ → 1).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/__tests__/Gauge.test.tsx
import { render } from '@testing-library/react-native';
import { Gauge, gaugePositionForMultiplier } from '@/src/components/Gauge';

describe('gaugePositionForMultiplier', () => {
  it('maps 1x to the start and 3x to the end, clamped', () => {
    expect(gaugePositionForMultiplier(1)).toBe(0);
    expect(gaugePositionForMultiplier(2)).toBe(0.5);
    expect(gaugePositionForMultiplier(3)).toBe(1);
    expect(gaugePositionForMultiplier(0.5)).toBe(0); // clamped
    expect(gaugePositionForMultiplier(5)).toBe(1); // clamped
  });
});

describe('Gauge', () => {
  it('renders with an accessibility label', () => {
    const { getByLabelText } = render(<Gauge value={0.5} accessibilityLabel="halfway" />);
    expect(getByLabelText('halfway')).toBeOnTheScreen();
  });

  it('clamps value out of range without throwing', () => {
    expect(() => render(<Gauge value={2} />)).not.toThrow();
    expect(() => render(<Gauge value={-1} />)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/Gauge.test.tsx`
Expected: FAIL — cannot find module `@/src/components/Gauge`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/Gauge.tsx
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// Gauge — the repeating Patterns instrument motif. A flat horizontal track with a
// fill (0–1) and an optional tick marker. One primitive so the hero gauge, the
// est-vs-actual mini-bars, and the Pro readiness bars share one visual language.
// Pure View + tokens; no animation (callers that animate wrap their own value).
// ──────────────────────────────────────────────────────────────────────────────

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Place a multiplier on the optimism scale: 1× (honest) → 0, 3×+ → 1. */
export function gaugePositionForMultiplier(m: number): number {
  return clamp01((m - 1) / 2);
}

export function Gauge({
  value,
  tickAt,
  tone = 'indigo',
  accessibilityLabel,
}: {
  value: number;
  tickAt?: number;
  tone?: 'indigo' | 'amber';
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const pct = clamp01(value);
  const fillColor = tone === 'amber' ? t.colors.accent : t.colors.primary;

  const track: ViewStyle = {
    height: t.progress.gapTrack,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    overflow: 'hidden',
    justifyContent: 'center',
  };
  const fill: ViewStyle = {
    height: '100%',
    width: `${pct * 100}%`,
    backgroundColor: fillColor,
    borderRadius: t.radii.full,
  };
  const tick: ViewStyle = {
    position: 'absolute',
    left: `${clamp01(tickAt ?? 0) * 100}%`,
    top: -t.space[1],
    bottom: -t.space[1],
    width: t.progress.tickW,
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.full,
  };

  return (
    <View
      style={track}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={fill} />
      {tickAt !== undefined ? <View style={tick} /> : null}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/Gauge.test.tsx`
Expected: PASS (all 4).

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/components/Gauge.tsx src/components/__tests__/Gauge.test.tsx
git add src/components/Gauge.tsx src/components/__tests__/Gauge.test.tsx
git commit -m "feat(patterns): add shared Gauge instrument primitive"
```

---

## Task 2: `usePatterns` data additions + drop prediction

**Files:**
- Modify: `src/features/patterns/usePatterns.ts`
- Test: `src/features/patterns/__tests__/usePatterns.test.ts` (create if absent; else append)

**Interfaces:**
- Consumes: `PatternsData` (`{ categories: PatternCategoryStat[]; logs: PatternLog[]; nameOf }`), constants `PERSONAL_MIN_LOGS` (=3), and the existing min-sample constants in this file.
- Produces: new exports on `PatternsView`:
  - `heroForming: FormingProgress | null` — present only when `archetype === null` and `current > 0`.
  - `forming: FormingProgress[]` — free cards gated-out but started (`current > 0`), excluding archetype.
  - `proReadiness: number` — 0–1, presentation only.
  - `FormingProgress` shape: `{ id: 'archetype' | 'youVsPast' | 'planExperiment'; title: string; blurb: string; current: number; target: number }`.
  - New constant `PRO_READY_LOGS = 9`.
  - **Removed:** `prediction` field from `PatternsView`; `derivePrediction` and `PredictionCard` interface deleted.

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/patterns/__tests__/usePatterns.test.ts
import { derivePatterns } from '@/src/features/patterns/usePatterns';
import type { PatternsData } from '@/src/stores/calibrationStore';

const NOW = 1_700_000_000_000;

function data(partial: Partial<PatternsData>): PatternsData {
  return { categories: [], logs: [], nameOf: (id) => id, ...partial };
}

const log = (over: Partial<PatternsData['logs'][number]> = {}) => ({
  category: 'admin',
  estimateMin: 10,
  actualMin: 20,
  status: 'completed' as const,
  source: 'timed' as const,
  createdAt: NOW,
  ...over,
});

describe('derivePatterns presentation fields', () => {
  it('omits the prediction field entirely', () => {
    const view = derivePatterns(data({}), NOW);
    expect('prediction' in view).toBe(false);
  });

  it('exposes heroForming when archetype is not earned but logs exist', () => {
    const view = derivePatterns(data({ logs: [log(), log(), log()] }), NOW);
    expect(view.archetype).toBeNull();
    expect(view.heroForming).not.toBeNull();
    expect(view.heroForming?.id).toBe('archetype');
    expect(view.heroForming?.current).toBe(3);
    expect(view.heroForming?.target).toBeGreaterThan(3);
  });

  it('has no heroForming when there are zero completed logs', () => {
    const view = derivePatterns(data({}), NOW);
    expect(view.heroForming).toBeNull();
  });

  it('lists youVsPast in forming only once started but not yet earned', () => {
    const view = derivePatterns(data({ logs: [log(), log()] }), NOW);
    expect(view.youVsPast).toBeNull(); // needs 6
    expect(view.forming.some((f) => f.id === 'youVsPast')).toBe(true);
  });

  it('proReadiness rises with completed-log count and clamps at 1', () => {
    const few = derivePatterns(data({ logs: [log(), log(), log()] }), NOW).proReadiness;
    const many = derivePatterns(
      data({ logs: Array.from({ length: 20 }, () => log()) }),
      NOW,
    ).proReadiness;
    expect(many).toBeGreaterThan(few);
    expect(many).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/patterns/__tests__/usePatterns.test.ts`
Expected: FAIL — `heroForming` / `forming` / `proReadiness` undefined; `prediction` still present.

- [ ] **Step 3: Add the constant + FormingProgress type**

In `src/features/patterns/usePatterns.ts`, after the existing `DRIFT_MIN_GAP` constant (line ~37) add:

```ts
/** Total completed logs at which the Pro insights read as "almost ready". */
export const PRO_READY_LOGS = 9;

/** A free card that is gated-out but has started accruing data — shown as a dial. */
export interface FormingProgress {
  id: 'archetype' | 'youVsPast' | 'planExperiment';
  title: string;
  blurb: string;
  current: number;
  target: number;
}
```

- [ ] **Step 4: Remove the prediction card**

Delete the `PredictionCard` interface (the `export interface PredictionCard { … }` block) and the entire `derivePrediction` function. Remove `prediction: derivePrediction(data)` from the returned object in `derivePatterns` and remove `prediction: PredictionCard | null;` from the `PatternsView` interface. Remove the now-unused `honestNumber` import **only if** no other derivation uses it (note: `deriveCalibrationMap` still uses `honestNumber` — keep the import).

- [ ] **Step 5: Add the new derivations**

Add these pure functions near the other derivations:

```ts
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** "Your time personality is forming" — progress toward the archetype gate. */
export function deriveHeroForming(data: PatternsData): FormingProgress | null {
  const completed = completedLogs(data.logs).length;
  if (completed === 0) return null;
  if (deriveArchetype(data) !== null) return null;
  const remaining = Math.max(0, ARCHETYPE_MIN_LOGS - completed);
  return {
    id: 'archetype',
    title: 'Your time personality',
    blurb:
      remaining > 0
        ? `${remaining} more ${remaining === 1 ? 'log' : 'logs'} and it appears.`
        : 'Log across a couple of areas and it appears.',
    current: completed,
    target: ARCHETYPE_MIN_LOGS,
  };
}

/** Free cards that are gated-out but started — rendered as dials (excludes archetype). */
export function deriveForming(data: PatternsData): FormingProgress[] {
  const out: FormingProgress[] = [];
  const logs = completedLogs(data.logs);

  // you vs past-you — needs COMPARE_MIN_LOGS completed logs
  if (deriveYouVsPast(data) === null && logs.length > 0) {
    const remaining = Math.max(0, COMPARE_MIN_LOGS - logs.length);
    out.push({
      id: 'youVsPast',
      title: 'You vs past-you',
      blurb: `${remaining} more ${remaining === 1 ? 'log' : 'logs'} shows how far you've come.`,
      current: logs.length,
      target: COMPARE_MIN_LOGS,
    });
  }

  // plan vs wing it — needs EXPERIMENT_MIN_PER_ARM timed AND retro
  const timed = logs.filter((l) => l.source === 'timed').length;
  const retro = logs.filter((l) => l.source === 'retro').length;
  const armMin = Math.min(timed, retro);
  if (derivePlanExperiment(data) === null && timed + retro > 0) {
    out.push({
      id: 'planExperiment',
      title: 'Plan vs wing it',
      blurb: 'A few more timed and logged-after tasks unlocks the comparison.',
      current: armMin,
      target: EXPERIMENT_MIN_PER_ARM,
    });
  }

  return out;
}

/** Presentation-only readiness for the Pro section (0–1). Not an entitlement. */
export function deriveProReadiness(data: PatternsData): number {
  return clamp01(completedLogs(data.logs).length / PRO_READY_LOGS);
}
```

- [ ] **Step 6: Wire them into `derivePatterns` + `PatternsView`**

Add to the `PatternsView` interface:

```ts
  heroForming: FormingProgress | null;
  forming: FormingProgress[];
  proReadiness: number;
```

Add to the object returned by `derivePatterns`:

```ts
    heroForming: deriveHeroForming(data),
    forming: deriveForming(data),
    proReadiness: deriveProReadiness(data),
```

- [ ] **Step 7: Run the new tests + the full suite**

Run: `npx jest src/features/patterns`
Expected: PASS for `usePatterns.test.ts`. The screen test will still reference `prediction`/old components — fixed in Task 6. If it fails only on prediction/locked-component symbols, that is expected and resolved later; the `usePatterns` tests must pass now.

- [ ] **Step 8: Lint + commit**

```bash
npx eslint src/features/patterns/usePatterns.ts src/features/patterns/__tests__/usePatterns.test.ts
git add src/features/patterns/usePatterns.ts src/features/patterns/__tests__/usePatterns.test.ts
git commit -m "feat(patterns): derive hero-forming, forming dials, and pro readiness"
```

---

## Task 3: `PatternsSection` + `PatternsHero`

**Files:**
- Create: `src/features/patterns/PatternsSection.tsx`
- Create: `src/features/patterns/PatternsHero.tsx`
- Test: `src/features/patterns/__tests__/PatternsHero.test.tsx`

**Interfaces:**
- Consumes: `Gauge`, `gaugePositionForMultiplier` (Task 1); `ArchetypeCard`, `FormingProgress` (Task 2); `Card`, `useTheme`, `type`.
- Produces:
  - `PatternsSection({ label, children })` — renders a muted uppercase label + children; renders `null` if `children` is falsy/empty.
  - `PatternsHero({ archetype, forming, onShare? })` — earned state when `archetype` non-null, forming state when `forming` non-null, `null` if both null.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/patterns/__tests__/PatternsHero.test.tsx
import { render } from '@testing-library/react-native';
import { PatternsHero } from '@/src/features/patterns/PatternsHero';

describe('PatternsHero', () => {
  it('renders the earned identity with the multiplier', () => {
    const { getByText } = render(
      <PatternsHero
        archetype={{ title: 'The Sprint Optimist', blurb: 'Mind moves fast.', averageMultiplier: 1.9 }}
        forming={null}
      />,
    );
    expect(getByText('The Sprint Optimist')).toBeOnTheScreen();
    expect(getByText(/1\.9×/)).toBeOnTheScreen();
  });

  it('renders the forming state with remaining logs', () => {
    const { getByText } = render(
      <PatternsHero
        archetype={null}
        forming={{ id: 'archetype', title: 'Your time personality', blurb: '3 more logs and it appears.', current: 9, target: 12 }}
      />,
    );
    expect(getByText('Your time personality')).toBeOnTheScreen();
    expect(getByText('3 more logs and it appears.')).toBeOnTheScreen();
  });

  it('renders nothing when both are null', () => {
    const { toJSON } = render(<PatternsHero archetype={null} forming={null} />);
    expect(toJSON()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/patterns/__tests__/PatternsHero.test.tsx`
Expected: FAIL — cannot find module `PatternsHero`.

- [ ] **Step 3: Implement `PatternsSection`**

```tsx
// src/features/patterns/PatternsSection.tsx
import { View, Text, type TextStyle } from 'react-native';
import { type ReactNode, Children } from 'react';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// PatternsSection — a muted uppercase section label over its cards. Renders null
// when it has no children, so empty sections never leave a dangling header.
// One spacing source: the section owns its top gap; cards own their own bottom gap.
// ──────────────────────────────────────────────────────────────────────────────

export function PatternsSection({ label, children }: { label: string; children: ReactNode }) {
  const t = useTheme();
  if (Children.toArray(children).length === 0) return null;

  const labelStyle: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginBottom: t.space[3],
    marginLeft: t.space[1],
  };

  return (
    <View style={{ marginTop: t.space[5] }}>
      <Text style={labelStyle}>{label}</Text>
      {children}
    </View>
  );
}
```

- [ ] **Step 4: Implement `PatternsHero`**

```tsx
// src/features/patterns/PatternsHero.tsx
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { Gauge, gaugePositionForMultiplier } from '@/src/components/Gauge';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { ArchetypeCard, FormingProgress } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// PatternsHero — the screen anchor. Earned: the time-personality name + multiplier
// + an optimism gauge (1× honest → 3×+ optimist) + Share. Forming: the same focal
// shell, but the body becomes the most important earning dial. Never both; null
// when neither has data (a brand-new user sees the empty state instead).
// ──────────────────────────────────────────────────────────────────────────────

export function PatternsHero({
  archetype,
  forming,
  onShare,
}: {
  archetype: ArchetypeCard | null;
  forming: FormingProgress | null;
  onShare?: () => void;
}) {
  const t = useTheme();

  const kicker: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const name: TextStyle = { ...(type.title as unknown as TextStyle), color: t.colors.ink, marginTop: t.space[1] };
  const desc: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, marginTop: t.space[2] };
  const mult: TextStyle = { color: t.colors.accent };
  const glab: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkFaint, fontSize: t.fontSize['2xs'], letterSpacing: 1 };
  const labRow: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', marginTop: t.space[2] };

  if (archetype) {
    const m = archetype.averageMultiplier;
    return (
      <Card tone="focal" style={{ gap: t.space[1] }}>
        <Text style={kicker}>YOUR TIME PERSONALITY</Text>
        <Text style={name}>{archetype.title}</Text>
        <Text style={desc}>
          You need about <Text style={mult}>{m.toFixed(1)}×</Text> your gut guess — {archetype.blurb}
        </Text>
        <View style={{ marginTop: t.space[4] }}>
          <Gauge
            value={gaugePositionForMultiplier(m)}
            tone="indigo"
            accessibilityLabel={`Your optimism gauge: about ${m.toFixed(1)} times your guess`}
          />
          <View style={labRow}>
            <Text style={glab}>HONEST · 1×</Text>
            <Text style={glab}>BIG OPTIMIST · 3×+</Text>
          </View>
        </View>
        {onShare ? (
          <Pressable
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel="Share your time personality"
            hitSlop={8}
            style={{ marginTop: t.space[4], alignSelf: 'flex-start' }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space[2],
                backgroundColor: t.colors.surfaceSunken,
                paddingVertical: t.space[2],
                paddingHorizontal: t.space[3],
                borderRadius: t.radii.full,
              }}
            >
              <Ionicons name="share-outline" size={t.iconSize.sm} color={t.colors.ink} />
              <Text style={{ ...(type.bodySm as unknown as TextStyle), color: t.colors.ink }}>Share this</Text>
            </View>
          </Pressable>
        ) : null}
      </Card>
    );
  }

  if (forming) {
    const progress = forming.target > 0 ? forming.current / forming.target : 0;
    return (
      <Card tone="focal" style={{ gap: t.space[1] }}>
        <Text style={kicker}>YOUR TIME PERSONALITY</Text>
        <Text style={name}>{forming.title}</Text>
        <Text style={{ ...(type.bodyLg as unknown as TextStyle), color: t.colors.inkSoft, marginTop: t.space[2] }}>
          {forming.blurb}
        </Text>
        <View style={{ marginTop: t.space[4] }}>
          <Gauge value={progress} tone="indigo" accessibilityLabel={`${forming.current} of ${forming.target} logs`} />
          <Text style={{ ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint, marginTop: t.space[2] }}>
            {forming.current} of {forming.target} logs
          </Text>
        </View>
      </Card>
    );
  }

  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/features/patterns/__tests__/PatternsHero.test.tsx`
Expected: PASS (all 3).

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/features/patterns/PatternsSection.tsx src/features/patterns/PatternsHero.tsx src/features/patterns/__tests__/PatternsHero.test.tsx
git add src/features/patterns/PatternsSection.tsx src/features/patterns/PatternsHero.tsx src/features/patterns/__tests__/PatternsHero.test.tsx
git commit -m "feat(patterns): add section wrapper and archetype hero"
```

---

## Task 4: `FormingDial`

**Files:**
- Create: `src/features/patterns/FormingDial.tsx`
- Test: `src/features/patterns/__tests__/FormingDial.test.tsx`

**Interfaces:**
- Consumes: `FormingProgress` (Task 2); `Card`, `useTheme`, `type`.
- Produces: `FormingDial({ item })` where `item: FormingProgress` — a card row: a ring showing `current/target` + title + blurb.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/patterns/__tests__/FormingDial.test.tsx
import { render } from '@testing-library/react-native';
import { FormingDial } from '@/src/features/patterns/FormingDial';

describe('FormingDial', () => {
  it('shows the title, blurb, and remaining count', () => {
    const { getByText } = render(
      <FormingDial item={{ id: 'youVsPast', title: 'You vs past-you', blurb: '4 more logs shows how far you have come.', current: 2, target: 6 }} />,
    );
    expect(getByText('You vs past-you')).toBeOnTheScreen();
    expect(getByText('4 more logs shows how far you have come.')).toBeOnTheScreen();
    expect(getByText('4 to go')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/patterns/__tests__/FormingDial.test.tsx`
Expected: FAIL — cannot find module `FormingDial`.

- [ ] **Step 3: Implement**

```tsx
// src/features/patterns/FormingDial.tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { FormingProgress } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// FormingDial — a calm "almost there" row for a free insight that hasn't earned
// its card yet. A small ring (current/target) turns absence into anticipation.
// The ring is a flat token-built disc with an inner cut-out; no animation needed.
// ──────────────────────────────────────────────────────────────────────────────

export function FormingDial({ item }: { item: FormingProgress }) {
  const t = useTheme();
  const remaining = Math.max(0, item.target - item.current);

  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[4] };
  const ring: ViewStyle = {
    width: t.size.coin,
    height: t.size.coin,
    borderRadius: t.radii.full,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const ringNum: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.primary };
  const title: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const blurb: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, marginTop: t.space[0.5] };

  return (
    <Card tone="flat" style={{ marginBottom: t.space[3] }}>
      <View style={row}>
        <View style={ring} accessibilityLabel={`${item.current} of ${item.target}`}>
          <Text style={ringNum}>{remaining} to go</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={title}>{item.title}</Text>
          <Text style={blurb}>{item.blurb}</Text>
        </View>
      </View>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/patterns/__tests__/FormingDial.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/patterns/FormingDial.tsx src/features/patterns/__tests__/FormingDial.test.tsx
git add src/features/patterns/FormingDial.tsx src/features/patterns/__tests__/FormingDial.test.tsx
git commit -m "feat(patterns): add forming-dial card for unearned insights"
```

---

## Task 5: `ProReadinessCard`

**Files:**
- Create: `src/features/patterns/ProReadinessCard.tsx`
- Test: `src/features/patterns/__tests__/ProReadinessCard.test.tsx`

**Interfaces:**
- Consumes: `Gauge` (Task 1); `Card`, `useTheme`, `type`.
- Produces: `ProReadinessCard({ title, benefit, readiness })` where `readiness: number` (0–1). Status chip text: `readiness >= 0.7 ? 'ALMOST READY' : 'EARNING'`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/patterns/__tests__/ProReadinessCard.test.tsx
import { render } from '@testing-library/react-native';
import { ProReadinessCard } from '@/src/features/patterns/ProReadinessCard';

describe('ProReadinessCard', () => {
  it('reads ALMOST READY at high readiness', () => {
    const { getByText } = render(
      <ProReadinessCard title="What steals your time" benefit="Why your tasks run over." readiness={0.8} />,
    );
    expect(getByText('What steals your time')).toBeOnTheScreen();
    expect(getByText('ALMOST READY')).toBeOnTheScreen();
  });

  it('reads EARNING at low readiness', () => {
    const { getByText } = render(
      <ProReadinessCard title="When you're sharpest" benefit="Your best hours." readiness={0.3} />,
    );
    expect(getByText('EARNING')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/patterns/__tests__/ProReadinessCard.test.tsx`
Expected: FAIL — cannot find module `ProReadinessCard`.

- [ ] **Step 3: Implement**

```tsx
// src/features/patterns/ProReadinessCard.tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Card } from '@/src/components/Card';
import { Gauge } from '@/src/components/Gauge';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// ProReadinessCard — the loud earning home. A locked Pro insight shown as PROGRESS,
// not a wall: a benefit line + an amber readiness bar + a status chip. Conveys
// "you're earning this", never "you can't have this". ProGate owns the unlocked
// swap; this is only the locked/earning face.
// ──────────────────────────────────────────────────────────────────────────────

export function ProReadinessCard({
  title,
  benefit,
  readiness,
}: {
  title: string;
  benefit: string;
  readiness: number;
}) {
  const t = useTheme();
  const almost = readiness >= 0.7;

  const card: ViewStyle = {
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.accentSoft,
    marginBottom: t.space[3],
  };
  const chip: ViewStyle = {
    alignSelf: 'flex-start',
    backgroundColor: t.colors.accentSoft,
    paddingVertical: t.space[1],
    paddingHorizontal: t.space[2.5],
    borderRadius: t.radii.sm,
    marginBottom: t.space[2],
  };
  const chipText: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText, fontSize: t.fontSize['2xs'] };
  const titleText: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, marginBottom: t.space[1] };
  const benefitText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, marginBottom: t.space[3] };

  return (
    <Card tone="flat" style={card}>
      <View style={chip}>
        <Text style={chipText}>{almost ? 'ALMOST READY' : 'EARNING'}</Text>
      </View>
      <Text style={titleText}>{title}</Text>
      <Text style={benefitText}>{benefit}</Text>
      <Gauge value={readiness} tone="amber" accessibilityLabel={`${Math.round(readiness * 100)} percent ready`} />
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/patterns/__tests__/ProReadinessCard.test.tsx`
Expected: PASS (both).

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/patterns/ProReadinessCard.tsx src/features/patterns/__tests__/ProReadinessCard.test.tsx
git add src/features/patterns/ProReadinessCard.tsx src/features/patterns/__tests__/ProReadinessCard.test.tsx
git commit -m "feat(patterns): add pro readiness card for the earning home"
```

---

## Task 6: Re-skin `BiggestSurprise` to the gauge motif

**Files:**
- Modify: `src/features/patterns/BiggestSurprise.tsx`
- Test: `src/features/patterns/__tests__/BiggestSurprise.test.tsx` (create)

**Interfaces:**
- Consumes: `Gauge` (Task 1); existing `BiggestSurpriseCard`, `PatternCard`.
- Produces: unchanged export `BiggestSurprise({ card })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/patterns/__tests__/BiggestSurprise.test.tsx
import { render } from '@testing-library/react-native';
import { BiggestSurprise } from '@/src/features/patterns/BiggestSurprise';

describe('BiggestSurprise', () => {
  it('renders guess and actual as labelled values', () => {
    const { getByText } = render(
      <BiggestSurprise card={{ categoryId: 'cleaning', categoryName: 'Cleaning', estimateMin: 10, actualMin: 30, ratio: 3 }} />,
    );
    expect(getByText('Cleaning stretched the most this week.')).toBeOnTheScreen();
    expect(getByText('GUESS')).toBeOnTheScreen();
    expect(getByText('ACTUAL')).toBeOnTheScreen();
    expect(getByText('10m')).toBeOnTheScreen();
    expect(getByText('30m')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/patterns/__tests__/BiggestSurprise.test.tsx`
Expected: FAIL — "GUESS" / "ACTUAL" not found (current copy is a sentence).

- [ ] **Step 3: Replace the body**

```tsx
// src/features/patterns/BiggestSurprise.tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { Gauge } from '@/src/components/Gauge';
import { PatternCard } from './PatternCard';
import type { BiggestSurpriseCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// BiggestSurprise (S6) — the week's largest guess-vs-reality gap. Now shown as two
// gauge mini-bars (guess vs actual) so the gap is visible, not just stated. The
// bigger of the two is the denominator; amber marks the actual. Curiosity, never
// a callout.
// ──────────────────────────────────────────────────────────────────────────────

export function BiggestSurprise({ card }: { card: BiggestSurpriseCard }) {
  const t = useTheme();

  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, marginTop: t.space[2.5] };
  const rowLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkFaint, fontSize: t.fontSize['2xs'], width: t.space[12] };
  const rowVal: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, width: t.space[10], textAlign: 'right' };
  const barRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2.5], marginTop: t.space[2] };

  const ranLonger = card.actualMin > card.estimateMin;
  const headlineText = ranLonger
    ? `${card.categoryName} stretched the most this week.`
    : `${card.categoryName} wrapped up early this week.`;
  const denom = Math.max(card.estimateMin, card.actualMin, 1);

  return (
    <PatternCard eyebrow="THIS WEEK'S SURPRISE" icon="bulb-outline" dismissLabel="Hide this week's surprise">
      <Text style={headline}>{headlineText}</Text>
      <View style={barRow}>
        <Text style={rowLabel}>GUESS</Text>
        <View style={{ flex: 1 }}><Gauge value={card.estimateMin / denom} tone="indigo" /></View>
        <Text style={rowVal}>{card.estimateMin}m</Text>
      </View>
      <View style={barRow}>
        <Text style={rowLabel}>ACTUAL</Text>
        <View style={{ flex: 1 }}><Gauge value={card.actualMin / denom} tone="amber" /></View>
        <Text style={rowVal}>{card.actualMin}m</Text>
      </View>
      <Text style={detail}>Worth a mental note for next time. Now you know.</Text>
    </PatternCard>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/patterns/__tests__/BiggestSurprise.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/patterns/BiggestSurprise.tsx src/features/patterns/__tests__/BiggestSurprise.test.tsx
git add src/features/patterns/BiggestSurprise.tsx src/features/patterns/__tests__/BiggestSurprise.test.tsx
git commit -m "feat(patterns): re-skin biggest surprise with gauge mini-bars"
```

---

## Task 7: Rebuild the screen spine + restyle empty + remove S7 from Patterns

**Files:**
- Modify: `src/app/(tabs)/patterns.tsx`
- Modify: `src/features/patterns/PatternsEmpty.tsx`
- Delete: `src/features/patterns/PredictionCard.tsx`, `src/features/patterns/Archetype.tsx`, `src/features/patterns/StealsYourTimeLocked.tsx`, `src/features/patterns/AccuracyCorrelationsLocked.tsx`, `src/features/patterns/ContextCorrelationsLocked.tsx`
- Test: `src/features/patterns/__tests__/patternsScreen.test.tsx` (update)

**Interfaces:**
- Consumes: `usePatterns().view` with the Task-2 shape; `PatternsHero`, `PatternsSection`, `FormingDial`, `ProReadinessCard`; existing `BiggestSurprise`, `YouVsPast`, `PlanExperiment`/`PlanExperimentPending`, `DriftAlert`, `CalibrationMap`, `WeeklyReview`, `ProGate`, `StealsYourTime`, `StealsYourTimeWeekly`, `AccuracyCorrelations`, `ContextCorrelations`, `useReasonInsights`, `useContextInsights`.

- [ ] **Step 1: Delete the retired components**

```bash
git rm src/features/patterns/PredictionCard.tsx src/features/patterns/Archetype.tsx \
  src/features/patterns/StealsYourTimeLocked.tsx src/features/patterns/AccuracyCorrelationsLocked.tsx \
  src/features/patterns/ContextCorrelationsLocked.tsx
```

- [ ] **Step 2: Rebuild `patterns.tsx`**

```tsx
// src/app/(tabs)/patterns.tsx
import { ScrollView } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { usePatterns } from '@/src/features/patterns/usePatterns';
import { PatternsHero } from '@/src/features/patterns/PatternsHero';
import { PatternsSection } from '@/src/features/patterns/PatternsSection';
import { FormingDial } from '@/src/features/patterns/FormingDial';
import { ProReadinessCard } from '@/src/features/patterns/ProReadinessCard';
import { PlanExperiment, PlanExperimentPending } from '@/src/features/patterns/PlanExperiment';
import { YouVsPast } from '@/src/features/patterns/YouVsPast';
import { BiggestSurprise } from '@/src/features/patterns/BiggestSurprise';
import { DriftAlert } from '@/src/features/patterns/DriftAlert';
import { CalibrationMap } from '@/src/features/patterns/CalibrationMap';
import { PatternsEmpty } from '@/src/features/patterns/PatternsEmpty';
import { WeeklyReview } from '@/src/features/patterns/WeeklyReview';
import { useReasonInsights } from '@/src/features/patterns/useReasonInsights';
import { ProGate } from '@/src/features/paywall/ProGate';
import { StealsYourTime } from '@/src/features/patterns/StealsYourTime';
import { StealsYourTimeWeekly } from '@/src/features/patterns/StealsYourTimeWeekly';
import { AccuracyCorrelations } from '@/src/features/patterns/AccuracyCorrelations';
import { useContextInsights } from '@/src/features/patterns/useContextInsights';
import { ContextCorrelations } from '@/src/features/patterns/ContextCorrelations';

// ──────────────────────────────────────────────────────────────────────────────
// Patterns — the free, read-only self-insight surface (the "Mirror"). A clear
// spine: hero identity → This week → Your growth → Still forming (dials) →
// Go deeper (Pro, as readiness not a wall). Every card is a pure projection over
// the engine. No guilt, no streaks, amber stays scarce.
// ──────────────────────────────────────────────────────────────────────────────

export default function Patterns() {
  const t = useTheme();
  const { view } = usePatterns();
  const { insights } = useReasonInsights();
  const { insights: contextInsights } = useContextInsights();

  if (view === null) {
    return (
      <Screen>
        <ScreenHeader title="Patterns" subtitle="What your time keeps telling you." />
      </Screen>
    );
  }

  if (view.empty) {
    return (
      <Screen>
        <ScreenHeader title="Patterns" subtitle="What your time keeps telling you." />
        <PatternsEmpty />
      </Screen>
    );
  }

  const showPlanPending = view.planExperiment === null && !view.forming.some((f) => f.id === 'planExperiment');
  const hasThisWeek = view.biggestSurprise !== null || view.driftAlert !== null;
  const hasGrowth = view.youVsPast !== null || view.planExperiment !== null || showPlanPending || view.calibrationMap.length > 0;
  const proBenefitSteals = 'Why your tasks run over — interruptions, switching, or just bigger than they look.';
  const proBenefitSharp = "When you're sharpest — by time of day, weekday, and energy.";

  return (
    <Screen>
      <ScreenHeader title="Patterns" subtitle="What your time keeps telling you." />
      <ScrollView
        contentContainerStyle={{ paddingBottom: t.space[12] }}
        showsVerticalScrollIndicator={false}
      >
        <WeeklyReview view={view} />

        <PatternsHero archetype={view.archetype} forming={view.heroForming} />

        {hasThisWeek ? (
          <PatternsSection label="This week">
            {view.biggestSurprise ? <BiggestSurprise card={view.biggestSurprise} /> : null}
            {view.driftAlert ? <DriftAlert card={view.driftAlert} /> : null}
          </PatternsSection>
        ) : null}

        {hasGrowth ? (
          <PatternsSection label="Your growth">
            {view.youVsPast ? <YouVsPast card={view.youVsPast} /> : null}
            {view.planExperiment ? (
              <PlanExperiment card={view.planExperiment} />
            ) : showPlanPending ? (
              <PlanExperimentPending />
            ) : null}
            {view.calibrationMap.length > 0 ? <CalibrationMap rows={view.calibrationMap} /> : null}
          </PatternsSection>
        ) : null}

        {view.forming.length > 0 ? (
          <PatternsSection label="Still forming">
            {view.forming.map((item) => (
              <FormingDial key={item.id} item={item} />
            ))}
          </PatternsSection>
        ) : null}

        <PatternsSection label="Go deeper · Pro">
          <ProGate fallback={<ProReadinessCard title="What steals your time" benefit={proBenefitSteals} readiness={view.proReadiness} />}>
            {insights.length > 0 ? (
              <>
                <StealsYourTime insights={insights} />
                <StealsYourTimeWeekly insights={insights} />
              </>
            ) : (
              <ProReadinessCard title="What steals your time" benefit={proBenefitSteals} readiness={view.proReadiness} />
            )}
          </ProGate>
          <ProGate fallback={<ProReadinessCard title="When you're sharpest" benefit={proBenefitSharp} readiness={view.proReadiness} />}>
            {view.accuracyCorrelations.length > 0 ? (
              <AccuracyCorrelations correlations={view.accuracyCorrelations} />
            ) : (
              <ProReadinessCard title="When you're sharpest" benefit={proBenefitSharp} readiness={view.proReadiness} />
            )}
            {contextInsights.length > 0 ? <ContextCorrelations correlations={contextInsights} /> : null}
          </ProGate>
        </PatternsSection>
      </ScrollView>
    </Screen>
  );
}
```

> Note: `ProGate`'s `fallback` is what a non-Pro user sees; the children are the unlocked render. Both now degrade to `ProReadinessCard` when the underlying data isn't earned yet, so the Pro section always shows the earning narrative rather than disappearing. Verify `ProGate`'s prop name is `fallback` (it is, per the current screen); if not, match the existing API.

- [ ] **Step 3: Restyle `PatternsEmpty`**

Open `src/features/patterns/PatternsEmpty.tsx`. Keep its existing exported name and the headline string the screen test expects (`Your patterns are on the way`) OR update both together. Replace its body with a single calm hero: a centered geometric honeycomb/gauge motif (reuse `Gauge` at a low value as the motif, or a small honeycomb `View` cluster from tokens), the headline, and one warm sub-line. No bee, no creature. Example:

```tsx
// src/features/patterns/PatternsEmpty.tsx
import { View, Text, type TextStyle } from 'react-native';
import { Card } from '@/src/components/Card';
import { Gauge } from '@/src/components/Gauge';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

export function PatternsEmpty() {
  const t = useTheme();
  const title: TextStyle = { ...(type.title as unknown as TextStyle), color: t.colors.ink, textAlign: 'center', marginTop: t.space[4] };
  const sub: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.inkSoft, textAlign: 'center', marginTop: t.space[2] };

  return (
    <Card tone="focal" style={{ alignItems: 'center', paddingVertical: t.space[8] }}>
      <View style={{ width: '60%', gap: t.space[2] }}>
        <Gauge value={0.25} tone="indigo" />
        <Gauge value={0.55} tone="amber" />
        <Gauge value={0.4} tone="indigo" />
      </View>
      <Text style={title}>Your patterns are on the way</Text>
      <Text style={sub}>Log a few tasks and your time personality starts to appear here. No rush.</Text>
    </Card>
  );
}
```

> If the existing `PatternsEmpty` headline differs from `Your patterns are on the way`, update the screen test in Step 5 to match whichever string you ship — keep them identical.

- [ ] **Step 4: Update the screen test**

Open `src/features/patterns/__tests__/patternsScreen.test.tsx`. (a) Ensure the empty-state assertion matches the headline shipped in Step 3. (b) In the "renders earned cards" test, replace any assertion on the old `WHAT TO EXPECT` prediction card or `*Locked` components. Add an assertion that the hero forming/earned state renders and that the Pro section shows a readiness card when not entitled. Concretely, add:

```tsx
  it('shows the hero (forming) and a pro readiness card for a non-pro user', async () => {
    setPatternsData({
      nameOf: (id) => id,
      categories: [{ categoryId: 'admin', n: 3, mEffective: 2.0, sharpness: 50 }],
      logs: Array.from({ length: 3 }, () => ({
        category: 'admin',
        estimateMin: 10,
        actualMin: 20,
        status: 'completed' as const,
        source: 'timed' as const,
        createdAt: NOW,
      })),
    });

    render(<Patterns />);

    await waitFor(() => {
      expect(screen.getByText('YOUR TIME PERSONALITY')).toBeOnTheScreen();
    });
    // Pro section degrades to the earning card, never vanishes.
    expect(screen.getByText('What steals your time')).toBeOnTheScreen();
  });
```

> If `ProGate` reads entitlement from a store, ensure the test's default (non-Pro) path renders the `fallback`. If `ProGate` needs a store stub to be non-Pro, add it to `setPatternsData` or a `beforeEach` mirroring how other tests stub entitlement.

- [ ] **Step 5: Run the patterns tests**

Run: `npx jest src/features/patterns`
Expected: PASS across the suite (screen + all component + derivation tests).

- [ ] **Step 6: Typecheck (catches dropped `prediction`/deleted imports anywhere)**

Run: `npm run typecheck`
Expected: no errors. If any file still imports `PredictionCard`/`Archetype`/`*Locked`, remove those imports.

- [ ] **Step 7: Lint + commit**

```bash
npm run lint
git add -A src/app/\(tabs\)/patterns.tsx src/features/patterns/
git commit -m "feat(patterns): rebuild screen spine with hero, sections, and pro earning home"
```

---

## Task 8: Timer "I bet" copy reword (S7 relocation)

**Files:**
- Modify: `src/app/(modals)/timer.tsx` (the during-run reframe block, around lines 200–207)

**Interfaces:**
- Consumes: existing `guessRounded` and `honestRounded` already computed in `timer.tsx` (no new data, no recompute). The honest number remains the param passed from Today's FocusCard — parity is preserved by construction.

- [ ] **Step 1: Reword the reframe**

Replace the reframe `View` block (the four `AppText` lines: `guessed {guessRounded}m → honest ~{honestRounded}m`) with the playful S7 framing, reusing the same values. Compute the multiplier inline from the two numbers already present:

```tsx
          <View style={reframeRow}>
            <AppText style={reframeStrong}>I bet</AppText>
            <AppText style={reframeHonest}>~{honestRounded}m</AppText>
            <AppText style={reframeSoft}>
              · {(honestRounded / Math.max(1, guessRounded)).toFixed(1)}× your {guessRounded}m guess
            </AppText>
          </View>
```

> Copy honours `humanizer` + `conversion-psychology`: a low-stakes "bet", amber honest number, no guilt. Keep the existing `reframeRow`/`reframeStrong`/`reframeSoft`/`reframeHonest` styles. Do **not** touch `useTimer`, the auto-start/attach flow, or the route params.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint "src/app/(modals)/timer.tsx"`
Expected: no errors/warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(modals\)/timer.tsx
git commit -m "feat(timer): reframe honest number as the playful I-bet prediction"
```

---

## Task 9: Full verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all green. Investigate any failure referencing deleted symbols (`PredictionCard`, `Archetype`, `*Locked`) and remove stragglers.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Lint (zero warnings)**

Run: `npm run lint`
Expected: clean (eslint `--max-warnings=0`).

- [ ] **Step 4: Manual sim check (per CLAUDE.md — no CLI tap; verify by eye)**

Run `npm run ios`, open the Patterns tab in three data states if reachable (empty / forming / earned). Confirm: hero present, sections labelled, dials show "N to go", Pro shows readiness (not blank), no red anywhere, no gradient banding in dark mode, spacing rhythm consistent. Capture `xcrun simctl io booted screenshot` and eyeball alignment/typography against the design (CLAUDE.md frontend-craft rules). Fix before declaring done.

- [ ] **Step 5: Final commit if the sim pass required tweaks**

```bash
git add -A
git commit -m "fix(patterns): polish spacing and alignment from sim review"
```

---

## Self-Review

**Spec coverage** — every spec section maps to a task:
- §3 spine / sections → Task 7 (screen) + Task 3 (`PatternsSection`).
- §3.1 S7 relocation → Task 2 (drop `prediction`), Task 7 (delete `PredictionCard`), Task 8 (Timer reword). Sync preserved (no recompute) — documented in Task 8 interface.
- §4 hero (earned + forming) → Task 3.
- §5 gauge motif → Task 1, reused in Tasks 3/5/6/7.
- §6 `PatternsSection` → Task 3.
- §7 forming dials + `forming[]` → Task 2 + Task 4 + Task 7.
- §8 Pro earning home → Task 2 (`proReadiness`) + Task 5 + Task 7.
- §9 copy → applied in each component; final pass folded into Tasks 7/8 + Task 9 eye-check.
- §10 inventory (new/changed/deleted/reused) → Tasks 1–8 line up 1:1.
- §11 invariants → Global Constraints + amber/tone choices in every component.
- §12 testing → tests in Tasks 1–7; sweep in Task 9.
- §13 phasing → task order matches.

**Placeholder scan** — no TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency** — `FormingProgress` (`id|title|blurb|current|target`) defined in Task 2, consumed unchanged in Tasks 3/4/7. `Gauge` props (`value|tickAt?|tone?|accessibilityLabel?`) defined in Task 1, consumed in Tasks 3/5/6/7. `PatternsHero({archetype, forming, onShare?})`, `ProReadinessCard({title, benefit, readiness})`, `FormingDial({item})` consistent across definition and use. `prediction` removed in Task 2 and no later task references it.

**Open risk flagged for the implementer:** `ProGate`'s exact prop/entitlement API and the existing `PatternsEmpty` headline string — both verified-against-current-code notes are inline in Task 7. Match the shipped string in the test.
