# Today Header Honey-Ring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Today screen's "Good morning" subtitle + full-width honey HUD card with a greeting eyebrow + a compact, fully-animated honey ring (the reused hub ring, shrunk) in the header.

**Architecture:** Reuse `src/features/whenbee/HoneyRing.tsx` (the hub's bee ring) by adding optional `size`/`stroke` props and scaling its ceremony sub-geometry from `size`, so one ring identity serves both the 200px hub and the 58px header. A new thin feature component `TodayHeaderRing` wraps it with hub-routing + caption. The greeting moves into a new optional `eyebrow` prop on `ScreenHeader`. A pure `leadHoney` helper picks the most-ripened category to drive the ring.

**Tech Stack:** React Native (Expo SDK 54), TypeScript (strict), Reanimated 3, react-native-svg, Zustand, expo-router, Jest + @testing-library/react-native.

## Global Constraints

- **Git is the founder's.** Do NOT commit, do NOT switch/create branches, do NOT push. Each task ends at a **review checkpoint** — stop and let the founder review.
- **Tokens only.** Every size/color/space from `src/theme/tokens.ts` via `useTheme()`. No inlined hex/number; add a token if missing.
- **iOS dev build only** (Expo Go cannot run native modules). No `boxShadow` (RN 0.81/Fabric renders it as a hard line) — soft shadow uses iOS `shadowColor/shadowRadius/shadowOpacity/shadowOffset`.
- **The hub `HoneyRing` call must stay byte-identical.** All scaling derives from existing tokens at the default `size = t.ring.size`, so `<HoneyRing sharpness sealed>` with no size/stroke props produces exactly today's geometry. Existing hub + animation tests must still pass.
- **Reduced motion + monotonic honey preserved.** Keep the component's `reduced` + `introDone` gating; honey only ever rises.
- **Run before each checkpoint:** `npm run lint && npm run typecheck && npx jest <changed test files>`.

---

### Task 1: Add the `headerRing` token group

**Files:**
- Modify: `src/theme/tokens.ts` (add `headerRing` group near `ring`)
- Modify: `src/theme/useTheme.ts:9` (pass it through `resolveTheme`)

**Interfaces:**
- Produces: `t.headerRing = { size: 58, stroke: 4.5, bee: 31, caption: 10.5 }`

- [ ] **Step 1: Add the token group.** In `src/theme/tokens.ts`, immediately after the `ring: {...}` line (the `ring: { size: 200, ... headDot: 13 }` block), add:

```ts
  // Compact Today-header honey ring (reuses HoneyRing at a small size). size =
  // SVG square edge; stroke = ring weight; bee = BeeMascot size inside; caption =
  // tier-word font size beneath the ring. The ceremony sub-geometry (head-dot,
  // ripple, motes, seal) scales from `size` inside HoneyRing — see the ring group.
  headerRing: { size: 58, stroke: 4.5, bee: 31, caption: 10.5 },
```

- [ ] **Step 2: Pass it through the theme.** In `src/theme/useTheme.ts:9`, add `headerRing: tokens.headerRing,` to the returned object (e.g. right after `ring: tokens.ring,`):

```ts
    companion: tokens.companion, ring: tokens.ring, headerRing: tokens.headerRing, seal: tokens.seal, mote: tokens.mote, row: tokens.row, planRail: tokens.planRail, upsell: tokens.upsell, quick: tokens.quick, chart: tokens.chart, proTeaser: tokens.proTeaser, discovery: tokens.discovery };
```

- [ ] **Step 3: Typecheck.**

Run: `npm run typecheck`
Expected: PASS (no errors). `t.headerRing` now resolves app-wide.

- [ ] **Step 4: Review checkpoint** — stop. Do not commit.

---

### Task 2: `leadHoney` pure helper

**Files:**
- Create: `src/features/today/leadHoney.ts`
- Test: `src/features/today/__tests__/leadHoney.test.ts`

**Interfaces:**
- Consumes: `HoneycombCell` from `@/src/components/honeycomb/Honeycomb`
- Produces: `leadHoney(cells: HoneycombCell[]): { sharpness: number; tier: HoneycombCell['tier'] }`

- [ ] **Step 1: Write the failing test.** Create `src/features/today/__tests__/leadHoney.test.ts`:

```ts
import { leadHoney } from '../leadHoney';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

const cell = (sharpness: number, tier: HoneycombCell['tier']): HoneycombCell => ({
  categoryId: `c-${sharpness}`,
  label: 'x',
  sharpness,
  tier,
});

describe('leadHoney', () => {
  it('returns Raw / 0 for no cells', () => {
    expect(leadHoney([])).toEqual({ sharpness: 0, tier: 'Raw' });
  });

  it('returns the single cell unchanged', () => {
    expect(leadHoney([cell(40, 'Ripening')])).toEqual({ sharpness: 40, tier: 'Ripening' });
  });

  it('picks the most-ripened (max sharpness) cell as the lead', () => {
    const cells = [cell(20, 'Forming'), cell(72, 'Honest'), cell(55, 'Ripening')];
    expect(leadHoney(cells)).toEqual({ sharpness: 72, tier: 'Honest' });
  });
});
```

- [ ] **Step 2: Run it — verify it fails.**

Run: `npx jest src/features/today/__tests__/leadHoney.test.ts`
Expected: FAIL — "Cannot find module '../leadHoney'".

- [ ] **Step 3: Implement.** Create `src/features/today/leadHoney.ts`:

```ts
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

// Pure: the most-ripened cell drives the Today header ring. Returns that cell's
// absolute sharpness (0..100, the same scale HoneyRing fills by) + its tier (the
// caption word). Empty list → a Raw/0 baseline (HoneyRing's endowedPct floor
// keeps a fresh ring from reading as a cold empty circle).
export function leadHoney(
  cells: HoneycombCell[],
): { sharpness: number; tier: HoneycombCell['tier'] } {
  const lead = cells.reduce<HoneycombCell | null>(
    (best, c) => (best === null || c.sharpness > best.sharpness ? c : best),
    null,
  );
  return { sharpness: lead?.sharpness ?? 0, tier: lead?.tier ?? 'Raw' };
}
```

- [ ] **Step 4: Run it — verify it passes.**

Run: `npx jest src/features/today/__tests__/leadHoney.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint.** Run: `npx eslint src/features/today/leadHoney.ts src/features/today/__tests__/leadHoney.test.ts` — Expected: clean.

- [ ] **Step 6: Review checkpoint** — stop. Do not commit.

---

### Task 3: Parameterize `HoneyRing` (size/stroke + scaled ceremony)

**Files:**
- Modify: `src/features/whenbee/HoneyRing.tsx`
- Test: `src/features/whenbee/__tests__/HoneyRing.test.tsx` (extend existing)

**Interfaces:**
- Consumes: `t.ring.{size,stroke,popStroke,headDot}`, `t.seal.size`, `t.mote.{distance,size,count}` (as scaling bases)
- Produces: `HoneyRing` now accepts optional `size?: number`, `stroke?: number`. Defaults to `t.ring.size` / `t.ring.stroke` → hub call unchanged. All sub-geometry scales from the active `S`.

- [ ] **Step 1: Write the failing test.** Add to `src/features/whenbee/__tests__/HoneyRing.test.tsx` (create the describe block if the file lacks one; keep all existing tests):

```tsx
import { render } from '@testing-library/react-native';
import { HoneyRing } from '../HoneyRing';
import { Text } from 'react-native';

describe('HoneyRing size parameterization', () => {
  it('renders the SVG at the default ring size when no size prop is given', () => {
    const { UNSAFE_getAllByType } = render(
      <HoneyRing sharpness={40} sealed={false}><Text>bee</Text></HoneyRing>,
    );
    // The first <Svg> (track+arc) carries width === t.ring.size (200).
    const Svg = require('react-native-svg').default;
    const svg = UNSAFE_getAllByType(Svg)[0];
    expect(svg.props.width).toBe(200);
  });

  it('renders the SVG at a custom size when size prop is given', () => {
    const { UNSAFE_getAllByType } = render(
      <HoneyRing sharpness={40} sealed={false} size={58} stroke={4.5}><Text>bee</Text></HoneyRing>,
    );
    const Svg = require('react-native-svg').default;
    const svg = UNSAFE_getAllByType(Svg)[0];
    expect(svg.props.width).toBe(58);
  });
});
```

- [ ] **Step 2: Run it — verify the custom-size test fails.**

Run: `npx jest src/features/whenbee/__tests__/HoneyRing.test.tsx -t "custom size"`
Expected: FAIL — width is 200 (props ignored), not 58.

- [ ] **Step 3: Add the props + derive `S`/`sw`.** In `src/features/whenbee/HoneyRing.tsx`, change the signature and the first two derived lines:

```tsx
export function HoneyRing({
  sharpness,
  sealed,
  children,
  size,
  stroke,
}: {
  sharpness: number;
  sealed: boolean;
  children: React.ReactNode;
  size?: number;
  stroke?: number;
}) {
  const t = useTheme();
  const S = size ?? t.ring.size;
  // Widen to `number` so the shared value accepts the full popStroke range.
  const sw: number = stroke ?? t.ring.stroke;
```

- [ ] **Step 4: Scale the stroke-pop target.** The pop currently animates to the fixed `t.ring.popStroke` (11). Make it proportional to `sw` so a 4.5px ring pops to ~5.5, not 11. Just below the `const stroke = useSharedValue(sw);` line, add:

```tsx
  // Pop target scales with the active stroke (= t.ring.popStroke at the default).
  const popStroke = sw * (t.ring.popStroke / t.ring.stroke);
```

Then in the stroke-pop `useEffect`, replace `t.ring.popStroke` with `popStroke`:

```tsx
        stroke.set(
          withSequence(
            withTiming(popStroke, { duration: t.motion.strokePop / 2, easing: t.motion.easing.honey }),
            withTiming(sw, { duration: t.motion.strokePop / 2, easing: t.motion.easing.honey }),
          ),
        );
```

Update that effect's dependency array: replace `t.ring.popStroke` with `popStroke`.

- [ ] **Step 5: Scale the head-dot + seal from `S`.** Replace the existing `const dotSize = t.ring.headDot;` / `const sealW = t.seal.size;` / `const sealH = t.seal.size * 1.1;` lines with:

```tsx
  const dotSize = S * (t.ring.headDot / t.ring.size);
  const sealW = S * (t.seal.size / t.ring.size);
  const sealH = sealW * 1.1;
```

- [ ] **Step 6: Scale the motes from `S`.** In the motes `.map(...)`, change the `distance` and `size` props passed to `<Mote>`:

```tsx
            <Mote
              key={i}
              index={i}
              count={t.mote.count}
              distance={S * (t.mote.distance / t.ring.size)}
              size={S * (t.mote.size / t.ring.size)}
              color={t.colors.accent}
              sealSeq={t.motion.sealSeq}
              easing={t.motion.easing.honey}
            />
```

- [ ] **Step 7: Scale the ripple from `S`.** The `Ripple` sub-component computes `const size = t.ring.size * 0.72;`. Pass the active ring size in. Change the three `<Ripple .../>` call sites to include `ringSize={S}`:

```tsx
          <Ripple delay={0} ringSize={S} t={t} />
          <Ripple delay={t.motion.sealSeq * 0.15} ringSize={S} t={t} />
          <Ripple delay={t.motion.sealSeq * 0.3} ringSize={S} t={t} />
```

Then update the `Ripple` definition's props + its size line:

```tsx
function Ripple({ delay, ringSize, t }: { delay: number; ringSize: number; t: ReturnType<typeof useTheme> }) {
```
```tsx
  const size = ringSize * 0.72;
```

- [ ] **Step 8: Run the HoneyRing tests — verify all pass.**

Run: `npx jest src/features/whenbee/__tests__/HoneyRing.test.tsx`
Expected: PASS — both new tests + every pre-existing HoneyRing test (defaults unchanged at `S = 200`).

- [ ] **Step 9: Lint + typecheck.** Run: `npx eslint src/features/whenbee/HoneyRing.tsx && npm run typecheck` — Expected: clean.

- [ ] **Step 10: Review checkpoint** — stop. Do not commit.

---

### Task 4: `ScreenHeader` optional `eyebrow`

**Files:**
- Modify: `src/components/ScreenHeader.tsx`
- Test: `src/components/__tests__/ScreenHeader.test.tsx` (create if absent)

**Interfaces:**
- Produces: `ScreenHeader` accepts optional `eyebrow?: string`, rendered as a mixed-case `caption` line above the title. Other screens pass no eyebrow → unchanged.

- [ ] **Step 1: Write the failing test.** Create `src/components/__tests__/ScreenHeader.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { ScreenHeader } from '../ScreenHeader';

describe('ScreenHeader eyebrow', () => {
  it('renders the eyebrow above the title when provided', () => {
    const { getByText } = render(<ScreenHeader title="Today" eyebrow="Good morning, Ali" />);
    expect(getByText('Good morning, Ali')).toBeTruthy();
    expect(getByText('Today')).toBeTruthy();
  });

  it('renders no eyebrow when not provided', () => {
    const { queryByText } = render(<ScreenHeader title="Today" />);
    expect(queryByText('Good morning, Ali')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — verify it fails.**

Run: `npx jest src/components/__tests__/ScreenHeader.test.tsx`
Expected: FAIL — eyebrow text not found.

- [ ] **Step 3: Implement.** In `src/components/ScreenHeader.tsx`, add `eyebrow` to the props and render it. Mixed-case on purpose — do NOT use `type.eyebrow` (it uppercases, which would shout the greeting and lose the name's casing):

```tsx
export function ScreenHeader({
  title,
  subtitle,
  right,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  eyebrow?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ paddingTop: t.space[1], paddingBottom: t.space[3], gap: 2 }}>
      {eyebrow ? (
        <AppText variant="caption" style={{ color: t.colors.inkSoft }}>
          {eyebrow}
        </AppText>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="display" style={{ color: t.colors.ink }}>
          {title}
        </AppText>
        {right ?? null}
      </View>
      {subtitle ? (
        <AppText variant="caption" style={{ color: t.colors.inkSoft }}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Run it — verify it passes.**

Run: `npx jest src/components/__tests__/ScreenHeader.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Lint.** Run: `npx eslint src/components/ScreenHeader.tsx src/components/__tests__/ScreenHeader.test.tsx` — Expected: clean.

- [ ] **Step 6: Review checkpoint** — stop. Do not commit.

---

### Task 5: `TodayHeaderRing` component

**Files:**
- Create: `src/features/today/TodayHeaderRing.tsx`
- Test: `src/features/today/__tests__/TodayHeaderRing.test.tsx`

**Interfaces:**
- Consumes: `HoneyRing` (Task 3), `t.headerRing` (Task 1), `BeeMascot`, `companion.glow`
- Produces: `<TodayHeaderRing sharpness tier stage seed />` — a Pressable that routes to `/(tabs)/whenbee`, renders the small animated ring with a nameless `BeeMascot` child + the tier-word caption, with an iOS amber glow from Ripening up.

- [ ] **Step 1: Write the failing test.** Create `src/features/today/__tests__/TodayHeaderRing.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { TodayHeaderRing } from '../TodayHeaderRing';

const push = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => push(...a) } }));

describe('TodayHeaderRing', () => {
  beforeEach(() => push.mockClear());

  it('shows the tier word caption', () => {
    const { getByText } = render(
      <TodayHeaderRing sharpness={40} tier="Ripening" stage={3} seed={1} />,
    );
    expect(getByText('Ripening')).toBeTruthy();
  });

  it('routes to the whenbee hub on press', () => {
    const { getByLabelText } = render(
      <TodayHeaderRing sharpness={40} tier="Ripening" stage={3} seed={1} />,
    );
    fireEvent.press(getByLabelText(/honey tier Ripening/i));
    expect(push).toHaveBeenCalledWith('/(tabs)/whenbee');
  });
});
```

- [ ] **Step 2: Run it — verify it fails.**

Run: `npx jest src/features/today/__tests__/TodayHeaderRing.test.tsx`
Expected: FAIL — "Cannot find module '../TodayHeaderRing'".

- [ ] **Step 3: Implement.** Create `src/features/today/TodayHeaderRing.tsx`:

```tsx
import { Pressable, View, Text, Platform, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { HoneyRing } from '@/src/features/whenbee/HoneyRing';
import { BeeMascot, type BeeVariant } from '@/src/components/BeeMascot';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { CompanionStage } from '@/src/engine';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

// Compact Today-header honey ring: the SAME animated HoneyRing as the hub, shrunk
// to t.headerRing.size, with a nameless BeeMascot inside (no name overlay, no
// RingBadge) and the tier word beneath. Tap → the Whenbee hub. A soft amber glow
// (iOS shadow — never boxShadow) blooms from the Ripening stage up via
// companion.glow. Honey is monotonic; the ring only ever fills forward.
export function TodayHeaderRing({
  sharpness,
  tier,
  stage,
  seed,
}: {
  sharpness: number;
  tier: HoneycombCell['tier'];
  stage: CompanionStage;
  seed: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const glowRadius = t.companion.glow[stage - 1] ?? 0;
  const glow: ViewStyle =
    Platform.OS === 'ios' && glowRadius > 0
      ? {
          shadowColor: t.colors.accent,
          shadowOpacity: 0.5,
          shadowRadius: glowRadius,
          shadowOffset: { width: 0, height: 0 },
        }
      : {};

  const caption: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    fontSize: t.headerRing.caption,
    color: t.colors.inkSoft,
    textAlign: 'center',
    marginTop: t.space[1],
  };

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/whenbee')}
      onPressIn={() => {
        if (!reduced) scale.set(withTiming(0.98, { duration: t.motion.press }));
      }}
      onPressOut={() => {
        if (!reduced) scale.set(withSpring(1, t.motion.spring));
      }}
      accessibilityRole="button"
      accessibilityLabel={`Whenbee, honey tier ${tier}. Tap to open your honeycomb.`}
    >
      <Animated.View style={[{ alignItems: 'center' }, pressStyle]}>
        <View style={glow}>
          <HoneyRing
            sharpness={sharpness}
            sealed={tier === 'Honest'}
            size={t.headerRing.size}
            stroke={t.headerRing.stroke}
          >
            <BeeMascot
              size={t.headerRing.bee}
              variant={`stage-${stage}` as BeeVariant}
              seed={seed}
              animated
            />
          </HoneyRing>
        </View>
        <Text style={caption}>{tier}</Text>
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run it — verify it passes.**

Run: `npx jest src/features/today/__tests__/TodayHeaderRing.test.tsx`
Expected: PASS (2 tests). (If the SVG/reanimated mocks aren't set up, mirror the mock setup already used by `whenbeeHub.test.tsx` / `RingBadge.test.tsx`.)

- [ ] **Step 5: Lint + typecheck.** Run: `npx eslint src/features/today/TodayHeaderRing.tsx && npm run typecheck` — Expected: clean.

- [ ] **Step 6: Review checkpoint** — stop. Do not commit.

---

### Task 6: Wire the new header into `index.tsx`

**Files:**
- Modify: `src/app/(tabs)/index.tsx`
- Test: `src/features/today/__tests__/todayScreen.test.tsx` (update)

**Interfaces:**
- Consumes: `leadHoney` (Task 2), `TodayHeaderRing` (Task 5), `ScreenHeader` eyebrow (Task 4)

- [ ] **Step 1: Update the screen test first.** In `src/features/today/__tests__/todayScreen.test.tsx`, add/adjust assertions (keep existing passing ones):

```tsx
it('renders the greeting in the header eyebrow (no standalone subtitle block)', () => {
  const { getByText } = renderToday(); // existing render helper in this file
  // The greeting text still appears (now as the eyebrow). useGreeting is time-based;
  // assert the time-independent prefix.
  expect(getByText(/^Good (morning|afternoon|evening)/)).toBeTruthy();
  expect(getByText('Today')).toBeTruthy();
});
```

(If the file has an existing assertion that the greeting renders as a separate top element, update it to expect the eyebrow placement; do not assert the removed `TodayHud` card.)

- [ ] **Step 2: Run it — verify the new assertion fails or the suite reflects the old layout.**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx`
Expected: FAIL on the new/updated assertion (greeting not yet in eyebrow) — confirming the test drives the change.

- [ ] **Step 3: Swap imports.** In `src/app/(tabs)/index.tsx`, remove the `TodayHud` import line and add the two new imports:

Remove:
```tsx
import { TodayHud } from '@/src/components/honeycomb/TodayHud';
```
Add (near the other `@/src/features/today/*` imports):
```tsx
import { TodayHeaderRing } from '@/src/features/today/TodayHeaderRing';
import { leadHoney } from '@/src/features/today/leadHoney';
```

- [ ] **Step 4: Delete the top greeting `<Text>` block.** Remove these lines (currently ~168–173):

```tsx
          <Text
            style={{ ...(type.subtitle as unknown as TextStyle), color: t.colors.ink }}
            accessibilityRole="header"
          >
            {greeting}
          </Text>
```

- [ ] **Step 5: Move the greeting onto `ScreenHeader` + add the ring cluster.** Replace the existing `<ScreenHeader title="Today" subtitle={...} right={<settings gear Pressable/>} />` block with:

```tsx
          <ScreenHeader
            title="Today"
            subtitle={dateLabel(new Date())}
            eyebrow={greeting}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4] }}>
                <Pressable
                  onPress={() => router.push('/settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                  hitSlop={8}
                >
                  <Ionicons name="settings-outline" size={22} color={t.colors.inkSoft} />
                </Pressable>
                <TodayHeaderRing
                  sharpness={leadHoney(shownCells).sharpness}
                  tier={leadHoney(shownCells).tier}
                  stage={companionStage}
                  seed={companionSeed}
                />
              </View>
            }
          />
```

- [ ] **Step 6: Replace the `TodayHud` wrapper with the standalone ritual seal.** Delete the entire `{/* The honey HUD hugs the header ... */}` comment + the `<View style={{ marginTop: -t.space[2], marginBottom: t.space[3] }}><TodayHud .../></View>` block (currently ~190–202) and replace with:

```tsx
          {/* Daily ritual (opt-in) lived in the honey HUD footer; the HUD is gone,
              so render the seal standalone where the card was. */}
          {dailyRitualEnabled ? (
            <RitualSeal done={ritualDone} onLog={() => router.push('/(modals)/retro')} />
          ) : null}
```

Add the import if not present:
```tsx
import { RitualSeal } from '@/src/features/today/RitualSeal';
```

- [ ] **Step 7: Remove the now-unused `type.subtitle` cast import usage** if `type` / `TextStyle` are no longer referenced after the greeting block deletion. Run typecheck to find any unused-import / dangling reference and clean it:

Run: `npm run typecheck`
Expected: PASS. Fix any "declared but never used" by removing the dead import.

- [ ] **Step 8: Run the screen test — verify it passes.**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx`
Expected: PASS.

- [ ] **Step 9: Lint.** Run: `npx eslint "src/app/(tabs)/index.tsx" src/features/today/__tests__/todayScreen.test.tsx` — Expected: clean.

- [ ] **Step 10: Review checkpoint** — stop. Do not commit.

---

### Task 7: Remove `TodayHud` + fix the stale comment

**Files:**
- Delete: `src/components/honeycomb/TodayHud.tsx`
- Delete: `src/components/honeycomb/__tests__/TodayHud.test.tsx` (if present)
- Modify: `src/features/today/TodayEmptyState.tsx:12` (stale comment)

**Interfaces:**
- None produced. `index.tsx` is the only real consumer (verified) and now uses `TodayHeaderRing` instead.

- [ ] **Step 1: Confirm no remaining importers.**

Run: `grep -rn "TodayHud" src | grep -v "TodayEmptyState"`
Expected: no matches except the file being deleted + its test. (If anything else appears, stop and reassess.)

- [ ] **Step 2: Delete the component + its test.**

```bash
rm src/components/honeycomb/TodayHud.tsx
rm -f src/components/honeycomb/__tests__/TodayHud.test.tsx
```

- [ ] **Step 3: Fix the stale comment.** In `src/features/today/TodayEmptyState.tsx:12`, change:

```tsx
// The companion presence lives in TodayHud above; this body stays calm + actionable.
```
to:
```tsx
// The companion presence lives in the header honey ring above; this body stays calm + actionable.
```

- [ ] **Step 4: Full gate.**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS — no dangling `TodayHud` reference, full suite green.

- [ ] **Step 5: Device verification.** Run `npm run ios`, open Today. Confirm: greeting eyebrow above "Today"; the small ring animates its fill on entry; the bee blinks / looks around; gear opens settings; ring opens the hub; (if a category is Honest) the seal celebration stays inside the header band (no motes spilling onto the title/date — if they do, lower the mote distance fraction in Task 3 Step 6). Capture `xcrun simctl io booted screenshot` for the founder.

- [ ] **Step 6: Review checkpoint** — stop. Do not commit. Founder reviews the screenshot + commits.

---

## Self-Review

**Spec coverage:**
- Greeting → eyebrow (g1): Task 4 (prop) + Task 6 (wiring). ✓
- Honey HUD card → reused HoneyRing (A2 caption): Tasks 1, 3, 5, 6. ✓
- Keep ALL animations, scaled: Task 3 (size-scaled head-dot/ripple/mote/seal/pop, motion preserved). ✓
- No bee name / no RingBadge: Task 5 (nameless `BeeMascot`, no RingBadge). ✓
- Settings gear inboard: Task 6 Step 5. ✓
- RitualSeal rehomed when `dailyRitualEnabled`: Task 6 Step 6. ✓
- `leadHoney` pure helper (absolute sharpness + tier): Task 2. ✓
- `headerRing` token group + useTheme line: Task 1. ✓
- Hub call byte-identical: Task 3 (defaults derive from `t.ring.*` at S=200). ✓
- Glow via iOS shadow (not boxShadow): Task 5. ✓
- Remove TodayHud + stale comment: Task 7. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to" — every code step shows full code. ✓

**Type consistency:** `leadHoney` returns `{ sharpness: number; tier: HoneycombCell['tier'] }`, consumed verbatim by `TodayHeaderRing` props (`sharpness`, `tier`). `HoneyRing` new props `size?`/`stroke?` match the call in `TodayHeaderRing`. `CompanionStage` / `BeeVariant` match `BeeMascot`'s existing API used by the old `TodayHud`. ✓
