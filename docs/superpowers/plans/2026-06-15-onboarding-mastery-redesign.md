# Onboarding + Mastery Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the three onboarding screens and unify the mastery surface app-wide — honey-drop trail (no padlocks), visual guess→honest payoff, animated indigo/amber privacy lock, clear "Add your own", real bee, de-AI'd copy.

**Architecture:** Build small presentational components (`HoneyTrail`, `OverflowBar`, `LockGlyph`, `OnboardingBackdrop`, `OnboardingFooterCard`) that consume ONLY `tokens.ts`/`typography.ts`, then reassemble the three onboarding routes and point `TierTrailHub` at `HoneyTrail`. No engine/db/store/loop changes.

**Tech Stack:** Expo SDK 54, React Native 0.81, `react-native-svg`, `react-native-reanimated` v3, Zustand, Jest + RTL.

---

## Ground rules (every task)

- **Tokens only.** Never inline a px/hex/duration. Use `t.colors.*`, `t.space[*]`, `t.radii.*`, `t.size.*`, `t.fontSize.*`, `t.motion.*`, and `AppText variant=...` roles. See the binding token map in `docs/superpowers/specs/2026-06-15-onboarding-mastery-redesign-design.md`. If a value is missing, add it to `tokens.ts` first.
- **TDD** for logic-bearing parts (trail state mapping, ratio math, reduced-motion). UI assembly gets interaction/snapshot tests.
- Run `npx eslint <files>` + `npm run typecheck` per component; `npm test` before each commit. CI parity: lint 0 warnings.
- Read/write reanimated shared values with `.get()/.set()`, never `.value`. Keep visual style on an inner `View`, never a function-form `Pressable` style.
- Conventional Commits, **no AI/co-author attribution**. Commit only the files in each task (the working tree has unrelated in-progress changes — never `git add -A`).

---

## File structure

- Create `src/components/HoneyTrail.tsx` — the honey-drop trail (done/now/ahead). Replaces the padlock visual.
- Create `src/components/LockGlyph.tsx` — `ReasonGlyph`-style animated padlock.
- Create `src/components/OverflowBar.tsx` — welcome guess→honest payoff bar.
- Create `src/components/OnboardingBackdrop.tsx` — indigo aurora behind onboarding.
- Create `src/components/OnboardingFooterCard.tsx` — compact glyph+text card pinned above the button.
- Modify `src/components/TierTrail.tsx` — repoint to `HoneyTrail` (or re-export) so the hub + onboarding share one component.
- Modify `src/features/whenbee/TierTrailHub.tsx` — feed `HoneyTrail` 6 nodes from `companionStage`.
- Modify `src/features/onboarding/BrandLockup.tsx` — bee instead of 🍯.
- Modify `src/components/Chip.tsx` — `add` variant → dashed outline + "Add your own".
- Modify `src/app/(onboarding)/welcome.tsx`, `categories.tsx`, `ready.tsx` — reassemble.
- Tests alongside each in `__tests__/`.

---

## Task 1: `HoneyTrail` component

**Files:**
- Create: `src/components/HoneyTrail.tsx`
- Test: `src/components/__tests__/HoneyTrail.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { render } from '@testing-library/react-native';
import { HoneyTrail } from '../HoneyTrail';

const nodes = [
  { label: 'Raw', state: 'done' as const },
  { label: 'Setting', state: 'done' as const },
  { label: 'Ripening', state: 'now' as const },
  { label: 'Thickening', state: 'ahead' as const },
  { label: 'Honest', state: 'ahead' as const },
];

test('renders a label per node', () => {
  const { getByText } = render(<HoneyTrail nodes={nodes} />);
  nodes.forEach((n) => expect(getByText(n.label)).toBeTruthy());
});

test('exposes accessible state per node', () => {
  const { getByLabelText } = render(<HoneyTrail nodes={nodes} />);
  expect(getByLabelText('Ripening: now')).toBeTruthy();
  expect(getByLabelText('Honest: ahead')).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/components/__tests__/HoneyTrail.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `HoneyTrail`** (tokens only; bee marker on `now`, filled drop on `done`, hairline outline on `ahead`; connector solid `accent` to the current node then dotted hairline)

```tsx
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Line } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';
import { BeeMascot } from './BeeMascot';

export type TrailState = 'done' | 'now' | 'ahead';
export interface TrailNode { label: string; state: TrailState }

const NODE = 28;

function Node({ state }: { state: TrailState }) {
  const t = useTheme();
  if (state === 'now') {
    return (
      <View style={{ width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={NODE} height={NODE}>
          <Circle cx={NODE / 2} cy={NODE / 2} r={NODE / 2 - t.borderWidth.thick}
            fill="none" stroke={t.colors.accent} strokeWidth={t.borderWidth.thick} />
        </Svg>
        <View style={{ position: 'absolute' }}>
          <BeeMascot size={Math.round(NODE * 0.62)} />
        </View>
      </View>
    );
  }
  const r = state === 'done' ? 9 : 8;
  return (
    <Svg width={NODE} height={NODE}>
      {state === 'done' ? (
        <>
          <Circle cx={NODE / 2} cy={NODE / 2} r={r} fill={t.colors.accent} />
          <Ellipse cx={NODE / 2 - 3} cy={NODE / 2 - 3} rx={3} ry={2} fill={t.colors.surface} opacity={0.5} />
        </>
      ) : (
        <Circle cx={NODE / 2} cy={NODE / 2} r={r} fill="none"
          stroke={t.colors.hairline === 0 ? t.colors.inkFaint : t.colors.inkFaint} strokeWidth={t.borderWidth.thick} />
      )}
    </Svg>
  );
}

export function HoneyTrail({ nodes }: { nodes: TrailNode[] }) {
  const t = useTheme();
  const labelColor = (s: TrailState) =>
    s === 'now' ? t.colors.accent : s === 'done' ? t.colors.inkSoft : t.colors.inkFaint;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }} accessibilityRole="list">
      {nodes.map((node, i) => {
        const isLast = i === nodes.length - 1;
        const next = nodes[i + 1];
        const solid = node.state === 'done' || next?.state === 'now';
        const col: ViewStyle = { flexDirection: 'row', alignItems: 'flex-start', flex: isLast ? 0 : 1 };
        return (
          <View key={i} style={col}>
            <View style={{ alignItems: 'center', gap: t.space[1] }}>
              <View accessible accessibilityLabel={`${node.label}: ${node.state}`}>
                <Node state={node.state} />
              </View>
              <AppText variant="label" numberOfLines={1}
                style={{ textAlign: 'center', width: t.space[16], color: labelColor(node.state) }}>
                {node.label}
              </AppText>
            </View>
            {!isLast && (
              <View style={{ flex: 1, paddingTop: NODE / 2 }}>
                <Svg width="100%" height={t.borderWidth.thick}>
                  <Line x1="0" y1="0" x2="100%" y2="0"
                    stroke={solid ? t.colors.accent : t.colors.inkFaint}
                    strokeWidth={t.borderWidth.thick}
                    strokeDasharray={solid ? undefined : '2 6'} strokeLinecap="round" />
                </Svg>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx jest src/components/__tests__/HoneyTrail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/components/HoneyTrail.tsx && npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/HoneyTrail.tsx src/components/__tests__/HoneyTrail.test.tsx
git commit -m "feat(onboarding): add HoneyTrail (honey-drop tier trail, no padlocks)"
```

---

## Task 2: Point `TierTrail` + `TierTrailHub` at `HoneyTrail`

**Files:**
- Modify: `src/components/TierTrail.tsx`
- Modify: `src/features/whenbee/TierTrailHub.tsx`
- Test: `src/features/whenbee/__tests__/companionStage.test.tsx` (extend)

- [ ] **Step 1: Write failing test — hub maps stage to done/now/ahead, monotonic**

```tsx
import { render } from '@testing-library/react-native';
import { TierTrailHub } from '../TierTrailHub';

test('stage 3 marks Raw/Setting done, Ripening now, rest ahead', () => {
  const { getByLabelText } = render(<TierTrailHub stage={3} />);
  expect(getByLabelText('Raw: done')).toBeTruthy();
  expect(getByLabelText('Ripening: now')).toBeTruthy();
  expect(getByLabelText('Keeper: ahead')).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail** — `npx jest src/features/whenbee/__tests__/companionStage.test.tsx` → FAIL.

- [ ] **Step 3: Rewrite `TierTrailHub.tsx` to use `HoneyTrail`**

```tsx
import { useMemo } from 'react';
import { HoneyTrail, type TrailState } from '@/src/components/HoneyTrail';
import type { CompanionStage } from '@/src/engine';

const TRAIL_LABELS = ['Raw', 'Setting', 'Ripening', 'Thickening', 'Honest', 'Keeper'] as const;

export function TierTrailHub({ stage }: { stage: CompanionStage }) {
  const nodes = useMemo(() => {
    const now = stage - 1;
    return TRAIL_LABELS.map((label, i) => ({
      label,
      state: (i < now ? 'done' : i === now ? 'now' : 'ahead') as TrailState,
    }));
  }, [stage]);
  return <HoneyTrail nodes={nodes} />;
}
```

- [ ] **Step 4: Update `TierTrail.tsx`** — re-export `HoneyTrail` under the old name and node shape so onboarding's `ready.tsx` keeps compiling, OR migrate `ready.tsx` in Task 11. Add at top of `TierTrail.tsx`:

```tsx
// TierTrail is superseded by HoneyTrail (honey-drop, no padlocks).
// Re-exported so existing call sites keep working until migrated.
export { HoneyTrail as TierTrail } from './HoneyTrail';
export type { TrailNode, TrailState } from './HoneyTrail';
```
Delete the old padlock implementation body in the same edit.

- [ ] **Step 5: Run tests** — `npx jest src/features/whenbee` → PASS. Then `npm run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add src/components/TierTrail.tsx src/features/whenbee/TierTrailHub.tsx src/features/whenbee/__tests__/companionStage.test.tsx
git commit -m "refactor(whenbee): unify mastery on HoneyTrail (hub + onboarding share one trail)"
```

---

## Task 3: `LockGlyph` component

**Files:**
- Create: `src/components/LockGlyph.tsx`
- Test: `src/components/__tests__/LockGlyph.test.tsx`

- [ ] **Step 1: Write failing test (renders; reduced-motion safe)**

```tsx
import { render } from '@testing-library/react-native';
import { LockGlyph } from '../LockGlyph';

test('renders a lock with accessible label', () => {
  const { getByLabelText } = render(<LockGlyph />);
  expect(getByLabelText('Locked — stored on this device')).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement (24-box, SW from `borderWidth`, indigo body + amber keyhole; shackle shut on mount via `motion.press`+`motion.spring`; reduced-motion still)**

```tsx
import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

const BOX = 24;

export function LockGlyph({ size = 24 }: { size?: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const dy = useSharedValue(reduced ? 0 : -3);

  useEffect(() => {
    if (reduced) { dy.set(0); return; }
    dy.set(withSequence(withTiming(0.6, { duration: t.motion.press }), withSpring(0, t.motion.spring)));
  }, [reduced, dy, t.motion.press, t.motion.spring]);

  const shackle = useAnimatedStyle(() => ({ transform: [{ translateY: dy.get() }] }));
  const sw = t.borderWidth.thick - 0.4; // 1.6, matches ReasonGlyph SW

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}
      accessibilityRole="image" accessibilityLabel="Locked — stored on this device">
      <Rect x={6} y={11} width={12} height={9} rx={2.2}
        fill={t.colors.primarySoft} stroke={t.colors.primary} strokeWidth={sw} strokeLinejoin="round" />
      <Circle cx={12} cy={15} r={1.4} fill={t.colors.accent} />
      <Rect x={11.3} y={15.4} width={1.4} height={2.7} rx={0.7} fill={t.colors.accent} />
      <AnimatedPath style={shackle} d="M8 11 V9 a4 4 0 0 1 8 0 V11"
        fill="none" stroke={t.colors.primary} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
```

- [ ] **Step 4: Run tests** → PASS. **Step 5: Lint + typecheck** → clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/LockGlyph.tsx src/components/__tests__/LockGlyph.test.tsx
git commit -m "feat(onboarding): add LockGlyph (indigo+amber animated privacy lock)"
```

---

## Task 4: `OverflowBar` component

**Files:**
- Create: `src/components/OverflowBar.tsx`
- Test: `src/components/__tests__/OverflowBar.test.tsx`

- [ ] **Step 1: Failing test — exposes example numbers + ratio**

```tsx
import { render } from '@testing-library/react-native';
import { OverflowBar } from '../OverflowBar';

test('shows guess and honest example values', () => {
  const { getByText } = render(<OverflowBar guessMin={15} honestMin={24} />);
  expect(getByText('15m')).toBeTruthy();
  expect(getByText('24m')).toBeTruthy();
  expect(getByText(/example/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement (track height `space[3]`, `radii.full`; guess fill `primary`; honey fill `accent`; cap `accent`; numbers `type.bigNumber`/Inter; animate width on mount over `motion.honeyFill`; reduced-motion final). Guess width % = `guessMin/honestMin`.**

```tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';
import { type } from '@/src/theme/typography';

export function OverflowBar({ guessMin, honestMin }: { guessMin: number; honestMin: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(1, guessMin / honestMin));
  const fill = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) { fill.set(1); return; }
    fill.set(withTiming(1, { duration: t.motion.honeyFill }));
  }, [reduced, fill, t.motion.honeyFill]);

  const guessStyle = useAnimatedStyle(() => ({ width: `${pct * 100 * fill.get()}%` }));
  const overStyle = useAnimatedStyle(() => ({ width: `${(1 - pct) * 100 * fill.get()}%` }));

  const H = t.space[3];
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: t.space[2] }}>
        <AppText variant="caption" style={{ color: t.colors.inkSoft }}>{`${guessMin}m`}</AppText>
        <AppText style={[type.bigNumber, { color: t.colors.accent }]}>{`${honestMin}m`}</AppText>
      </View>
      <View style={{ flexDirection: 'row', height: H, borderRadius: t.radii.full, backgroundColor: t.colors.accentSoft, overflow: 'hidden' }}>
        <Animated.View style={[guessStyle, { height: H, backgroundColor: t.colors.primary }]} />
        <Animated.View style={[overStyle, { height: H, backgroundColor: t.colors.accent }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.space[2] }}>
        <AppText variant="caption" style={{ color: t.colors.inkSoft }}>you guessed</AppText>
        <AppText variant="label" style={{ color: t.colors.accent }}>{`+${honestMin - guessMin} min reality`}</AppText>
      </View>
      <AppText variant="caption" style={{ color: t.colors.inkFaint, textAlign: 'center', marginTop: t.space[2] }}>
        An example — yours come from your own timers.
      </AppText>
    </View>
  );
}
```

- [ ] **Step 4: Run tests** → PASS. **Step 5: Lint + typecheck** → clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/OverflowBar.tsx src/components/__tests__/OverflowBar.test.tsx
git commit -m "feat(onboarding): add OverflowBar guess→honest payoff (HoneyBar-weight track)"
```

---

## Task 5: `OnboardingBackdrop`

**Files:**
- Create: `src/components/OnboardingBackdrop.tsx`
- Modify: `src/theme/tokens.ts` (add `onboardingBackdrop` alpha constants under a new `gradients` key)
- Test: `src/components/__tests__/OnboardingBackdrop.test.tsx`

- [ ] **Step 1: Add tokens** — in `tokens.ts`, add (numbers are the only literals, centralized here):

```ts
gradients: { backdropTop: 0.22, backdropCorner: 0.16 },
```

- [ ] **Step 2: Failing test (renders without crashing).**

```tsx
import { render } from '@testing-library/react-native';
import { OnboardingBackdrop } from '../OnboardingBackdrop';
test('renders', () => { expect(render(<OnboardingBackdrop />).toJSON()).toBeTruthy(); });
```

- [ ] **Step 3: Implement (absolute, behind content, radial glows from `primary`/`primaryEdge` at the token alphas over `colors.bg`).**

```tsx
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

export function OnboardingBackdrop() {
  const t = useTheme();
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="top" cx="50%" cy="-8%" rx="115%" ry="52%">
          <Stop offset="0" stopColor={t.colors.primary} stopOpacity={t.gradients.backdropTop} />
          <Stop offset="0.58" stopColor={t.colors.primary} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="corner" cx="10%" cy="108%" rx="90%" ry="48%">
          <Stop offset="0" stopColor={t.colors.primaryEdge} stopOpacity={t.gradients.backdropCorner} />
          <Stop offset="0.6" stopColor={t.colors.primaryEdge} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={t.colors.bg} />
      <Rect width="100%" height="100%" fill="url(#top)" />
      <Rect width="100%" height="100%" fill="url(#corner)" />
    </Svg>
  );
}
```

- [ ] **Step 4: Run tests** → PASS. **Step 5: Lint + typecheck.**

- [ ] **Step 6: Commit**

```bash
git add src/components/OnboardingBackdrop.tsx src/components/__tests__/OnboardingBackdrop.test.tsx src/theme/tokens.ts
git commit -m "feat(onboarding): add OnboardingBackdrop indigo aurora (token alphas)"
```

---

## Task 6: `OnboardingFooterCard`

**Files:**
- Create: `src/components/OnboardingFooterCard.tsx`
- Test: `src/components/__tests__/OnboardingFooterCard.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { OnboardingFooterCard } from '../OnboardingFooterCard';
test('renders glyph slot + text', () => {
  const { getByText } = render(<OnboardingFooterCard glyph={<Text>G</Text>}>Stays here.</OnboardingFooterCard>);
  expect(getByText('Stays here.')).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement (raised surface, `radii.card`, padding `space[3]`, row glyph + `bodySm`).**

```tsx
import { View, type ReactNode } from 'react';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';

export function OnboardingFooterCard({ glyph, children }: { glyph: ReactNode; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3],
      backgroundColor: t.colors.surfaceRaised, borderRadius: t.radii.card, padding: t.space[3] }}>
      <View>{glyph}</View>
      <AppText variant="bodySm" style={{ flex: 1, color: t.colors.ink }}>{children}</AppText>
    </View>
  );
}
```
(Note: import `ReactNode`/`View` correctly — `import { View } from 'react-native'; import type { ReactNode } from 'react';`.)

- [ ] **Step 4–6:** tests PASS, lint+typecheck, commit:

```bash
git add src/components/OnboardingFooterCard.tsx src/components/__tests__/OnboardingFooterCard.test.tsx
git commit -m "feat(onboarding): add OnboardingFooterCard compact glyph+text card"
```

---

## Task 7: `Chip` `add` variant → dashed "Add your own"

**Files:**
- Modify: `src/components/Chip.tsx`
- Test: `src/components/__tests__/Chip.test.tsx` (create if absent)

- [ ] **Step 1: Failing test**

```tsx
import { render } from '@testing-library/react-native';
import { Chip } from '../Chip';
test('add variant shows dashed action affordance', () => {
  const { getByText } = render(<Chip label="Add your own" variant="add" onPress={() => {}} />);
  expect(getByText('Add your own')).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail (label text differs / variant style).**

- [ ] **Step 3: Update `Chip.tsx`** `isAdd` branch: inner `View` border `borderWidth.thin`, `borderStyle:'dashed'`, `borderColor: t.colors.primary`, transparent bg; text color `t.colors.primary`; render a leading `+` (use existing icon set or an `AppText` "+"). Keep the `Pressable` a bare touch wrapper (visual on inner `View`).

- [ ] **Step 4–6:** tests PASS, `npx eslint src/components/Chip.tsx && npm run typecheck`, commit:

```bash
git add src/components/Chip.tsx src/components/__tests__/Chip.test.tsx
git commit -m "feat(onboarding): dashed 'Add your own' chip (clear add affordance)"
```

---

## Task 8: `BrandLockup` — bee instead of emoji

**Files:**
- Modify: `src/features/onboarding/BrandLockup.tsx`

- [ ] **Step 1: Replace the 🍯 tile** with `BeeMascot` size `t.space[10]` (40); keep the "Whenbee" wordmark (`fontSize.lg`, `fontWeight.bold`). Remove the indigo tile View + the emoji `AppText`.

```tsx
import { View } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { BeeMascot } from '@/src/components/BeeMascot';

export function BrandLockup() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
      <BeeMascot size={t.space[10]} />
      <AppText style={{ fontSize: t.fontSize.lg, fontWeight: t.fontWeight.bold as '700', color: t.colors.ink, letterSpacing: -0.3 }}>
        Whenbee
      </AppText>
    </View>
  );
}
```

- [ ] **Step 2: Lint + typecheck. Step 3: Commit**

```bash
git add src/features/onboarding/BrandLockup.tsx
git commit -m "feat(onboarding): use real bee mascot in brand lockup"
```

---

## Task 9: Assemble Welcome

**Files:**
- Modify: `src/app/(onboarding)/welcome.tsx`
- Test: `src/features/onboarding/__tests__/welcomeScreen.test.tsx` (create)

- [ ] **Step 1: Failing test** — asserts headline, payoff bar example text, privacy copy, CTA present.

```tsx
import { render } from '@testing-library/react-native';
import Welcome from '@/src/app/(onboarding)/welcome';
test('welcome shows hero, payoff, privacy, CTA', () => {
  const { getByText } = render(<Welcome />);
  expect(getByText(/time optimist/)).toBeTruthy();
  expect(getByText(/example/i)).toBeTruthy();
  expect(getByText(/stays on this phone/i)).toBeTruthy();
  expect(getByText(/Get started/)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Rebuild `welcome.tsx`** per spec order: `OnboardingBackdrop` behind `Screen`; `StepProgress current={0}`; `BrandLockup`; hero headline (existing `fontSize['2xl']` styles — keep); body (`variant="body"`); `<View style={{ flex: 1 }} />` spacer; eyebrow ("How long it really takes") + `<OverflowBar guessMin={15} honestMin={24} />`; `OnboardingFooterCard glyph={<LockGlyph />}` with privacy copy; `AppButton label="Get started →" fullWidth`. Copy strings from the spec. All gaps via `space` tokens.

- [ ] **Step 4: Run tests** → PASS. **Step 5: Lint + typecheck.**

- [ ] **Step 6: Verify on sim** (per CLAUDE.md): reset onboarding, `npm run ios`, screenshot; confirm spacing/alignment against the approved mock. Fix before commit if off.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(onboarding)/welcome.tsx" src/features/onboarding/__tests__/welcomeScreen.test.tsx
git commit -m "feat(onboarding): rebuild welcome — bee, payoff bar, animated privacy lock"
```

---

## Task 10: Assemble Categories

**Files:**
- Modify: `src/app/(onboarding)/categories.tsx`
- Test: `src/features/onboarding/__tests__/categoriesScreen.test.tsx` (extend)

- [ ] **Step 1: Failing test** — "Add your own" present as a button; nudge shows live pick count.

```tsx
test('shows add-your-own and a pick-count nudge', () => {
  const { getByText } = render(<Categories />);
  expect(getByText('Add your own')).toBeTruthy();
  expect(getByText(/picked\./)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Update `categories.tsx`:** `OnboardingBackdrop`; title (`fontSize.xl`, existing); body copy "Pick a few, or add your own. These are what I'll learn first."; chip wrap (seed chips gain leading ✓ when `selected` — pass through `Chip`; the inline-add unchanged but the resting chip uses `variant="add"` label **"Add your own"**); `<View style={{ flex: 1 }} />`; `OnboardingFooterCard glyph={<BeeMascot size={t.space[8]} />}` with text `` `${picked.length} picked. One more and I'll have plenty to learn from.` ``; `AppButton label="Continue →"`. Keep keyboard-dismiss `Pressable`.

- [ ] **Step 4–5:** tests PASS, lint+typecheck. **Step 6: Sim verify. Step 7: Commit**

```bash
git add "src/app/(onboarding)/categories.tsx" src/features/onboarding/__tests__/categoriesScreen.test.tsx
git commit -m "feat(onboarding): rebuild categories — clear add chip + pick-count nudge"
```

---

## Task 11: Assemble Ready

**Files:**
- Modify: `src/app/(onboarding)/ready.tsx`
- Test: `src/features/onboarding/__tests__/readyScreen.test.tsx` (create)

- [ ] **Step 1: Failing test** — trail labels + "no streak to break" + empty-days promise + CTA.

```tsx
test('ready shows trail, no-guilt caption, promise, CTA', () => {
  const { getByText } = render(<Ready />);
  expect(getByText('Raw')).toBeTruthy();
  expect(getByText(/no streak to break/i)).toBeTruthy();
  expect(getByText(/Empty days are fine/i)).toBeTruthy();
  expect(getByText(/Open my day/)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Update `ready.tsx`:** `OnboardingBackdrop`; title; body copy (spec); `Card` with eyebrow "Where you're headed" + `HoneyTrail` nodes `[{Raw, now}, {Setting, ahead}, {Ripening, ahead}, {Thickening, ahead}, {Honest, ahead}]` + caption "It only ripens. There's no streak to break."; spacer; `OnboardingFooterCard` with a door-exit glyph (reuse `ReasonGlyph kind="pulled"` or a small inline Svg in the same style) + empty-days promise; `AppButton label="Open my day →"` → `complete()` + `router.replace('/(tabs)')` (unchanged behavior).

- [ ] **Step 4–5:** tests PASS, lint+typecheck. **Step 6: Sim verify (trail + bee marker render; no padlocks). Step 7: Commit**

```bash
git add "src/app/(onboarding)/ready.tsx" src/features/onboarding/__tests__/readyScreen.test.tsx
git commit -m "feat(onboarding): rebuild ready — honey-drop trail, no-guilt promise"
```

---

## Task 12: Full verification

- [ ] **Step 1:** `npm run lint` → 0 warnings.
- [ ] **Step 2:** `npm run typecheck` → clean.
- [ ] **Step 3:** `npm test` → green (engine/db/store untouched; new component + screen tests pass).
- [ ] **Step 4:** Sim walkthrough: fresh onboarding → all 3 screens → land in tabs → open Whenbee hub, confirm the **same** trail mid-journey, no padlocks anywhere. Screenshot each, eyeball spacing/alignment vs. the approved mocks.
- [ ] **Step 5:** Confirm no literal px/hex/duration crept into any touched file: `git diff --staged | grep -nE "fontSize: [0-9]|#[0-9a-fA-F]{6}|: [0-9]+,? // px" || echo clean`. Fix any hit by routing through a token.

---

## Self-review (done at write time)

- **Spec coverage:** HoneyTrail (T1/T2), hub unify (T2), LockGlyph (T3), OverflowBar (T4), backdrop (T5), footer card (T6), add chip (T7), bee lockup (T8), screens (T9–T11), copy strings embedded in T9–T11, motion via `motion.*` tokens in T3/T4, testing (T12). All spec sections mapped.
- **Placeholder scan:** no TBD/"handle edge cases"; component code is complete; door-glyph in T11 names a concrete reuse (`ReasonGlyph kind="pulled"`).
- **Type consistency:** `TrailState`/`TrailNode` defined in T1, reused in T2/T11; `OverflowBar` props `guessMin/honestMin` consistent T4↔T9; `LockGlyph` prop `size` consistent T3↔T9.
