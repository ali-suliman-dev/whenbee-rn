# Whenbee Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Whenbee companion tab as a calm, flat-tactical hub — a honey-ring-around-the-bee hero with a 2-line tier badge, labeled body zones, merged "Your areas" rows, and glow-free size/stroke/path motion.

**Architecture:** Pure read of existing engine/store values (no engine changes). New presentational components in `src/features/whenbee/` (`HoneyRing`, `RingBadge`, `AreaRow`) + a pure `ringCopy` helper. `WhenbeeHub` is rewritten to compose them; `TierTrailHub` and the hub `Honeycomb`/`RayBurst` usages are removed. Ring animation uses `react-native-reanimated` + `react-native-svg` (`useAnimatedProps`).

**Tech Stack:** React Native 0.81 (Fabric), Expo SDK 54, expo-router 6, Zustand, react-native-reanimated, react-native-svg, Jest + @testing-library/react-native, TypeScript (strict).

## Global Constraints

- **Worktree:** all work happens in an isolated git worktree off `main` (created at execution start via `superpowers:using-git-worktrees`). Final task cleans it up and opens a **live PR — do NOT merge** (founder merges).
- **No glow anywhere** on this surface: no RayBurst, no radial washes, no `boxShadow`/shadow halos. Depth via flat surfaces + 1px hairline only.
- **Theme tokens only** — every color/space/size/duration via `useTheme()` from `src/theme/tokens.ts`. If a value is missing, ADD a token; never inline a hex/number.
- **Invariants:** no guilt; amber-never-red; honey/sharpness monotonic (ring only grows, tier never regresses); on-device only; pricing from RevenueCat (CTA routes to paywall).
- **RN gotchas:** keep `Pressable` a bare touch wrapper, put visual style on an inner `View`; read/write reanimated shared values with `.get()/.set()` (never `.value`); no CSS `boxShadow`.
- **Layer rule:** `src/components/**` and `src/app/**` must not import `src/services/*` or `src/db/*` — route through stores/hooks. New feature components live in `src/features/whenbee/`.
- **Commits:** Conventional Commits; **no AI/co-author attribution** of any kind.
- **Verification:** `npm run lint && npm run typecheck && npm test` must pass before the final PR. UI is verified on the iOS sim (no CLI tap).

---

## File Structure

- Create `src/features/whenbee/ringCopy.ts` — pure: tier word, per-stage line, next-stage label, soft "logs to next" string.
- Create `src/features/whenbee/ringCopy.test.ts` — unit tests for the above.
- Create `src/features/whenbee/leadSharpness.ts` — pure: lead sharpness from cells.
- Create `src/features/whenbee/leadSharpness.test.ts` — unit tests.
- Create `src/features/whenbee/RingBadge.tsx` — 2-line badge.
- Create `src/features/whenbee/AreaRow.tsx` — merged category row.
- Create `src/features/whenbee/HoneyRing.tsx` — SVG ring + bee slot + animated beats.
- Modify `src/components/BeeMascot.tsx` — add `glow?: boolean` prop (default `true`).
- Modify `src/features/whenbee/useWhenbeeHub.ts` — expose `leadSharpness`.
- Rewrite `src/features/whenbee/WhenbeeHub.tsx` — new layout/zones.
- Modify `src/theme/tokens.ts` — add `ring`, `seal`, `mote` geometry + ring colors + motion durations/easing.
- Delete `src/features/whenbee/TierTrailHub.tsx` (and its test) once unused.
- Tests: `src/features/whenbee/__tests__/whenbeeHub.test.tsx` updated; new `RingBadge.test.tsx`, `AreaRow.test.tsx`, `HoneyRing.test.tsx`.

---

### Task 1: Theme tokens (ring / seal / mote geometry, ring colors, motion)

**Files:**
- Modify: `src/theme/tokens.ts`

**Interfaces:**
- Produces: `tokens.ring = { size, stroke, popStroke, capStroke, endowedPct }`, `tokens.seal = { size }`, `tokens.mote = { size, count, distance }`; `colors.{light,dark}.ringTrack`; `motion.{ringFill, capFill, strokePop, sealSeq, ripple}`; `motion.easing.honey`.

- [ ] **Step 1: Add geometry blocks near `burst`**

In `src/theme/tokens.ts`, after the `burst: {...}` block, add:

```ts
  // Honey ring (Whenbee hub hero). Geometry only — mode-independent like `burst`.
  // size = SVG square edge; stroke = ring weight; popStroke/capStroke = the
  // momentary thickening on a fill-landing / cap; endowedPct = the tiny starting
  // sliver shown at Raw so a fresh ring is never a cold 0.
  ring: { size: 200, stroke: 9, popStroke: 11, capStroke: 13, endowedPct: 6 },
  // Wax-seal hex stamped over the bee at the Honest cap (flat-top hexagon WIDTH).
  seal: { size: 38 },
  // Flat motes flicked outward on the cap (solid squares — no glow).
  mote: { size: 5, count: 8, distance: 96 },
```

- [ ] **Step 2: Add motion durations + honey easing**

Inside the `motion: {` block, add these keys (alongside the existing ones):

```ts
    // Whenbee-hub ring beats (calm, decelerating). ringFill = entrance/log fill;
    // capFill = the slower ceremonial cap fill; strokePop = the landing thicken;
    // sealSeq = the cap seal-stamp + ripples window; ripple = one outline ripple.
    ringFill: 1600, capFill: 1900, strokePop: 620, sealSeq: 1650, ripple: 720,
```

And inside `motion.easing: {`, add:

```ts
    // Strong ease-out for honey fills — fast start, soft settle.
    honey: Easing.bezier(0.22, 1, 0.36, 1),
```

- [ ] **Step 3: Add `ringTrack` to both color modes**

In `colors.light` add: `ringTrack: '#E4DFD3',` (sits just off cream). In `colors.dark` add: `ringTrack: 'rgba(255,255,255,0.08)',`.

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/theme/tokens.ts`
Expected: no errors (the `as const` keeps literal types; new keys are additive).

- [ ] **Step 5: Commit**

```bash
git add src/theme/tokens.ts
git commit -m "feat(theme): add honey-ring, seal, mote tokens for the Whenbee hub"
```

---

### Task 2: `BeeMascot` glow opt-out

**Files:**
- Modify: `src/components/BeeMascot.tsx`
- Test: `src/components/__tests__/beeMascot.glow.test.tsx` (create)

**Interfaces:**
- Produces: `BeeMascot` accepts `glow?: boolean` (default `true`). When `false`, the amber/drift glow halo is not rendered — used by the hub where the ring carries the focal accent.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/__tests__/beeMascot.glow.test.tsx
import { render } from '@testing-library/react-native';
import { BeeMascot } from '@/src/components/BeeMascot';

describe('BeeMascot glow prop', () => {
  it('renders without crashing when glow is disabled', () => {
    const { toJSON } = render(<BeeMascot size={120} variant="stage-4" seed={1} glow={false} />);
    const tree = JSON.stringify(toJSON());
    // The glow halo uses a RadialGradient id "beeGlow"; with glow off it must be absent.
    expect(tree).not.toContain('beeGlow');
  });
  it('renders the glow by default', () => {
    const { toJSON } = render(<BeeMascot size={120} variant="stage-4" seed={1} />);
    expect(JSON.stringify(toJSON())).toContain('beeGlow');
  });
});
```

> Note: if the existing glow gradient id differs from `beeGlow`, read `BeeMascot.tsx` and use the actual id string in both the test and the guard below.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/beeMascot.glow.test.tsx`
Expected: FAIL (prop not supported / glow always rendered).

- [ ] **Step 3: Add the prop + guard**

In `src/components/BeeMascot.tsx`, add `glow = true` to the component props (extend the existing prop type with `glow?: boolean`). Wrap the glow-halo JSX (the stage-driven amber/drift `RadialGradient` + its `Circle`/`Rect`) in `{glow && stageGlowRadius > 0 ? ( …existing glow… ) : null}` so disabling `glow` removes it entirely. Leave the stripe/seed recolor untouched.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/__tests__/beeMascot.glow.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/BeeMascot.tsx src/components/__tests__/beeMascot.glow.test.tsx
git commit -m "feat(bee): add glow opt-out prop to BeeMascot"
```

---

### Task 3: `ringCopy` — pure tier/badge copy

**Files:**
- Create: `src/features/whenbee/ringCopy.ts`
- Test: `src/features/whenbee/ringCopy.test.ts`

**Interfaces:**
- Consumes: `TIERS`, `TIER_THRESHOLDS`, `tierFor`, `logsToNextTier` from `@/src/engine`; `Tier` from `@/src/domain/types`.
- Produces: `ringCopy(sharpness: number): { tier: Tier; pct: number; line: string; next: string; sealed: boolean }` where `pct = Math.round(sharpness)`, `line` is the per-stage human line, `next` is the soft goal-gradient (e.g. `~3 logs to Ripening`) or `Honeycomb sealed ✦` at the top, `sealed = sharpness >= 93`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/whenbee/ringCopy.test.ts
import { ringCopy } from './ringCopy';

describe('ringCopy', () => {
  it('describes the Setting band with a soft next-stage pull', () => {
    const r = ringCopy(46);
    expect(r.tier).toBe('Setting');
    expect(r.pct).toBe(46);
    expect(r.line).toBe('Getting sharper');
    expect(r.next).toMatch(/^~\d+ logs? to Ripening$/);
    expect(r.sealed).toBe(false);
  });
  it('uses the Raw line at zero', () => {
    expect(ringCopy(0).line).toBe('Just getting started');
    expect(ringCopy(0).tier).toBe('Raw');
  });
  it('holds at the top — sealed, no next stage', () => {
    const r = ringCopy(95);
    expect(r.tier).toBe('Honest');
    expect(r.sealed).toBe(true);
    expect(r.line).toBe('Plans match reality');
    expect(r.next).toBe('Honeycomb sealed ✦');
  });
  it('rounds the percentage', () => {
    expect(ringCopy(63.7).pct).toBe(64);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/whenbee/ringCopy.test.ts`
Expected: FAIL with "Cannot find module './ringCopy'".

- [ ] **Step 3: Write the implementation**

```ts
// src/features/whenbee/ringCopy.ts
import { TIERS, TIER_THRESHOLDS, tierFor, logsToNextTier } from '@/src/engine';
import type { Tier } from '@/src/domain/types';

// Per-stage human line shown under the ring (plain English, no jargon stranding).
const STAGE_LINE: Record<Tier, string> = {
  Raw: 'Just getting started',
  Setting: 'Getting sharper',
  Ripening: 'Landing closer',
  Thickening: 'You know your timing',
  Honest: 'Plans match reality',
};

export interface RingCopy {
  tier: Tier;
  pct: number;
  line: string;
  next: string;
  sealed: boolean;
}

/** Pure copy for the ring badge from an overall sharpness 0–100. */
export function ringCopy(sharpness: number): RingCopy {
  const tier = tierFor(sharpness);
  const sealed = sharpness >= TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1]!; // >= 93
  const idx = TIERS.indexOf(tier);
  const nextTier = TIERS[idx + 1];
  const logs = logsToNextTier(sharpness);
  const next =
    sealed || !nextTier
      ? 'Honeycomb sealed ✦'
      : `~${logs} ${logs === 1 ? 'log' : 'logs'} to ${nextTier}`;
  return { tier, pct: Math.round(sharpness), line: STAGE_LINE[tier], next, sealed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/whenbee/ringCopy.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/whenbee/ringCopy.ts src/features/whenbee/ringCopy.test.ts
git commit -m "feat(whenbee): add pure ringCopy for the hub ring badge"
```

---

### Task 4: `leadSharpness` helper + expose on the hub VM

**Files:**
- Create: `src/features/whenbee/leadSharpness.ts`
- Test: `src/features/whenbee/leadSharpness.test.ts`
- Modify: `src/features/whenbee/useWhenbeeHub.ts`

**Interfaces:**
- Consumes: `HoneycombCell` from `@/src/components/honeycomb/Honeycomb`.
- Produces: `leadSharpnessOf(cells: { sharpness: number }[]): number` (max sharpness, 0 if empty). `WhenbeeHubVM` gains `leadSharpness: number`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/whenbee/leadSharpness.test.ts
import { leadSharpnessOf } from './leadSharpness';

describe('leadSharpnessOf', () => {
  it('returns the highest cell sharpness', () => {
    expect(leadSharpnessOf([{ sharpness: 12 }, { sharpness: 46 }, { sharpness: 30 }])).toBe(46);
  });
  it('returns 0 for an empty comb', () => {
    expect(leadSharpnessOf([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/whenbee/leadSharpness.test.ts`
Expected: FAIL with "Cannot find module './leadSharpness'".

- [ ] **Step 3: Write the helper**

```ts
// src/features/whenbee/leadSharpness.ts
/** Overall hub sharpness = the most-ripened category's sharpness (0 if none). */
export function leadSharpnessOf(cells: { sharpness: number }[]): number {
  return cells.reduce((max, c) => Math.max(max, c.sharpness), 0);
}
```

- [ ] **Step 4: Wire it into the VM**

In `src/features/whenbee/useWhenbeeHub.ts`:
1. Add to the import block: `import { leadSharpnessOf } from './leadSharpness';`
2. Add `leadSharpness: number;` to the `WhenbeeHubVM` interface (near `tier`).
3. Replace the `tier` memo's inline max with the helper and derive both:

```ts
  const leadSharpness = useMemo<number>(() => leadSharpnessOf(cells), [cells]);
  const tier = useMemo<Tier>(() => tierFor(leadSharpness), [leadSharpness]);
```

4. Add `leadSharpness,` to the returned object.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest src/features/whenbee/leadSharpness.test.ts && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/whenbee/leadSharpness.ts src/features/whenbee/leadSharpness.test.ts src/features/whenbee/useWhenbeeHub.ts
git commit -m "feat(whenbee): expose leadSharpness on the hub view-model"
```

---

### Task 5: `RingBadge` component

**Files:**
- Create: `src/features/whenbee/RingBadge.tsx`
- Test: `src/features/whenbee/__tests__/RingBadge.test.tsx`

**Interfaces:**
- Consumes: `ringCopy` (Task 3); `useTheme`.
- Produces: `<RingBadge sharpness={number} />` rendering two lines: `{tier} {pct}%` (line 1) and `{line} · {next} →` (line 2). At the sealed top, line 2 shows just `{next}` (no trailing arrow).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/whenbee/__tests__/RingBadge.test.tsx
import { render } from '@testing-library/react-native';
import { RingBadge } from '../RingBadge';

describe('RingBadge', () => {
  it('shows tier, percent and the soft next pull', () => {
    const { getByText, queryByText } = render(<RingBadge sharpness={46} />);
    expect(getByText(/Setting/)).toBeTruthy();
    expect(getByText(/46%/)).toBeTruthy();
    expect(getByText(/Getting sharper/)).toBeTruthy();
    expect(getByText(/Ripening/)).toBeTruthy();
    expect(queryByText(/sealed/)).toBeNull();
  });
  it('shows the sealed hold state at the top', () => {
    const { getByText } = render(<RingBadge sharpness={95} />);
    expect(getByText(/Honeycomb sealed ✦/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/whenbee/__tests__/RingBadge.test.tsx`
Expected: FAIL with "Cannot find module '../RingBadge'".

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/whenbee/RingBadge.tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { ringCopy } from './ringCopy';

// Compact 2-line tier badge under the honey ring. Line 1: tier word + overall %.
// Line 2: per-stage human line + soft "logs to next" (or the sealed hold state).
export function RingBadge({ sharpness }: { sharpness: number }) {
  const t = useTheme();
  const c = ringCopy(sharpness);

  const wrap: ViewStyle = {
    alignSelf: 'center',
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2],
    alignItems: 'center',
    gap: t.space[0.5],
  };
  const line1: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.bodySm,
    color: t.colors.accent,
    fontVariant: ['tabular-nums'],
  };
  const line2: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <View style={wrap} accessibilityRole="text" accessibilityLabel={`${c.tier}, ${c.pct} percent. ${c.line}. ${c.next}`}>
      <Text style={line1}>
        {c.tier} {c.pct}%
      </Text>
      <Text style={line2} numberOfLines={1}>
        {c.sealed ? c.next : `${c.line} · ${c.next} →`}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/whenbee/__tests__/RingBadge.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/whenbee/RingBadge.tsx src/features/whenbee/__tests__/RingBadge.test.tsx
git commit -m "feat(whenbee): add RingBadge (2-line tier/percent/next badge)"
```

---

### Task 6: `AreaRow` component (merged comb + category row)

**Files:**
- Create: `src/features/whenbee/AreaRow.tsx`
- Test: `src/features/whenbee/__tests__/AreaRow.test.tsx`

**Interfaces:**
- Consumes: `useTheme`; `Ionicons`.
- Produces: `<AreaRow name multiplier sharpness onPress />` where `multiplier?: number` (undefined → `—`), `sharpness: number` (0–100 → inline bar fill width), `onPress: () => void`. Renders name · honey bar · multiplier (`1.9×` or `—`) · chevron. Pressable wraps an inner styled `View` (RN gotcha).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/whenbee/__tests__/AreaRow.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { AreaRow } from '../AreaRow';

describe('AreaRow', () => {
  it('renders the name and multiplier and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText, getByLabelText } = render(
      <AreaRow name="Cleaning" multiplier={1.9} sharpness={60} onPress={onPress} />,
    );
    expect(getByText('Cleaning')).toBeTruthy();
    expect(getByText('1.9×')).toBeTruthy();
    fireEvent.press(getByLabelText('Cleaning insights'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('shows an em dash when no multiplier yet', () => {
    const { getByText } = render(<AreaRow name="Email" sharpness={0} onPress={() => {}} />);
    expect(getByText('—')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/whenbee/__tests__/AreaRow.test.tsx`
Expected: FAIL with "Cannot find module '../AreaRow'".

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/whenbee/AreaRow.tsx
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// One merged row per tracked category: name · inline honey bar (sharpness) ·
// learned multiplier · chevron → the category page. Replaces both the separate
// honeycomb grid and the old "in the background" rows (one surface, not two).
export function AreaRow({
  name,
  multiplier,
  sharpness,
  onPress,
}: {
  name: string;
  multiplier?: number;
  sharpness: number;
  onPress: () => void;
}) {
  const t = useTheme();
  const fill = Math.max(0, Math.min(100, sharpness));

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    minHeight: t.size.control.md,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const nameText: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, minWidth: 66 };
  const track: ViewStyle = {
    flex: 1,
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const barFill: ViewStyle = { width: `${fill}%`, height: '100%', borderRadius: t.radii.full, backgroundColor: t.colors.accent };
  const multText: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.md,
    color: t.colors.primary,
    fontVariant: ['tabular-nums'],
    minWidth: 34,
    textAlign: 'right',
  };

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name} insights`}>
      <View style={row}>
        <Text style={nameText}>{name}</Text>
        <View style={track}>
          <View style={barFill} />
        </View>
        <Text style={multText}>{multiplier !== undefined ? `${multiplier.toFixed(1)}×` : '—'}</Text>
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/whenbee/__tests__/AreaRow.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/whenbee/AreaRow.tsx src/features/whenbee/__tests__/AreaRow.test.tsx
git commit -m "feat(whenbee): add AreaRow merging honey-fill + multiplier per category"
```

---

### Task 7: `HoneyRing` — static ring + bee slot + sealed hex

**Files:**
- Create: `src/features/whenbee/HoneyRing.tsx`
- Test: `src/features/whenbee/__tests__/HoneyRing.test.tsx`

**Interfaces:**
- Consumes: `useTheme`; `react-native-svg`.
- Produces: `<HoneyRing sharpness={number} sealed={boolean}>{children}</HoneyRing>` — renders a track circle + an amber fill arc to `sharpness%` (clamped, with the token endowed sliver floor at Raw) + centered `children` (the bee). When `sealed`, a flat wax-seal hex overlays the bee. This task is **static** (no animation yet — animation lands in Task 8/9).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/whenbee/__tests__/HoneyRing.test.tsx
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { HoneyRing } from '../HoneyRing';

describe('HoneyRing', () => {
  it('renders its children (the bee slot)', () => {
    const { getByText } = render(
      <HoneyRing sharpness={46} sealed={false}>
        <Text>BEE</Text>
      </HoneyRing>,
    );
    expect(getByText('BEE')).toBeTruthy();
  });
  it('mounts at the sealed state without crashing', () => {
    const { toJSON } = render(
      <HoneyRing sharpness={95} sealed>
        <Text>BEE</Text>
      </HoneyRing>,
    );
    expect(toJSON()).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/whenbee/__tests__/HoneyRing.test.tsx`
Expected: FAIL with "Cannot find module '../HoneyRing'".

- [ ] **Step 3: Write the static implementation**

```tsx
// src/features/whenbee/HoneyRing.tsx
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// Honey ring around the bee. Track + amber fill arc to `sharpness%`; centered
// children (the bee). Sealed → a flat wax-seal hex overlays the bee. No glow.
export function HoneyRing({
  sharpness,
  sealed,
  children,
}: {
  sharpness: number;
  sealed: boolean;
  children: ReactNode;
}) {
  const t = useTheme();
  const S = t.ring.size;
  const sw = t.ring.stroke;
  const r = (S - sw) / 2;
  const cx = S / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(t.ring.endowedPct, Math.min(100, sharpness));
  const dashoffset = circumference * (1 - pct / 100);

  const wrap: ViewStyle = { width: S, height: S, alignItems: 'center', justifyContent: 'center' };
  const svgAbsolute: ViewStyle = { position: 'absolute' };
  const sealStyle: ViewStyle = {
    position: 'absolute',
    width: t.seal.size,
    height: t.seal.size * 1.1,
    backgroundColor: t.colors.accent,
    // flat-top hexagon
    // (RN has no clip-path; approximate with a rotated square is wrong — use a
    //  Svg hex instead. Kept as a View here only for layout; replaced below.)
  };

  return (
    <View style={wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={svgAbsolute} pointerEvents="none">
        <Svg width={S} height={S}>
          <Defs>
            <LinearGradient id="honeyGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={t.brand.bee.stripe} />
              <Stop offset="1" stopColor={t.colors.accent} />
            </LinearGradient>
          </Defs>
          {/* rotate -90° so the arc starts at 12 o'clock */}
          <G rotation={-90} origin={`${cx}, ${cx}`}>
            <Circle cx={cx} cy={cx} r={r} stroke={t.colors.ringTrack} strokeWidth={sw} fill="none" />
            <Circle
              cx={cx}
              cy={cx}
              r={r}
              stroke="url(#honeyGrad)"
              strokeWidth={sw}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashoffset}
            />
          </G>
          {sealed ? (
            // flat wax-seal hex over the centre (drawn in the same Svg)
            <SealHex cx={cx} size={t.seal.size} color={t.colors.accent} />
          ) : null}
        </Svg>
      </View>
      {children}
      {/* avoid an unused-style lint error from the layout-only placeholder */}
      <View style={[sealStyle, { display: 'none' }]} />
    </View>
  );
}

// Flat-top hexagon via an SVG polygon (no glow, flat-tactical).
function SealHex({ cx, size, color }: { cx: number; size: number; color: string }) {
  const w = size;
  const h = size * 1.1;
  const x = cx - w / 2;
  const y = cx - h / 2;
  const pts = [
    [x + w * 0.5, y],
    [x + w, y + h * 0.25],
    [x + w, y + h * 0.75],
    [x + w * 0.5, y + h],
    [x, y + h * 0.75],
    [x, y + h * 0.25],
  ]
    .map((p) => p.join(','))
    .join(' ');
  return <PolygonSeal points={pts} color={color} />;
}
```

> The `PolygonSeal` is a thin wrapper to keep the import list explicit. Add `Polygon` to the `react-native-svg` import and define at the bottom:

```tsx
import Svg, { Circle, G, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
// …
function PolygonSeal({ points, color }: { points: string; color: string }) {
  return <Polygon points={points} fill={color} opacity={0.95} />;
}
```

> Also delete the layout-only `sealStyle`/placeholder `View` if your lint config rejects the `display:none` guard — they exist only to avoid an unused-var warning; prefer removing both once `SealHex` is in.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/whenbee/__tests__/HoneyRing.test.tsx && npx eslint src/features/whenbee/HoneyRing.tsx`
Expected: PASS; no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/whenbee/HoneyRing.tsx src/features/whenbee/__tests__/HoneyRing.test.tsx
git commit -m "feat(whenbee): add static HoneyRing (track + fill arc + sealed hex)"
```

---

### Task 8: `HoneyRing` — animated fill + entrance landing beat

**Files:**
- Modify: `src/features/whenbee/HoneyRing.tsx`
- Modify: `src/features/whenbee/__tests__/HoneyRing.test.tsx`

**Interfaces:**
- Produces: on mount/focus the fill animates `endowedPct → sharpness` over `motion.ringFill` with `easing.honey`; a flat head-dot rides the arc to the landing point, then the ring stroke "pops" (`ring.stroke → ring.popStroke → ring.stroke`). Honors `useReducedMotion()` (instant final state, no head-dot/pop). Monotonic: fill never animates downward.

- [ ] **Step 1: Add the animated-fill test (reduced-motion path)**

Append to `HoneyRing.test.tsx`:

```tsx
import * as Reanimated from 'react-native-reanimated';

it('renders final state instantly under reduced motion', () => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
  const { toJSON } = render(
    <HoneyRing sharpness={70} sealed={false}>
      <></>
    </HoneyRing>,
  );
  expect(toJSON()).toBeTruthy();
  (Reanimated.useReducedMotion as jest.Mock).mockRestore?.();
});
```

- [ ] **Step 2: Run it to verify current behavior**

Run: `npx jest src/features/whenbee/__tests__/HoneyRing.test.tsx`
Expected: PASS for static cases; the new test passes too (static ring already renders) — it guards the reduced-motion branch you add next from regressing.

- [ ] **Step 3: Convert the fill circle to animated**

In `HoneyRing.tsx`:

```tsx
import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedProps, withTiming, useReducedMotion } from 'react-native-reanimated';
// …
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
```

Inside the component, drive the fill with a shared `progress` (0–100):

```tsx
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? pct : t.ring.endowedPct);
  const stroke = useSharedValue(sw);

  useEffect(() => {
    if (reduced) {
      progress.set(pct);
      return;
    }
    progress.set(withTiming(pct, { duration: t.motion.ringFill, easing: t.motion.easing.honey }));
  }, [pct, reduced, progress, t.motion.ringFill, t.motion.easing.honey]);

  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.get() / 100),
    strokeWidth: stroke.get(),
  }));
```

Replace the static fill `<Circle …/>` with `<AnimatedCircle … animatedProps={fillProps} />` (drop the static `strokeDashoffset`/`strokeWidth` props now driven by `fillProps`).

- [ ] **Step 4: Add the head-dot + stroke pop (skip under reduced motion)**

Add a head-dot `Animated.View` (flat — `backgroundColor: t.colors.accentEdge`, no shadow) positioned by a worklet from `progress`, and a stroke pop on landing:

```tsx
  const headStyle = useAnimatedStyle(() => {
    const ang = ((-90 + (progress.get() / 100) * 360) * Math.PI) / 180;
    return {
      opacity: reduced ? 0 : 1,
      transform: [
        { translateX: r * Math.cos(ang) },
        { translateY: r * Math.sin(ang) },
      ],
    };
  });

  useEffect(() => {
    if (reduced) return;
    // pop the stroke once, timed to land with the fill
    const id = setTimeout(() => {
      stroke.set(withSequence(
        withTiming(t.ring.popStroke, { duration: t.motion.strokePop / 2, easing: t.motion.easing.honey }),
        withTiming(sw, { duration: t.motion.strokePop / 2, easing: t.motion.easing.honey }),
      ));
    }, t.motion.ringFill - t.motion.strokePop / 2);
    return () => clearTimeout(id);
  }, [reduced, stroke, sw, t.ring.popStroke, t.motion.strokePop, t.motion.ringFill, t.motion.easing.honey]);
```

Add `useAnimatedStyle, withSequence` to the reanimated import. Render the head-dot centered (absolute) inside `wrap`, after the Svg:

```tsx
      {!reduced ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: 13, height: 13, borderRadius: 999, backgroundColor: t.colors.accentEdge }, headStyle]}
        />
      ) : null}
```

> Note: the head-dot sits at the wrap centre and is translated by `(r·cosθ, r·sinθ)`; because the wrap is centered, that places it on the arc. Keep its size from a token if you prefer (add `ring.headDot: 13`).

- [ ] **Step 5: Run tests + lint + typecheck**

Run: `npx jest src/features/whenbee/__tests__/HoneyRing.test.tsx && npx eslint src/features/whenbee/HoneyRing.tsx && npm run typecheck`
Expected: PASS; no errors.

- [ ] **Step 6: Manual sim check**

Build the app (`npm run ios`), open the Whenbee tab. Confirm the ring fills smoothly from the sliver to the current %, the head-dot rides to the end, and the stroke gives a subtle thicken on landing. Toggle iOS Reduce Motion (Settings → Accessibility) and confirm the ring snaps to final with no head-dot.

- [ ] **Step 7: Commit**

```bash
git add src/features/whenbee/HoneyRing.tsx src/features/whenbee/__tests__/HoneyRing.test.tsx
git commit -m "feat(whenbee): animate HoneyRing fill + head-dot landing beat"
```

---

### Task 9: `HoneyRing` — seal-stamp ceremony (ripples + motes)

**Files:**
- Modify: `src/features/whenbee/HoneyRing.tsx`

**Interfaces:**
- Produces: when `sealed` becomes true while mounted (or on first mount already sealed), play a one-time calm ceremony — the seal hex stamps in (scale 2.2→1 settle), 3 thin outline ripples expand from centre (staggered), and `mote.count` flat squares flick outward to `mote.distance`. Honors reduced motion (seal fades in; no ripples/motes). Uses `motion.sealSeq` / `motion.ripple`.

- [ ] **Step 1: Add a `sealed` entrance animation to the hex**

Wrap the `SealHex` render in an `Animated`-driven scale/opacity. Simplest: render the hex inside an `Animated.View` overlay (absolute, centered) instead of inside the Svg, so it can transform independently:

```tsx
  const sealScale = useSharedValue(sealed && reduced ? 1 : sealed ? 2.2 : 1);
  const sealOpacity = useSharedValue(sealed && reduced ? 0.95 : 0);

  useEffect(() => {
    if (!sealed) return;
    if (reduced) { sealOpacity.set(0.95); sealScale.set(1); return; }
    sealOpacity.set(withTiming(0.95, { duration: t.motion.sealSeq * 0.4, easing: t.motion.easing.honey }));
    sealScale.set(withTiming(1, { duration: t.motion.sealSeq * 0.5, easing: t.motion.easing.honey }));
  }, [sealed, reduced, sealOpacity, sealScale, t.motion.sealSeq, t.motion.easing.honey]);

  const sealStyle = useAnimatedStyle(() => ({ opacity: sealOpacity.get(), transform: [{ scale: sealScale.get() }] }));
```

Render (replace the in-Svg `SealHex` from Task 7 with a small standalone Svg in an overlay):

```tsx
      {sealed ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, sealStyle]}>
          <Svg width={t.seal.size} height={t.seal.size * 1.1}>
            <Polygon points={hexPoints(t.seal.size)} fill={t.colors.accent} />
          </Svg>
        </Animated.View>
      ) : null}
```

Add a pure `hexPoints(size: number): string` helper (flat-top hex around its own 0..size box) at module scope and reuse it; delete the earlier `SealHex`/`PolygonSeal`/`svg` seal path from Task 7 to avoid duplication.

- [ ] **Step 2: Add ripples + motes (skip under reduced motion)**

Render `sealed && !reduced` decorations: three absolute outline rings and `t.mote.count` small squares, each an `Animated.View` with an entering animation. Use a tiny local component so the loop is clean:

```tsx
import { useMemo } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
// …
function Ripple({ delay, t }: { delay: number; t: ReturnType<typeof useTheme> }) {
  const s = useSharedValue(0.5);
  const o = useSharedValue(0.5);
  useEffect(() => {
    s.set(withDelay(delay, withTiming(1.5, { duration: t.motion.sealSeq, easing: t.motion.easing.honey })));
    o.set(withDelay(delay, withTiming(0, { duration: t.motion.sealSeq, easing: t.motion.easing.honey })));
  }, [delay, s, o, t.motion.sealSeq, t.motion.easing.honey]);
  const st = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scale: s.get() }] }));
  const size = t.ring.size * 0.72;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: t.borderWidth.thick, borderColor: t.colors.accent }, st]}
    />
  );
}
```

Add `withDelay` to the reanimated import. In `HoneyRing`, when `sealed && !reduced`, render `<Ripple delay={0} t={t}/>`, `<Ripple delay={t.motion.sealSeq*0.15} t={t}/>`, `<Ripple delay={t.motion.sealSeq*0.3} t={t}/>`. For motes, build an array `useMemo(() => Array.from({length: t.mote.count}), …)` and map each index `i` to an `Animated.View` (size `t.mote.size`, `backgroundColor: t.colors.accent`) translated outward to `(cos·distance, sin·distance)` with `angle = -90 + i*(360/count)` via a per-mote shared value + `withDelay(300 + i*40, withTiming(...))`.

- [ ] **Step 3: Run tests + lint + typecheck**

Run: `npx jest src/features/whenbee/__tests__/HoneyRing.test.tsx && npx eslint src/features/whenbee/HoneyRing.tsx && npm run typecheck`
Expected: PASS; the existing sealed-mount test still passes; no errors.

- [ ] **Step 4: Manual sim check**

On the sim, drive a category to seal (or temporarily pass `sealed` for a screenshot). Confirm: hex stamps in calmly, three thin ripples expand, a few flat squares flick out, no glow. Toggle Reduce Motion → hex just fades in, no ripples/motes.

- [ ] **Step 5: Commit**

```bash
git add src/features/whenbee/HoneyRing.tsx
git commit -m "feat(whenbee): add HoneyRing seal-stamp ceremony (ripples + motes), reduce-motion safe"
```

---

### Task 10: Rewrite `WhenbeeHub` (hero + labeled zones + empty state)

**Files:**
- Modify: `src/features/whenbee/WhenbeeHub.tsx`
- Modify: `src/features/whenbee/__tests__/whenbeeHub.test.tsx`

**Interfaces:**
- Consumes: `useWhenbeeHub` (now with `leadSharpness`), `HoneyRing`, `RingBadge`, `AreaRow`, `WhenbeeAvatar`/`BeeMascot` (with `glow={false}`), `ReclaimHeroCard`, `DiscoveriesPreviewCard`, `BlindSpotCard`, `LifeDriftCard`, `useCategoriesStore`, `useCalibrationStore`, `useEntitlement`.
- Produces: the new vertical layout. Removes `TierTrailHub`, the hub `Honeycomb` grid, and `RayBurst`.

- [ ] **Step 1: Update the hub test for the new structure**

Replace the body of `src/features/whenbee/__tests__/whenbeeHub.test.tsx` assertions that referenced the trail/honeycomb with the new shape. Add:

```tsx
it('renders the ring badge tier, the labeled zones and area rows', () => {
  // (mock useWhenbeeHub to a populated VM: leadSharpness 46, one+ categories, reclaim > 0)
  const { getByText } = renderHub(); // existing helper in this file
  expect(getByText(/Setting/)).toBeTruthy();      // ring badge
  expect(getByText('Reclaimed')).toBeTruthy();    // zone label
  expect(getByText('Your areas')).toBeTruthy();   // zone label
});
it('shows the empty CTA when there are no logs', () => {
  const { getByText } = renderHub({ leadSharpness: 0, reclaimLifetimeMin: 0, honestLogCount: 0 });
  expect(getByText('Log your first task')).toBeTruthy();
});
```

> Match the file's existing mocking style for `useWhenbeeHub` / stores. If the file mocks the hook, extend the mock VM with `leadSharpness`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/features/whenbee/__tests__/whenbeeHub.test.tsx`
Expected: FAIL (new labels/CTA not present yet; trail/honeycomb assertions removed).

- [ ] **Step 3: Rewrite the component**

Replace `WhenbeeHub.tsx` with the new composition (keep the existing imports for stores/router/entitlement; drop `Honeycomb`, `TierTrailHub`, `RayBurst`):

```tsx
import { useCallback } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { CATEGORY_NAMES } from '@/src/engine';
import { useWhenbeeHub } from './useWhenbeeHub';
import { WhenbeeAvatar } from './WhenbeeAvatar';
import { HoneyRing } from './HoneyRing';
import { RingBadge } from './RingBadge';
import { AreaRow } from './AreaRow';
import { ReclaimHeroCard } from './ReclaimHeroCard';
import { DiscoveriesPreviewCard } from './DiscoveriesPreviewCard';
import { BlindSpotCard } from './BlindSpotCard';
import { LifeDriftCard } from './LifeDriftCard';

function categoryLabel(id: string): string {
  const seed = CATEGORY_NAMES[id];
  if (seed) return seed;
  return id.split(/[_\-\s]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function WhenbeeHub() {
  const t = useTheme();
  const vm = useWhenbeeHub();
  const categories = useCategoriesStore((s) => s.categories);
  const stats = useCalibrationStore((s) => s.statsByCategory);
  const isPro = useEntitlement((s) => s.isPro);

  const { refresh } = vm;
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const isEmpty = vm.honestLogCount === 0;

  function openCategory(id: string) {
    router.push({ pathname: '/category/[category]', params: { category: id } });
  }
  function openDayHonest() {
    router.push(isPro ? '/(modals)/honest-day' : { pathname: '/(modals)/paywall', params: { trigger: 'make_day_honest' } });
  }
  function logFirst() {
    router.push('/(modals)/add-task');
  }

  const zoneLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const zoneExplain: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint, marginTop: t.space[0.5] };
  const heroZone: ViewStyle = { alignItems: 'center', gap: t.space[3] };
  const ctaSub: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint, textAlign: 'center', marginTop: t.space[2] };

  return (
    <View style={{ gap: t.space[5] }}>
      <ScreenHeader
        title="Whenbee"
        subtitle={isEmpty ? 'Log a task — your honey starts to set.' : "What you've learned about your time."}
      />

      {/* HERO — honey ring + bee + badge */}
      <View style={heroZone}>
        <HoneyRing sharpness={vm.leadSharpness} sealed={vm.tier === 'Honest'}>
          <WhenbeeAvatar
            stage={vm.companion.stage}
            capability={vm.companion.capability}
            seed={vm.companion.seed}
            driftHealth={vm.companion.driftHealth}
            name={vm.companion.name ?? undefined}
            glow={false}
          />
        </HoneyRing>
        <RingBadge sharpness={vm.leadSharpness} />
      </View>

      {/* RECLAIMED */}
      <View>
        <Text style={zoneLabel}>RECLAIMED</Text>
        <Text style={zoneExplain}>time your honest numbers spared you</Text>
        <ReclaimHeroCard lifetimeMin={vm.reclaimLifetimeMin} honestLogCount={vm.honestLogCount} biggestArea={vm.biggestArea} />
      </View>

      {/* DISCOVERIES */}
      {vm.discoveryCount > 0 ? (
        <View>
          <Text style={zoneLabel}>DISCOVERIES</Text>
          <Text style={zoneExplain}>surprising truths about how long things take</Text>
          <DiscoveriesPreviewCard discoveries={vm.discoveries} discoveryCount={vm.discoveryCount} />
        </View>
      ) : null}

      {/* conditional gentle cards */}
      {vm.showDriftRecheck ? (
        <LifeDriftCard companionName={vm.companion.name} blindSpot={vm.blindSpot} onDismiss={vm.dismissDriftRecheck} />
      ) : null}
      {vm.blindSpot ? <BlindSpotCard blindSpot={vm.blindSpot} /> : null}

      {/* YOUR AREAS */}
      {categories.length > 0 ? (
        <View>
          <Text style={zoneLabel}>YOUR AREAS</Text>
          <Text style={zoneExplain}>fill = how honest your guesses are · tap to tune</Text>
          <View style={{ gap: t.space[2], marginTop: t.space[2] }}>
            {categories.map((cat) => (
              <AreaRow
                key={cat.id}
                name={categoryLabel(cat.id)}
                multiplier={stats[cat.id]?.mEffective}
                sharpness={stats[cat.id]?.sharpness ?? 0}
                onPress={() => openCategory(cat.id)}
              />
            ))}
          </View>
        </View>
      ) : (
        <AppText variant="caption">Track a few tasks and your areas will appear here.</AppText>
      )}

      {/* CTA */}
      {isEmpty ? (
        <View>
          <AppButton label="Log your first task" variant="amber" fullWidth onPress={logFirst} />
          <Text style={ctaSub}>Honest-day planning unlocks once your honey sets.</Text>
        </View>
      ) : (
        <AppButton label="Make my whole day honest" variant="amber" fullWidth onPress={openDayHonest} />
      )}
    </View>
  );
}
```

> Verify the add-task route path (`/(modals)/add-task`) against `src/app/` — use the actual route the FAB/Today uses. If different, use that exact path.

- [ ] **Step 4: Remove the sunburst wrapper in the route**

In `src/app/(tabs)/whenbee.tsx`, the header comment + `zIndex` dance existed to keep the title above the rotating `RayBurst`. With no burst, simplify: keep `ScreenHeader` rendered inside `WhenbeeHub` (as above) OR keep it in the route — pick one, not both. Recommended: render `ScreenHeader` in `WhenbeeHub` (done above) and delete the `<ScreenHeader …/>` + `zIndex` `View` from the route so the title isn't duplicated. The route keeps only `<Screen><ScrollView …><WhenbeeHub/></ScrollView></Screen>`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/features/whenbee/__tests__/whenbeeHub.test.tsx`
Expected: PASS (ring badge, zone labels, empty CTA).

- [ ] **Step 6: Commit**

```bash
git add src/features/whenbee/WhenbeeHub.tsx src/app/\(tabs\)/whenbee.tsx src/features/whenbee/__tests__/whenbeeHub.test.tsx
git commit -m "feat(whenbee): rebuild hub as ring hero + labeled zones + merged area rows"
```

---

### Task 11: Remove dead code + full verification + sim check

**Files:**
- Delete: `src/features/whenbee/TierTrailHub.tsx` and its test (if any)
- Possibly delete/keep: `src/components/bee/RayBurst.tsx`
- Verify: whole repo

- [ ] **Step 1: Find remaining usages**

Run: `grep -rn "TierTrailHub\|RayBurst\|<Honeycomb" src/ --include=*.tsx --include=*.ts`
Expected: `TierTrailHub` only in its own file/test → safe to delete. For `RayBurst` / `Honeycomb`: if used by other surfaces (e.g. reward, Today strip), **keep** them; only remove the imports from `WhenbeeHub` (already done in Task 10). Delete a file only if it has zero remaining references.

- [ ] **Step 2: Delete `TierTrailHub` (and its test) if unreferenced**

```bash
git rm src/features/whenbee/TierTrailHub.tsx
# also remove its test file if present, e.g.:
# git rm src/features/whenbee/__tests__/companionStage.test.tsx  # ONLY if it solely tested the trail
```

> Do not delete `companionStage.test.tsx` blindly — open it; remove only assertions/files that exclusively covered the removed trail. Keep any companion-stage coverage that still applies.

- [ ] **Step 3: Full gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 0 lint warnings, no type errors, all tests pass. Fix anything that fails before continuing.

- [ ] **Step 4: Manual sim verification (empty + populated)**

Build (`npm run ios`). Reset onboarding to see the **empty** state (per CLAUDE.md: delete `Documents/SQLite/ExpoSQLiteStorage` + `whenbee.db` in the app data container, relaunch). Confirm: endowed ring sliver, "Raw / Your first logs set the honey", dashed Reclaimed/Discoveries copy, area rows with `—`, "Log your first task" CTA, **no glow anywhere**. Then log a few tasks and confirm the **populated** hub: ring fills with the head-dot beat, badge reads the tier + soft next, zones labeled, area rows show bar + multiplier + chevron and tap into the category page. Capture screenshots (`xcrun simctl io booted screenshot`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(whenbee): remove dead tier-trail; verify lint/types/tests + sim"
```

---

### Task 12: Finalize — clean worktree, push, open live PR (no merge)

**Files:** none (git/PR operations)

- [ ] **Step 1: Final gate (last guard)**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green.

- [ ] **Step 2: Push the worktree branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 3: Open a live PR — do NOT merge**

```bash
gh pr create --base main --title "Whenbee hub redesign — ring hero, labeled zones, flat-tactical motion" --body "$(cat <<'EOF'
Rebuilds the Whenbee tab per docs/superpowers/specs/2026-06-17-whenbee-hub-redesign-design.md.

- Honey ring around the bee carries the tier (6-node trail removed); 2-line RingBadge (tier · % · soft logs-to-next).
- Merged comb + "in the background" into one tappable AreaRow (honey bar + multiplier + chevron).
- Labeled zones (Reclaimed / Discoveries / Your areas) with plain-English explainers.
- Empty state: endowed ring, no cold zeros, "Log your first task" CTA.
- Flat-tactical motion (no glow): ring fill + head-dot landing beat, seal-stamp ceremony; reduce-motion safe.
- BeeMascot gains a glow opt-out; engine untouched.

Verified: lint + typecheck + tests pass; empty + populated states checked on the iOS sim.
Leaving unmerged for founder review.
EOF
)"
```

Expected: PR URL printed. **Do not run `gh pr merge`.**

- [ ] **Step 4: Clean up the worktree**

From the main checkout (outside the worktree dir), after the branch is pushed:

```bash
git worktree remove <worktree-path>
git worktree prune
```

> The branch lives on `origin` via the PR, so removing the local worktree is safe. If `using-git-worktrees` created the worktree, follow its teardown (it cleans automatically when unchanged; here changes are pushed, so remove explicitly).

- [ ] **Step 5: Report**

Report the PR URL to the founder and confirm it is **open, not merged**, and the worktree is removed.

---

## Self-Review

**Spec coverage:**
- De-dup (bee carries tier; comb+rows merged) → Tasks 7–10 (HoneyRing + AreaRow + hub rewrite; trail removed Task 11). ✓
- Ring badge + per-stage copy + sealed hold → Tasks 3, 5. ✓
- Empty state (endowed, no cold zeros, log-first CTA) → Tasks 1 (endowedPct), 10. ✓
- No-glow flat-tactical motion (fill/head-dot/stroke-pop/seal/ripples/motes; reduce-motion) → Tasks 8, 9; BeeMascot glow off Task 2. ✓
- Theming via tokens → Task 1; every component reads `useTheme`. ✓
- A11y (color+text, chevron, reduce-motion, tap targets) → RingBadge label, AreaRow label/role + `size.control.md`, reduce-motion branches. ✓
- Invariants (monotonic fill, amber-only, on-device, RC pricing) → fill never animates down (Task 8), amber accents only, CTA→paywall. ✓
- Execution constraints (worktree, TDD, gate, live PR no-merge, cleanup) → Global Constraints + Task 12. ✓
- Deferred (discoveries gallery, widget) → untouched; only preview card used. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Two explicit *verification* notes (confirm the glow gradient id; confirm the add-task route path) are guardrails for codebase facts the implementer must read, with the fallback action stated — not deferred work. ✓

**Type consistency:** `ringCopy(): RingCopy` used by `RingBadge`; `leadSharpnessOf` → `vm.leadSharpness` consumed by `HoneyRing`/`RingBadge`; `HoneyRing` props `{sharpness, sealed, children}` match the hub call; `AreaRow` props `{name, multiplier?, sharpness, onPress}` match the hub `.map`. ✓
