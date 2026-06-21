# Category Range-Band Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the category-detail hero so the honest **range** is a living band (segment + caret callout + honey-cell maturity meter + plain-language tier meaning), replacing the flat text block.

**Architecture:** UI-only. A new `CategoryRangeBand` (View-based band, its own caret/ghost/tick chrome) and `MaturityMeter` (two-row honey-cell meter) are composed inside a reworked `HonestCard`. Pure helpers (`maturityMeter`, `makeBandDomain`) are unit-tested; the engine is untouched — `range`, `confidence`, `firstHonestRange` already flow through `CategoryDetail`.

**Tech Stack:** React Native (Expo SDK 54), TypeScript (strict), Reanimated, react-native-svg (honey-cell pips only), Jest + @testing-library/react-native.

## Global Constraints

- **Tokens only** — every color/space/size/font from `src/theme/tokens.ts` via `useTheme()`. No raw hex/number. New top-level token group ⇒ add a matching line in `resolveTheme` (`src/theme/useTheme.ts`) or `t.<key>` is `undefined`. (We extend the already-enumerated `progress` group, so no new `resolveTheme` line is needed.)
- **No guilt / no streaks** — amber never red; honey/sharpness monotonic; band only ever animates *inward* (narrowing), never colored as a regression.
- **Pro gate (spec 03 §9):** range numbers + band segment + maturity meter = FREE; the precise convergence tick ("~30 · where tasks land") + narrowing-proof caption = PRO. Engine math is never gated — gating is a render branch on `isPro`.
- **RN gotcha:** `Pressable` with function-form `style` drops under reactCompiler — keep `Pressable` a bare touch wrapper, put visuals on an inner `View`. Reanimated shared values use `.get()/.set()`, never `.value`. No CSS `boxShadow` for soft shadow on Fabric.
- **Reduced motion:** honor `ReduceMotion.System`; final width immediately, no wipe.
- **Lint gate:** `npm run lint` is `--max-warnings=0`. Run `npx eslint <files>` after each task (flat `eslint.config.js`, no `.eslintrc.js`).
- **Commits:** Conventional Commits. NEVER add Co-Authored-By or any AI/attribution trailer (project policy). Do not merge — open work only.

---

### Task 1: Theme tokens for the band hero

**Files:**
- Modify: `src/theme/tokens.ts` (the `progress` group, ~line 112–118)

**Interfaces:**
- Produces: `tokens.progress.bandTrack: number` (16), `tokens.progress.caret: { w: number; h: number }` ({ w: 10, h: 6 }). Consumed by Tasks 4 & 5 via `t.progress.bandTrack` / `t.progress.caret`. Honey-cell size reuses existing `t.honeycomb.pip` (15); honey fill reuses `t.brand.honeyFill`; on-honey text reuses `t.colors.onAmber`.

- [ ] **Step 1: Add the tokens**

In `src/theme/tokens.ts`, extend the `progress` object (it already resolves through `useTheme`, so no `resolveTheme` edit is needed):

```ts
  progress: {
    track: 6, gapTrack: 8, tickW: 3, tickH: 16,
    // bandTrack = the category-detail hero range band height (a bolder strip than
    // the Add-Task gapTrack). caret = the convergence-point callout triangle that
    // floats above the band (w = base, h = height of the downward caret).
    bandTrack: 16, caret: { w: 10, h: 6 },
    gapStripe: { lineW: 2, gapW: 4 },
  },
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/theme/tokens.ts
git commit -m "feat(theme): add range-band hero tokens (bandTrack, caret)"
```

---

### Task 2: `maturityMeter` pure helper

**Files:**
- Create: `src/features/category-detail/maturity.ts`
- Test: `src/features/category-detail/__tests__/maturity.test.ts`
- Modify: `src/engine/index.ts` (re-export `CONFIDENCE_HONEST_MIN_LOGS`)

**Interfaces:**
- Consumes: `CONFIDENCE_HONEST_MIN_LOGS` from `@/src/engine` (value `6`, in `src/engine/constants.ts`), `CalibrationConfidence` from `@/src/domain/types`.
- Produces: `interface Meter { filled: number; total: number; runsLeft: number; settledButNoisy: boolean }` and `maturityMeter(n: number, confidence: CalibrationConfidence): Meter`. Consumed by Tasks 3 & 5.

- [ ] **Step 1: Export the constant from the engine barrel**

Confirm `CONFIDENCE_HONEST_MIN_LOGS` is exported. In `src/engine/index.ts`, add it to the constants re-export (find the line exporting from `./constants` and include it):

```ts
export {
  // ...existing constant exports...
  CONFIDENCE_HONEST_MIN_LOGS,
} from './constants';
```

(If `./constants` is re-exported with `export * from './constants'`, this step is already satisfied — verify with `grep -n "CONFIDENCE_HONEST_MIN_LOGS\|export \* from './constants'" src/engine/index.ts` and skip if present.)

- [ ] **Step 2: Write the failing test**

```ts
// src/features/category-detail/__tests__/maturity.test.ts
import { maturityMeter } from '@/src/features/category-detail/maturity';

describe('maturityMeter', () => {
  it('lights one cell per log, capped at the honest threshold (6)', () => {
    expect(maturityMeter(2, 'setting')).toEqual({
      filled: 2, total: 6, runsLeft: 4, settledButNoisy: false,
    });
  });

  it('n=0 is all empty with full runsLeft', () => {
    expect(maturityMeter(0, 'raw')).toEqual({
      filled: 0, total: 6, runsLeft: 6, settledButNoisy: false,
    });
  });

  it('caps filled and clamps runsLeft to 0 at/above threshold', () => {
    expect(maturityMeter(8, 'setting')).toEqual({
      filled: 6, total: 6, runsLeft: 0, settledButNoisy: true,
    });
  });

  it('honest at threshold is not "settledButNoisy"', () => {
    expect(maturityMeter(6, 'honest')).toEqual({
      filled: 6, total: 6, runsLeft: 0, settledButNoisy: false,
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/features/category-detail/__tests__/maturity.test.ts`
Expected: FAIL — "Cannot find module '.../maturity'".

- [ ] **Step 4: Write the implementation**

```ts
// src/features/category-detail/maturity.ts
import { CONFIDENCE_HONEST_MIN_LOGS } from '@/src/engine';
import type { CalibrationConfidence } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// maturityMeter — the honey-cell "runs to one honest number" progress.
//
// One cell per log lit, capped at the honest-confidence log threshold. Pure: the
// caption + pip render derive entirely from this. `settledButNoisy` flags the
// honest case where there are enough logs but the spread is still too wide to
// graduate (confidence stays 'setting') — copy nudges differently there.
// ──────────────────────────────────────────────────────────────────────────────

export interface Meter {
  filled: number;
  total: number;
  runsLeft: number;
  settledButNoisy: boolean;
}

export function maturityMeter(n: number, confidence: CalibrationConfidence): Meter {
  const total = CONFIDENCE_HONEST_MIN_LOGS;
  const filled = Math.max(0, Math.min(n, total));
  const runsLeft = Math.max(0, total - n);
  const settledButNoisy = runsLeft === 0 && confidence !== 'honest';
  return { filled, total, runsLeft, settledButNoisy };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/features/category-detail/__tests__/maturity.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/features/category-detail/maturity.ts src/features/category-detail/__tests__/maturity.test.ts src/engine/index.ts
git add src/features/category-detail/maturity.ts src/features/category-detail/__tests__/maturity.test.ts src/engine/index.ts
git commit -m "feat(category): add maturityMeter pure helper"
```

---

### Task 3: `HoneyPips` + `MaturityMeter` components

**Files:**
- Create: `src/features/category-detail/HoneyPips.tsx`
- Create: `src/features/category-detail/MaturityMeter.tsx`
- Test: `src/features/category-detail/__tests__/maturityMeter.test.tsx`

**Interfaces:**
- Consumes: `Meter` + `maturityMeter` (Task 2); `t.honeycomb.pip`, `t.brand.honeyFill`, `t.colors.surfaceRaised` (tokens).
- Produces: `HoneyPips({ filled, total }: { filled: number; total: number })` — a single SVG row of flat-top hexagons. `MaturityMeter({ meter }: { meter: Meter })` — pips row **above**, caption row **below** (two rows, never side-by-side). Consumed by Task 5.

- [ ] **Step 1: Write `HoneyPips` (SVG flat-top hexagons in one row)**

```tsx
// src/features/category-detail/HoneyPips.tsx
import Svg, { Polygon } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// Flat-top hexagon honey cells in a single row. One SVG (not one per pip) keeps
// it cheap. Filled cells = honey, remaining = the raised surface (a quiet ghost).
export function HoneyPips({ filled, total }: { filled: number; total: number }) {
  const t = useTheme();
  const s = t.honeycomb.pip; // cell box (square); hexagon inscribed
  const gap = t.space[1.5];
  const w = total * s + (total - 1) * gap;
  // flat-top hexagon points within an s×s box
  const hex = (x: number) =>
    `${x + s * 0.25},0 ${x + s * 0.75},0 ${x + s},${s * 0.5} ${x + s * 0.75},${s} ${x + s * 0.25},${s} ${x},${s * 0.5}`;
  return (
    <Svg width={w} height={s}>
      {Array.from({ length: total }, (_, i) => (
        <Polygon
          key={i}
          points={hex(i * (s + gap))}
          fill={i < filled ? t.brand.honeyFill : t.colors.surfaceRaised}
        />
      ))}
    </Svg>
  );
}
```

- [ ] **Step 2: Write `MaturityMeter` (two rows: pips, then caption)**

```tsx
// src/features/category-detail/MaturityMeter.tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { HoneyPips } from './HoneyPips';
import type { Meter } from './maturity';

// Maturity meter — TWO ROWS by design: the honey-cell pips on their own line,
// the caption on the line below. Never side-by-side (the caption must not wrap
// in a cramped column beside the pips).
export function MaturityMeter({ meter }: { meter: Meter }) {
  const t = useTheme();
  const wrap: ViewStyle = { gap: t.space[3], marginTop: t.space[6] };
  const caption: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const strong: TextStyle = { color: t.colors.ink, fontFamily: 'Jakarta-Bold' };

  const lead = meter.settledButNoisy ? (
    <Text style={caption}>A few more runs and this settles to one number.</Text>
  ) : (
    <Text style={caption}>
      <Text style={strong}>{meter.runsLeft} more {meter.runsLeft === 1 ? 'run' : 'runs'}</Text>
      {' sharpen this to one number'}
    </Text>
  );

  return (
    <View style={wrap}>
      <HoneyPips filled={meter.filled} total={meter.total} />
      {lead}
    </View>
  );
}
```

- [ ] **Step 3: Write the render test**

```tsx
// src/features/category-detail/__tests__/maturityMeter.test.tsx
import { render, screen } from '@testing-library/react-native';
import { MaturityMeter } from '@/src/features/category-detail/MaturityMeter';
import { maturityMeter } from '@/src/features/category-detail/maturity';

describe('MaturityMeter', () => {
  it('shows the runs-left caption while learning', () => {
    render(<MaturityMeter meter={maturityMeter(2, 'setting')} />);
    expect(screen.getByText(/4 more runs/)).toBeOnTheScreen();
    expect(screen.getByText(/sharpen this to one number/)).toBeOnTheScreen();
  });

  it('singularizes a single remaining run', () => {
    render(<MaturityMeter meter={maturityMeter(5, 'setting')} />);
    expect(screen.getByText(/1 more run/)).toBeOnTheScreen();
  });

  it('shows the settle nudge when enough logs but still noisy', () => {
    render(<MaturityMeter meter={maturityMeter(8, 'setting')} />);
    expect(screen.getByText(/A few more runs and this settles/)).toBeOnTheScreen();
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npx jest src/features/category-detail/__tests__/maturityMeter.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/category-detail/HoneyPips.tsx src/features/category-detail/MaturityMeter.tsx src/features/category-detail/__tests__/maturityMeter.test.tsx
git add src/features/category-detail/HoneyPips.tsx src/features/category-detail/MaturityMeter.tsx src/features/category-detail/__tests__/maturityMeter.test.tsx
git commit -m "feat(category): add HoneyPips + two-row MaturityMeter"
```

---

### Task 4: `makeBandDomain` helper + `CategoryRangeBand` component

**Files:**
- Create: `src/features/shared/bandDomain.ts`
- Test: `src/features/shared/__tests__/bandDomain.test.ts`
- Create: `src/features/category-detail/CategoryRangeBand.tsx`

**Interfaces:**
- Consumes: `HonestRange`, `CalibrationConfidence` from `@/src/domain/types`; tokens `t.progress.bandTrack`, `t.progress.caret`, `t.colors.{accent,accentSoft,accentEdge,surfaceSunken,onAmber,primary,primarySoft,inkSoft}`, `t.brand.honeyFill`, `t.motion`.
- Produces:
  - `makeBandDomain(range: HonestRange): { at: (minutes: number) => number }` — maps minutes → [0,1] over the display domain `[floor5(low*0.6), ceil5(high*1.4)]`.
  - `CategoryRangeBand({ range, point, confidence, isPro, priorRange, onUnlockPress })` where `point: number`, `priorRange?: HonestRange | null`, `onUnlockPress?: () => void`. Consumed by Task 5.

- [ ] **Step 1: Write the failing helper test**

```ts
// src/features/shared/__tests__/bandDomain.test.ts
import { makeBandDomain } from '@/src/features/shared/bandDomain';

describe('makeBandDomain', () => {
  it('maps the range edges inside the padded domain', () => {
    // range 20–40 → domain [floor5(12)=10, ceil5(56)=60], span 50
    const { at } = makeBandDomain({ lowMinutes: 20, highMinutes: 40 });
    expect(at(20)).toBeCloseTo(0.2, 5); // (20-10)/50
    expect(at(40)).toBeCloseTo(0.6, 5); // (40-10)/50
    expect(at(30)).toBeCloseTo(0.4, 5); // point midway
  });

  it('clamps to [0,1] outside the domain', () => {
    const { at } = makeBandDomain({ lowMinutes: 20, highMinutes: 40 });
    expect(at(0)).toBe(0);
    expect(at(1000)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/shared/__tests__/bandDomain.test.ts`
Expected: FAIL — "Cannot find module '.../bandDomain'".

- [ ] **Step 3: Write the helper**

```ts
// src/features/shared/bandDomain.ts
import type { HonestRange } from '@/src/domain/types';

// Presentation-only minutes→fraction mapper for the honest band (spec 03 §8.4).
// A fixed padded domain so the segment width is comparable across renders and a
// ghost of a prior (wider) range maps onto the same axis.
const floor5 = (n: number) => Math.floor(n / 5) * 5;
const ceil5 = (n: number) => Math.ceil(n / 5) * 5;

export function makeBandDomain(range: HonestRange): { at: (minutes: number) => number } {
  const domainLow = Math.max(0, floor5(range.lowMinutes * 0.6));
  const domainHigh = ceil5(range.highMinutes * 1.4);
  const span = Math.max(domainHigh - domainLow, 5);
  const at = (m: number) => Math.min(1, Math.max(0, (m - domainLow) / span));
  return { at };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/features/shared/__tests__/bandDomain.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write `CategoryRangeBand`**

The band: a sunken track; an optional ghost of the prior wider range (Pro); the amber range segment (tone by confidence); a caret callout above the convergence point; the point tick (Pro = amber, free = locked indigo, tappable to the paywall). Reanimated narrows the segment inward on mount.

```tsx
// src/features/category-detail/CategoryRangeBand.tsx
import { useEffect } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';
import { makeBandDomain } from '@/src/features/shared/bandDomain';

interface Props {
  range: HonestRange;
  /** The convergence point (honest minutes) the caret marks. */
  point: number;
  confidence: CalibrationConfidence;
  /** Pro unlocks the precise point tick + caret value; free sees it locked. */
  isPro: boolean;
  /** A prior, wider range to ghost behind the live band (Pro narrowing proof). */
  priorRange?: HonestRange | null;
  /** Tapped when a free user taps the locked caret — opens the paywall. */
  onUnlockPress?: () => void;
}

export function CategoryRangeBand({
  range, point, confidence, isPro, priorRange, onUnlockPress,
}: Props) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const { at } = makeBandDomain(range);

  const left = at(range.lowMinutes);
  const width = Math.max(at(range.highMinutes) - left, 0.04);
  const pointPct = at(point);
  const fill = confidence === 'honest' ? t.colors.accent : t.colors.accentSoft;

  // Ghost of the prior, wider range — only when it is genuinely wider (Pro).
  const showGhost =
    isPro && priorRange != null &&
    priorRange.highMinutes - priorRange.lowMinutes > range.highMinutes - range.lowMinutes;
  const ghostLeft = showGhost ? at(priorRange!.lowMinutes) : 0;
  const ghostWidth = showGhost ? Math.max(at(priorRange!.highMinutes) - ghostLeft, 0.04) : 0;

  // Segment narrows inward from the full track on mount (the "tightening" gesture).
  const w = useSharedValue(reduceMotion ? width : 1);
  const l = useSharedValue(left);
  const caretOpacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    const timing = { duration: t.motion.base, easing: t.motion.easing.out, reduceMotion: ReduceMotion.System };
    w.set(withTiming(width, timing));
    l.set(withTiming(left, timing));
    caretOpacity.set(withDelay(t.motion.fast, withTiming(1, { duration: t.motion.fast, reduceMotion: ReduceMotion.System })));
  }, [width, left, t.motion, w, l, caretOpacity]);

  const segStyle = useAnimatedStyle(() => ({ left: `${l.get() * 100}%`, width: `${w.get() * 100}%` }));
  const caretStyle = useAnimatedStyle(() => ({ opacity: caretOpacity.get() }));

  const track: ViewStyle = {
    position: 'relative',
    height: t.progress.bandTrack,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    marginTop: t.space[8],
  };
  const segBase: ViewStyle = { position: 'absolute', top: 0, bottom: 0, borderRadius: t.radii.full };
  const ghost: ViewStyle = {
    ...segBase, left: `${ghostLeft * 100}%`, width: `${ghostWidth * 100}%`,
    backgroundColor: t.colors.accentSoft, opacity: 0.5,
  };
  const tick: ViewStyle = {
    position: 'absolute', top: -t.space[0.5], bottom: -t.space[0.5],
    left: `${pointPct * 100}%`, width: t.progress.tickW, marginLeft: -t.progress.tickW / 2,
    borderRadius: t.radii.full, backgroundColor: isPro ? t.colors.accentEdge : t.colors.primary,
  };

  // Caret callout: a small pill + downward triangle, centered on the point.
  // width:0 + alignItems:center centers variable-width children on the point%
  // (RN transforms are numeric, so translateX(-50%) is not an option).
  const calloutWrap: ViewStyle = {
    position: 'absolute', top: -(t.progress.caret.h + t.space[6]),
    left: `${pointPct * 100}%`, width: 0, alignItems: 'center',
  };
  const pill: ViewStyle = {
    backgroundColor: isPro ? t.brand.honeyFill : t.colors.primarySoft,
    borderRadius: t.radii.full, paddingHorizontal: t.space[2], paddingVertical: t.space[0.5],
  };
  const pillText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: isPro ? t.colors.onAmber : t.colors.primary,
  };
  const caret: ViewStyle = {
    width: 0, height: 0, marginTop: -1,
    borderLeftWidth: t.progress.caret.w / 2, borderRightWidth: t.progress.caret.w / 2,
    borderTopWidth: t.progress.caret.h, borderStyle: 'solid',
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: isPro ? t.brand.honeyFill : t.colors.primarySoft,
  };
  const endRow: ViewStyle = { position: 'relative', height: t.space[4], marginTop: t.space[2.5] };
  // Same zero-width-centered trick so each end number sits centered on its fill edge.
  const endCell = (frac: number): ViewStyle => ({
    position: 'absolute', left: `${frac * 100}%`, width: 0, alignItems: 'center',
  });
  const endTxt: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  // The caret is the locked-Pro affordance for free users (tap → paywall). Keep
  // the Pressable a bare wrapper; the visual pill sits on the inner View.
  const calloutInner = (
    <View style={{ alignItems: 'center' }}>
      <View style={pill}>
        <Text style={pillText}>{isPro ? `~${point}` : `\u{1F512} ~${point}`}</Text>
      </View>
      <View style={caret} />
    </View>
  );

  return (
    <View>
      <View style={track}>
        {showGhost ? <View style={ghost} pointerEvents="none" /> : null}
        <Animated.View style={[segBase, { backgroundColor: fill }, segStyle]} />
        <View style={tick} pointerEvents="none" />
        <Animated.View style={[calloutWrap, caretStyle]}>
          {isPro || !onUnlockPress ? (
            calloutInner
          ) : (
            <Pressable onPress={onUnlockPress} accessibilityRole="button" accessibilityLabel="Unlock where tasks land with Pro" hitSlop={t.size.hitSlop}>
              {calloutInner}
            </Pressable>
          )}
        </Animated.View>
      </View>
      <View style={endRow}>
        <View style={endCell(left)}><Text style={endTxt}>{range.lowMinutes}</Text></View>
        <View style={endCell(at(range.highMinutes))}><Text style={endTxt}>{range.highMinutes}</Text></View>
      </View>
    </View>
  );
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/features/shared/bandDomain.ts src/features/shared/__tests__/bandDomain.test.ts src/features/category-detail/CategoryRangeBand.tsx`
Expected: PASS (no errors/warnings).

- [ ] **Step 7: Commit**

```bash
git add src/features/shared/bandDomain.ts src/features/shared/__tests__/bandDomain.test.ts src/features/category-detail/CategoryRangeBand.tsx
git commit -m "feat(category): add makeBandDomain + CategoryRangeBand"
```

---

### Task 5: Rework `HonestCard` into the band hero + update its tests

**Files:**
- Modify: `src/features/category-detail/HonestCard.tsx` (full hero rework)
- Modify: `src/features/category-detail/__tests__/HonestCard.test.tsx` (new copy/structure)

**Interfaces:**
- Consumes: `CategoryRangeBand` (Task 4), `MaturityMeter` + `maturityMeter` (Tasks 2–3), `HonestNumber` (existing). Props on `HonestCard` are unchanged (the screen already passes `tier, n, logsToNext, nextTier, confidence, range, isPro, firstHonestRange, honestMinutes, multiplier`).
- Produces: the rendered hero. The honest state (point number + multiplier + affirmation) is unchanged behavior.

- [ ] **Step 1: Add the tier-meaning map + rework the learning branch**

Replace the body of `src/features/category-detail/HonestCard.tsx`. Keep the honest/tight-number branch and props exactly as today; replace the `showRange` learning branch with the band hero. Full file:

```tsx
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { HonestNumber } from '@/src/components/HonestNumber';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';
import { CategoryRangeBand } from './CategoryRangeBand';
import { MaturityMeter } from './MaturityMeter';
import { maturityMeter } from './maturity';

// ──────────────────────────────────────────────────────────────────────────────
// HonestCard — the category hero. While learning, the honest RANGE is the hero:
// a tier-meaning pill, the range number, a living band (segment + caret callout),
// and a two-row honey-cell maturity meter. Once honest it collapses to the single
// number + multiplier + affirmation. Range numbers + band are free; the precise
// convergence tick is the Pro layer (spec 03 §9). No guilt, amber never red.
// ──────────────────────────────────────────────────────────────────────────────

interface HonestCardProps {
  categoryName: string;
  honestMinutes: number;
  multiplier: number;
  provenance: string;
  tier?: string;
  n?: number;
  logsToNext?: number;
  nextTier?: string | null;
  confidence?: CalibrationConfidence;
  range?: HonestRange | null;
  reasonNote?: string;
  isPro?: boolean;
  firstHonestRange?: HonestRange | null;
}

// Plain-language meaning for the one-word tier pill (replaces "6 to Ripening").
const TIER_MEANING: Record<Exclude<CalibrationConfidence, 'honest'>, string> = {
  raw: 'just getting to know your pace',
  setting: 'still sharpening your pace',
};

export function HonestCard({
  honestMinutes, multiplier, tier, n = 0, confidence, range,
  reasonNote, isPro = false, firstHonestRange,
}: HonestCardProps) {
  const t = useTheme();
  const showRange = confidence !== undefined && confidence !== 'honest' && range != null;

  const tierRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const pill: ViewStyle = {
    flexDirection: 'row', alignItems: 'center', gap: t.space[1.5],
    backgroundColor: t.colors.accentSoft, borderRadius: t.radii.full,
    paddingHorizontal: t.space[3], paddingVertical: t.space[1],
  };
  const pillHex: ViewStyle = {
    width: t.space[2], height: t.space[2], borderRadius: t.radii.sm, backgroundColor: t.brand.honeyFill,
  };
  const pillText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.amberText };
  const meaning: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft, flex: 1 };

  const heroBlock: ViewStyle = { gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const numberRow: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[3], flexWrap: 'wrap' };
  const multNote: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, paddingBottom: t.space[1] };
  const affirmRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] };
  const affirmText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.amberText, fontFamily: 'Jakarta-Bold' };
  const reasonNoteText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const narrowCaption: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, marginTop: t.space[6] };
  const strong: TextStyle = { color: t.colors.ink, fontFamily: 'Jakarta-Bold' };

  const learningTier = confidence === 'raw' ? 'raw' : 'setting';
  const meter = maturityMeter(n, confidence ?? 'setting');

  // Pro narrowing proof: a prior, wider range exists → show "tightened from".
  const narrowed =
    isPro && showRange && firstHonestRange != null && range != null &&
    firstHonestRange.highMinutes - firstHonestRange.lowMinutes >
      range.highMinutes - range.lowMinutes;

  const openPaywall = () => {
    analytics.capture('honest_range_locked_tap', { surface: 'category_detail' });
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'honest_range' } });
  };

  return (
    <View style={{ gap: t.space[4] }}>
      {tier && showRange ? (
        <View style={tierRow}>
          <View style={pill}>
            <View style={pillHex} />
            <Text style={pillText}>{tier}</Text>
          </View>
          <Text style={meaning}>{TIER_MEANING[learningTier]}</Text>
        </View>
      ) : null}

      <View style={heroBlock}>
        <Text style={eyebrow}>{showRange ? 'YOUR HONEST RANGE' : 'YOUR HONEST NUMBER'}</Text>

        {showRange && range ? (
          <>
            <View style={numberRow}>
              <HonestNumber size="xl" tone="ink" value={`${range.lowMinutes}–${range.highMinutes}`} unit="min" />
            </View>
            <CategoryRangeBand
              range={range}
              point={honestMinutes}
              confidence={confidence ?? 'setting'}
              isPro={isPro}
              priorRange={firstHonestRange}
              onUnlockPress={openPaywall}
            />
            {narrowed && firstHonestRange ? (
              <Text style={narrowCaption}>
                <Text style={strong}>Tightened from {firstHonestRange.lowMinutes}–{firstHonestRange.highMinutes}</Text>
                {' as you logged.'}
              </Text>
            ) : (
              <MaturityMeter meter={meter} />
            )}
          </>
        ) : (
          <>
            <View style={numberRow}>
              <HonestNumber size="xl" tone="ink" value={`~${honestMinutes}`} unit="min" />
              <Text style={multNote}>runs {multiplier.toFixed(1)}×</Text>
            </View>
            {confidence === 'honest' ? (
              <View style={affirmRow}>
                <Ionicons name="checkmark-circle" size={t.iconSize.sm} color={t.colors.accent} />
                <Text style={affirmText}>Now an honest number</Text>
              </View>
            ) : null}
          </>
        )}
        {reasonNote ? <Text style={reasonNoteText}>{reasonNote}</Text> : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Update `HonestCard.test.tsx` for the new structure**

Replace `src/features/category-detail/__tests__/HonestCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { HonestCard } from '@/src/features/category-detail/HonestCard';

const base = {
  categoryName: 'Cleaning',
  honestMinutes: 30,
  multiplier: 2.0,
  provenance: 'based on your runs',
  tier: 'Setting',
  n: 2,
  logsToNext: 2,
  nextTier: 'Ripening' as const,
};

describe('HonestCard — range band hero', () => {
  it('shows the range, tier meaning, and maturity caption while learning (free)', () => {
    render(<HonestCard {...base} confidence="setting" range={{ lowMinutes: 20, highMinutes: 40 }} isPro={false} />);
    expect(screen.getByText('20–40')).toBeOnTheScreen();
    expect(screen.getByText('YOUR HONEST RANGE')).toBeOnTheScreen();
    expect(screen.getByText('still sharpening your pace')).toBeOnTheScreen();
    expect(screen.getByText(/4 more runs/)).toBeOnTheScreen();
    // Free: the convergence caret is the LOCKED teaser (lock glyph + point).
    expect(screen.getByText(/~30/)).toBeOnTheScreen();
    // No tight number / multiplier while learning.
    expect(screen.queryByText('runs 2.0×')).toBeNull();
  });

  it('uses the raw tier meaning for raw confidence', () => {
    render(<HonestCard {...base} n={1} confidence="raw" range={{ lowMinutes: 20, highMinutes: 45 }} />);
    expect(screen.getByText('just getting to know your pace')).toBeOnTheScreen();
  });

  it('shows the narrowing proof for Pro with a wider prior range', () => {
    render(
      <HonestCard
        {...base}
        confidence="setting"
        range={{ lowMinutes: 20, highMinutes: 40 }}
        isPro
        firstHonestRange={{ lowMinutes: 10, highMinutes: 55 }}
      />,
    );
    expect(screen.getByText(/Tightened from 10–55/)).toBeOnTheScreen();
  });

  it('shows the tight number, multiplier, and affirmation once honest', () => {
    render(<HonestCard {...base} confidence="honest" range={null} />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('runs 2.0×')).toBeOnTheScreen();
    expect(screen.getByText('Now an honest number')).toBeOnTheScreen();
    expect(screen.getByText('YOUR HONEST NUMBER')).toBeOnTheScreen();
  });

  it('falls back to the tight number when confidence is omitted (back-compat)', () => {
    render(<HonestCard {...base} />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('runs 2.0×')).toBeOnTheScreen();
    expect(screen.queryByText('Now an honest number')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the HonestCard + screen tests**

Run: `npx jest src/features/category-detail/`
Expected: PASS. If `categoryDetailScreen.test.tsx` or `honestCardReasonNote.test.tsx` assert the old learning copy ("Still learning your pace" / "Getting clearer"), update those assertions to the new strings (tier meaning + maturity caption) — same render, new copy.

- [ ] **Step 4: Full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS (0 lint warnings).

- [ ] **Step 5: Commit**

```bash
git add src/features/category-detail/HonestCard.tsx src/features/category-detail/__tests__/
git commit -m "feat(category): range band hero — tier meaning, band, maturity meter"
```

- [ ] **Step 6: Verify on the simulator**

Build/run: `npm run ios`. Open a category with 1–2 logs (Setting). Confirm against `docs/superpowers/mockups/category-hero-band.html`:
- Range number + amber band; caret "~30" floats above (free = indigo lock, Pro = honey); end numbers under the fill edges.
- Honey-cell pips **above** the caption ("4 more runs…"), not beside it.
- Band narrows inward on entry; reduced-motion shows final width.
- Tap the locked caret (free) → paywall opens with `trigger: 'honest_range'`.
Capture: `xcrun simctl io booted screenshot /tmp/category-hero.png` and eyeball spacing/alignment before calling it done.

---

## Notes / deferred (from the design spec open questions)

- **9.3 double-sell:** `ProHonestWeekTease` still renders on the screen (`[category].tsx:123`). With the band now teasing Pro via the locked caret, decide with the founder whether to keep both anchors. Not changed in this plan.
- **9.2 band height:** uses `progress.bandTrack` (16). Tune in `tokens.ts` if it reads heavy on device.
- The shared `HonestBand` (Add-Task strip) is intentionally left untouched — `CategoryRangeBand` is the category-hero-specific variant so the hot Add-Task path stays lean.
