# Today Ledger + Wax-Seal Ritual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three loose Today header pieces (honey HUD, reclaim line, ritual line) with one ledger card whose footer pairs the reclaim drip with a wax-seal "log one honest thing" affordance that seals with a calm, gain-only animation.

**Architecture:** Extend the existing `TodayHud` into the ledger card (top = honey HUD routing to the hub; optional hairline footer = inline reclaim stat + a new `RitualSeal` touch target). `RitualSeal` is a self-contained `react-native-svg` + Reanimated component owning the locked choreography. The screen (`index.tsx`) feeds presence flags from `useToday` + `useSettingsStore`; the old `ReclaimTodayLine`/`DailyRitualLine` components are removed.

**Tech Stack:** React Native (Expo SDK 54), TypeScript (strict), `react-native-reanimated` (`.get()/.set()` API), `react-native-svg`, Zustand, Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-06-18-today-ledger-ritual-seal-design.md`. **Binding render:** `docs/superpowers/plans/bee-ritual-final.html` (+ `bee-ritual-waxseal2-dark.html` for the locked motion).

## Global Constraints

- **Every color/size/font/radius/motion value comes from a token in `src/theme/tokens.ts` via `useTheme()`.** No inline hex or raw numbers. New value → add a token. (Glyph *geometry* in a 24-unit box may be local consts, matching the existing `EnergyGlyph` pattern — colors must still be tokens.)
- **No streak / count / loss / guilt.** Resting seal = warm invitation; resets invisibly; no day-count; empty days invisible.
- **Amber-never-red.** Honey yellow (`brand.honeyFill`) + indigo only. No red anywhere.
- **Reanimated:** read/write shared values with `.get()/.set()`, never `.value`. Guard motion with `useReducedMotion()` → final state, no motion.
- **`Pressable` stays a bare touch wrapper**; visual style on an inner `View` (reactCompiler/nativewind gotcha). No CSS `boxShadow` (use `Platform.select`/View-edge for the light coin shadow — already handled by `BeeCoin`).
- **Layer rule:** `src/components/**` and `src/app/**` must not import `src/services/*` or `src/db/*` — route through `useToday`/stores.
- **Commits:** Conventional Commits; **never** add AI/co-author attribution. **Do not merge** — open work only.
- Verify with `npx eslint <files>`, `npm run typecheck`, `npx jest <file>` after each task; full `npm run lint && npm run typecheck && npm test` before finishing.

---

## File Structure

- **Create** `src/features/today/RitualSeal.tsx` — the seal glyph + label + tap target; owns the animation.
- **Create** `src/features/today/__tests__/RitualSeal.test.tsx`.
- **Modify** `src/theme/tokens.ts` — add `brand.honeyFill`, `motion.easing.premium`, `motion.seal`. (Both are nested under already-resolved groups, so `useTheme`/`resolveTheme` needs **no** change — [[usetheme-token-enumeration]] only applies to new top-level groups.)
- **Modify** `src/components/honeycomb/TodayHud.tsx` — restructure into the ledger card: top row Pressable (hub) + optional hairline footer (inline reclaim + `RitualSeal`).
- **Modify** `src/components/honeycomb/__tests__/TodayHud.test.tsx` — add presence-state cases.
- **Modify** `src/app/(tabs)/index.tsx` — pass footer props to `TodayHud`; remove the standalone `ReclaimTodayLine` + `DailyRitualLine`.
- **Delete** `src/features/today/ReclaimTodayLine.tsx`, `src/features/today/DailyRitualLine.tsx`, and their tests `src/features/today/__tests__/reclaimTodayLine.test.tsx` (+ any `DailyRitualLine` test).

---

## Task 1: Tokens — honey-fill color, premium easing, seal timings

**Files:**
- Modify: `src/theme/tokens.ts`

**Interfaces:**
- Produces: `t.brand.honeyFill: string`; `t.motion.easing.premium: EasingFunctionFactory`; `t.motion.seal: { border:number; honey:number; bloom:number; mark:number; spark:number; dBorder:number; dHoney:number; dBloom:number; dMark:number; dSpark:number }`.

- [ ] **Step 1: Add the honey-fill brand color**

In `src/theme/tokens.ts`, find the `brand:` object and add `honeyFill` as a sibling of `bee` (fixed art color, mode-independent):

```ts
  brand: {
    honeyFill: '#F5C03F', // lit yellow honey — the sealed-cell fill (brighter than accent, distinct from the indigo body)
    bee: {
      // …unchanged…
    },
  },
```

- [ ] **Step 2: Add the premium easing curve**

In `tokens.motion.easing`, add `premium` alongside `standard`/`calm`/`honey`:

```ts
    easing: { standard: Easing.bezier(0.4, 0, 0.2, 1), calm: Easing.inOut(Easing.sin), honey: Easing.bezier(0.22, 1, 0.36, 1), premium: Easing.bezier(0.4, 0, 0.2, 1) },
```

- [ ] **Step 3: Add the seal timing group**

In `tokens.motion`, add a `seal` group (durations + per-beat delays, ms) near the other named motion values:

```ts
    // Wax-seal ritual choreography (RitualSeal). Calm, no overshoot: the border
    // draws closed FIRST, then honey wells up, a soft bloom passes, the ✦ fades
    // in, and an amber sparkle bursts radially. Durations + start delays (ms).
    seal: { border: 660, honey: 580, bloom: 900, mark: 360, spark: 620, dBorder: 40, dHoney: 700, dBloom: 980, dMark: 1200, dSpark: 1220 },
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). `t.brand.honeyFill`, `t.motion.easing.premium`, `t.motion.seal.*` now resolve.

- [ ] **Step 5: Commit**

```bash
git add src/theme/tokens.ts
git commit -m "feat(theme): add honey-fill color, premium easing, and seal motion timings"
```

---

## Task 2: `RitualSeal` component

A `Pressable` containing the seal SVG + label. Drives the locked choreography off a `done` prop via Reanimated shared values (one per beat, mirroring `EnergyGlyph`). Resting = faint breathing hex + invitation; sealed = yellow fill, indigo border (= star color), indigo `✦`. Reduced-motion / already-done-on-mount → final state, no motion.

**Files:**
- Create: `src/features/today/RitualSeal.tsx`
- Test: `src/features/today/__tests__/RitualSeal.test.tsx`

**Interfaces:**
- Consumes: `t.brand.honeyFill`, `t.brand.bee.body` (`#5F4EE4`, the seal border + ✦), `t.brand.bee.wing` (`#FCE7C5`, surface edge), `t.colors.primary`, `t.colors.inkSoft`, `t.colors.amberText`, `t.motion.seal`, `t.motion.easing`.
- Produces: `RitualSeal({ done, onLog, size? }: { done: boolean; onLog: () => void; size?: number }) → JSX.Element`. Labels: invitation `Log one honest thing`, done `Today's honey set ✦`. Plays the animation only on a `false → true` transition of `done`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/today/__tests__/RitualSeal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RitualSeal } from '@/src/features/today/RitualSeal';

describe('RitualSeal', () => {
  it('shows the invitation when not done and logs on press', () => {
    const onLog = jest.fn();
    render(<RitualSeal done={false} onLog={onLog} />);
    expect(screen.getByText('Log one honest thing')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Log one honest thing'));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it('shows the sealed label when done', () => {
    render(<RitualSeal done onLog={() => {}} />);
    expect(screen.getByText("Today's honey set ✦")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/today/__tests__/RitualSeal.test.tsx`
Expected: FAIL — cannot find module `RitualSeal`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/today/RitualSeal.tsx
import { useEffect, useRef } from 'react';
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useReducedMotion,
  withDelay,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Path, Rect, Circle, G, Defs, ClipPath, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// RitualSeal — the daily "log one honest thing" affordance, drawn as a comb cell
// that seals on a log. Gain-only: the resting outline is a calm invitation (no
// count, no streak, no scold); on a log it plays a one-shot, calm choreography —
// the indigo border draws closed, honey wells up, a soft bloom passes, the ✦
// fades in, and an amber sparkle bursts radially. Resets invisibly each day.
// Border + ✦ are the brand indigo (bee.body); fill is the lit honey yellow.
// ──────────────────────────────────────────────────────────────────────────────

const BOX = 24;
// Flat-top hex path + its approx perimeter (for the border draw).
const HEX = 'M5 12 L8.5 5.4 H15.5 L19 12 L15.5 18.6 H8.5 Z';
const HEX_PERIM = 44;
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

export function RitualSeal({
  done,
  onLog,
  size = 27,
}: {
  done: boolean;
  onLog: () => void;
  size?: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const m = t.motion.seal;
  const e = t.motion.easing;

  // One shared value per beat (0 → 1), like EnergyGlyph.
  const border = useSharedValue(done ? 1 : 0);
  const honey = useSharedValue(done ? 1 : 0);
  const bloom = useSharedValue(0); // one-shot; rests at 0
  const mark = useSharedValue(done ? 1 : 0);
  const spark = useSharedValue(0); // one-shot; rests at 0
  const prevDone = useRef(done);

  useEffect(() => {
    const justSealed = !prevDone.current && done;
    prevDone.current = done;

    if (!done) {
      border.set(0); honey.set(0); mark.set(0); bloom.set(0); spark.set(0);
      return;
    }
    if (reduced || !justSealed) {
      // Already sealed on mount, or reduced motion: snap to final, no motion.
      border.set(1); honey.set(1); mark.set(1); bloom.set(0); spark.set(0);
      return;
    }
    // Play the one-shot: border → honey → bloom → ✦ → sparkle.
    border.set(0); border.set(withDelay(m.dBorder, withTiming(1, { duration: m.border, easing: e.standard })));
    honey.set(0);  honey.set(withDelay(m.dHoney, withTiming(1, { duration: m.honey, easing: e.premium })));
    bloom.set(0);  bloom.set(withDelay(m.dBloom, withTiming(1, { duration: m.bloom, easing: e.calm })));
    mark.set(0);   mark.set(withDelay(m.dMark, withTiming(1, { duration: m.mark, easing: e.standard })));
    spark.set(0);  spark.set(withDelay(m.dSpark, withTiming(1, { duration: m.spark, easing: e.standard })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, reduced]);

  const borderProps = useAnimatedProps(() => ({ strokeDashoffset: HEX_PERIM * (1 - border.get()) }));
  const honeyProps = useAnimatedProps(() => {
    const h = 14 * honey.get();
    return { height: h, y: 19 - h };
  });
  const surfProps = useAnimatedProps(() => ({ opacity: interpolate(honey.get(), [0, 0.4, 1], [0, 0.8, 0.8]) }));
  const bloomProps = useAnimatedProps(() => ({
    opacity: interpolate(bloom.get(), [0, 0.4, 1], [0, 0.5, 0]),
    r: interpolate(bloom.get(), [0, 1], [11, 13.75]),
  }));
  const markProps = useAnimatedProps(() => ({
    opacity: mark.get(),
    scale: interpolate(mark.get(), [0, 1], [0.85, 1]),
    originX: 12,
    originY: 12,
  }));
  // Each sliver: same shared `spark`, fixed rotation; the inner rect travels out
  // along the rotated axis (y decreasing) while it fades 0→1→0.
  const sparkProps = useAnimatedProps(() => ({
    opacity: interpolate(spark.get(), [0, 0.28, 1], [0, 1, 0]),
    y: interpolate(spark.get(), [0, 1], [9.4, -1.6]),
  }));

  const honeyYellow = t.brand.honeyFill;
  const sealInk = t.brand.bee.body;
  const cream = t.brand.bee.wing;

  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const label: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: done ? t.colors.amberText : t.colors.inkSoft,
  };

  return (
    <Pressable
      onPress={onLog}
      accessibilityRole="button"
      accessibilityLabel={
        done ? 'Logged one honest thing today.' : 'Log one honest thing today. Skipping is fine.'
      }
    >
      <View style={row}>
        <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
          <Defs>
            <ClipPath id="sealClip"><Path d={HEX} /></ClipPath>
            <RadialGradient id="sealBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={honeyYellow} stopOpacity={0.55} />
              <Stop offset="1" stopColor={honeyYellow} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          <AnimatedCircle cx={12} cy={12} animatedProps={bloomProps} fill="url(#sealBloom)" />

          {/* faint resting outline (only meaningful when not sealed) */}
          {!done ? (
            <Path d={HEX} fill="none" stroke={t.colors.primary} strokeWidth={1.5} strokeLinejoin="round" opacity={0.4} />
          ) : null}

          <Path d={HEX} fill="rgba(130,117,240,0.16)" />

          <G clipPath="url(#sealClip)">
            <AnimatedRect x={5} width={14} animatedProps={honeyProps} fill={honeyYellow} />
            <AnimatedRect x={5} y={5.4} width={14} height={1} animatedProps={surfProps} fill={cream} />
          </G>

          <AnimatedPath
            d={HEX}
            pathLength={HEX_PERIM}
            strokeDasharray={HEX_PERIM}
            animatedProps={borderProps}
            fill="none"
            stroke={sealInk}
            strokeWidth={1.7}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          <AnimatedG animatedProps={markProps}>
            <Path
              d="M12 8.6 C12.3 10.7 13.3 11.7 15.4 12 C13.3 12.3 12.3 13.3 12 15.4 C11.7 13.3 10.7 12.3 8.6 12 C10.7 11.7 11.7 10.7 12 8.6 Z"
              fill={sealInk}
            />
          </AnimatedG>

          {SPARK_ANGLES.map((a) => (
            <G key={a} rotation={a} originX={12} originY={12}>
              <AnimatedRect x={11.65} width={0.7} height={3.2} rx={0.35} animatedProps={sparkProps} fill={honeyYellow} />
            </G>
          ))}
        </Svg>
        <Text style={label}>{done ? "Today's honey set ✦" : 'Log one honest thing'}</Text>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/today/__tests__/RitualSeal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Lint the new files**

Run: `npx eslint src/features/today/RitualSeal.tsx src/features/today/__tests__/RitualSeal.test.tsx`
Expected: 0 errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add src/features/today/RitualSeal.tsx src/features/today/__tests__/RitualSeal.test.tsx
git commit -m "feat(today): add RitualSeal wax-seal log affordance"
```

---

## Task 3: Extend `TodayHud` into the ledger card

Restructure so the card is a `View`; the honey-HUD top is its own `Pressable` (routes to the hub); an optional hairline footer renders the inline reclaim stat (left) + `RitualSeal` (right). Footer is omitted entirely when both are absent.

**Files:**
- Modify: `src/components/honeycomb/TodayHud.tsx`
- Test: `src/components/honeycomb/__tests__/TodayHud.test.tsx`

**Interfaces:**
- Consumes: `RitualSeal` (Task 2); `t.colors.hairline`, `t.colors.amberText`, `t.colors.inkSoft`, `t.space`.
- Produces: `TodayHud` gains optional props — `reclaimMin?: number` (footer reclaim; shown only when `> 0`), `ritualEnabled?: boolean`, `ritualDone?: boolean`, `onLogRitual?: () => void`. Existing props (`cells`, `stage`, `seed`, `onPress`) unchanged. Footer renders when `reclaimMin > 0 || ritualEnabled`.

- [ ] **Step 1: Write the failing tests (add to the existing file)**

Append these cases inside the `describe('TodayHud', …)` block in `src/components/honeycomb/__tests__/TodayHud.test.tsx`:

```tsx
  it('shows the reclaim stat and the ritual invitation in the footer', () => {
    render(
      <TodayHud
        cells={cells}
        stage={2}
        seed={1}
        onPress={() => {}}
        reclaimMin={10}
        ritualEnabled
        ritualDone={false}
        onLogRitual={() => {}}
      />,
    );
    expect(screen.getByText('+10m')).toBeOnTheScreen();
    expect(screen.getByText('reclaimed today')).toBeOnTheScreen();
    expect(screen.getByText('Log one honest thing')).toBeOnTheScreen();
  });

  it('hides reclaim at 0 and renders no footer when ritual is off and reclaim is 0', () => {
    render(<TodayHud cells={cells} stage={2} seed={1} onPress={() => {}} reclaimMin={0} ritualEnabled={false} />);
    expect(screen.queryByText('reclaimed today')).toBeNull();
    expect(screen.queryByText('Log one honest thing')).toBeNull();
  });

  it('tapping the honey top still routes to the hub', () => {
    const onPress = jest.fn();
    render(<TodayHud cells={cells} stage={2} seed={1} onPress={onPress} reclaimMin={10} ritualEnabled />);
    fireEvent.press(screen.getByText('Setting'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/components/honeycomb/__tests__/TodayHud.test.tsx`
Expected: FAIL — footer text not found / props not accepted.

- [ ] **Step 3: Restructure `TodayHud`**

In `src/components/honeycomb/TodayHud.tsx`: add the imports, extend the props interface, wrap the existing top row in its own `Pressable`, and append the footer. Replace the component body so the outer element is a `View` (card) containing a top `Pressable` + optional footer.

Add to imports:
```tsx
import { RitualSeal } from '@/src/features/today/RitualSeal';
```

Extend the props interface:
```tsx
interface TodayHudProps {
  cells: HoneycombCell[];
  stage: CompanionStage;
  seed: number;
  onPress: () => void;
  /** Minutes reclaimed today; the footer stat hides when <= 0. */
  reclaimMin?: number;
  /** Whether the opt-in daily ritual is on (renders the seal). */
  ritualEnabled?: boolean;
  /** Whether something has been logged today (seal plays/holds sealed). */
  ritualDone?: boolean;
  /** Open the log flow from the ritual tap. */
  onLogRitual?: () => void;
}
```

Update the signature + add the footer flag and styles (place near the existing style consts):
```tsx
export function TodayHud({
  cells,
  stage,
  seed,
  onPress,
  reclaimMin = 0,
  ritualEnabled = false,
  ritualDone = false,
  onLogRitual,
}: TodayHudProps) {
```

```tsx
  const showReclaim = reclaimMin > 0;
  const showFooter = showReclaim || ritualEnabled;

  const footer: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: showReclaim && ritualEnabled ? 'space-between' : 'flex-start',
    gap: t.space[3],
    borderTopWidth: t.borderWidth.thin,
    borderTopColor: t.colors.hairline,
    paddingTop: t.space[2.5],
    marginTop: t.space[3],
  };
  const reclaimRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] };
  const reclaimNum: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.bodySm,
    color: t.colors.amberText,
    fontVariant: ['tabular-nums'],
  };
  const reclaimLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
```

Replace the returned JSX so the card is a `View`, the top is a `Pressable`, and the footer is appended. Keep the existing coin/bee/tier/bar markup verbatim inside the top `Pressable`'s inner `Animated.View`:

```tsx
  return (
    <Animated.View style={[card, pressStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (!reduced) scale.set(withTiming(0.98, { duration: t.motion.press }));
        }}
        onPressOut={() => {
          if (!reduced) scale.set(withSpring(1, t.motion.spring));
        }}
        accessibilityRole="button"
        accessibilityLabel={`Whenbee, honey tier ${tier}. Tap to open your honeycomb.`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}
      >
        {/* coin + bee (unchanged) */}
        <View
          style={{
            width: t.companion.hudCoin,
            height: t.companion.hudCoin,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BeeCoin
            size={t.companion.hudCoin}
            color={t.colors.companionCoinHud}
            core={t.companion.hudCoinCore}
            solid={t.mode === 'light'}
            shadowColor={t.mode === 'light' ? t.colors.companionCoinShadow : undefined}
          />
          <BeeMascot size={t.companion.hudBee} variant={variant} seed={seed} animated />
        </View>
        <View style={{ flex: 1, gap: t.space[1.5] }}>
          <Text style={tierLabel}>{tier}</Text>
          <View style={track}>
            <View style={fill} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
      </Pressable>

      {showFooter ? (
        <View style={footer}>
          {showReclaim ? (
            <View style={reclaimRow} accessibilityLabel={`${reclaimMin} minutes reclaimed today`}>
              <Text style={reclaimNum}>+{reclaimMin}m</Text>
              <Text style={reclaimLabel}>reclaimed today</Text>
            </View>
          ) : null}
          {ritualEnabled ? (
            <RitualSeal done={ritualDone} onLog={onLogRitual ?? (() => {})} />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
```

Notes: the card no longer needs `flexDirection:'row'` on the outer `card` style — change the `card` const to a column container (remove `flexDirection`, `alignItems`, `gap` from it; keep `backgroundColor`, border, radius, padding). The press-scale (`scale`/`pressStyle`) now lives on the outer `Animated.View`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/honeycomb/__tests__/TodayHud.test.tsx`
Expected: PASS (original 2 + new 3 = 5).

- [ ] **Step 5: Lint**

Run: `npx eslint src/components/honeycomb/TodayHud.tsx src/components/honeycomb/__tests__/TodayHud.test.tsx`
Expected: 0 errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/honeycomb/TodayHud.tsx src/components/honeycomb/__tests__/TodayHud.test.tsx
git commit -m "feat(today): fold reclaim + ritual seal into the ledger card footer"
```

---

## Task 4: Wire the screen + remove the old line components

**Files:**
- Modify: `src/app/(tabs)/index.tsx`
- Delete: `src/features/today/ReclaimTodayLine.tsx`, `src/features/today/DailyRitualLine.tsx`, `src/features/today/__tests__/reclaimTodayLine.test.tsx` (+ any `DailyRitualLine` test file if present)

**Interfaces:**
- Consumes: `useToday().todayReclaimMin`, `useSettingsStore().dailyRitualEnabled`, `done` (from `useToday`), router.
- Produces: Today renders exactly one ledger card; no standalone reclaim/ritual lines.

- [ ] **Step 1: Update the header zone in `index.tsx`**

Replace the imports of the two line components and the header-zone block. Remove:
```tsx
import { ReclaimTodayLine } from '@/src/features/today/ReclaimTodayLine';
import { DailyRitualLine } from '@/src/features/today/DailyRitualLine';
```

Replace the header-zone `<View>` (the one containing `TodayHud`, `ReclaimTodayLine`, `DailyRitualLine`) with:

```tsx
          <View style={{ marginTop: -t.space[2], marginBottom: t.space[3] }}>
            <TodayHud
              cells={honeyCells}
              stage={companionStage}
              seed={companionSeed}
              onPress={() => router.push('/(tabs)/whenbee')}
              reclaimMin={todayReclaimMin}
              ritualEnabled={dailyRitualEnabled}
              ritualDone={done.length > 0}
              onLogRitual={() => router.push('/(modals)/retro')}
            />
          </View>
```

(`dailyRitualEnabled` is already read via `useSettingsStore`, and `done`/`todayReclaimMin`/`companionStage`/`companionSeed` are already destructured from `useToday` — no new reads needed.)

- [ ] **Step 2: Delete the obsolete components + tests**

```bash
git rm src/features/today/ReclaimTodayLine.tsx src/features/today/DailyRitualLine.tsx src/features/today/__tests__/reclaimTodayLine.test.tsx
```
If a `DailyRitualLine` test exists, remove it too:
```bash
git rm -f src/features/today/__tests__/DailyRitualLine.test.tsx 2>/dev/null || true
```

- [ ] **Step 3: Check for stragglers**

Run: `grep -rn "ReclaimTodayLine\|DailyRitualLine" src/`
Expected: no matches. If `src/features/today/__tests__/todayScreen.test.tsx` references them, update those assertions to look for the footer text (`reclaimed today` / `Log one honest thing`) on the rendered screen instead.

- [ ] **Step 4: Run the Today screen tests**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `npx eslint "src/app/(tabs)/index.tsx"`
Expected: 0 errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(today): render the single ledger card; drop the standalone reclaim/ritual lines"
```

---

## Task 5: Copy, accessibility, and full verification

**Files:**
- Modify (if a copy change is chosen): `src/features/today/RitualSeal.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: final, verified surface.

- [ ] **Step 1: Confirm copy strings**

Default invitation `Log one honest thing`, done `Today's honey set ✦` are in place (Task 2). If the founder picked an alternate during the copy pass ("Sealed today ✦" / "Caught one today ✦"), change the two string literals in `RitualSeal.tsx` accordingly. Verify no banned strings (`streak`, `missed`, `don't lose`, `in a row`) appear:

Run: `grep -rniE "streak|missed|don't lose|in a row" src/features/today/RitualSeal.tsx src/components/honeycomb/TodayHud.tsx`
Expected: no matches.

- [ ] **Step 2: Update the RitualSeal test if copy changed**

If the strings changed in Step 1, update the two `getByText` assertions in `RitualSeal.test.tsx` to match, then:
Run: `npx jest src/features/today/__tests__/RitualSeal.test.tsx`
Expected: PASS.

- [ ] **Step 3: Full verification suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS (lint 0 warnings, typecheck clean, jest green).

- [ ] **Step 4: Device check (manual, per CLAUDE.md sim flow)**

Run `npm run ios`, open Today. Verify against `bee-ritual-final.html`: one ledger card; honey top routes to the hub; footer shows reclaim + seal; tapping the seal opens the retro log; on returning after a log the seal plays the calm choreography (border → honey → bloom → ✦ → sparkle) and the reclaim banks; the four other presence states render (toggle the ritual in Settings, and a 0-reclaim day) with the footer disappearing when empty. Capture `xcrun simctl io booted screenshot` for the founder's visual approval.

- [ ] **Step 5: Commit any copy/polish changes**

```bash
git add -A
git commit -m "polish(today): finalize ritual copy and verify ledger card"
```

---

## Self-Review

- **Spec coverage:** §2.1 layout A → Task 3; §2.2 wax-seal glyph + resting/sealed → Task 2; §2.3 reclaim↔ritual link → Tasks 3–4 (reclaim re-reads on focus; seal plays on `ritualDone` transition; both in the footer); §2.4 motion (border→honey→bloom→✦→sparkle, exact timings, reduced-motion) → Task 2; §2.5 copy → Tasks 2 & 5; §3 components/retire old → Tasks 2–4; §4 presence states → Task 3 tests + Task 5 device check; §5 tokens → Task 1; §6 invariants/RN gotchas → Global Constraints + Task 2; §7 analytics (no new event) → no task needed (intentional). Covered.
- **Placeholder scan:** no TBD/"handle edge cases"/"similar to" — all code is inline.
- **Type consistency:** `RitualSeal({ done, onLog, size })` used identically in Tasks 2–3; `TodayHud` footer props (`reclaimMin`, `ritualEnabled`, `ritualDone`, `onLogRitual`) defined in Task 3 and passed verbatim in Task 4; token paths (`brand.honeyFill`, `motion.easing.premium`, `motion.seal.*`) defined in Task 1 and consumed in Task 2.

---

## Notes for the implementer

- The reclaim "bump on seal" coupling (spec §2.3) is satisfied structurally: `todayReclaimMin` re-reads on screen focus (after the Reward flow), and the seal animates when `ritualDone` flips true on the same return. A literal scale-bump on the reclaim number is optional polish — only add it if the device check shows the two beats feel disconnected; if added, drive it from a shared value in `TodayHud` keyed on `reclaimMin` increasing, and keep it reduced-motion-guarded.
- If `react-native-svg`'s `G` does not animate `scale`/`originX` via `animatedProps` on the installed version, fall back to wrapping the `✦` `Path` in an `Animated.View` is not possible inside `Svg`; instead animate only `opacity` on the `✦` (drop the 0.85→1 scale) — the fade alone reads fine and keeps the calm intent.
