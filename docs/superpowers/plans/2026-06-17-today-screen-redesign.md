# Today Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Today tab so Whenbee (companion + honey) is present in every state, the dead-pixel honeycomb strip is gone, and the empty states (first-run + daily) feel alive and have one clear action.

**Architecture:** One constant HUD (`TodayHud`: BeeMascot + honey bar, tap → Whenbee hub) sits at the top of Today in every state. The body branches on session/task state; a new `TodayEmptyState` renders the first-run vs daily-empty variants. `useToday` is extended to surface the companion presence + lifetime reclaim it already computes in the store. A shared `RetroLogChip` removes duplication.

**Tech Stack:** React Native (Expo SDK 54), expo-router, Zustand, react-native-reanimated, react-native-svg, Jest + @testing-library/react-native.

## Global Constraints

- **Every spacing/size/font/color/motion value comes from a token in `src/theme/tokens.ts` via `useTheme()`.** Never inline a raw number or hex. If a value is missing, add a token.
- **`src/app/**` and `src/components/**` must NOT import `src/services/*` or `src/db/*`.** Route through stores / feature hooks.
- **Routes in `src/app/` stay thin** — logic lives in `src/features/*` and `src/stores/*`.
- **Brand invariants:** amber-never-red; honey/companion stage is monotonic (never regress in UI); no streak / guilt / "missed day" copy; core loop stays on-device.
- **Copy is verbatim** from the copy deck below — no em dashes, no AI-vocab. Banned strings anywhere: `streak`, `missed`, `don't lose`, `days in a row`, red error styling on over-runs.
- **Reanimated under reactCompiler:** never put function-form `style` on `Pressable`; animate an inner `Animated.View`. Read/write shared values with `.get()/.set()`.
- **Lint gate:** `npm run lint` is `eslint . --max-warnings=0`. Zero warnings or CI fails. Repo uses flat `eslint.config.js` (no `.eslintrc.js`).

### Copy deck (verbatim)

| Surface | String |
|---|---|
| First-run lead | `Time your first task` |
| First-run sub | `That's all it takes for Whenbee to start learning your real numbers, the ones you can plan around.` |
| First-run primary CTA | `Start now` |
| First-run secondary chip | `Already finished something? Log it` |
| Daily-empty eyebrow | `Nothing on yet` |
| Daily-empty lead | `What's on today?` |
| Daily-empty sub | `Add a task and I'll show its honest finish, plus whether the day actually fits.` |
| Daily-empty primary CTA | `Plan a task` |
| Daily-empty reclaim line | `{formatReclaim(min)} reclaimed so far` |
| Daily-empty secondary chip | `Or log something you finished` |
| Populated retro chip (unchanged) | `Finished something? Log it — it ripens your honey` |

> Note: the populated chip keeps its existing em dash (pre-existing copy, not part of this redesign's new strings). The two *new* empty-state subs are em-dash-free.

---

## File structure

- **Create** `src/features/today/RetroLogChip.tsx` — the "log something you finished" chip, extracted so the empty state and the populated screen share one component.
- **Create** `src/components/honeycomb/TodayHud.tsx` — BeeMascot + tier label + honey bar; taps to the hub. Replaces `HoneycombStrip` usage *on Today only* (HoneycombStrip stays for any other caller).
- **Create** `src/features/today/TodayEmptyState.tsx` — first-run / daily empty body.
- **Modify** `src/theme/tokens.ts` — add `companion.hudBee` size token.
- **Modify** `src/features/today/useToday.ts` — surface `companionStage`, `companionSeed`, `reclaimLifetimeMin`, `hasEverLogged`.
- **Modify** `src/app/(tabs)/index.tsx` — swap HUD, add the empty-state branch, use `RetroLogChip`.
- **Tests:** new unit tests per component + extend `src/features/today/__tests__/todayScreen.test.tsx`; new `src/features/today/__tests__/useToday.test.tsx`.

---

## Task 1: RetroLogChip component

**Files:**
- Create: `src/features/today/RetroLogChip.tsx`
- Test: `src/features/today/__tests__/RetroLogChip.test.tsx`

**Interfaces:**
- Produces: `RetroLogChip({ label, onPress }: { label: string; onPress: () => void })` — a full-width pressable row: clock icon + label + chevron.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/today/__tests__/RetroLogChip.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RetroLogChip } from '@/src/features/today/RetroLogChip';

describe('RetroLogChip', () => {
  it('renders its label and fires onPress', () => {
    const onPress = jest.fn();
    render(<RetroLogChip label="Or log something you finished" onPress={onPress} />);
    expect(screen.getByText('Or log something you finished')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Or log something you finished'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/today/__tests__/RetroLogChip.test.tsx`
Expected: FAIL — cannot find module `RetroLogChip`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/today/RetroLogChip.tsx
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// The "log something you finished" chip. Shared by Today's empty state and the
// populated screen, so the copy can differ per surface while the styling stays one
// source. The whole row is the touch target into the retro-log modal.
export function RetroLogChip({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();

  const chip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    alignSelf: 'stretch',
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[4],
  };
  const text: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={chip}
    >
      <Ionicons name="time-outline" size={t.iconSize.sm} color={t.colors.inkSoft} />
      <Text style={text}>{label}</Text>
      <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/today/__tests__/RetroLogChip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `npx eslint src/features/today/RetroLogChip.tsx src/features/today/__tests__/RetroLogChip.test.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/today/RetroLogChip.tsx src/features/today/__tests__/RetroLogChip.test.tsx
git commit -m "feat(today): extract RetroLogChip"
```

---

## Task 2: TodayHud component (+ token)

**Files:**
- Modify: `src/theme/tokens.ts` (the `companion` object)
- Create: `src/components/honeycomb/TodayHud.tsx`
- Test: `src/components/honeycomb/__tests__/TodayHud.test.tsx`

**Interfaces:**
- Consumes: `HoneycombCell` from `@/src/components/honeycomb/Honeycomb` (`{ categoryId: string; label: string; sharpness: number; tier: Tier }`); `TIERS`, `tierBandProgress`, `CompanionStage` from `@/src/engine`; `BeeMascot`, `BeeVariant` from `@/src/components/BeeMascot`.
- Produces: `TodayHud({ cells, stage, seed, onPress }: { cells: HoneycombCell[]; stage: CompanionStage; seed: number; onPress: () => void })`.

- [ ] **Step 1: Add the bee-size token**

In `src/theme/tokens.ts`, inside the `companion: { … }` object, add a scalar after the `glow` array:

```ts
  companion: {
    floatLift: [2, 3, 5, 7, 9, 11],
    glow: [0, 0, 6, 12, 18, 24],
    // BeeMascot size (px) for the compact Today HUD — smaller than the hub/onboarding
    // bee so the companion reads as a quiet presence beside the honey bar.
    hudBee: 36,
  },
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/components/honeycomb/__tests__/TodayHud.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TodayHud } from '@/src/components/honeycomb/TodayHud';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

const cells: HoneycombCell[] = [
  { categoryId: 'cleaning', label: 'Cleaning', sharpness: 50, tier: 'Setting' },
  { categoryId: 'email', label: 'Email', sharpness: 20, tier: 'Raw' },
];

describe('TodayHud', () => {
  it('shows the lead category tier and routes on press', () => {
    const onPress = jest.fn();
    render(<TodayHud cells={cells} stage={2} seed={1} onPress={onPress} />);
    // Lead = highest sharpness (Setting).
    expect(screen.getByText('Setting')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Setting'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('falls back to Raw when there are no cells', () => {
    render(<TodayHud cells={[]} stage={1} seed={1} onPress={() => {}} />);
    expect(screen.getByText('Raw')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/components/honeycomb/__tests__/TodayHud.test.tsx`
Expected: FAIL — cannot find module `TodayHud`.

- [ ] **Step 4: Write the implementation**

```tsx
// src/components/honeycomb/TodayHud.tsx
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BeeMascot, type BeeVariant } from '@/src/components/BeeMascot';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { tierBandProgress, type CompanionStage } from '@/src/engine';
import type { HoneycombCell } from './Honeycomb';

// ──────────────────────────────────────────────────────────────────────────────
// TodayHud — the persistent companion + honey HUD on Today (replaces the
// HoneycombStrip on this screen). One row:
//
//   (Whenbee)  Setting                                          ›
//              ▓▓▓▓▓▓▓░░░░░░░░  (honey bar toward the next tier)
//
// The bee is the living presence (its stage drives glow/float inside BeeMascot);
// the honey bar fills amber toward the next tier using the existing band progress.
// No "N logs to go" counter — the tier word + fill carry it, calm not chore-like.
// The whole card taps into the Whenbee hub, where the full per-category comb lives.
// Amber here is the sanctioned honey identity; it only ever fills, never drains.
// ──────────────────────────────────────────────────────────────────────────────

interface TodayHudProps {
  cells: HoneycombCell[];
  stage: CompanionStage;
  seed: number;
  onPress: () => void;
}

export function TodayHud({ cells, stage, seed, onPress }: TodayHudProps) {
  const t = useTheme();
  const reduced = useReducedMotion();

  // Lead = the most-ripened category; it drives the tier word + honey bar.
  const lead = cells.reduce<HoneycombCell | null>(
    (best, c) => (best === null || c.sharpness > best.sharpness ? c : best),
    null,
  );
  const tier = lead?.tier ?? 'Raw';
  const band = tierBandProgress(lead?.sharpness ?? 0);
  // Fraction filled toward the next tier; a capped (Honest) comb reads full.
  const fillPct = band.total > 0 ? Math.round((band.done / band.total) * 100) : 100;

  const variant = `stage-${stage}` as BeeVariant;

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingVertical: t.space[3],
    paddingHorizontal: t.space[4],
  };
  const tierLabel: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };
  const track: ViewStyle = {
    height: t.progress.track,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    overflow: 'hidden',
  };
  const fill: ViewStyle = {
    height: '100%',
    width: `${fillPct}%`,
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.full,
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!reduced) scale.set(withTiming(0.98, { duration: t.motion.press }));
      }}
      onPressOut={() => {
        if (!reduced) scale.set(withSpring(1, t.motion.spring));
      }}
      accessibilityRole="button"
      accessibilityLabel={`Whenbee — honey tier ${tier}. Tap to open your honeycomb.`}
    >
      <Animated.View style={[card, pressStyle]}>
        <BeeMascot size={t.companion.hudBee} variant={variant} seed={seed} animated />
        <View style={{ flex: 1, gap: t.space[1.5] }}>
          <Text style={tierLabel}>{tier}</Text>
          <View style={track}>
            <View style={fill} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/components/honeycomb/__tests__/TodayHud.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `npx eslint src/theme/tokens.ts src/components/honeycomb/TodayHud.tsx src/components/honeycomb/__tests__/TodayHud.test.tsx`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/theme/tokens.ts src/components/honeycomb/TodayHud.tsx src/components/honeycomb/__tests__/TodayHud.test.tsx
git commit -m "feat(today): add TodayHud companion + honey bar HUD"
```

---

## Task 3: TodayEmptyState component

**Files:**
- Create: `src/features/today/TodayEmptyState.tsx`
- Test: `src/features/today/__tests__/TodayEmptyState.test.tsx`

**Interfaces:**
- Consumes: `formatReclaim` from `@/src/engine`; `AppButton` from `@/src/components/AppButton`; `RetroLogChip` from `./RetroLogChip` (Task 1).
- Produces: `TodayEmptyState({ variant, reclaimLifetimeMin, onPrimary, onLog }: { variant: 'first-run' | 'daily'; reclaimLifetimeMin: number; onPrimary: () => void; onLog: () => void })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/today/__tests__/TodayEmptyState.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TodayEmptyState } from '@/src/features/today/TodayEmptyState';

describe('TodayEmptyState', () => {
  it('renders first-run copy and fires the primary CTA', () => {
    const onPrimary = jest.fn();
    render(
      <TodayEmptyState variant="first-run" reclaimLifetimeMin={0} onPrimary={onPrimary} onLog={() => {}} />,
    );
    expect(screen.getByText('Time your first task')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "That's all it takes for Whenbee to start learning your real numbers, the ones you can plan around.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/reclaimed so far/)).toBeNull();
    fireEvent.press(screen.getByText('Start now'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('renders daily copy with the lifetime reclaim line and fires log', () => {
    const onLog = jest.fn();
    render(
      <TodayEmptyState variant="daily" reclaimLifetimeMin={860} onPrimary={() => {}} onLog={onLog} />,
    );
    expect(screen.getByText('Nothing on yet')).toBeOnTheScreen();
    expect(screen.getByText("What's on today?")).toBeOnTheScreen();
    expect(screen.getByText('14h 20m reclaimed so far')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Or log something you finished'));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it('hides the reclaim line on a daily day with nothing banked', () => {
    render(<TodayEmptyState variant="daily" reclaimLifetimeMin={0} onPrimary={() => {}} onLog={() => {}} />);
    expect(screen.queryByText(/reclaimed so far/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/today/__tests__/TodayEmptyState.test.tsx`
Expected: FAIL — cannot find module `TodayEmptyState`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/today/TodayEmptyState.tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatReclaim } from '@/src/engine';
import { RetroLogChip } from './RetroLogChip';

// ──────────────────────────────────────────────────────────────────────────────
// TodayEmptyState — the body when nothing is tracked today. Two variants:
//   • first-run  — the user has never logged. One job: reach the first log fast.
//   • daily      — a returning user with an empty day. No guilt; a gentle plan
//                  invite, plus the lifetime reclaim as quiet proof.
// The companion presence lives in TodayHud above; this body stays calm + actionable.
// All copy is verbatim from the spec copy deck (no em dashes, no guilt language).
// ──────────────────────────────────────────────────────────────────────────────

interface TodayEmptyStateProps {
  variant: 'first-run' | 'daily';
  /** Lifetime minutes reclaimed; the proof line shows only on the daily variant when ≥ 1. */
  reclaimLifetimeMin: number;
  /** Primary CTA — start the first task (first-run) / plan a task (daily). */
  onPrimary: () => void;
  /** Secondary chip — open the retro-log flow. */
  onLog: () => void;
}

export function TodayEmptyState({ variant, reclaimLifetimeMin, onPrimary, onLog }: TodayEmptyStateProps) {
  const t = useTheme();
  const isFirstRun = variant === 'first-run';

  const lead = isFirstRun ? 'Time your first task' : "What's on today?";
  const sub = isFirstRun
    ? "That's all it takes for Whenbee to start learning your real numbers, the ones you can plan around."
    : "Add a task and I'll show its honest finish, plus whether the day actually fits.";
  const primaryLabel = isFirstRun ? 'Start now' : 'Plan a task';
  const chipLabel = isFirstRun ? 'Already finished something? Log it' : 'Or log something you finished';
  const showReclaim = !isFirstRun && reclaimLifetimeMin >= 1;

  const block: ViewStyle = { alignItems: 'center', gap: t.space[2], marginTop: t.space[8] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const leadText: TextStyle = {
    ...(type.subtitle as unknown as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
  };
  const subText: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };
  const reclaimRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
    marginTop: t.space[3],
  };
  const reclaimText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.amberText };

  return (
    <View style={{ gap: t.space[4] }}>
      <View style={block}>
        {isFirstRun ? null : <Text style={eyebrow}>Nothing on yet</Text>}
        <Text style={leadText}>{lead}</Text>
        <Text style={subText}>{sub}</Text>
      </View>

      <AppButton label={primaryLabel} variant="indigo" fullWidth onPress={onPrimary} />

      {showReclaim ? (
        <View style={reclaimRow}>
          <Ionicons name="sparkles-outline" size={t.iconSize.sm} color={t.colors.accent} />
          <Text style={reclaimText}>{formatReclaim(reclaimLifetimeMin)} reclaimed so far</Text>
        </View>
      ) : null}

      <RetroLogChip label={chipLabel} onPress={onLog} />
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/today/__tests__/TodayEmptyState.test.tsx`
Expected: PASS (all three).

- [ ] **Step 5: Lint**

Run: `npx eslint src/features/today/TodayEmptyState.tsx src/features/today/__tests__/TodayEmptyState.test.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/today/TodayEmptyState.tsx src/features/today/__tests__/TodayEmptyState.test.tsx
git commit -m "feat(today): add first-run + daily empty state"
```

---

## Task 4: Extend useToday with companion presence + lifetime reclaim

**Files:**
- Modify: `src/features/today/useToday.ts`
- Test: `src/features/today/__tests__/useToday.test.tsx`

**Interfaces:**
- Consumes: `useCalibrationStore` selector `loadReclaimSummary: () => Promise<ReclaimSummary>` (existing); `CompanionStage` from `@/src/engine`.
- Produces: extends `UseTodayResult` with `companionStage: CompanionStage`, `companionSeed: number`, `reclaimLifetimeMin: number`, `hasEverLogged: boolean`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/today/__tests__/useToday.test.tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { useToday } from '@/src/features/today/useToday';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

function summary(over: Partial<{ lifetimeMin: number; lifetimeNectar: number; stage: number; seed: number }>) {
  return {
    lifetimeMin: over.lifetimeMin ?? 0,
    byCategory: [],
    biggestArea: null,
    honestLogCount: 0,
    discoveryCount: 0,
    companion: {
      stage: over.stage ?? 1,
      capability: 'finish_time',
      keeper: false,
      lifetimeNectar: over.lifetimeNectar ?? 0,
      driftHealth: 'settled',
      seed: over.seed ?? 1,
      name: null,
    },
  };
}

beforeEach(() => {
  useTasksStore.setState({ tasks: [] });
  useCalibrationStore.setState({
    statsByCategory: {},
    hydrate: async () => {},
    loadTodayReclaimMin: async () => 0,
    loadReclaimSummary: async () => summary({ lifetimeMin: 0, lifetimeNectar: 0 }),
  });
});

describe('useToday companion + reclaim', () => {
  it('reports a first-run user (no lifetime nectar)', async () => {
    const { result } = renderHook(() => useToday());
    await waitFor(() => expect(result.current.hasEverLogged).toBe(false));
    expect(result.current.reclaimLifetimeMin).toBe(0);
  });

  it('reports a returning user with lifetime reclaim + stage', async () => {
    useCalibrationStore.setState({
      loadReclaimSummary: async () => summary({ lifetimeMin: 860, lifetimeNectar: 12, stage: 3, seed: 7 }),
    });
    const { result } = renderHook(() => useToday());
    await waitFor(() => expect(result.current.hasEverLogged).toBe(true));
    expect(result.current.reclaimLifetimeMin).toBe(860);
    expect(result.current.companionStage).toBe(3);
    expect(result.current.companionSeed).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/today/__tests__/useToday.test.tsx`
Expected: FAIL — `hasEverLogged` is undefined.

- [ ] **Step 3: Add the imports + state**

In `src/features/today/useToday.ts`, add `useState` is already imported; add `CompanionStage` to the engine import and add the new selector + state. Change the engine import line:

```ts
import { resolveSuggestion, priorFor, CATEGORY_NAMES, type CompanionStage } from '@/src/engine';
```

Add the selector near the other store selectors (after `loadTodayReclaimMin`):

```ts
  const loadReclaimSummary = useCalibrationStore((s) => s.loadReclaimSummary);
```

Add state after `const [todayReclaimMin, setTodayReclaimMin] = useState(0);`:

```ts
  const [companionStage, setCompanionStage] = useState<CompanionStage>(1);
  const [companionSeed, setCompanionSeed] = useState(1);
  const [reclaimLifetimeMin, setReclaimLifetimeMin] = useState(0);
  const [lifetimeNectar, setLifetimeNectar] = useState(0);
```

- [ ] **Step 4: Load the summary on focus**

Add a second `useFocusEffect` right after the existing reclaim-loading one:

```ts
  // Companion presence + lifetime reclaim drive the HUD bee and the daily-empty
  // proof line. Re-read on focus so a fresh deposit / tier-up shows on return.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadReclaimSummary().then((s) => {
        if (!active) return;
        setCompanionStage(s.companion.stage);
        setCompanionSeed(s.companion.seed);
        setReclaimLifetimeMin(s.lifetimeMin);
        setLifetimeNectar(s.companion.lifetimeNectar);
      });
      return () => {
        active = false;
      };
    }, [loadReclaimSummary]),
  );
```

- [ ] **Step 5: Extend the result type + return**

Add to the `UseTodayResult` interface:

```ts
  /** The companion's current stage (1..6) — drives the HUD bee. */
  companionStage: CompanionStage;
  /** The companion's procedural seed — drives the HUD bee's stripe warmth. */
  companionSeed: number;
  /** Lifetime minutes reclaimed — the daily-empty proof line (hidden when < 1). */
  reclaimLifetimeMin: number;
  /** True once the user has ever logged — picks first-run vs daily empty copy. */
  hasEverLogged: boolean;
```

Change the return statement to:

```ts
  return {
    focus,
    summary,
    upNext,
    done,
    totalCount: tasks.length,
    categoryName,
    todayReclaimMin,
    companionStage,
    companionSeed,
    reclaimLifetimeMin,
    hasEverLogged: lifetimeNectar > 0,
  };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/features/today/__tests__/useToday.test.tsx`
Expected: PASS (both).

- [ ] **Step 7: Lint**

Run: `npx eslint src/features/today/useToday.ts src/features/today/__tests__/useToday.test.tsx`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/today/useToday.ts src/features/today/__tests__/useToday.test.tsx
git commit -m "feat(today): surface companion presence + lifetime reclaim from useToday"
```

---

## Task 5: Wire the Today screen

**Files:**
- Modify: `src/app/(tabs)/index.tsx`
- Test: `src/features/today/__tests__/todayScreen.test.tsx`

**Interfaces:**
- Consumes: `TodayHud` (Task 2), `TodayEmptyState` (Task 3), `RetroLogChip` (Task 1), and the extended `useToday` (Task 4).

- [ ] **Step 1: Rewrite the screen test for all states**

Replace the entire contents of `src/features/today/__tests__/todayScreen.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react-native';
import Today from '@/src/app/(tabs)/index';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

const T0 = 1_700_000_000_000;

function summary(over: Partial<{ lifetimeMin: number; lifetimeNectar: number; stage: number }>) {
  return {
    lifetimeMin: over.lifetimeMin ?? 0,
    byCategory: [],
    biggestArea: null,
    honestLogCount: 0,
    discoveryCount: 0,
    companion: {
      stage: over.stage ?? 1,
      capability: 'finish_time',
      keeper: false,
      lifetimeNectar: over.lifetimeNectar ?? 0,
      driftHealth: 'settled',
      seed: 1,
      name: null,
    },
  };
}

beforeEach(() => {
  useTasksStore.setState({ tasks: [] });
  useCalibrationStore.setState({
    logs: 0,
    statsByCategory: {},
    hydrate: async () => {},
    loadTodayReclaimMin: async () => 0,
    loadReclaimSummary: async () => summary({ lifetimeMin: 0, lifetimeNectar: 0 }),
  });
});

describe('Today screen', () => {
  it('shows the first-run empty state when the user has never logged', async () => {
    render(<Today />);
    expect(await screen.findByText('Time your first task')).toBeOnTheScreen();
  });

  it('shows the daily empty state + lifetime reclaim for a returning user', async () => {
    useCalibrationStore.setState({
      loadReclaimSummary: async () => summary({ lifetimeMin: 860, lifetimeNectar: 12, stage: 2 }),
    });
    render(<Today />);
    expect(await screen.findByText("What's on today?")).toBeOnTheScreen();
    expect(screen.getByText('14h 20m reclaimed so far')).toBeOnTheScreen();
  });

  it('renders the focus card plan total + guess→plan gap for a focus task', () => {
    useCalibrationStore.setState({
      statsByCategory: {
        getting_ready: { mEffective: 2.0, n: 8, sharpness: 70, tier: 'Ripening' },
      },
    });
    useTasksStore
      .getState()
      .addTask({ label: 'Leave for work', category: 'getting_ready', guessMin: 15, nowMs: T0 });

    render(<Today />);

    expect(screen.getByText('Leave for work')).toBeOnTheScreen();
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('guessed 15 min')).toBeOnTheScreen();
    expect(screen.getByText('+15 min')).toBeOnTheScreen();
    // No empty-state copy when a task is present.
    expect(screen.queryByText('Time your first task')).toBeNull();
    expect(screen.queryByText("What's on today?")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx`
Expected: FAIL — old screen renders the legacy "Nothing tracked yet today…" copy; new copy not found.

- [ ] **Step 3: Update the imports in `index.tsx`**

Remove the `HoneycombStrip` import and the `HoneycombCell` type import is still needed. Replace:

```ts
import { HoneycombStrip } from '@/src/components/honeycomb/HoneycombStrip';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';
```

with:

```ts
import { TodayHud } from '@/src/components/honeycomb/TodayHud';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';
import { TodayEmptyState } from '@/src/features/today/TodayEmptyState';
import { RetroLogChip } from '@/src/features/today/RetroLogChip';
```

- [ ] **Step 4: Destructure the new hook fields**

Change the `useToday()` destructure line to add the new fields:

```ts
  const {
    focus,
    summary,
    upNext,
    done,
    totalCount,
    categoryName,
    todayReclaimMin,
    companionStage,
    companionSeed,
    reclaimLifetimeMin,
    hasEverLogged,
  } = useToday();
```

- [ ] **Step 5: Delete the now-unused styles**

Remove the `logChip`, `logChipText`, and `emptyCopy` style consts (the chip moves to `RetroLogChip`; the empty copy moves to `TodayEmptyState`). Keep `sectionLabel`.

- [ ] **Step 6: Swap the HUD**

Replace the `<HoneycombStrip … />` element with:

```tsx
            <TodayHud
              cells={honeyCells}
              stage={companionStage}
              seed={companionSeed}
              onPress={() => router.push('/(tabs)/whenbee')}
            />
```

- [ ] **Step 7: Replace the body branch**

Replace the focus/empty branch block (the `isTimerRunning ? … : focus && summary ? … : totalCount === 0 ? <Text …> : null` expression) with:

```tsx
          {isTimerRunning ? (
            <RunningFocusCard categoryName={categoryName} />
          ) : focus && summary ? (
            <FocusCard
              category={focus.category}
              categoryLabel={categoryName(focus.category)}
              taskTitle={focus.label}
              summary={summary}
              onStart={() =>
                router.push({
                  pathname: '/(modals)/timer',
                  params: {
                    taskId: focus.id,
                    label: focus.label,
                    category: focus.category,
                    estimateMin: summary.honestMinutes,
                    guessMin: focus.guessMin,
                  },
                })
              }
            />
          ) : totalCount === 0 ? (
            <TodayEmptyState
              variant={hasEverLogged ? 'daily' : 'first-run'}
              reclaimLifetimeMin={reclaimLifetimeMin}
              onPrimary={() => {
                haptics.light();
                router.push('/(modals)/add-task');
              }}
              onLog={() => router.push('/(modals)/retro')}
            />
          ) : null}
```

- [ ] **Step 8: Replace the bottom retro chip**

Replace the bottom `<Pressable … style={logChip}>…</Pressable>` block with the shared chip, shown only when the empty state is NOT being rendered (the empty state carries its own chip):

```tsx
          {totalCount === 0 && !isTimerRunning ? null : (
            <RetroLogChip
              label="Finished something? Log it — it ripens your honey"
              onPress={() => router.push('/(modals)/retro')}
            />
          )}
```

- [ ] **Step 9: Run the screen test to verify it passes**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx`
Expected: PASS (all three).

- [ ] **Step 10: Full verification**

Run: `npx eslint src/app/\(tabs\)/index.tsx && npm run typecheck && npm test`
Expected: eslint clean, `tsc --noEmit` clean, all Jest suites pass.

- [ ] **Step 11: Commit**

```bash
git add src/app/\(tabs\)/index.tsx src/features/today/__tests__/todayScreen.test.tsx
git commit -m "feat(today): redesign Today across first-run, daily, populated, running"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** HUD (Task 2), first-run + daily copy (Task 3), populated/running reuse existing `FocusCard`/`RunningFocusCard` (Task 5 wiring), Reclaim line reads `ReclaimSummary.lifetimeMin` already built (Task 4). Running keeps the inline ring + reopens the modal via `RunningFocusCard.reopen` (unchanged).
- **`HoneycombStrip` is intentionally left in the repo** — only its *Today usage* is replaced. If no other caller exists after this change, removing it can be a separate cleanup; do not delete it as part of these tasks.
- **Type consistency:** `companionStage`/`companionSeed`/`reclaimLifetimeMin`/`hasEverLogged` are named identically in `useToday` (Task 4) and consumed in `index.tsx` (Task 5). `TodayHud` props (`cells`, `stage`, `seed`, `onPress`) match the call site.
- **No new motion magic numbers:** TodayHud press uses `motion.press`/`motion.spring`; the bee's float/glow come from `BeeMascot` + `companion` tokens; honey-bar fill is a static monotonic percentage (the bee carries the life), avoiding reanimated width-percentage pitfalls.
