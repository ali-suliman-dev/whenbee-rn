# Patterns Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Patterns tab from a flat sameness-scroll into a hero + sectioned story (identity → progress → what changed → numbers → Pro), with a premium Pro teaser and restrained entrance motion.

**Architecture:** Presentation-only over the existing gated view model in `usePatterns`, plus ONE new pure engine derivation (`buildAccuracySeries`) feeding a new `ProgressChart`. The route `src/app/(tabs)/patterns.tsx` stays thin and composes new section components from the existing `usePatterns()` / `useReasonInsights()` / `useContextInsights()` hooks. The three `*Locked` Pro teasers collapse into one premium `ProTeaserCard`.

**Tech Stack:** React Native (Expo SDK 54), TypeScript (strict + `noUncheckedIndexedAccess`), Zustand, react-native-svg 15, react-native-reanimated 4, Jest. Theming via `src/theme/tokens.ts` + `useTheme()`. Spec: `docs/superpowers/specs/2026-06-21-patterns-redesign-design.md`. Visual reference: `docs/superpowers/mockups/patterns-combined.html`.

## Global Constraints

- **Product invariants (never violate):** no guilt/shame, no streaks; amber never becomes red; honey/sharpness monotonic; core loop on-device-only; pricing read from RevenueCat, never hardcoded.
- **Tokens only:** every color/spacing/size/font/radius/motion value comes from a `src/theme/tokens.ts` token via `useTheme()`. No raw hex or magic number in a component. A NEW token group requires a matching line in `resolveTheme` (`src/theme/useTheme.ts`) or `t.<key>` is `undefined`.
- **Engine purity:** `src/engine/**` is pure TS — no React/RN/Expo, no `Date.now()`/clock. Clock bucketing happens only in `usePatterns` (the existing pattern). Tune via `src/engine/constants.ts`, never inline magic numbers.
- **Reanimated on Fabric:** entering-only. NEVER use `exiting` layout animations (SIGABRT on conditionally-unmounted views). Read/write shared values with `.get()/.set()`, never `.value`. Imported helpers called inside a worklet need `'worklet';`.
- **Pressable gotcha:** `reactCompiler` + nativewind drop function-form `style={({pressed})=>…}` on `Pressable`. Put visuals on an inner `View`/`Animated.View`; keep `Pressable` a bare touch wrapper.
- **TDD for logic** (engine + hook derivations): write the failing test first. UI components get a render/snapshot test.
- **Lint flat config:** `npx eslint <files>` (there is no `.eslintrc.js`). `npm run lint` = `eslint . --max-warnings=0`.
- **Commits:** Conventional Commits, NO AI/co-author attribution. Branch `feat/patterns-redesign` already exists and is checked out. **Never merge** — open a PR, founder merges.
- Run `npm run lint && npm run typecheck && npm test` green before the PR.

---

### Task 1: Engine — `buildAccuracySeries`

Pure derivation that turns an ordered list of clamped ratios into a short accuracy series + delta, for the new progress chart. Returns `null` below a min-log gate so the UI can fall back to the 2-point then-vs-now.

**Files:**
- Create: `src/engine/accuracyTrend.ts`
- Modify: `src/engine/constants.ts` (add gate + bucket constants)
- Modify: `src/engine/index.ts` (export)
- Test: `src/engine/__tests__/accuracyTrend.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  ```ts
  export interface AccuracyTrend { points: number[]; deltaPts: number; }
  export function buildAccuracySeries(ratios: number[]): AccuracyTrend | null;
  ```
  `points` = bucket accuracies (0–100), oldest→newest, length 2..`ACCURACY_TREND_BUCKETS`. `deltaPts` = `last − first` (raw; may be negative — the UI never frames it as loss).

- [ ] **Step 1: Add constants**

In `src/engine/constants.ts`, append after the Accuracy-correlations block (after line 76):
```ts
// ── Accuracy trend series (ProgressChart — "you, then vs now") ────────────────
export const ACCURACY_TREND_MIN_LOGS = 6; // below this, UI falls back to 2-point
export const ACCURACY_TREND_BUCKETS = 6; // max ordered windows in the series
```

- [ ] **Step 2: Write the failing test**

Create `src/engine/__tests__/accuracyTrend.test.ts`:
```ts
import { buildAccuracySeries } from '../accuracyTrend';

// Helper: a ratio of 1 is a perfect guess (accuracy 100); 2 or 0.5 is ~50.
const perfect = (n: number) => Array(n).fill(1);

describe('buildAccuracySeries', () => {
  it('returns null below the min-log gate', () => {
    expect(buildAccuracySeries(perfect(5))).toBeNull();
  });

  it('buckets ordered ratios into an accuracy series', () => {
    const out = buildAccuracySeries(perfect(12));
    expect(out).not.toBeNull();
    expect(out!.points).toHaveLength(6);
    out!.points.forEach((p) => expect(p).toBe(100));
    expect(out!.deltaPts).toBe(0);
  });

  it('reports a positive delta when recent buckets are sharper', () => {
    // first half loose (ratio 2 → ~50), second half perfect (ratio 1 → 100)
    const ratios = [...Array(6).fill(2), ...Array(6).fill(1)];
    const out = buildAccuracySeries(ratios);
    expect(out).not.toBeNull();
    expect(out!.points[0]).toBeLessThan(out!.points[out!.points.length - 1]);
    expect(out!.deltaPts).toBeGreaterThan(0);
  });

  it('caps the series at ACCURACY_TREND_BUCKETS even with many logs', () => {
    const out = buildAccuracySeries(perfect(40));
    expect(out!.points.length).toBeLessThanOrEqual(6);
  });

  it('allows a negative delta (steady/loosening) without throwing', () => {
    const ratios = [...Array(6).fill(1), ...Array(6).fill(2)];
    const out = buildAccuracySeries(ratios);
    expect(out!.deltaPts).toBeLessThan(0);
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `npx jest src/engine/__tests__/accuracyTrend.test.ts`
Expected: FAIL — "Cannot find module '../accuracyTrend'".

- [ ] **Step 4: Implement**

Create `src/engine/accuracyTrend.ts`:
```ts
// ProgressChart series — "you, then vs now". PURE TS: no React/RN, no clock.
// Caller passes already-ordered clamped ratios (oldest → newest). Buckets them
// into <= ACCURACY_TREND_BUCKETS contiguous windows and reports each window's
// accuracy (same shape as engine sharpness: 100·(1 − mean(min(1,|1 − 1/r|)))).
import { ACCURACY_TREND_MIN_LOGS, ACCURACY_TREND_BUCKETS } from './constants';

export interface AccuracyTrend {
  /** Bucket accuracies 0–100, oldest → newest (length 2..ACCURACY_TREND_BUCKETS). */
  points: number[];
  /** last − first, in accuracy points. May be negative; never framed as loss. */
  deltaPts: number;
}

function accuracyOf(ratios: number[]): number {
  if (ratios.length === 0) return 0;
  const err = ratios.reduce((sum, r) => sum + Math.min(1, Math.abs(1 - 1 / r)), 0) / ratios.length;
  return Math.round((1 - err) * 100);
}

export function buildAccuracySeries(ratios: number[]): AccuracyTrend | null {
  if (ratios.length < ACCURACY_TREND_MIN_LOGS) return null;

  const buckets = Math.min(ACCURACY_TREND_BUCKETS, ratios.length);
  const size = ratios.length / buckets;
  const points: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * size);
    const end = Math.floor((i + 1) * size);
    points.push(accuracyOf(ratios.slice(start, end)));
  }

  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  return { points, deltaPts: last - first };
}
```

- [ ] **Step 5: Export from the barrel**

In `src/engine/index.ts`, add after the accuracy export (line 24):
```ts
export { buildAccuracySeries } from './accuracyTrend';
export type { AccuracyTrend } from './accuracyTrend';
```

- [ ] **Step 6: Run the test, verify it passes**

Run: `npx jest src/engine/__tests__/accuracyTrend.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Lint + commit**

Run: `npx eslint src/engine/accuracyTrend.ts src/engine/constants.ts src/engine/index.ts src/engine/__tests__/accuracyTrend.test.ts`
```bash
git add src/engine/accuracyTrend.ts src/engine/constants.ts src/engine/index.ts src/engine/__tests__/accuracyTrend.test.ts
git commit -m "feat(engine): add buildAccuracySeries for the patterns progress chart"
```

---

### Task 2: Hook — expose `accuracyTrend` on the patterns view

Add a `deriveAccuracyTrend` derivation and an `accuracyTrend` field to `PatternsView`, sourced from the existing completed-log ratios (oldest→newest order already established by `completedLogs`).

**Files:**
- Modify: `src/features/patterns/usePatterns.ts`
- Test: `src/features/patterns/__tests__/usePatterns.test.ts`

**Interfaces:**
- Consumes: `buildAccuracySeries`, `AccuracyTrend` from `@/src/engine`.
- Produces: `view.accuracyTrend: AccuracyTrend | null` on `PatternsView`.

- [ ] **Step 1: Write the failing test**

In `src/features/patterns/__tests__/usePatterns.test.ts`, add (match the file's existing `derivePatterns`/data-builder helpers — reuse whatever factory the file already uses to build `PatternsData`; the assertion is the new part):
```ts
import { derivePatterns } from '../usePatterns';
// (reuse the existing test's data factory; example name shown — adapt to the file)

it('exposes an accuracy trend once enough completed logs exist', () => {
  const data = makePatternsData({ completed: 12 }); // existing helper in this test file
  const view = derivePatterns(data, Date.now());
  expect(view.accuracyTrend).not.toBeNull();
  expect(view.accuracyTrend!.points.length).toBeGreaterThanOrEqual(2);
});

it('leaves accuracy trend null for a thin history', () => {
  const data = makePatternsData({ completed: 3 });
  const view = derivePatterns(data, Date.now());
  expect(view.accuracyTrend).toBeNull();
});
```
> If the existing test file has no `makePatternsData` helper, use the exact factory it already uses to construct `PatternsData` for the other `derivePatterns` assertions in that file — do not invent a new one.

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest src/features/patterns/__tests__/usePatterns.test.ts -t "accuracy trend"`
Expected: FAIL — `view.accuracyTrend` is `undefined`.

- [ ] **Step 3: Implement the derivation**

In `src/features/patterns/usePatterns.ts`:

Add to the imports from `@/src/engine` (line 3-9 block):
```ts
  buildAccuracySeries,
```
and to the type import (line 10):
```ts
import type { AccuracyCorrelation, AccuracySample, AccuracyTrend } from '@/src/engine';
```

Add the field to `PatternsView` (after `accuracyCorrelations`, line 125):
```ts
  /** Short accuracy series for the progress chart; null below the gate. */
  accuracyTrend: AccuracyTrend | null;
```

Add the derivation after `deriveAccuracyCorrelations` (after line 354):
```ts
/** Ordered accuracy series for the progress chart, over all completed logs. */
export function deriveAccuracyTrend(data: PatternsData): AccuracyTrend | null {
  return buildAccuracySeries(ratiosOf(completedLogs(data.logs)));
}
```

Wire it into `derivePatterns` (in the returned object, after `accuracyCorrelations`, line 368):
```ts
    accuracyTrend: deriveAccuracyTrend(data),
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx jest src/features/patterns/__tests__/usePatterns.test.ts`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/patterns/usePatterns.ts src/features/patterns/__tests__/usePatterns.test.ts`
```bash
git add src/features/patterns/usePatterns.ts src/features/patterns/__tests__/usePatterns.test.ts
git commit -m "feat(patterns): derive accuracyTrend on the patterns view"
```

---

### Task 3: Tokens — `chart` + `proTeaser` geometry groups

Add the two new geometry groups and wire them into `resolveTheme`.

**Files:**
- Modify: `src/theme/tokens.ts`
- Modify: `src/theme/useTheme.ts`

**Interfaces:**
- Produces: `t.chart.{height,stroke,dot,areaOpacity,strokeDash}` and `t.proTeaser.{previewH,barGap,barRadius,scrimOpacity,barOpacity,pillPadX}`.

- [ ] **Step 1: Add the token groups**

In `src/theme/tokens.ts`, add before the closing `} as const;` (after the `quick` group, ~line 434):
```ts
  // Patterns ProgressChart geometry — sparkline of accuracy over time. height =
  // SVG box height (pt); stroke = line weight; dot = endpoint radius; areaOpacity
  // = gradient fill alpha under the line; strokeDash = path length used for the
  // draw-on animation (large enough to cover any path).
  chart: { height: 96, stroke: 2.5, dot: 4.5, areaOpacity: 0.32, strokeDash: 1000 },

  // Premium Pro teaser card (ProTeaserCard) — frosted preview panel + amber pill.
  // previewH = preview panel height (pt); barGap = gap between faux bars; barRadius
  // = bar corner; scrimOpacity = the overlay that fakes "frost" over the bars (no
  // native blur dep); barOpacity = the teased bars' own alpha; pillPadX = "Pro"
  // pill horizontal padding.
  proTeaser: { previewH: 118, barGap: 9, barRadius: 4, scrimOpacity: 0.28, barOpacity: 0.55, pillPadX: 11 },
```

- [ ] **Step 2: Wire into resolveTheme**

In `src/theme/useTheme.ts`, append to the returned object (end of line 9, before the closing `}`):
```ts
    , chart: tokens.chart, proTeaser: tokens.proTeaser
```
(Result: `… upsell: tokens.upsell, quick: tokens.quick, chart: tokens.chart, proTeaser: tokens.proTeaser };`)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (the new keys resolve on `Theme`).

- [ ] **Step 4: Lint + commit**

Run: `npx eslint src/theme/tokens.ts src/theme/useTheme.ts`
```bash
git add src/theme/tokens.ts src/theme/useTheme.ts
git commit -m "feat(theme): add chart and proTeaser geometry tokens"
```

---

### Task 4: `SectionHeader` component

The eyebrow-style group label + hairline rule that separates the new sections (`YOUR PROGRESS ───`).

**Files:**
- Create: `src/features/patterns/SectionHeader.tsx`
- Test: `src/features/patterns/__tests__/SectionHeader.test.tsx`

**Interfaces:**
- Produces: `export function SectionHeader({ label }: { label: string }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `src/features/patterns/__tests__/SectionHeader.test.tsx`:
```tsx
import { render } from '@testing-library/react-native';
import { SectionHeader } from '../SectionHeader';

it('renders its label', () => {
  const { getByText } = render(<SectionHeader label="Your progress" />);
  expect(getByText('Your progress')).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/features/patterns/__tests__/SectionHeader.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/patterns/SectionHeader.tsx`:
```tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// Group label for the redesigned Patterns sections: an indigo-muted eyebrow with a
// hairline rule trailing to the card edge. Replaces the per-card eyebrow rhythm
// with a sectioned one (identity → progress → what changed → numbers → Pro).
export function SectionHeader({ label }: { label: string }) {
  const t = useTheme();
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2.5] };
  const text: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const line: ViewStyle = { flex: 1, height: t.borderWidth.share, backgroundColor: t.colors.hairline };
  return (
    <View style={row} accessibilityRole="header">
      <Text style={text}>{label}</Text>
      <View style={line} />
    </View>
  );
}
```
> Note: `t.borderWidth.share` = 1pt (the only 1px borderWidth token; `hairline` is 0 in this theme). The hairline rule needs a visible 1pt height.

- [ ] **Step 4: Run, verify it passes**

Run: `npx jest src/features/patterns/__tests__/SectionHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/patterns/SectionHeader.tsx src/features/patterns/__tests__/SectionHeader.test.tsx`
```bash
git add src/features/patterns/SectionHeader.tsx src/features/patterns/__tests__/SectionHeader.test.tsx
git commit -m "feat(patterns): add SectionHeader for the sectioned story"
```

---

### Task 5: `ArchetypeHero` — the focal identity card

Redesign `Archetype` into the hero: raised card, amber radial glow, bee glyph, eyebrow, title, large amber multiplier, blurb, share chip. Keeps the existing share-card capture flow verbatim.

**Files:**
- Modify: `src/features/patterns/Archetype.tsx` (rename the export, restyle)
- Modify: `src/app/(tabs)/patterns.tsx` (import name — done in Task 10)
- Test: `src/features/patterns/__tests__/Archetype.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `ArchetypeCard` from `./usePatterns`, `useShareCard`, `ShareableCard`, `AppButton`.
- Produces: `export function ArchetypeHero({ card }: { card: ArchetypeCard }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `src/features/patterns/__tests__/Archetype.test.tsx`:
```tsx
import { render } from '@testing-library/react-native';
import { ArchetypeHero } from '../Archetype';

it('renders the personality title and average multiplier', () => {
  const { getByText } = render(
    <ArchetypeHero card={{ title: 'The Gentle Optimist', blurb: 'You lean hopeful.', averageMultiplier: 1.6 }} />,
  );
  expect(getByText('The Gentle Optimist')).toBeTruthy();
  expect(getByText(/1\.6×/)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/features/patterns/__tests__/Archetype.test.tsx`
Expected: FAIL — `ArchetypeHero` not exported.

- [ ] **Step 3: Implement**

Replace the body of `src/features/patterns/Archetype.tsx` with:
```tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Polygon, Ellipse, Rect, Circle, RadialGradient, Defs, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';
import { ShareableCard } from '@/src/components/ShareableCard';
import { useShareCard } from '@/src/features/share/useShareCard';
import type { ArchetypeCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// ArchetypeHero (S1) — the FOCAL card of the Patterns screen. Your shareable time
// personality, sized up: a raised surface with a soft amber honey-glow, a hexagon
// bee glyph, the large average multiplier, and the share affordance. Identity
// first — the eye lands here before skimming the sectioned story below.
// ──────────────────────────────────────────────────────────────────────────────

function BeeGlyph({ size }: { size: number }) {
  const t = useTheme();
  // Flat-top hexagon shell + indigo body + amber bands — mirrors the brand bee.
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46">
      <Polygon points="23,4 39,13 39,33 23,42 7,33 7,13" fill={t.colors.primarySoft} stroke={t.colors.primary} strokeWidth={1.5} />
      <Ellipse cx={23} cy={24} rx={8} ry={9} fill={t.colors.primary} />
      <Rect x={16} y={20} width={14} height={2.4} rx={1.2} fill={t.colors.accent} />
      <Rect x={16} y={25} width={14} height={2.4} rx={1.2} fill={t.colors.accent} />
      <Circle cx={20} cy={17} r={1.4} fill={t.colors.ink} />
      <Circle cx={26} cy={17} r={1.4} fill={t.colors.ink} />
    </Svg>
  );
}

export function ArchetypeHero({ card }: { card: ArchetypeCard }) {
  const t = useTheme();
  const archetypeShare = useShareCard('archetype');
  const { title: archTitle, blurb, averageMultiplier } = card;

  const cardStyle: ViewStyle = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: t.borderWidth.share,
    borderColor: t.colors.border,
    padding: t.space[5],
    gap: t.space[2],
  };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink, marginTop: t.space[1] };
  const multRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[1.5] };
  const mult: TextStyle = { ...(type.honestNumberLg as unknown as TextStyle), color: t.colors.accent };
  const multCaption: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const blurbStyle: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft, maxWidth: 280 };
  const glyph: ViewStyle = { position: 'absolute', top: t.space[4], right: t.space[4] };

  return (
    <View style={cardStyle}>
      {/* Amber honey-glow — decorative, mode-independent alpha from tokens. */}
      <Svg width={180} height={180} style={{ position: 'absolute', top: -t.space[10], right: -t.space[8] }}>
        <Defs>
          <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={t.colors.accent} stopOpacity={t.gradients.backdropTop} />
            <Stop offset="70%" stopColor={t.colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={90} cy={90} r={90} fill="url(#heroGlow)" />
      </Svg>

      <View style={glyph} pointerEvents="none"><BeeGlyph size={t.companion.hudBee} /></View>

      <View style={eyebrowRow}>
        <Text style={eyebrow}>YOUR TIME PERSONALITY</Text>
      </View>
      <Text style={titleStyle}>{archTitle}</Text>
      <View style={multRow}>
        <Text style={mult}>{averageMultiplier.toFixed(1)}×</Text>
        <Text style={multCaption}>your guess, on average</Text>
      </View>
      <Text style={blurbStyle}>{blurb}</Text>
      <View style={{ alignSelf: 'flex-start', marginTop: t.space[2] }}>
        <AppButton label="Share my archetype" variant="ghost" size="md" onPress={archetypeShare.onShare} />
      </View>

      {/* Off-screen capture card — react-native-view-shot only; never visible. */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <ShareableCard ref={archetypeShare.ref} data={{ kind: 'archetype', title: archTitle, blurb, averageMultiplier }} />
      </View>
    </View>
  );
}
```
> The hero intentionally drops `PatternCard` (no dismiss/× on the focal identity). `t.gradients.backdropTop` (0.22) is the existing decorative-glow alpha token.

- [ ] **Step 4: Run, verify it passes**

Run: `npx jest src/features/patterns/__tests__/Archetype.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/patterns/Archetype.tsx src/features/patterns/__tests__/Archetype.test.tsx`
```bash
git add src/features/patterns/Archetype.tsx src/features/patterns/__tests__/Archetype.test.tsx
git commit -m "feat(patterns): redesign Archetype into the focal ArchetypeHero"
```

---

### Task 6: `ProgressChart` — accuracy-over-time sparkline

A line+area sparkline from `view.accuracyTrend`, with a `+N pts` delta pill (green when up, neutral when ≤0, NEVER red) and an amber endpoint dot. Falls back to a 2-point line from `view.youVsPast` when the trend is null. The line draws left→right on appear via an animated `stroke-dashoffset`.

**Files:**
- Create: `src/features/patterns/ProgressChart.tsx`
- Test: `src/features/patterns/__tests__/ProgressChart.test.tsx`

**Interfaces:**
- Consumes: `AccuracyTrend` from `@/src/engine`, `YouVsPastCard` from `./usePatterns`.
- Produces: `export function ProgressChart({ trend, fallback }: { trend: AccuracyTrend | null; fallback: YouVsPastCard | null }): JSX.Element | null`. Returns `null` when both inputs are null.

- [ ] **Step 1: Write the failing test**

Create `src/features/patterns/__tests__/ProgressChart.test.tsx`:
```tsx
import { render } from '@testing-library/react-native';
import { ProgressChart } from '../ProgressChart';

it('renders the then-vs-now endpoints and a positive delta pill', () => {
  const { getByText } = render(
    <ProgressChart trend={{ points: [61, 64, 66, 69], deltaPts: 8 }} fallback={null} />,
  );
  expect(getByText('At first · 61%')).toBeTruthy();
  expect(getByText('Lately · 69%')).toBeTruthy();
  expect(getByText('+8 pts')).toBeTruthy();
});

it('falls back to youVsPast when the trend is null', () => {
  const { getByText } = render(
    <ProgressChart trend={null} fallback={{ earlyAccuracy: 60, recentAccuracy: 60, delta: 0 }} />,
  );
  expect(getByText('At first · 60%')).toBeTruthy();
});

it('renders nothing when both inputs are null', () => {
  const { toJSON } = render(<ProgressChart trend={null} fallback={null} />);
  expect(toJSON()).toBeNull();
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/features/patterns/__tests__/ProgressChart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/patterns/ProgressChart.tsx`:
```tsx
import { useEffect } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { AccuracyTrend } from '@/src/engine';
import type { YouVsPastCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// ProgressChart — "You, then vs now". An accuracy sparkline over time: the line
// draws left→right on appear, area fades beneath it, the endpoint pops amber. The
// delta reads GREEN when up, neutral when flat/steady — never red, no loss state
// (honey/sharpness is monotonic in spirit here). Falls back to a 2-point line.
// ──────────────────────────────────────────────────────────────────────────────

const AnimatedPath = Animated.createAnimatedComponent(Path);
const W = 320;

/** Catmull-Rom-ish smooth path through evenly-spaced points (y already in px). */
function smoothPath(points: number[], height: number): string {
  if (points.length < 2) return '';
  const max = 100;
  const min = Math.min(...points, 50);
  const span = Math.max(1, max - min);
  const stepX = W / (points.length - 1);
  const xy = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / span) * (height - 8) - 4; // 4px top/bottom inset
    return [x, y] as const;
  });
  let d = `M${xy[0]![0]},${xy[0]![1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const [x0, y0] = xy[i]!;
    const [x1, y1] = xy[i + 1]!;
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

export function ProgressChart({ trend, fallback }: { trend: AccuracyTrend | null; fallback: YouVsPastCard | null }) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const points = trend?.points ?? (fallback ? [fallback.earlyAccuracy, fallback.recentAccuracy] : null);
  const deltaPts = trend?.deltaPts ?? fallback?.delta ?? 0;

  const dash = useSharedValue(reduced ? 0 : t.chart.strokeDash);
  useEffect(() => {
    if (reduced) return;
    dash.set(withTiming(0, { duration: t.motion.draw }));
  }, [dash, reduced, t.motion.draw]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: dash.get() }));

  if (!points) return null;

  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const h = t.chart.height;
  const d = smoothPath(points, h);
  const stepX = W / (points.length - 1);
  const endX = (points.length - 1) * stepX;
  const max = 100;
  const min = Math.min(...points, 50);
  const span = Math.max(1, max - min);
  const endY = h - ((last - min) / span) * (h - 8) - 4;
  const up = deltaPts > 0;

  const cardStyle: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[2],
  };
  const top: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const titleStyle: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, marginTop: t.space[1] };
  const pill: ViewStyle = {
    flexDirection: 'row', alignItems: 'center', gap: t.space[1],
    backgroundColor: up ? t.colors.successSoft : t.colors.surfaceSunken,
    paddingHorizontal: t.space[2.5], paddingVertical: t.space[1], borderRadius: t.radii.full,
  };
  const pillText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: up ? t.colors.success : t.colors.inkSoft };
  const axis: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', marginTop: t.space[1] };
  const axisText: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };

  return (
    <View style={cardStyle}>
      <View style={top}>
        <Text style={eyebrow}>ACCURACY OVER TIME</Text>
        <View style={pill}>
          <Text style={pillText}>{up ? `+${deltaPts} pts` : 'steady'}</Text>
        </View>
      </View>
      <Text style={titleStyle}>You, then vs now</Text>

      <Svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="prog" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.colors.primary} stopOpacity={t.chart.areaOpacity} />
            <Stop offset="1" stopColor={t.colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={`${d} L${endX},${h} L0,${h} Z`} fill="url(#prog)" />
        <AnimatedPath
          d={d}
          fill="none"
          stroke={t.colors.primary}
          strokeWidth={t.chart.stroke}
          strokeLinecap="round"
          strokeDasharray={t.chart.strokeDash}
          animatedProps={lineProps}
        />
        <Circle cx={endX} cy={endY} r={t.chart.dot} fill={t.colors.accent} />
      </Svg>

      <View style={axis}>
        <Text style={axisText}>At first · {first}%</Text>
        <Text style={axisText}>Lately · {last}%</Text>
      </View>
    </View>
  );
}
```
> The delta pill shows `steady` (neutral) when not up — never a negative/red number. Reduced motion starts the dash at 0 (line fully drawn, no animation).

- [ ] **Step 4: Run, verify it passes**

Run: `npx jest src/features/patterns/__tests__/ProgressChart.test.tsx`
Expected: PASS (3 tests). The first test expects `+8 pts`; the "steady" branch is covered by manual/device check.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/patterns/ProgressChart.tsx src/features/patterns/__tests__/ProgressChart.test.tsx`
```bash
git add src/features/patterns/ProgressChart.tsx src/features/patterns/__tests__/ProgressChart.test.tsx
git commit -m "feat(patterns): add ProgressChart accuracy sparkline"
```

---

### Task 7: `DriftNote` — the "what changed" annotation

Restyle `DriftAlert` into a quiet amber-tinted annotation (no card chrome, diamond marker, one sentence) matching the mockup.

**Files:**
- Modify: `src/features/patterns/DriftAlert.tsx` (rename export `DriftAlert` → `DriftNote`, restyle)
- Test: `src/features/patterns/__tests__/DriftNote.test.tsx`

**Interfaces:**
- Consumes: `DriftAlertCard` from `./usePatterns`.
- Produces: `export function DriftNote({ card }: { card: DriftAlertCard }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `src/features/patterns/__tests__/DriftNote.test.tsx`:
```tsx
import { render } from '@testing-library/react-native';
import { DriftNote } from '../DriftAlert';

it('describes a category taking longer lately', () => {
  const { getByText } = render(
    <DriftNote card={{ categoryId: 'admin', categoryName: 'Admin', earlyMultiplier: 1.6, recentMultiplier: 2.0, slowerLately: true }} />,
  );
  expect(getByText(/Admin/)).toBeTruthy();
  expect(getByText(/longer lately/)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/features/patterns/__tests__/DriftNote.test.tsx`
Expected: FAIL — `DriftNote` not exported.

- [ ] **Step 3: Implement**

Replace `src/features/patterns/DriftAlert.tsx` with:
```tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { DriftAlertCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// DriftNote (S9) — "what changed". A quiet amber margin-note (no card chrome), a
// diamond marker, one neutral sentence. Reports a shift in pace, never a verdict:
// the honest numbers already follow along, so there is nothing to fix.
// ──────────────────────────────────────────────────────────────────────────────

export function DriftNote({ card }: { card: DriftAlertCard }) {
  const t = useTheme();
  const { categoryName, earlyMultiplier, recentMultiplier, slowerLately } = card;

  const wrap: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    padding: t.space[4],
  };
  const marker: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.accent };
  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const name: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.amberText };

  const lead = slowerLately ? 'is taking longer lately' : 'is moving quicker lately';
  return (
    <View style={wrap}>
      <Text style={marker}>◆</Text>
      <Text style={body}>
        <Text style={name}>{categoryName}</Text> {lead} — it used to run {earlyMultiplier.toFixed(1)}×, now nearer{' '}
        {recentMultiplier.toFixed(1)}×. Your honest numbers already follow along.
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npx jest src/features/patterns/__tests__/DriftNote.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/patterns/DriftAlert.tsx src/features/patterns/__tests__/DriftNote.test.tsx`
```bash
git add src/features/patterns/DriftAlert.tsx src/features/patterns/__tests__/DriftNote.test.tsx
git commit -m "feat(patterns): restyle DriftAlert into the DriftNote annotation"
```

---

### Task 8: `HonestMap` — the numbers table

Restyle `CalibrationMap` to the mockup table (name + `runs N× · readiness` left, amber 3-step dial center, honest number right). Drop the `PatternCard` shell for a plain surface card with a `SectionHeader` supplied by the route. Keep the readiness-dial `progressbar` a11y semantics.

**Files:**
- Modify: `src/features/patterns/CalibrationMap.tsx` (rename export `CalibrationMap` → `HonestMap`, restyle; keep `ConfidenceDial` + `readinessLine` logic)
- Test: `src/features/patterns/__tests__/HonestMap.test.tsx`

**Interfaces:**
- Consumes: `CalibrationMapRow[]` from `./usePatterns`.
- Produces: `export function HonestMap({ rows }: { rows: CalibrationMapRow[] }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `src/features/patterns/__tests__/HonestMap.test.tsx`:
```tsx
import { render } from '@testing-library/react-native';
import { HonestMap } from '../CalibrationMap';

const rows = [
  { categoryId: 'c', categoryName: 'Cleaning', guessMin: 15, honestMin: 25, multiplier: 1.5, sampleSize: 1, confidence: 'setting' as const },
];

it('renders a category row with its honest number and readiness a11y label', () => {
  const { getByText, getByLabelText } = render(<HonestMap rows={rows} />);
  expect(getByText('Cleaning')).toBeTruthy();
  expect(getByText('~25')).toBeTruthy();
  expect(getByLabelText('Cleaning readiness: setting, 2 of 3')).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/features/patterns/__tests__/HonestMap.test.tsx`
Expected: FAIL — `HonestMap` not exported.

- [ ] **Step 3: Implement**

In `src/features/patterns/CalibrationMap.tsx`: keep `DIAL_STEPS`, `filledSteps`, `readinessLine`, and the `ConfidenceDial` function, with TWO changes to `ConfidenceDial` — make the lit pips AMBER and slightly larger to match the mockup:
```tsx
  const pipBase: ViewStyle = {
    width: t.space[4],         // was space[2]
    height: t.space[1.5],      // was space[1]
    borderRadius: t.radii.full,
  };
  // …unchanged View/accessibility…
        <View
          key={step}
          style={[pipBase, { backgroundColor: i < lit ? t.colors.accent : t.colors.surfaceSunken }]}
        />
```
Then replace the exported `CalibrationMap` with:
```tsx
export function HonestMap({ rows }: { rows: CalibrationMapRow[] }) {
  const t = useTheme();

  const lead: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, paddingHorizontal: t.space[4], paddingTop: t.space[3] };
  const cardStyle: ViewStyle = { backgroundColor: t.colors.surface, borderRadius: t.radii.card, borderCurve: 'continuous' };
  const row: ViewStyle = {
    flexDirection: 'row', alignItems: 'center', gap: t.space[3],
    paddingVertical: t.space[4], paddingHorizontal: t.space[4],
    borderBottomWidth: t.borderWidth.share, borderBottomColor: t.colors.hairline,
  };
  const leftCol: ViewStyle = { flex: 1, gap: t.space[1] };
  const name: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkSoft };
  const rightCol: ViewStyle = { alignItems: 'flex-end' };
  const honest: TextStyle = { ...(type.honestNumberMd as unknown as TextStyle), color: t.colors.accent };
  const honestRow: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[1] };
  const unit: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const guess: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };

  return (
    <View style={cardStyle}>
      <Text style={lead}>{readinessLine(rows)}</Text>
      {rows.map((r, i) => (
        <View key={r.categoryId} style={[row, i === rows.length - 1 ? { borderBottomWidth: 0 } : null]}>
          <View style={leftCol}>
            <Text style={name} numberOfLines={1}>{r.categoryName}</Text>
            <Text style={sub}>runs {r.multiplier.toFixed(1)}× · {r.confidence}</Text>
          </View>
          <ConfidenceDial confidence={r.confidence} categoryName={r.categoryName} />
          <View style={rightCol}>
            <View style={honestRow}>
              <Text style={honest}>~{r.honestMin}</Text>
              <Text style={unit}>m</Text>
            </View>
            <Text style={guess}>vs {r.guessMin} guess</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
```
Remove the now-unused `PatternCard` import from this file.

- [ ] **Step 4: Run, verify it passes**

Run: `npx jest src/features/patterns/__tests__/HonestMap.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/features/patterns/CalibrationMap.tsx src/features/patterns/__tests__/HonestMap.test.tsx`
```bash
git add src/features/patterns/CalibrationMap.tsx src/features/patterns/__tests__/HonestMap.test.tsx
git commit -m "feat(patterns): restyle CalibrationMap into the HonestMap table"
```

---

### Task 9: `ProTeaserCard` — the unified premium upsell

One premium teaser (frosted preview panel + amber `Pro` pill + WHENBEE PRO eyebrow + benefit headline + sub + amber coin-edge CTA + reassurance footer), driven by props. Refactor the three `*Locked` teasers to render it with per-feature copy + preview. Preserves each feature's existing paywall `trigger`.

**Files:**
- Create: `src/features/patterns/ProTeaserCard.tsx`
- Modify: `src/features/patterns/AccuracyCorrelationsLocked.tsx`
- Modify: `src/features/patterns/StealsYourTimeLocked.tsx`
- Modify: `src/features/patterns/ContextCorrelationsLocked.tsx`
- Test: `src/features/patterns/__tests__/ProTeaserCard.test.tsx`

**Interfaces:**
- Consumes: `AppButton`, `router` (expo-router).
- Produces:
  ```ts
  export type ProTeaserPreview = 'bars' | 'rhythm';
  export interface ProTeaserProps {
    eyebrow: string; headline: string; sub: string; cta: string;
    trigger: string; preview: ProTeaserPreview;
  }
  export function ProTeaserCard(props: ProTeaserProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/features/patterns/__tests__/ProTeaserCard.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ProTeaserCard } from '../ProTeaserCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

it('renders the benefit headline and routes to the paywall on CTA press', () => {
  const { getByText } = render(
    <ProTeaserCard eyebrow="Whenbee Pro" headline="Know your sharpest hours." sub="See when." cta="Reveal my rhythm" trigger="steals_your_time" preview="rhythm" />,
  );
  expect(getByText('Know your sharpest hours.')).toBeTruthy();
  fireEvent.press(getByText('Reveal my rhythm'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/(modals)/paywall', params: { trigger: 'steals_your_time' } });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/features/patterns/__tests__/ProTeaserCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the card**

Create `src/features/patterns/ProTeaserCard.tsx`:
```tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';

// ──────────────────────────────────────────────────────────────────────────────
// ProTeaserCard — the ONE premium Pro upsell on Patterns (replaces the three flat
// *Locked teasers). A frosted preview panel (faux-blur: low-opacity teased bars +
// a scrim, no native blur dep) wears an amber "Pro" pill; below, the WHENBEE PRO
// eyebrow, a benefit headline, an outcome line, an amber coin-edge CTA, and a calm
// reassurance footer. Identity-first screen, gentle pitch last — never guilt.
// ──────────────────────────────────────────────────────────────────────────────

export type ProTeaserPreview = 'bars' | 'rhythm';

export interface ProTeaserProps {
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  trigger: string;
  preview: ProTeaserPreview;
}

/** Teased, deliberately-illegible feature visual behind a scrim. */
function Preview({ kind }: { kind: ProTeaserPreview }) {
  const t = useTheme();
  const heights = kind === 'rhythm' ? [0.42, 0.66, 0.34, 1, 0.58, 0.4, 0.3] : [0.5, 0.8, 0.45, 0.7, 0.95, 0.6, 0.4];
  const panel: ViewStyle = {
    position: 'relative', overflow: 'hidden',
    height: t.proTeaser.previewH, borderRadius: t.radii.md, borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceSunken, justifyContent: 'flex-end',
    padding: t.space[4],
  };
  const bars: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.proTeaser.barGap, height: t.proTeaser.previewH * 0.55, opacity: t.proTeaser.barOpacity };
  const scrim: ViewStyle = { position: 'absolute', inset: 0, backgroundColor: t.colors.surfaceSunken, opacity: t.proTeaser.scrimOpacity } as ViewStyle;
  const pill: ViewStyle = {
    position: 'absolute', top: t.space[3], right: t.space[3], flexDirection: 'row', alignItems: 'center', gap: t.space[1],
    backgroundColor: t.colors.accent, paddingHorizontal: t.proTeaser.pillPadX, paddingVertical: t.space[1], borderRadius: t.radii.full,
  };
  const pillText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.onAmber };
  return (
    <View style={panel}>
      <View style={bars}>
        {heights.map((hf, i) => (
          <View key={i} style={{ flex: 1, height: `${hf * 100}%`, backgroundColor: t.colors.accent, borderTopLeftRadius: t.proTeaser.barRadius, borderTopRightRadius: t.proTeaser.barRadius }} />
        ))}
      </View>
      <View style={scrim} pointerEvents="none" />
      <View style={pill}>
        <Ionicons name="lock-closed" size={t.iconSize.xs} color={t.colors.onAmber} />
        <Text style={pillText}>Pro</Text>
      </View>
    </View>
  );
}

export function ProTeaserCard({ eyebrow, headline, sub, cta, trigger, preview }: ProTeaserProps) {
  const t = useTheme();
  const cardStyle: ViewStyle = {
    backgroundColor: t.colors.surfaceRaised, borderRadius: t.radii.card, borderCurve: 'continuous',
    borderWidth: t.borderWidth.share, borderColor: t.colors.border, padding: t.space[3.5] ?? t.space[4], gap: t.space[3],
  };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrowText: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText };
  const headlineStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const subStyle: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const foot: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint, textAlign: 'center' };

  const openPaywall = () => router.push({ pathname: '/(modals)/paywall', params: { trigger } });

  return (
    <View style={cardStyle}>
      <Preview kind={preview} />
      <View style={{ gap: t.space[2] }}>
        <View style={eyebrowRow}><Text style={eyebrowText}>{eyebrow}</Text></View>
        <Text style={headlineStyle}>{headline}</Text>
        <Text style={subStyle}>{sub}</Text>
      </View>
      <AppButton label={cta} variant="amber" size="lg" fullWidth onPress={openPaywall} />
      <Text style={foot}>Cancel anytime · learned on-device</Text>
    </View>
  );
}
```
> `t.space[3.5]` does not exist in the scale — use `t.space[4]` directly (the `?? t.space[4]` is a guard; replace the whole expression with `t.space[4]` to avoid an undefined-index lint). The amber `AppButton` already renders the coin-edge press from tokens.

- [ ] **Step 4: Point the three locked teasers at it**

Replace `src/features/patterns/AccuracyCorrelationsLocked.tsx` with:
```tsx
import { ProTeaserCard } from './ProTeaserCard';

// "When you're sharpest" (S3) teaser — opens the shared Pro-Patterns paywall.
export function AccuracyCorrelationsLocked() {
  return (
    <ProTeaserCard
      eyebrow="WHENBEE PRO"
      headline="Know your sharpest hours."
      sub="Some hours you read time better than others. See exactly when — and when to leave a little more buffer."
      cta="Reveal my rhythm"
      trigger="steals_your_time"
      preview="rhythm"
    />
  );
}
```
Replace `src/features/patterns/StealsYourTimeLocked.tsx` with:
```tsx
import { ProTeaserCard } from './ProTeaserCard';

// "What steals your time" (S12) teaser.
export function StealsYourTimeLocked() {
  return (
    <ProTeaserCard
      eyebrow="WHENBEE PRO"
      headline="See where your time really goes."
      sub="Every time you note why a task ran long, that's a clue. Pro reads them back: the cause behind your overruns, by category."
      cta="Show me the cause"
      trigger="steals_your_time"
      preview="bars"
    />
  );
}
```
Replace `src/features/patterns/ContextCorrelationsLocked.tsx` with:
```tsx
import { ProTeaserCard } from './ProTeaserCard';

// "What moves your accuracy" (S4) teaser.
export function ContextCorrelationsLocked() {
  return (
    <ProTeaserCard
      eyebrow="WHENBEE PRO"
      headline="Find what moves your accuracy."
      sub="When you note your energy after a session, that's a clue. Pro reads it back: whether low-energy days throw your estimates off."
      cta="Reveal the pattern"
      trigger="steals_your_time"
      preview="bars"
    />
  );
}
```
> All three keep the existing `steals_your_time` paywall trigger (the shared Pro-Patterns surface), unchanged from the current code. Copy passed through conversion-psychology (benefit-led headline, outcome sub) + humanizer (no AI-slop); no guilt language.

- [ ] **Step 5: Run, verify it passes + typecheck**

Run: `npx jest src/features/patterns/__tests__/ProTeaserCard.test.tsx`
Expected: PASS.
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Lint + commit**

Run: `npx eslint src/features/patterns/ProTeaserCard.tsx src/features/patterns/AccuracyCorrelationsLocked.tsx src/features/patterns/StealsYourTimeLocked.tsx src/features/patterns/ContextCorrelationsLocked.tsx src/features/patterns/__tests__/ProTeaserCard.test.tsx`
```bash
git add src/features/patterns/ProTeaserCard.tsx src/features/patterns/AccuracyCorrelationsLocked.tsx src/features/patterns/StealsYourTimeLocked.tsx src/features/patterns/ContextCorrelationsLocked.tsx src/features/patterns/__tests__/ProTeaserCard.test.tsx
git commit -m "feat(patterns): unify Pro teasers into a premium ProTeaserCard"
```

---

### Task 10: Recompose the Patterns route into the sectioned story

Rebuild `patterns.tsx` to the new IA: hero → Your progress → What changed → Your numbers → Pro, with `SectionHeader`s and a per-section entrance stagger. Keep the existing empty state, weekly banner, ProGate logic, and conditional gates intact.

**Files:**
- Modify: `src/app/(tabs)/patterns.tsx`
- Test: `src/features/patterns/__tests__/patternsScreen.test.tsx` (update imports/expectations)

**Interfaces:**
- Consumes: `ArchetypeHero`, `ProgressChart`, `DriftNote`, `HonestMap`, `SectionHeader`, plus existing `usePatterns`, `useReasonInsights`, `useContextInsights`, `ProGate`, `WeeklyReview`, `PatternsEmpty`, `BiggestSurprise`, `PredictionCard`, `PlanExperiment`, the Pro components.

- [ ] **Step 1: Update the screen test for the new tree**

In `src/features/patterns/__tests__/patternsScreen.test.tsx`, update any import of `Archetype`→`ArchetypeHero`, `CalibrationMap`→`HonestMap`, `DriftAlert`→`DriftNote`, and assert a section header renders, e.g.:
```tsx
expect(getByText('Your progress')).toBeTruthy();
```
> Keep the file's existing store mocks/data setup; only adjust the symbols the redesign renamed and add the section-header assertion.

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/features/patterns/__tests__/patternsScreen.test.tsx`
Expected: FAIL — old symbols / missing header text.

- [ ] **Step 3: Implement the route**

Replace `src/app/(tabs)/patterns.tsx` with:
```tsx
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { usePatterns } from '@/src/features/patterns/usePatterns';
import { ArchetypeHero } from '@/src/features/patterns/Archetype';
import { ProgressChart } from '@/src/features/patterns/ProgressChart';
import { PlanExperiment } from '@/src/features/patterns/PlanExperiment';
import { BiggestSurprise } from '@/src/features/patterns/BiggestSurprise';
import { DriftNote } from '@/src/features/patterns/DriftAlert';
import { HonestMap } from '@/src/features/patterns/CalibrationMap';
import { SectionHeader } from '@/src/features/patterns/SectionHeader';
import { PatternsEmpty } from '@/src/features/patterns/PatternsEmpty';
import { WeeklyReview } from '@/src/features/patterns/WeeklyReview';
import { useReasonInsights } from '@/src/features/patterns/useReasonInsights';
import { ProGate } from '@/src/features/paywall/ProGate';
import { StealsYourTime } from '@/src/features/patterns/StealsYourTime';
import { StealsYourTimeWeekly } from '@/src/features/patterns/StealsYourTimeWeekly';
import { StealsYourTimeLocked } from '@/src/features/patterns/StealsYourTimeLocked';
import { AccuracyCorrelations } from '@/src/features/patterns/AccuracyCorrelations';
import { AccuracyCorrelationsLocked } from '@/src/features/patterns/AccuracyCorrelationsLocked';
import { useContextInsights } from '@/src/features/patterns/useContextInsights';
import { ContextCorrelations } from '@/src/features/patterns/ContextCorrelations';
import { ContextCorrelationsLocked } from '@/src/features/patterns/ContextCorrelationsLocked';

// ──────────────────────────────────────────────────────────────────────────────
// Patterns — the free, read-only self-insight surface, redesigned as a hero +
// sectioned story: identity (ArchetypeHero) → progress (ProgressChart) → what
// changed (DriftNote / surprise) → your numbers (HonestMap) → Pro (one premium
// teaser). Every block is a pure projection over the engine (usePatterns) and
// hides until earned. Sections rise + stagger on entry (entering-only on Fabric;
// reduced-motion skips the transform). No guilt, no streaks, amber stays scarce.
// ──────────────────────────────────────────────────────────────────────────────

export default function Patterns() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const { view } = usePatterns();
  const { insights } = useReasonInsights();
  const { insights: contextInsights } = useContextInsights();

  const showEmpty = view !== null && view.empty;

  // Per-section entrance: rise + fade, staggered top→bottom (< 500ms total).
  let order = 0;
  const rise = () => (reduced ? undefined : FadeInDown.duration(t.motion.base).delay((order++) * t.motion.enterStagger));

  const hasProgress = view ? view.youVsPast !== null || view.accuracyTrend !== null || view.planExperiment !== null : false;
  const hasChanged = view ? view.driftAlert !== null || view.biggestSurprise !== null : false;

  return (
    <Screen>
      <ScreenHeader title="Patterns" subtitle="What your time keeps telling you." />
      <ScrollView
        contentContainerStyle={{ gap: t.space[4], paddingBottom: t.space[12] }}
        showsVerticalScrollIndicator={false}
      >
        {showEmpty ? <PatternsEmpty /> : null}

        {view && !view.empty ? (
          <>
            <WeeklyReview view={view} />

            {/* 1 · IDENTITY */}
            {view.archetype ? (
              <Animated.View entering={rise()}><ArchetypeHero card={view.archetype} /></Animated.View>
            ) : null}

            {/* 2 · YOUR PROGRESS */}
            {hasProgress ? (
              <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
                <SectionHeader label="Your progress" />
                <ProgressChart trend={view.accuracyTrend} fallback={view.youVsPast} />
                {view.planExperiment ? <PlanExperiment card={view.planExperiment} /> : null}
              </Animated.View>
            ) : null}

            {/* 3 · WHAT CHANGED */}
            {hasChanged ? (
              <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
                <SectionHeader label="What changed" />
                {view.driftAlert ? <DriftNote card={view.driftAlert} /> : null}
                {view.biggestSurprise ? <BiggestSurprise card={view.biggestSurprise} /> : null}
              </Animated.View>
            ) : null}

            {/* 4 · YOUR NUMBERS */}
            {view.calibrationMap.length > 0 ? (
              <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
                <SectionHeader label="Your numbers" />
                <HonestMap rows={view.calibrationMap} />
              </Animated.View>
            ) : null}

            {/* 5 · PRO — one premium teaser (or the unlocked insight) */}
            <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
              <ProGate fallback={insights.length > 0 ? <StealsYourTimeLocked /> : null}>
                <StealsYourTime insights={insights} />
                <StealsYourTimeWeekly insights={insights} />
              </ProGate>
              <ProGate fallback={view.accuracyCorrelations.length > 0 ? <AccuracyCorrelationsLocked /> : null}>
                {view.accuracyCorrelations.length > 0 ? <AccuracyCorrelations correlations={view.accuracyCorrelations} /> : null}
              </ProGate>
              <ProGate fallback={contextInsights.length > 0 ? <ContextCorrelationsLocked /> : null}>
                {contextInsights.length > 0 ? <ContextCorrelations correlations={contextInsights} /> : null}
              </ProGate>
            </Animated.View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
```
> `PredictionCard` is intentionally dropped from the route — its forward honest number is already represented by the most-tracked category leading `HonestMap`. `View` is imported but only used implicitly via `Animated.View`; if eslint flags the unused `View` import, remove it.

- [ ] **Step 4: Run, verify it passes**

Run: `npx jest src/features/patterns/__tests__/patternsScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck + lint**

Run: `npm run typecheck && npx jest src/features/patterns src/engine && npx eslint "src/app/(tabs)/patterns.tsx" src/features/patterns`
Expected: all green, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(tabs)/patterns.tsx" src/features/patterns/__tests__/patternsScreen.test.tsx
git commit -m "feat(patterns): recompose screen into hero + sectioned story with entrance motion"
```

---

### Task 11: Device verification + final gate

Verify the redesign on the iOS simulator (dark mode), capture screenshots, and run the full pre-PR gate.

**Files:** none (verification only).

- [ ] **Step 1: Build & launch the dev client**

Run: `npm run ios`
Wait for the app to boot on the booted simulator.

- [ ] **Step 2: Seed enough data to populate sections**

Use the in-app flow (or the existing dev seeding path if present) to create ≥12 completed logs across ≥2 categories so the hero, progress chart, drift note, and honest map all render. If onboarding blocks the tab, reset per CLAUDE.md: delete `Documents/SQLite/ExpoSQLiteStorage` + `whenbee.db` in the app data container (`xcrun simctl get_app_container booted com.whenbee.app data`), then `xcrun simctl launch booted com.whenbee.app`.

- [ ] **Step 3: Navigate to Patterns and screenshot**

Run: `xcrun simctl io booted screenshot /tmp/patterns-after.png`
Open `/tmp/patterns-after.png` and compare against `docs/superpowers/mockups/patterns-combined.html`. Critically check (per the founder craft rules):
- Hero is the clear focal point; amber glow reads, bee glyph aligned top-right.
- Section headers align; hairline rules reach the edge.
- HonestMap columns share one right edge; dials optically centered to the row.
- ProgressChart line draws on; endpoint dot amber; delta pill green (or "steady"), never red.
- ProTeaserCard reads premium and distinct; CTA depresses onto its coin-edge on press.
- Entrance stagger plays once, calm, < 500ms; no exiting/jank.

- [ ] **Step 4: Verify reduced-motion**

Enable Simulator → Settings → Accessibility → Motion → Reduce Motion. Relaunch Patterns. Confirm sections appear without transforms and the chart line is fully drawn (no animation). No crash.

- [ ] **Step 5: Full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green, 0 warnings.

- [ ] **Step 6: Open the PR (do NOT merge)**

```bash
git push -u origin feat/patterns-redesign
gh pr create --title "feat(patterns): redesign screen into hero + sectioned story" --body "$(cat <<'EOF'
Redesigns the Patterns tab from a flat sameness-scroll into a hero + sectioned story: identity (ArchetypeHero) → progress (ProgressChart) → what changed (DriftNote) → numbers (HonestMap) → Pro (premium ProTeaserCard). One new pure engine derivation (buildAccuracySeries) feeds the progress chart. Presentation-only over the existing gated view model; invariants honored (no guilt, monotonic, on-device, RevenueCat pricing). Entrance motion is entering-only with reduced-motion fallbacks.

Spec: docs/superpowers/specs/2026-06-21-patterns-redesign-design.md
Plan: docs/superpowers/plans/2026-06-21-patterns-redesign.md
Mockup: docs/superpowers/mockups/patterns-combined.html

Verified on iOS sim (dark + reduced-motion). lint + typecheck + test green.
EOF
)"
```
**Stop here. The founder reviews and merges every PR by hand.**

---

## Self-Review

**Spec coverage:** Hero (Task 5), progress chart + trend engine (Tasks 1,2,6), what-changed/drift (Task 7), honest map (Task 8), unified premium Pro teaser (Task 9), section headers + recomposed route + motion (Tasks 4,10), tokens (Task 3), device + reduced-motion verify (Task 11). The spec's "PlanExperiment folds into Progress" → Task 10 keeps it under the Progress section. WeeklyReview banner unchanged → preserved in Task 10. All spec sections map to a task.

**Placeholder scan:** No TBD/TODO. Every code step shows full code. The one risk noted inline: the `usePatterns.test.ts` data factory name (`makePatternsData`) is the existing file's helper — implementer must use the file's actual factory, flagged in Task 2 Step 1.

**Type consistency:** `AccuracyTrend { points, deltaPts }` defined in Task 1, consumed identically in Tasks 2/6. `ProgressChart({ trend, fallback })` signature matches its test and the route call in Task 10. Renames are consistent across tasks: `Archetype`→`ArchetypeHero`, `CalibrationMap`→`HonestMap`, `DriftAlert`→`DriftNote` (each re-exported from its original file path, and all import sites updated in Task 10). `t.space[3.5]` flagged as nonexistent in Task 9 with the fix (use `t.space[4]`).
