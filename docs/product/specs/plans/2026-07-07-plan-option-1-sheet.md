# Plan Option 1 — Plan is a Sheet You Pull Up (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Today's List/Timeline segmented control into a list-only screen whose plan is summoned as a formSheet (`(modals)/plan.tsx`) and glanced at via a pinned `PlanStrip`, so planning is an explicit act the user asked for — never a silent side effect of flipping a view.

**Architecture:** The plan surface moves off Today into a summoned formSheet. Today becomes list-only and gains a compact `PlanStrip` status row (shown once a plan exists for the day) that reopens the sheet. The sheet composes the already-self-contained `DayTimeline` (reads `useDayPlan` internally, returns `null` when empty/!Pro) plus the shared `PlanReminderChip` and a ghost "Done". `handlePlanMyDay` stops driving `dayTasksStore.viewMode` and instead `router.push('/(modals)/plan')` after `markPlanned` + the existing calendar-export wire. The `viewMode` store field stays (other code/tests read it) but Today no longer drives it.

**Tech Stack:** React Native (Expo SDK 54), expo-router 6 (typed routes, root-stack formSheet), Zustand (`dayTasksStore`, `settingsStore`), Reanimated (press scale only), theme tokens (`src/theme/tokens.ts`), Jest + `@testing-library/react-native`.

## Global Constraints

- Every color/spacing/size/font value comes from a token in `src/theme/tokens.ts` via `useTheme()`. No raw hex or number literals.
- `npm run lint` must pass at `--max-warnings=0`; `npm run typecheck` clean (`strict`, `noUncheckedIndexedAccess`).
- Run the affected jest suite + `npm test` before each commit.
- Conventional Commits. **No** `Co-Authored-By` / AI-attribution trailers (project HARD RULE).
- No guilt/shame copy. Honey/sharpness monotonic. Core loop stays on-device.
- Animation HARD RULE: no bounce/overshoot/slide-in on content; switch settles, entrances fade; reduced-motion → final state.
- reactCompiler gotcha: `Pressable` stays a bare touch wrapper; visual + press animation on an inner `Animated.View`; reanimated shared values via `.get()/.set()`.

### Assumed already built (shared foundation — consume, do NOT re-plan)

From `docs/product/specs/plans/2026-07-07-plan-foundation.md`:

- `PlanReminderChip({ startByClock }: { startByClock: string | null })` — `src/features/today/PlanReminderChip.tsx`. Self-contained; renders `null` when `startByClock` is `null`; on = amber, off = quiet; tap toggles the plan-owned `startByEnabled` (permission-aware).
- `useStartByToggle(): { enabled: boolean; toggle: (next: boolean) => Promise<boolean> }` — `src/features/today/useStartByToggle.ts`.
- `settingsStore.startByEnabled: boolean` is decoupled from the reminders master and defaults **off**.

### Project structure facts confirmed against the current code

- **Modal routes are registered on the ROOT stack in `src/app/_layout.tsx`** — there is NO `src/app/(modals)/_layout.tsx`. The shared `sheet` options object (`useSheetScreenOptions`) already sets `presentation: 'formSheet'`, `headerShown: false`, `sheetAllowedDetents: [0.95]`, and the side-gutter `contentStyle: { …, paddingHorizontal: t.space[5] }`. The formSheet anchor is the root `export const unstable_settings = { initialRouteName: '(tabs)' }`. So a new modal route is registered by adding one `<Stack.Screen name="(modals)/plan" options={sheet} />` line — that single line satisfies both the modal HARD RULE (`headerShown:false`) and the modal-anchor-required rule.
- `PlanResult.startBy` is a **top-level epoch-ms field** (`src/domain/types.ts`): `interface PlanResult { startBy: number; timeline; verdict; totalMin }`. Format it with `formatClockMeridiem(plan.startBy)`.
- `useDayPlan()` returns `{ plan: PlanResult | null; status: 'empty' | 'ready'; doneByMin: number | null; setDoneBy }`.
- `dayTasksStore.dayMeta` is `{ doneByMin: number | null; planComputedAt: number | null } | null`; `dayMeta.planComputedAt != null` means a plan was computed for the selected day.
- `src/lib/time.ts` exports `formatClockMeridiem(epochMs)`, `startOfLocalDay(nowMs)`, `formatClockMin(min)`.

---

### Task 1: `(modals)/plan.tsx` — the summoned plan sheet + route registration

**Files:**
- Create: `src/app/(modals)/plan.tsx`
- Modify: `src/app/_layout.tsx` (add one `<Stack.Screen>` line after the `(modals)/timer` line, ~line 167)
- Test: `src/app/(modals)/__tests__/plan.test.tsx`

**Interfaces:**
- Consumes: `useDayPlan()` (`{ plan, status, doneByMin, setDoneBy }`); `DayTimeline` (`() => JSX | null`); `PlanReminderChip({ startByClock: string | null })`; `formatClockMeridiem(epochMs: number): string`; `Screen`, `SheetGrabber`, `AppButton`, `AppText`; `router.back()`.
- Produces: default export `PlanRoute()` — a formSheet screen. Registered as route `'(modals)/plan'`, opened via `router.push('/(modals)/plan')`.

- [ ] **Step 1: Write the failing test.**

```tsx
// src/app/(modals)/__tests__/plan.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import PlanRoute from '@/src/app/(modals)/plan';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import type { PlanResult } from '@/src/domain/types';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

// DayTimeline pulls the native calendar + engine planner — stub it to a marker.
jest.mock('@/src/features/today/DayTimeline', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { DayTimeline: () => React.createElement(Text, { testID: 'day-timeline-root' }, 'DayTimeline') };
});

// PlanReminderChip is exercised in its own foundation test — here we only need to
// see which clock the sheet handed it.
jest.mock('@/src/features/today/PlanReminderChip', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlanReminderChip: ({ startByClock }: { startByClock: string | null }) =>
      React.createElement(Text, { testID: 'plan-reminder-chip' }, startByClock ?? 'no-clock'),
  };
});

jest.mock('@/src/features/today/useDayPlan');
const mockUseDayPlan = jest.mocked(useDayPlan);

function makePlan(startBy: number): PlanResult {
  return { startBy, timeline: [], verdict: { kind: 'fits', startBy }, totalMin: 60 };
}

afterEach(() => jest.clearAllMocks());

describe('(modals)/plan', () => {
  it('renders the title, the timeline, and the reminder chip with the start-by clock', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime(); // 12:35 PM local
    mockUseDayPlan.mockReturnValue({ plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    expect(screen.getByText("Today's plan")).toBeOnTheScreen();
    expect(screen.getByTestId('day-timeline-root')).toBeOnTheScreen();
    expect(screen.getByTestId('plan-reminder-chip')).toHaveTextContent('12:35pm');
  });

  it('passes a null clock to the chip when there is no plan yet', () => {
    mockUseDayPlan.mockReturnValue({ plan: null, status: 'empty', doneByMin: null, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    expect(screen.getByTestId('plan-reminder-chip')).toHaveTextContent('no-clock');
  });

  it('dismisses on Done', () => {
    mockUseDayPlan.mockReturnValue({ plan: makePlan(Date.now()), status: 'ready', doneByMin: null, setDoneBy: jest.fn() });
    render(<PlanRoute />);
    fireEvent.press(screen.getByText('Done'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `npx jest "src/app/(modals)/__tests__/plan.test.tsx"`
Expected: FAIL — `Cannot find module '@/src/app/(modals)/plan'`.

- [ ] **Step 3: Create the route.** Full formSheet screen — `headerShown:false` comes from the root `sheet` options; gutters come from the native `contentStyle` (so `Screen` gets `horizontalPadding={false}` and `edges={['left','right']}`); the `minHeight` anchor stops react-native-screens collapsing the `flex:1` column. `Done` is a ghost button (the screen has no filled primary — the sheet is a viewer, not a form).

```tsx
// src/app/(modals)/plan.tsx
import { View, useWindowDimensions, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { DayTimeline } from '@/src/features/today/DayTimeline';
import { PlanReminderChip } from '@/src/features/today/PlanReminderChip';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { formatClockMeridiem } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// Plan sheet (Option 1) — the day plan the user summoned, fully contained. It
// composes the self-contained DayTimeline (start-by header, timeline rows, done-by
// chip) with the shared PlanReminderChip and a Done affordance. No white native
// header (root `sheet` options), grabber on top, side gutters from the sheet's
// native contentStyle. Dismiss returns to Today.
// ──────────────────────────────────────────────────────────────────────────────

export default function PlanRoute() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  // DayTimeline re-reads the plan itself; we read it here only to hand the chip
  // the start-by clock (epoch → the user's meridiem format).
  const { plan } = useDayPlan();
  const startByClock = plan ? formatClockMeridiem(plan.startBy) : null;

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };

  return (
    // Sheet host already sits below the status bar — no top inset (avoids a gap on
    // Android). Gutters come from the native contentStyle → horizontalPadding={false}.
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      {/* react-native-screens' formSheet collapses a flex:1 child to its content
          height, floating pinned controls mid-sheet with dead space below. Anchor
          the column to the sheet's 0.95 detent so DayTimeline fills and Done pins. */}
      <View style={{ flex: 1, minHeight: winH * 0.95 - insets.bottom }}>
        <SheetGrabber />

        <View style={{ paddingTop: t.space[2], paddingBottom: t.space[3] }}>
          <AppText style={heading}>Today&apos;s plan</AppText>
        </View>

        {/* DayTimeline owns its own scroll + start-by/done-by header; it returns
            null when the day has no plan or the user isn't Pro. */}
        <View style={{ flex: 1 }}>
          <DayTimeline />
        </View>

        {/* Reminder control + dismiss, pinned above the home indicator. */}
        <View style={{ paddingTop: t.space[3], paddingBottom: insets.bottom + t.space[3], gap: t.space[3] }}>
          <PlanReminderChip startByClock={startByClock} />
          <AppButton label="Done" variant="ghost" fullWidth onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 4: Register the route on the root stack.** In `src/app/_layout.tsx`, add the plan screen immediately after the `(modals)/timer` line (~line 167), reusing the shared `sheet` options (which already carry `headerShown:false`; the anchor is the file-level `unstable_settings = { initialRouteName: '(tabs)' }`).

```tsx
      <Stack.Screen name="(modals)/timer" options={sheet} />
      <Stack.Screen name="(modals)/plan" options={sheet} />
```

- [ ] **Step 5: Run the test, verify it passes.**

Run: `npx jest "src/app/(modals)/__tests__/plan.test.tsx"`
Expected: PASS (3 tests).

- [ ] **Step 6: Lint + typecheck.**

Run: `npx eslint "src/app/(modals)/plan.tsx" "src/app/_layout.tsx" && npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit.**

```bash
git add "src/app/(modals)/plan.tsx" "src/app/_layout.tsx" "src/app/(modals)/__tests__/plan.test.tsx"
git commit -m "feat(plan): add summoned plan formSheet route composing DayTimeline + reminder chip"
```

---

### Task 2: `PlanStrip` — the pinned Today status strip

**Files:**
- Create: `src/features/today/PlanStrip.tsx`
- Test: `src/features/today/__tests__/PlanStrip.test.tsx`

**Interfaces:**
- Consumes: `useTheme()`; `haptics`; `Ionicons`; Reanimated (`useSharedValue`, `useAnimatedStyle`, `withTiming`).
- Produces: `PlanStrip({ startByClock, doneByClock, reminderOn, onPress }: { startByClock: string; doneByClock: string | null; reminderOn: boolean; onPress: () => void })`. A compact `testID="plan-strip"` status row: "Start by {clock} · 🔔 {nudge on|off} · done by {clock}" + a trailing chevron. Bare `Pressable` wrapper, visual on inner `Animated.View`, no bounce.

- [ ] **Step 1: Write the failing test.**

```tsx
// src/features/today/__tests__/PlanStrip.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PlanStrip } from '@/src/features/today/PlanStrip';

describe('PlanStrip', () => {
  it('shows start-by, an on-nudge segment, and done-by', () => {
    render(<PlanStrip startByClock="12:35pm" doneByClock="1:00pm" reminderOn onPress={() => {}} />);
    expect(screen.getByText('Start by 12:35pm')).toBeOnTheScreen();
    expect(screen.getByText('nudge on')).toBeOnTheScreen();
    expect(screen.getByText('done by 1:00pm')).toBeOnTheScreen();
  });

  it('shows an off-nudge segment and omits done-by when null', () => {
    render(<PlanStrip startByClock="12:35pm" doneByClock={null} reminderOn={false} onPress={() => {}} />);
    expect(screen.getByText('nudge off')).toBeOnTheScreen();
    expect(screen.queryByText(/done by/)).toBeNull();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<PlanStrip startByClock="12:35pm" doneByClock={null} reminderOn onPress={onPress} />);
    fireEvent.press(screen.getByTestId('plan-strip'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `npx jest src/features/today/__tests__/PlanStrip.test.tsx`
Expected: FAIL — `Cannot find module '@/src/features/today/PlanStrip'`.

- [ ] **Step 3: Implement the component.** Flat surface + 1px hairline (no shadow); one spacing source per axis (`gap`, no per-child margins); chevron optically centered via `alignItems:'center'`; press scale via `withTiming` (no overshoot). Reminder icon fills only when on.

```tsx
// src/features/today/PlanStrip.tsx
// PlanStrip — the pinned "you have a plan" status row on Today. Glanceable: start-by
// clock, live nudge state, done-by target, chevron. Tapping reopens the plan sheet.
// It is NOT a primary CTA (the + FAB owns the one filled action) — a quiet hairline
// surface. reactCompiler gotcha: Pressable is a bare touch wrapper; the visual + press
// scale live on the inner Animated.View (shared value via .get()/.set()). No bounce.

import { useCallback } from 'react';
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';

interface PlanStripProps {
  /** Start-by clock in the user's meridiem format, e.g. "12:35pm". */
  startByClock: string;
  /** Done-by target clock, or null when the user hasn't set one. */
  doneByClock: string | null;
  /** Whether the start-by nudge is currently on (reflects settingsStore.startByEnabled). */
  reminderOn: boolean;
  /** Reopen the plan sheet. */
  onPress: () => void;
}

export function PlanStrip({ startByClock, doneByClock, reminderOn, onPress }: PlanStripProps) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const onPressIn = useCallback(
    () => scale.set(withTiming(t.scale.pressIn, { duration: t.motion.press })),
    [scale, t.scale.pressIn, t.motion.press],
  );
  const onPressOut = useCallback(
    () => scale.set(withTiming(1, { duration: t.motion.press })),
    [scale, t.motion.press],
  );
  const handlePress = useCallback(() => {
    haptics.light();
    onPress();
  }, [onPress]);

  const stripStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
    minHeight: t.size.control.sm,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2],
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
  };
  const strongText: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.ink,
    fontFamily: t.fontFamily.ui,
  };
  const softText: TextStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    fontFamily: t.fontFamily.ui,
  };
  const dot: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkFaint };

  const a11yLabel =
    `Today's plan. Start by ${startByClock}. Reminder ${reminderOn ? 'on' : 'off'}.` +
    (doneByClock ? ` Done by ${doneByClock}.` : '') +
    ' Tap to open.';

  return (
    <Pressable
      testID="plan-strip"
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      hitSlop={4}
    >
      <Animated.View style={[stripStyle, aStyle]}>
        <Ionicons name="map-outline" size={t.iconSize.sm} color={t.colors.primary} />
        <Text style={strongText}>Start by {startByClock}</Text>
        <Text style={dot}>·</Text>
        <Ionicons
          name={reminderOn ? 'notifications' : 'notifications-outline'}
          size={t.iconSize.xs}
          color={reminderOn ? t.colors.primary : t.colors.inkSoft}
        />
        <Text style={softText}>{reminderOn ? 'nudge on' : 'nudge off'}</Text>
        {doneByClock ? (
          <>
            <Text style={dot}>·</Text>
            <Text style={softText}>done by {doneByClock}</Text>
          </>
        ) : null}
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes.**

Run: `npx jest src/features/today/__tests__/PlanStrip.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + typecheck.**

Run: `npx eslint src/features/today/PlanStrip.tsx && npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit.**

```bash
git add src/features/today/PlanStrip.tsx src/features/today/__tests__/PlanStrip.test.tsx
git commit -m "feat(plan): add PlanStrip pinned Today status row"
```

---

### Task 3: Make Today list-only — remove the toggle/timeline branch, wire PlanStrip + summon the sheet

**Files:**
- Modify: `src/app/(tabs)/index.tsx`
- Test: `src/features/today/__tests__/todayPlanEntry.test.tsx` (new)

**Interfaces:**
- Consumes: `PlanStrip` (Task 2); `PlanMyDayButton` (existing — reused as the single "Plan my day" secondary); `useDayPlan()` (`{ plan, status }`); `dayTasksStore.dayMeta`, `markPlanned`; `settingsStore.startByEnabled`; `formatClockMeridiem`, `startOfLocalDay` (`src/lib/time`); `router.push`.
- Produces: Today renders no segmented control and no inline `DayTimeline`. When the selected day has tasks: a `PlanStrip` if a plan exists (`dayMeta.planComputedAt != null && status === 'ready'`), else a single `PlanMyDayButton`. `handlePlanMyDay` pushes `/(modals)/plan` (Pro) after `markPlanned` + export wire, or the paywall (`trigger: 'plan_my_day'`) for free users.

- [ ] **Step 1: Write the failing test (new file).** A focused Today harness with a configurable `useDayPlan` mock (the existing `todayScreen.test.tsx` hard-codes an empty plan, so a separate file avoids touching its shared mock).

```tsx
// src/features/today/__tests__/todayPlanEntry.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import Today from '@/src/app/(tabs)/index';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useDayCapacity } from '@/src/features/today/useDayCapacity';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import type { DayTask } from '@/src/engine/daySelectors';
import type { PlanResult } from '@/src/domain/types';
import { toLocalDayKey } from '@/src/lib/day';

const FIXED_NOW = new Date(2026, 5, 24, 12, 0, 0).getTime(); // local 2026-06-24 noon
const FIXED_TODAY = toLocalDayKey(FIXED_NOW);
beforeAll(() => { jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW); });
afterAll(() => { (Date.now as jest.Mock).mockRestore(); });

// Native-pulling children stubbed so the screen test stays on plan-entry wiring.
jest.mock('@/src/features/today/calendarStrip/CalendarStrip', () => ({ CalendarStrip: () => null }));
jest.mock('@/src/features/planner/useLearnedFocusWindow', () => ({
  useLearnedFocusWindow: () => ({
    startMin: 540, endMin: 690, basis: 'prior' as const,
    confidence: 0.3, scoreByBin: new Array(38).fill(0.3), sampleCount: 0, distinctDays: 0, held: false,
  }),
}));
jest.mock('@/src/features/today/useDayCapacity');
const mockUseDayCapacity = jest.mocked(useDayCapacity);
jest.mock('@/src/features/today/useDayPlan');
const mockUseDayPlan = jest.mocked(useDayPlan);
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({ isFocused: () => true, addListener: () => () => {} }),
}));

const T0 = 1_700_000_000_000;
function makeQueued(id: string): DayTask {
  return {
    id, label: 'Leave for work', category: 'getting_ready', guessMin: 15,
    status: 'queued', plannedDate: FIXED_TODAY, orderIndex: T0, doneByMin: null,
    createdAt: T0, completedAt: null, actualMin: null, fromRoutineId: null,
    calendarEventId: null, carriedFrom: null,
  };
}
function makePlan(startBy: number): PlanResult {
  return { startBy, timeline: [], verdict: { kind: 'fits', startBy }, totalMin: 60 };
}

beforeEach(() => {
  jest.clearAllMocks();
  useEntitlement.setState({ isPro: false });
  useSettingsStore.setState({ startByEnabled: true });
  mockUseDayCapacity.mockReturnValue({ status: 'off', load: undefined as never, events: [], allDayEvents: [], isPro: false });
  mockUseDayPlan.mockReturnValue({ plan: null, status: 'empty', doneByMin: null, setDoneBy: jest.fn() });
  useDayTasksStore.setState({
    dayTasks: [], shelfTasks: [], selectedDate: FIXED_TODAY, dayMeta: null,
    selectFocusTask: () => null, loadShelf: async () => {}, markPlanned: jest.fn(async () => {}),
  });
  useCalibrationStore.setState({
    logs: 0, statsByCategory: {}, hydrate: async () => {},
    loadReclaimSummary: async () => ({
      lifetimeMin: 0, byCategory: [], biggestArea: null, honestLogCount: 0, discoveryCount: 0,
      companion: { stage: 2, capability: 'finish_time' as never, keeper: false, lifetimeNectar: 0, driftHealth: 'settled', seed: 1, name: null },
    } as never),
  });
});

describe('Today plan entry (Option 1)', () => {
  it('shows the PlanStrip and no segmented control once a plan exists', () => {
    const startBy = new Date(2026, 5, 24, 12, 35, 0).getTime();
    useDayTasksStore.setState({ dayTasks: [makeQueued('a')], dayMeta: { doneByMin: 780, planComputedAt: FIXED_NOW } });
    mockUseDayPlan.mockReturnValue({ plan: makePlan(startBy), status: 'ready', doneByMin: 780, setDoneBy: jest.fn() });
    render(<Today />);
    expect(screen.getByText('Start by 12:35pm')).toBeOnTheScreen();
    expect(screen.getByText('done by 1:00pm')).toBeOnTheScreen();
    expect(screen.queryByTestId('view-toggle-timeline')).toBeNull();
    expect(screen.queryByTestId('view-toggle-list')).toBeNull();
  });

  it('shows a single Plan my day button (no strip) when tasks exist but no plan yet', () => {
    useDayTasksStore.setState({ dayTasks: [makeQueued('b')], dayMeta: null });
    render(<Today />);
    expect(screen.getByTestId('plan-my-day-btn')).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-strip')).toBeNull();
    expect(screen.queryByTestId('view-toggle-timeline')).toBeNull();
  });

  it('routes a free user to the paywall on Plan my day', () => {
    useEntitlement.setState({ isPro: false });
    useDayTasksStore.setState({ dayTasks: [makeQueued('c')], dayMeta: null });
    render(<Today />);
    fireEvent.press(screen.getByTestId('plan-my-day-btn'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/(modals)/paywall', params: { trigger: 'plan_my_day' } });
  });

  it('marks planned and opens the plan sheet for a Pro user', () => {
    const markPlanned = jest.fn(async () => {});
    useEntitlement.setState({ isPro: true });
    useDayTasksStore.setState({ dayTasks: [makeQueued('d')], dayMeta: null, markPlanned });
    render(<Today />);
    fireEvent.press(screen.getByTestId('plan-my-day-btn'));
    expect(markPlanned).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/(modals)/plan');
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `npx jest src/features/today/__tests__/todayPlanEntry.test.tsx`
Expected: FAIL — the segmented control still renders (`view-toggle-timeline` found) and there is no `plan-strip`.

- [ ] **Step 3: Delete the `ViewToggle` component + interface.** Remove the entire block in `src/app/(tabs)/index.tsx` from the `// ViewToggle — segmented List ⇄ Timeline control` banner through the end of the `ViewToggle` function (currently lines ~70–150), including `interface ViewToggleProps`. Nothing else references them after the later edits.

- [ ] **Step 4: Fix imports.** In `src/app/(tabs)/index.tsx`:
  - Remove `useRef` from the react import (line 2) — it is only used by the deleted reset effect. New line 2:

```tsx
import { useState, useCallback, useEffect } from 'react';
```

  - Remove the `DayTimeline` import (line 47) — Today no longer renders it (the sheet does).
  - Add `PlanStrip` and extend the `time` import with `startOfLocalDay`:

```tsx
import { PlanStrip } from '@/src/features/today/PlanStrip';
```

```tsx
import { projectedFinish, formatClockMeridiem, startOfLocalDay } from '@/src/lib/time';
```

- [ ] **Step 5: Drop `viewMode` wiring + the reset effect; add plan-entry reads.** In the `Today()` body:
  - Remove `const viewMode = useDayTasksStore((s) => s.viewMode);` and `const setViewMode = useDayTasksStore((s) => s.setViewMode);` (lines ~166–167). Keep `markPlanned`.
  - Add reads for the plan-entry decision:

```tsx
  const dayMeta = useDayTasksStore((s) => s.dayMeta);
  const reminderOn = useSettingsStore((s) => s.startByEnabled);
```

  - Remove the whole "Reset to List whenever the selected day changes" effect (lines ~180–188, the `prevSelectedDate` ref + `useEffect`).
  - Change the plan read to also take `status`:

```tsx
  // Day plan — read here for the plan-entry strip + the export wire. DayTimeline
  // re-reads it inside the sheet.
  const { plan: dayPlan, status: planStatus } = useDayPlan();
```

- [ ] **Step 6: Rewrite `handlePlanMyDay` to summon the sheet.** Replace the existing `handlePlanMyDay` (lines ~236–273) with:

```tsx
  // "Plan my day" — Pro feature. Free users → paywall. Pro users: stamp
  // planComputedAt, run the calendar-export wire (guarded), then open the plan
  // sheet. Today itself never flips a view — the plan is a thing the user summoned.
  const handlePlanMyDay = useCallback(() => {
    haptics.light();
    if (!isPro) {
      router.push({ pathname: '/(modals)/paywall', params: { trigger: 'plan_my_day' } });
      return;
    }
    void markPlanned();

    // Export wire (C1 / B2): when calendar export is on, push the computed timed
    // plan to the Whenbee calendar. The store action is fully guarded (isExpoGo +
    // Pro + exportEnabled + whenbeeCalendarId), so this is safe to call
    // unconditionally — a no-op when any guard fails.
    if (dayPlan !== null) {
      const { exportEnabled } = useSettingsStore.getState().calendar;
      if (exportEnabled) {
        const currentDayTasks = useDayTasksStore.getState().dayTasks;
        const calEventIdByTaskId = new Map(
          currentDayTasks.map((task) => [task.id, task.calendarEventId ?? null]),
        );
        const timedTasks = dayPlan.timeline
          .filter((item) => item.kind === 'task')
          .map((item) => ({
            id: item.id,
            label: item.label,
            startMs: item.startAt,
            endMs: item.endAt,
            calendarEventId: calEventIdByTaskId.get(item.id) ?? null,
          }));
        void useDayTasksStore.getState().syncExportForSelectedDay(timedTasks);
      }
    }

    router.push('/(modals)/plan');
  }, [isPro, markPlanned, dayPlan]);
```

- [ ] **Step 7: Delete the now-unused view handlers.** Remove `handleViewSelect` (lines ~277–283) and `handleTimelineGated` (lines ~286–289) — the paywall gate now lives in `handlePlanMyDay`, and there is no view to select.

- [ ] **Step 8: Derive the plan-entry values just before the `return`.** Add these near the other derived values (e.g. right after `const lead = leadHoney(shownCells);`):

```tsx
  // Plan entry: a plan exists for the selected day when it was computed AND the
  // engine currently resolves a ready plan. The strip mirrors its glanceable state.
  const hasPlan = dayMeta?.planComputedAt != null && planStatus === 'ready';
  const doneByClock =
    dayPlan && dayMeta?.doneByMin != null
      ? formatClockMeridiem(startOfLocalDay(Date.now()) + dayMeta.doneByMin * 60_000)
      : null;
```

- [ ] **Step 9: Replace the control-row + timeline/list branch.** Replace the whole `{!isPastDay ? ( … ) : null}` block (currently lines ~534–632) with the list-only body below. The plan entry is the strip when a plan exists, else a single secondary "Plan my day" button; the list body always renders (no more Timeline lens).

```tsx
          {/* Plan entry + day body — only on today/future days. Past days use
              DayRecapCard above and never show the planner. */}
          {!isPastDay ? (
            <>
              {/* Plan entry: once the day has tasks, either the glanceable PlanStrip
                  (a plan exists → tap to reopen the sheet) or a single secondary
                  "Plan my day" action. There's nothing to plan on an empty day. */}
              {totalCount > 0 ? (
                hasPlan && dayPlan ? (
                  <PlanStrip
                    startByClock={formatClockMeridiem(dayPlan.startBy)}
                    doneByClock={doneByClock}
                    reminderOn={reminderOn}
                    onPress={() => {
                      haptics.light();
                      router.push('/(modals)/plan');
                    }}
                  />
                ) : (
                  <PlanMyDayButton onPress={handlePlanMyDay} isPro={isPro} label="Plan my day" />
                )
              ) : null}

              {/* List body — the task list + calendar overlay (the only lens now). */}
              <Animated.View entering={FadeIn.duration(t.motion.base)}>
                {/* Scheduled routine blocks — Pro, derived read (no DB rows). */}
                {isPro && scheduledRoutineBlocks.length > 0 ? (
                  <View style={{ gap: t.space[2], marginBottom: t.space[2] }}>
                    <Text style={sectionLabel}>{"TODAY'S ROUTINES"}</Text>
                    {scheduledRoutineBlocks.map((block) => (
                      <ScheduledRoutineBlock key={block.routineId} block={block} />
                    ))}
                  </View>
                ) : null}

                {upNext.length > 0 ? (
                  <View style={{ gap: t.space[2] }}>
                    <Text style={sectionLabel}>UP NEXT</Text>
                    {upNext.map((row, idx) => (
                      <TaskRow
                        key={row.id}
                        title={row.label}
                        categoryLabel={row.categoryLabel}
                        guessMin={row.guessMin}
                        honestMin={row.honestMin}
                        carriedFrom={row.carriedFrom}
                        onPress={() => startRow(row)}
                        onDelete={() => deleteTask(row.id)}
                        onLongPress={() => promptRowActions(row.id, row.label)}
                        onMove={() => void useDayTasksStore.getState().moveToTomorrow(row.id)}
                        peekHint={peekFirstRow && idx === 0}
                        onPeeked={markSwipeHintSeen}
                        isExiting={deletingId === row.id}
                      />
                    ))}
                  </View>
                ) : null}

                {/* Read-only calendar overlay — Pro + showEvents only (cap returns []
                    for free users). Sits above Done so finished work reads last. */}
                <CalendarOverlaySection
                  events={cap.events}
                  allDayEvents={cap.allDayEvents}
                />

                {done.length > 0 ? (
                  <DoneSection
                    rows={done}
                    deletingId={deletingId}
                    onDelete={deleteTask}
                    onLongPress={promptRowActions}
                    showCoachMark={showCoachMark}
                    onCoachMarkDismiss={dismissCoachMark}
                  />
                ) : null}
              </Animated.View>
            </>
          ) : null}
```

- [ ] **Step 10: Run the new test, verify it passes.**

Run: `npx jest src/features/today/__tests__/todayPlanEntry.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 11: Run the existing Today suite — catch stale `viewMode`/toggle assertions.**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx`
Expected: PASS. If any test asserts the segmented control (`view-toggle-*`), the Timeline lens, or `viewMode` transitions on Today, update it to the list-only + PlanStrip model (those behaviors moved to the sheet). Do NOT re-add the toggle. Re-run until green.

- [ ] **Step 12: Lint + typecheck.**

Run: `npx eslint "src/app/(tabs)/index.tsx" && npm run typecheck`
Expected: clean (no unused `useRef`/`DayTimeline`/`ViewToggle`/`handleViewSelect`/`handleTimelineGated`).

- [ ] **Step 13: Full suite.**

Run: `npm test`
Expected: PASS. Investigate any failure that reads `dayTasksStore.viewMode` from Today — the field remains in the store (unchanged), so store/other-consumer tests should be unaffected.

- [ ] **Step 14: Commit.**

```bash
git add "src/app/(tabs)/index.tsx" src/features/today/__tests__/todayPlanEntry.test.tsx
git commit -m "feat(today): make Today list-only, summon the plan as a sheet with a pinned PlanStrip"
```

---

## Self-Review

**1. Spec coverage (§5 Option 1):**
- §5.2 new route `(modals)/plan.tsx` (formSheet, `headerShown:false`, `SheetGrabber`, root-contentStyle gutters, `minHeight` anchor, reuses `DayTimeline` + `PlanReminderChip` + Done, registered with the anchor) → Task 1. (Registration is in the root `_layout.tsx`, not a `(modals)/_layout.tsx`, which does not exist — documented in Global Constraints; the shared `sheet` options + root `unstable_settings` supply `headerShown:false` and the `'(tabs)'` anchor.)
- §5.2 new `PlanStrip.tsx` pinned status strip → Task 2.
- §5.2 `index.tsx`: remove `ViewToggle` + timeline branch (list-only), add `PlanStrip` when `dayMeta.planComputedAt != null` & plan ready, `handlePlanMyDay` → `router.push('/(modals)/plan')` after `markPlanned` + export wire, Pro-gate `trigger:'plan_my_day'`, single secondary "Plan my day" when no plan → Task 3.
- §5.2 keep `viewMode` field, stop driving it from Today → Task 3 (reads removed; store field untouched).
- §5.3 acceptance (no segmented control; tap opens sheet; strip reopens; chip inside sheet; formSheet rules; shared §2.4) → covered by Task 1 tests (title/timeline/chip/Done), Task 2 tests (strip segments + press), Task 3 tests (no toggle, strip present, paywall gate, sheet push). Shared §2.4 belongs to the foundation plan (consumed, not re-tested here).

**2. Placeholder scan:** none. Every step has concrete code or an exact command. The one conditional step (Task 3 Step 11) names the exact change to make if a legacy assertion is hit, not a vague "fix as needed".

**3. Type consistency:**
- `PlanStrip` prop names/types (`startByClock: string`, `doneByClock: string | null`, `reminderOn: boolean`, `onPress: () => void`) match the Task 3 call site and the Task 2 tests.
- `useDayPlan()` destructured as `{ plan, status }` in both `plan.tsx` and `index.tsx`; `PlanResult.startBy` (top-level epoch) is what `formatClockMeridiem` receives everywhere — matches `src/domain/types.ts`.
- `PlanReminderChip({ startByClock })` (foundation) is called with `string | null` in `plan.tsx` — matches the pinned signature.
- `dayMeta` shape `{ doneByMin: number | null; planComputedAt: number | null }` matches `dayTasksStore`; `hasPlan` guards on `planComputedAt != null` and `planStatus === 'ready'`.
- `handlePlanMyDay` deps `[isPro, markPlanned, dayPlan]` — `setViewMode` removed from both body and deps; export-wire map param renamed `task` (was `t`) so it no longer shadows the theme `t`.
- Removed symbols (`ViewToggle`, `ViewToggleProps`, `useRef`, `DayTimeline` import, `handleViewSelect`, `handleTimelineGated`, `viewMode`/`setViewMode` reads) have no remaining references after Task 3.
