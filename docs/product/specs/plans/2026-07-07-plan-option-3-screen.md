# Plan Option 3 — "Plan is its own screen you visit" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "Plan my day" into a deliberate, self-contained ritual: a dedicated full-screen route (`(modals)/plan.tsx`) that opens with a one-time consent setup step, then shows the day timeline + reminder chip — while Today drops the List/Timeline segmented control and instead carries a single "Plan my day" entry that becomes a live status card after planning.

**Architecture:** Builds on the already-landed shared foundation (`2026-07-07-plan-foundation.md`) — `useStartByToggle`, `PlanReminderChip`, and the decoupled `startByEnabled` opt-in. This plan adds three UI pieces (a consent step, an entry card, a full-screen route) and rewires Today to be list-only. No engine, store, or service changes: `useDayPlan`, `markPlanned`, and the export wire are all consumed as-is. The first-run gate is a single kv flag (`plan.setupSeen`).

**Tech Stack:** React Native (Expo SDK 54), expo-router 6 (typed routes, modal on the root stack), Zustand (`settingsStore`, `dayTasksStore`, `useEntitlement`), Reanimated (press scale only), theme tokens (`src/theme/tokens.ts`), `expo-calendar` via `src/services/calendar`, Jest + `@testing-library/react-native`.

## Global Constraints

- Every color/spacing/size/font value comes from a token in `src/theme/tokens.ts` via `useTheme()`. No raw hex or number literals.
- `npm run lint` must pass at `--max-warnings=0`; `npm run typecheck` clean (`strict`, `noUncheckedIndexedAccess`).
- Run the affected jest suite + `npm test` before each commit.
- Conventional Commits. **No** `Co-Authored-By` / AI-attribution trailers (project HARD RULE).
- No guilt/shame copy. Honey/sharpness monotonic. Core loop stays on-device.
- Animation HARD RULE: no bounce/overshoot/slide-in on content; switch settles, entrances fade; reduced-motion → final state.
- reactCompiler gotcha: `Pressable` stays a bare touch wrapper; visual + press animation on an inner `Animated.View`; reanimated shared values via `.get()/.set()`.

### Additional constraints for this plan

- **Modal HARD RULES:** the new route MUST be registered on the ROOT stack (`src/app/_layout.tsx`) with `headerShown: false`; the root already sets `unstable_settings = { initialRouteName: '(tabs)' }` (the required `'(tabs)'` anchor) so no per-route anchor is needed. The plan screen renders its OWN title with `type.subtitle` + `t.colors.ink` (never a native header). It is a `fullScreenModal` (a screen you *visit*, per Option 3) — not a slide-up sheet — so it does NOT use `<SheetGrabber />`.
- **Layer boundaries (ESLint-enforced):** `src/app/**` (the route) must NOT import `@/src/services/*` or `@/src/db/*` — route only through hooks/components/lib. `src/features/**` (the two components) MAY import services (`PlanSetupStep` reads `@/src/services/calendar`).
- **Pinned shared interfaces (from the foundation — consume, do not re-plan):**
  - `PlanReminderChip({ startByClock }: { startByClock: string | null })` — `src/features/today/PlanReminderChip.tsx`. Renders `null` when `startByClock` is null.
  - `useStartByToggle(): { enabled: boolean; toggle: (next: boolean) => Promise<boolean> }` — `src/features/today/useStartByToggle.ts`.
  - `useDayPlan(): { plan: PlanResult | null; status; doneByMin; setDoneBy }` — `src/features/today/useDayPlan.ts`. `PlanResult.startBy` is a top-level epoch-ms `number`; format via `formatClockMeridiem(plan.startBy)` (`src/lib/time.ts`).

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/features/today/PlanSetupStep.tsx` (new) | First-run two-toggle consent step (calendar + start-by nudge), both off, ValueStack-style rows | 1 |
| `src/features/today/PlanEntryCard.tsx` (new) | Today's entry: plain "Plan my day" CTA before planning → live status card after | 2 |
| `src/app/(modals)/plan.tsx` (new) | Full-screen route: first-run setup gate → plan body (`DayTimeline` + `PlanReminderChip` + "Looks good") | 3 |
| `src/app/_layout.tsx` (modify) | Register the `(modals)/plan` screen on the root stack | 3 |
| `src/app/(tabs)/index.tsx` (modify) | Remove `ViewToggle` + timeline branch; render `PlanEntryCard`; `handlePlanMyDay` → `router.push('/(modals)/plan')` | 4 |
| `src/features/today/__tests__/todayScreen.test.tsx` (modify) | Replace toggle/timeline tests with entry-card + Pro-gate tests | 4 |

---

### Task 1: `PlanSetupStep` — the first-run consent step

**Files:**
- Create: `src/features/today/PlanSetupStep.tsx`
- Test: `src/features/today/__tests__/PlanSetupStep.test.tsx`

**Interfaces:**
- Consumes: `useSettingsStore` (`calendar.showEvents`, `setShowEvents`), `useStartByToggle()` (Task 2 of the foundation), `getCalendar()` from `@/src/services/calendar` (`requestReadAccess(): Promise<boolean>`), `useTheme()`, `type` typography, `AppText`, `AppButton`, `Ionicons`, RN `Switch`.
- Produces: `PlanSetupStep({ onContinue }: { onContinue: () => void })`. Two rows, both OFF by default. Calendar row: enabling calls `requestReadAccess()` and flips `showEvents` only if granted; disabling flips it off. Reminder row: `toggle(next)`. "Continue" calls `onContinue`.

- [ ] **Step 1: Write the failing test.** Mock `useStartByToggle` and `@/src/services/calendar`; use the real `settingsStore`.

```tsx
import { render, fireEvent, act } from '@testing-library/react-native';
import { PlanSetupStep } from '../PlanSetupStep';
import { useStartByToggle } from '../useStartByToggle';
import { getCalendar } from '@/src/services/calendar';
import { useSettingsStore } from '@/src/stores/settingsStore';

jest.mock('../useStartByToggle');
jest.mock('@/src/services/calendar');

const mockToggle = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({
    calendar: { showEvents: false, enabledCalendarIds: [], exportEnabled: false, whenbeeCalendarId: null },
  });
  (useStartByToggle as jest.Mock).mockReturnValue({ enabled: false, toggle: mockToggle });
  (getCalendar as jest.Mock).mockReturnValue({ requestReadAccess: jest.fn().mockResolvedValue(true) });
});

it('renders both consent rows and a Continue button, both toggles off', () => {
  const { getByText, getByTestId } = render(<PlanSetupStep onContinue={jest.fn()} />);
  expect(getByText("Read today's calendar")).toBeTruthy();
  expect(getByText('Nudge me when to start')).toBeTruthy();
  expect(getByTestId('plan-setup-calendar').props.value).toBe(false);
  expect(getByTestId('plan-setup-reminder').props.value).toBe(false);
});

it('enabling the calendar row requests read access, then flips showEvents', async () => {
  const { getByTestId } = render(<PlanSetupStep onContinue={jest.fn()} />);
  await act(async () => {
    fireEvent(getByTestId('plan-setup-calendar'), 'valueChange', true);
  });
  expect(getCalendar().requestReadAccess).toHaveBeenCalled();
  expect(useSettingsStore.getState().calendar.showEvents).toBe(true);
});

it('leaves showEvents off when calendar permission is denied', async () => {
  (getCalendar as jest.Mock).mockReturnValue({ requestReadAccess: jest.fn().mockResolvedValue(false) });
  const { getByTestId } = render(<PlanSetupStep onContinue={jest.fn()} />);
  await act(async () => {
    fireEvent(getByTestId('plan-setup-calendar'), 'valueChange', true);
  });
  expect(useSettingsStore.getState().calendar.showEvents).toBe(false);
});

it('enabling the reminder row calls toggle(true)', () => {
  const { getByTestId } = render(<PlanSetupStep onContinue={jest.fn()} />);
  fireEvent(getByTestId('plan-setup-reminder'), 'valueChange', true);
  expect(mockToggle).toHaveBeenCalledWith(true);
});

it('Continue calls onContinue', () => {
  const onContinue = jest.fn();
  const { getByText } = render(<PlanSetupStep onContinue={onContinue} />);
  fireEvent.press(getByText('Continue'));
  expect(onContinue).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `npx jest src/features/today/__tests__/PlanSetupStep.test.tsx`
Expected: FAIL — "Cannot find module '../PlanSetupStep'".

- [ ] **Step 3: Implement the component.** ValueStack-style rows (icon tile + title + description + trailing `Switch`). Wrap the async calendar handler at the call site so no Promise is passed where `void` is expected.

```tsx
import { useCallback } from 'react';
import { View, Switch, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { getCalendar } from '@/src/services/calendar';
import { useStartByToggle } from './useStartByToggle';

// One consent row: ValueStack icon tile + title + description + trailing Switch.
// Same visual grammar as the paywall ValueStack so the setup reads as first-class.
function ConsentRow({
  icon,
  title,
  desc,
  value,
  onValueChange,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  testID: string;
}) {
  const t = useTheme();
  const tile: ViewStyle = {
    width: t.space[8],
    height: t.space[8],
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const row: ViewStyle = { flexDirection: 'row', gap: t.space[3], alignItems: 'center' };
  const titleStyle: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Jakarta-Bold',
  };
  const descStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <View style={row}>
      <View style={tile}>
        <Ionicons name={icon} size={t.iconSize.sm} color={t.colors.primary} />
      </View>
      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <AppText style={titleStyle}>{title}</AppText>
        <AppText style={descStyle}>{desc}</AppText>
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
        accessibilityLabel={title}
      />
    </View>
  );
}

/**
 * First-run consent step for the plan screen. Names the two potentially-silent
 * behaviours (calendar read, start-by nudge) and lets the user opt into each.
 * Both default OFF. Shown once (gated by `plan.setupSeen` in the route).
 */
export function PlanSetupStep({ onContinue }: { onContinue: () => void }) {
  const t = useTheme();
  const showEvents = useSettingsStore((s) => s.calendar.showEvents);
  const setShowEvents = useSettingsStore((s) => s.setShowEvents);
  const { enabled: startByEnabled, toggle: toggleStartBy } = useStartByToggle();

  // Enabling calendar asks for READ permission at that moment; only flip the
  // setting when granted so the toggle never lies about access.
  const onToggleCalendar = useCallback(
    async (next: boolean): Promise<void> => {
      if (!next) {
        setShowEvents(false);
        return;
      }
      const granted = await getCalendar().requestReadAccess();
      if (granted) setShowEvents(true);
    },
    [setShowEvents],
  );

  const onToggleReminder = useCallback(
    (next: boolean) => {
      void toggleStartBy(next);
    },
    [toggleStartBy],
  );

  return (
    <View style={{ gap: t.space[6] }}>
      <View style={{ gap: t.space[2] }}>
        <AppText
          accessibilityRole="header"
          style={{ ...(type.subtitle as unknown as TextStyle), color: t.colors.ink }}
        >
          Before we plan
        </AppText>
        <AppText style={{ ...(type.body as unknown as TextStyle), color: t.colors.inkSoft }}>
          Two optional helpers. Both stay off unless you switch them on.
        </AppText>
      </View>

      <View style={{ gap: t.space[5] }}>
        <ConsentRow
          icon="calendar-outline"
          title="Read today's calendar"
          desc="Whenbee slots your tasks around your meetings. Read-only — it never edits your events."
          value={showEvents}
          onValueChange={(next) => {
            void onToggleCalendar(next);
          }}
          testID="plan-setup-calendar"
        />
        <ConsentRow
          icon="notifications-outline"
          title="Nudge me when to start"
          desc="One quiet ping at your start-by time. No streaks, nothing to keep up."
          value={startByEnabled}
          onValueChange={onToggleReminder}
          testID="plan-setup-reminder"
        />
      </View>

      <AppButton
        label="Continue"
        onPress={onContinue}
        fullWidth
        accessibilityLabel="Continue to your plan"
      />
    </View>
  );
}
```

- [ ] **Step 4: Run tests.**

Run: `npx jest src/features/today/__tests__/PlanSetupStep.test.tsx`
Expected: PASS (5/5).

- [ ] **Step 5: Lint the file.**

Run: `npx eslint src/features/today/PlanSetupStep.tsx`
Expected: clean (0 problems).

- [ ] **Step 6: Commit.**

```bash
git add src/features/today/PlanSetupStep.tsx src/features/today/__tests__/PlanSetupStep.test.tsx
git commit -m "feat(plan): add first-run PlanSetupStep consent step (calendar + start-by, both off)"
```

---

### Task 2: `PlanEntryCard` — Today's entry (CTA → live status card)

**Files:**
- Create: `src/features/today/PlanEntryCard.tsx`
- Test: `src/features/today/__tests__/PlanEntryCard.test.tsx`

**Interfaces:**
- Consumes: `useTheme()`, `haptics`, `AppText`, `Ionicons`, Reanimated (`useSharedValue`/`useAnimatedStyle`/`withTiming`).
- Produces: `PlanEntryCard({ hasPlan, startByClock, reminderOn, onPress }: { hasPlan: boolean; startByClock: string | null; reminderOn: boolean; onPress: () => void })`. `hasPlan=false` → a plain secondary "Plan my day" CTA (ghost). `hasPlan=true` → a live status card ("Today's plan · Start by 12:35 PM · nudge on · tap to view"). Both are a bare `Pressable` (testID `plan-entry-card`) with the visual + press-scale on an inner `Animated.View`.

- [ ] **Step 1: Write the failing test.**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PlanEntryCard } from '../PlanEntryCard';

it('shows the plain "Plan my day" CTA before planning', () => {
  const { getByText, queryByText } = render(
    <PlanEntryCard hasPlan={false} startByClock={null} reminderOn={false} onPress={jest.fn()} />,
  );
  expect(getByText('Plan my day')).toBeTruthy();
  expect(queryByText(/tap to view/)).toBeNull();
});

it('shows the live status card with the start-by clock and nudge-on state after planning', () => {
  const { getByText } = render(
    <PlanEntryCard hasPlan startByClock="12:35 PM" reminderOn onPress={jest.fn()} />,
  );
  expect(getByText("Today's plan")).toBeTruthy();
  expect(getByText('Start by 12:35 PM')).toBeTruthy();
  expect(getByText('nudge on')).toBeTruthy();
  expect(getByText('tap to view')).toBeTruthy();
});

it('reflects the nudge-off state', () => {
  const { getByText } = render(
    <PlanEntryCard hasPlan startByClock="12:35 PM" reminderOn={false} onPress={jest.fn()} />,
  );
  expect(getByText('no nudge')).toBeTruthy();
});

it('calls onPress when tapped', () => {
  const onPress = jest.fn();
  const { getByTestId } = render(
    <PlanEntryCard hasPlan={false} startByClock={null} reminderOn={false} onPress={onPress} />,
  );
  fireEvent.press(getByTestId('plan-entry-card'));
  expect(onPress).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `npx jest src/features/today/__tests__/PlanEntryCard.test.tsx`
Expected: FAIL — "Cannot find module '../PlanEntryCard'".

- [ ] **Step 3: Implement the component.** Ghost CTA reuses `PlanMyDayButton`'s press pattern; the status card is a flat sunken surface + hairline (no shadow, no bounce).

```tsx
import { useCallback } from 'react';
import { Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '@/src/lib/haptics';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';

interface PlanEntryCardProps {
  /** True once the selected day has been planned (planComputedAt stamped). */
  hasPlan: boolean;
  /** The plan's start-by time, already formatted (e.g. "12:35 PM"), or null. */
  startByClock: string | null;
  /** Whether the start-by nudge is currently armed. */
  reminderOn: boolean;
  onPress: () => void;
}

/**
 * Today's plan entry. Before a plan exists it is a quiet secondary "Plan my day"
 * CTA (the + FAB stays the single filled primary). After planning it becomes a
 * glanceable status card that doubles as at-a-glance state and reopens the plan
 * screen on tap. Bare Pressable + visual on the inner Animated.View (reactCompiler
 * gotcha); press-scale only, no bounce, no slide-in.
 */
export function PlanEntryCard({ hasPlan, startByClock, reminderOn, onPress }: PlanEntryCardProps) {
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

  if (!hasPlan) {
    const ctaStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      minHeight: t.size.control.sm,
      gap: t.space[1.5],
      paddingHorizontal: t.space[2],
      borderRadius: t.radii.full,
      borderCurve: 'continuous',
    };
    return (
      <Pressable
        testID="plan-entry-card"
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Plan my day"
        hitSlop={8}
      >
        <Animated.View style={[ctaStyle, aStyle]}>
          <Ionicons name="map-outline" size={t.iconSize.sm} color={t.colors.primary} />
          <AppText
            style={{
              fontSize: t.fontSize.sm,
              fontWeight: t.fontWeight.semibold,
              color: t.colors.primary,
              fontFamily: t.fontFamily.ui,
            }}
          >
            Plan my day
          </AppText>
        </Animated.View>
      </Pressable>
    );
  }

  const cardStyle: ViewStyle = {
    gap: t.space[1.5],
    padding: t.space[4],
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceSunken,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.hairline,
  };
  const headerRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const titleStyle: TextStyle = {
    flex: 1,
    fontSize: t.fontSize.bodySm,
    fontWeight: t.fontWeight.semibold,
    color: t.colors.ink,
    fontFamily: t.fontFamily.ui,
  };
  const statusStyle: TextStyle = { fontSize: t.fontSize.caption, color: t.colors.inkSoft };

  const startClause = startByClock !== null ? `Start by ${startByClock}` : 'Ready to start';
  const reminderClause = reminderOn ? 'nudge on' : 'no nudge';

  return (
    <Pressable
      testID="plan-entry-card"
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Today's plan. ${startClause}, ${reminderClause}. Tap to view.`}
      hitSlop={4}
    >
      <Animated.View style={[cardStyle, aStyle]}>
        <View style={headerRow}>
          <Ionicons name="map-outline" size={t.iconSize.sm} color={t.colors.primary} />
          <AppText style={titleStyle}>Today&apos;s plan</AppText>
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] }}>
          <AppText style={statusStyle}>{startClause}</AppText>
          <AppText style={statusStyle}>·</AppText>
          <Ionicons
            name={reminderOn ? 'notifications' : 'notifications-off-outline'}
            size={t.iconSize.xs}
            color={reminderOn ? t.colors.primary : t.colors.inkFaint}
          />
          <AppText style={statusStyle}>{reminderClause}</AppText>
          <AppText style={statusStyle}>·</AppText>
          <AppText style={{ ...statusStyle, color: t.colors.primary }}>tap to view</AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run tests.**

Run: `npx jest src/features/today/__tests__/PlanEntryCard.test.tsx`
Expected: PASS (4/4).

- [ ] **Step 5: Lint the file.**

Run: `npx eslint src/features/today/PlanEntryCard.tsx`
Expected: clean (0 problems).

- [ ] **Step 6: Commit.**

```bash
git add src/features/today/PlanEntryCard.tsx src/features/today/__tests__/PlanEntryCard.test.tsx
git commit -m "feat(plan): add PlanEntryCard (Plan my day CTA -> live status card)"
```

---

### Task 3: `(modals)/plan.tsx` route + root-stack registration

**Files:**
- Create: `src/app/(modals)/plan.tsx`
- Modify: `src/app/_layout.tsx` (register the screen after the `(modals)/timer` line, ~line 167)
- Test: `src/app/(modals)/__tests__/plan.test.tsx`

**Interfaces:**
- Consumes: `kv` (`@/src/lib/kv`), `useDayPlan()`, `DayTimeline`, `PlanReminderChip`, `PlanSetupStep`, `formatClockMeridiem`, `Screen`, `AppText`, `AppButton`, `useTheme`, `type`, `router`, `useSafeAreaInsets`.
- Produces: default-export `PlanScreen`. On mount: if `kv.getString('plan.setupSeen') == null` → render `<PlanSetupStep onContinue={...} />`; the `onContinue` sets `plan.setupSeen='1'` and swaps to the plan body. The plan body renders its own `type.subtitle` title + `<DayTimeline />` + `<PlanReminderChip startByClock={plan?.startBy ? formatClockMeridiem(plan.startBy) : null} />` + a "Looks good" `AppButton` that `router.back()`s.

- [ ] **Step 1: Write the failing test.** Mock the heavy children + `expo-router`; use the real `kv` (backed by the in-memory `expo-sqlite/kv-store` mock in `jest.setup.js`) and clear the flag between tests.

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import PlanScreen from '@/src/app/(modals)/plan';
import { kv } from '@/src/lib/kv';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));

jest.mock('@/src/features/today/useDayPlan', () => ({
  useDayPlan: () => ({
    plan: { startBy: new Date(2026, 0, 1, 12, 35).getTime() },
    status: 'ready' as const,
    doneByMin: null,
    setDoneBy: jest.fn(),
  }),
}));

jest.mock('@/src/features/today/DayTimeline', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { DayTimeline: () => React.createElement(Text, { testID: 'day-timeline-root' }, 'timeline') };
});

jest.mock('@/src/features/today/PlanReminderChip', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlanReminderChip: ({ startByClock }: { startByClock: string | null }) =>
      React.createElement(Text, { testID: 'plan-reminder-chip' }, String(startByClock)),
  };
});

jest.mock('@/src/features/today/PlanSetupStep', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlanSetupStep: ({ onContinue }: { onContinue: () => void }) =>
      React.createElement(
        Pressable,
        { testID: 'plan-setup-step', onPress: onContinue },
        React.createElement(Text, null, 'setup'),
      ),
  };
});

beforeEach(() => {
  kv.delete('plan.setupSeen');
  jest.clearAllMocks();
});

it('shows the setup step on first run (no plan.setupSeen flag)', () => {
  const { getByTestId, queryByTestId } = render(<PlanScreen />);
  expect(getByTestId('plan-setup-step')).toBeTruthy();
  expect(queryByTestId('day-timeline-root')).toBeNull();
});

it('continuing the setup burns the flag and reveals the plan', () => {
  const { getByTestId } = render(<PlanScreen />);
  fireEvent.press(getByTestId('plan-setup-step'));
  expect(kv.getString('plan.setupSeen')).toBe('1');
  expect(getByTestId('day-timeline-root')).toBeTruthy();
});

it('skips setup entirely when plan.setupSeen is already set', () => {
  kv.set('plan.setupSeen', '1');
  const { getByTestId, queryByTestId } = render(<PlanScreen />);
  expect(getByTestId('day-timeline-root')).toBeTruthy();
  expect(queryByTestId('plan-setup-step')).toBeNull();
});

it('passes the formatted start-by clock into the reminder chip', () => {
  kv.set('plan.setupSeen', '1');
  const { getByTestId } = render(<PlanScreen />);
  // Real formatClockMeridiem runs — assert it is a non-null clock string, not "null".
  expect(getByTestId('plan-reminder-chip').props.children).not.toBe('null');
});

it('"Looks good" routes back to today', () => {
  kv.set('plan.setupSeen', '1');
  const { getByText } = render(<PlanScreen />);
  fireEvent.press(getByText('Looks good'));
  expect(router.back).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `npx jest src/app/\(modals\)/__tests__/plan.test.tsx`
Expected: FAIL — "Cannot find module '@/src/app/(modals)/plan'".

- [ ] **Step 3: Implement the route.** Full-screen; renders its own title (no native header); no `SheetGrabber` (it is a visited screen, not a slide-up sheet).

```tsx
import { useCallback, useState } from 'react';
import { ScrollView, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { kv } from '@/src/lib/kv';
import { formatClockMeridiem } from '@/src/lib/time';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { DayTimeline } from '@/src/features/today/DayTimeline';
import { PlanReminderChip } from '@/src/features/today/PlanReminderChip';
import { PlanSetupStep } from '@/src/features/today/PlanSetupStep';

// ──────────────────────────────────────────────────────────────────────────────
// Plan route (Option 3 — a full screen you visit). First run shows a one-time
// consent setup step (calendar read + start-by nudge, both off); after that it
// opens straight into the day plan. Modal HARD RULE: headerShown:false + own
// title (type.subtitle + ink); the '(tabs)' anchor is on the root stack.
// ──────────────────────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { plan } = useDayPlan();

  // Show the plan directly once the one-time setup has been seen.
  const [showPlan, setShowPlan] = useState(() => kv.getString('plan.setupSeen') != null);

  const handleContinue = useCallback(() => {
    kv.set('plan.setupSeen', '1');
    setShowPlan(true);
  }, []);

  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const startByClock = plan?.startBy ? formatClockMeridiem(plan.startBy) : null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          gap: t.space[5],
          paddingTop: t.space[4],
          paddingBottom: insets.bottom + t.space[8],
        }}
        showsVerticalScrollIndicator={false}
      >
        {showPlan ? (
          <>
            <AppText accessibilityRole="header" style={titleStyle}>
              Your day, planned
            </AppText>
            <DayTimeline />
            <PlanReminderChip startByClock={startByClock} />
            <AppButton
              label="Looks good"
              onPress={() => router.back()}
              fullWidth
              accessibilityLabel="Done, back to today"
            />
          </>
        ) : (
          <PlanSetupStep onContinue={handleContinue} />
        )}
      </ScrollView>
    </Screen>
  );
}
```

- [ ] **Step 4: Register the route on the root stack.** In `src/app/_layout.tsx`, add the screen immediately after the `(modals)/timer` entry (~line 167), before the `(modals)/reward` line. It is a full-screen visited modal (like reward/report), so use `fullScreenModal` + `headerShown: false`:

```tsx
<Stack.Screen name="(modals)/plan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
```

The root `unstable_settings = { initialRouteName: '(tabs)' }` (lines 33–35) already supplies the required `'(tabs)'` anchor — no per-route anchor needed.

- [ ] **Step 5: Run tests.**

Run: `npx jest src/app/\(modals\)/__tests__/plan.test.tsx`
Expected: PASS (5/5).

- [ ] **Step 6: Lint + typecheck.**

Run: `npx eslint "src/app/(modals)/plan.tsx" src/app/_layout.tsx && npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit.**

```bash
git add "src/app/(modals)/plan.tsx" "src/app/(modals)/__tests__/plan.test.tsx" src/app/_layout.tsx
git commit -m "feat(plan): add full-screen plan route with one-time setup gate"
```

---

### Task 4: Rewire Today — list-only + `PlanEntryCard`, plan opens the route

**Files:**
- Modify: `src/app/(tabs)/index.tsx`
- Modify: `src/features/today/__tests__/todayScreen.test.tsx`

**Interfaces:**
- Consumes: `PlanEntryCard` (Task 2), `useDayPlan()` (already imported), `settingsStore.startByEnabled`, `dayTasksStore.dayMeta.planComputedAt`, `router.push('/(modals)/plan')`.
- Produces: Today renders no segmented control and no timeline lens; the list body is always shown. A `PlanEntryCard` sits where the toggle row was (only on today/future with `totalCount > 0`). `handlePlanMyDay` keeps the Pro gate + `markPlanned` + export wire, then `router.push('/(modals)/plan')`.

- [ ] **Step 1: Update the screen test first (red).** Rewrite the two toggle/gate `describe` blocks in `todayScreen.test.tsx`. Delete the module-level `jest.mock('@/src/features/today/DayTimeline', …)` block (Today no longer imports it). Replace the entire `describe('List ⇄ Timeline toggle (B3)', …)` and `describe('C1 — Pro gate: Plan-my-day + Timeline', …)` blocks (lines ~279–462) with:

```tsx
// ─────────────────────────────────────────────────────────────────────────────
// Plan entry card — Today is list-only; planning opens the plan route
// ─────────────────────────────────────────────────────────────────────────────

describe('Plan entry card', () => {
  function seedTodayWithTask() {
    const task = makeQueued({ id: 't1', label: 'Write tests', category: 'work', guessMin: 30 });
    useDayTasksStore.setState({
      dayTasks: [task],
      shelfTasks: [],
      selectedDate: FIXED_TODAY,
      dayMeta: null,
      selectFocusTask: () => task,
      loadShelf: async () => {},
      markPlanned: jest.fn(async () => {}),
    });
  }

  it('shows the "Plan my day" entry on today when tasks exist', () => {
    seedTodayWithTask();
    render(<Today />);
    expect(screen.getByTestId('plan-entry-card')).toBeOnTheScreen();
    expect(screen.getByText('Plan my day')).toBeOnTheScreen();
  });

  it('does NOT show the plan entry on a past day', () => {
    useDayTasksStore.setState({
      selectedDate: '2023-11-13',
      dayTasks: [],
      selectFocusTask: () => null,
      loadShelf: async () => {},
    });
    render(<Today />);
    expect(screen.queryByTestId('plan-entry-card')).toBeNull();
  });

  it('always shows the list body (UP NEXT) — there is no timeline lens on Today', () => {
    seedTodayWithTask();
    const task = makeQueued({ id: 'u1', label: 'Review PR', category: 'work', guessMin: 20 });
    useDayTasksStore.setState({ dayTasks: [task], selectFocusTask: () => null });
    render(<Today />);
    expect(screen.getByText('UP NEXT')).toBeOnTheScreen();
    expect(screen.queryByTestId('day-timeline-root')).toBeNull();
  });

  it('renders the live status card once the day is planned', () => {
    useEntitlement.setState({ isPro: true });
    seedTodayWithTask();
    useDayTasksStore.setState({ dayMeta: { doneByMin: null, planComputedAt: 123 } });
    render(<Today />);
    expect(screen.getByText("Today's plan")).toBeOnTheScreen();
  });
});

describe('C1 — Pro gate: Plan my day', () => {
  function seedTodayWithTask() {
    const task = makeQueued({ id: 'c1', label: 'Deep work block', category: 'work', guessMin: 60 });
    useDayTasksStore.setState({
      dayTasks: [task],
      shelfTasks: [],
      selectedDate: FIXED_TODAY,
      dayMeta: null,
      selectFocusTask: () => task,
      loadShelf: async () => {},
      markPlanned: jest.fn(async () => {}),
    });
  }

  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('free: tapping the entry routes to the paywall with trigger=plan_my_day', () => {
    useEntitlement.setState({ isPro: false });
    seedTodayWithTask();
    const { getByTestId } = render(<Today />);
    fireEvent.press(getByTestId('plan-entry-card'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(modals)/paywall',
      params: { trigger: 'plan_my_day' },
    });
  });

  it('free: tapping the entry does NOT open the plan route', () => {
    useEntitlement.setState({ isPro: false });
    seedTodayWithTask();
    const { getByTestId } = render(<Today />);
    fireEvent.press(getByTestId('plan-entry-card'));
    expect(router.push).not.toHaveBeenCalledWith('/(modals)/plan');
  });

  it('Pro: tapping the entry plans the day and opens the plan route', () => {
    useEntitlement.setState({ isPro: true });
    seedTodayWithTask();
    const markPlanned = jest.fn(async () => {});
    useDayTasksStore.setState({ markPlanned });
    const { getByTestId } = render(<Today />);
    fireEvent.press(getByTestId('plan-entry-card'));
    expect(markPlanned).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/(modals)/plan');
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx`
Expected: FAIL — `plan-entry-card` testID not found (Today still renders the toggle + `PlanMyDayButton`).

- [ ] **Step 3: Rewire `src/app/(tabs)/index.tsx` — imports & unused code.**

  a. Drop `useRef` from the React import (line 2):

  ```tsx
  import { useState, useCallback, useEffect } from 'react';
  ```

  b. Remove the two now-unused imports (lines 38, 47) and add `PlanEntryCard`:

  ```tsx
  // remove:  import { PlanMyDayButton } from '@/src/features/today/PlanMyDayButton';
  // remove:  import { DayTimeline } from '@/src/features/today/DayTimeline';
  import { PlanEntryCard } from '@/src/features/today/PlanEntryCard';
  ```

  c. Delete the entire `ViewToggleProps` interface + `ViewToggle` component (lines ~70–150, from the `// ViewToggle — segmented …` banner through the closing `}` of `ViewToggle`).

- [ ] **Step 4: Rewire the Today component body.**

  a. Replace the `viewMode`/`setViewMode` store reads (lines ~166–167) and add the derived plan state. Change:

  ```tsx
  const viewMode = useDayTasksStore((s) => s.viewMode);
  const setViewMode = useDayTasksStore((s) => s.setViewMode);
  const markPlanned = useDayTasksStore((s) => s.markPlanned);
  ```

  to:

  ```tsx
  const markPlanned = useDayTasksStore((s) => s.markPlanned);
  const planComputedAt = useDayTasksStore((s) => s.dayMeta?.planComputedAt ?? null);
  const startByEnabled = useSettingsStore((s) => s.startByEnabled);
  ```

  b. Delete the "reset to List whenever the selected day changes" effect + its `prevSelectedDate` ref (lines ~180–188 — the `const prevSelectedDate = useRef(...)` and the `useEffect` that calls `setViewMode('list')`).

  c. Rewrite `handlePlanMyDay` (lines ~236–273) to push the route instead of switching view mode (also rename the map param off `t` to avoid shadowing the theme):

  ```tsx
  // "Plan my day" — Pro feature. Free users are routed to the paywall.
  // Pro users: stamp planComputedAt, push the plan to the Whenbee calendar when
  // export is on (fire-and-forget, guarded inside the store), then open the
  // dedicated plan screen.
  const handlePlanMyDay = useCallback(() => {
    haptics.light();
    if (!isPro) {
      router.push({ pathname: '/(modals)/paywall', params: { trigger: 'plan_my_day' } });
      return;
    }
    void markPlanned();

    // Export wire (C1 / B2): unchanged. The store action is fully guarded
    // (isExpoGo + Pro + exportEnabled + whenbeeCalendarId) so this is a no-op
    // whenever any guard fails.
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

  d. Delete the now-unused `handleViewSelect` (lines ~277–283) and `handleTimelineGated` (lines ~286–289) callbacks.

- [ ] **Step 5: Replace the toggle/timeline JSX block.** Swap the whole `{!isPastDay ? ( … ) : null}` block (lines ~534–632) for a list-only body that carries the `PlanEntryCard`. Derive the entry props inline and route "tap to view" straight to the plan when a plan already exists:

```tsx
{/* Plan entry + day body — only on today/future days. Past days use
    DayRecapCard above and never show the planner. Today is list-only:
    planning happens on the dedicated plan screen, not a segmented lens. */}
{!isPastDay ? (
  <>
    {totalCount > 0 ? (
      <PlanEntryCard
        hasPlan={planComputedAt !== null}
        startByClock={dayPlan?.startBy ? formatClockMeridiem(dayPlan.startBy) : null}
        reminderOn={startByEnabled}
        onPress={
          planComputedAt !== null
            ? () => {
                haptics.light();
                router.push('/(modals)/plan');
              }
            : handlePlanMyDay
        }
      />
    ) : null}

    <Animated.View entering={FadeIn.duration(t.motion.base)}>
      {/* Scheduled routine blocks — Pro, today/future only. */}
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

      {/* Read-only calendar overlay — Pro + showEvents only. */}
      <CalendarOverlaySection events={cap.events} allDayEvents={cap.allDayEvents} />

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

- [ ] **Step 6: Run the screen suite.**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx`
Expected: PASS.

- [ ] **Step 7: Lint + typecheck.**

Run: `npx eslint "src/app/(tabs)/index.tsx" src/features/today/__tests__/todayScreen.test.tsx && npm run typecheck`
Expected: clean. (If `PlanMyDayButton.tsx` is now imported nowhere, that is fine — it stays in the tree unused; do not delete it in this task.)

- [ ] **Step 8: Full suite.**

Run: `npm test`
Expected: PASS (green across the repo — the `useDayPlan`/`DayTimeline` mocks in `todayScreen.test.tsx` were updated in Step 1).

- [ ] **Step 9: Commit.**

```bash
git add "src/app/(tabs)/index.tsx" src/features/today/__tests__/todayScreen.test.tsx
git commit -m "feat(today): drop List/Timeline toggle for a Plan my day entry that opens the plan screen"
```

---

## Manual verification (device/sim — do before opening the PR)

The reminder + calendar consent are behaviour the tests can only stub. Verify on the sim per the CLAUDE.md deep-link flow:

1. Fresh state (or `kv.delete('plan.setupSeen')` via a rebuild): add a task, tap **Plan my day** (as Pro). Confirm the **setup step** appears with both toggles OFF.
2. Toggle **Read today's calendar** ON → the OS calendar-permission prompt fires at that moment; toggle **Nudge me when to start** ON → the notification-permission prompt fires. Tap **Continue** → the timeline + `PlanReminderChip` render.
3. Back on Today the entry is now the **live status card** ("Today's plan · Start by … · nudge on · tap to view"); tapping it reopens the plan screen and the setup step does NOT show again.
4. Confirm **no** start-by notification is scheduled unless the chip/setup reminder was turned on (verify via the notification dump path — never claim it works without observing it).
5. Confirm the plan screen shows **no white native header** (modal HARD RULE) and the "Looks good" button returns to Today.

---

## Self-Review

**1. Spec coverage (§6 of `2026-07-07-plan-surface-redesign.md`):**
- §6.1 dedicated full screen + first-run setup step (calendar + start-by, both off, "Continue", `plan.setupSeen`, ValueStack styling) → Task 1 + Task 3.
- §6.1 re-entry: Today's "Plan my day" becomes a live status card; loop is Today ⇄ Plan screen; Today never mutates behind the user → Task 2 + Task 4.
- §6.2 files: `(modals)/plan.tsx` (Task 3), `PlanSetupStep.tsx` (Task 1), `PlanEntryCard.tsx` (Task 2), `index.tsx` rewire (Task 4), `plan.setupSeen` via `kv.ts` (Task 3), shared foundation consumed (Tasks 1/3).
- §6.3 acceptance: first-run setup both-off + once-only (Task 3 test) ✓; calendar toggle flips `showEvents` + requests permission at that moment, reminder toggle flips `startByEnabled` + requests permission (Task 1 test, via `useStartByToggle`) ✓; live status card + tap-to-reopen (Task 2 + Task 4 tests) ✓; modal HARD RULES (own title, no header, anchor) (Task 3) ✓; shared §2.4 held by the foundation (not re-planned here) ✓.

**2. Placeholder scan:** none. Every code step has complete real code; every run step has an exact command + expected result. No "TODO"/"handle edge cases"/"similar to above".

**3. Type consistency:**
- `PlanSetupStep({ onContinue }: { onContinue: () => void })` produced in Task 1, consumed identically in Task 3.
- `PlanEntryCard({ hasPlan, startByClock, reminderOn, onPress })` produced in Task 2, consumed with exactly those props in Task 4.
- `useStartByToggle()` returns `{ enabled, toggle }` (foundation) — Task 1 destructures those names.
- `PlanReminderChip({ startByClock })` (foundation) — Task 3 passes `startByClock` string|null.
- `useDayPlan()` → `plan.startBy: number` (verified in `src/domain/types.ts` — `PlanResult.startBy`) — `plan?.startBy ? formatClockMeridiem(plan.startBy) : null` used consistently in Task 3 and Task 4.
- `dayMeta.planComputedAt: number | null` (verified in `dayTasksStore.ts`) — `planComputedAt !== null` drives `hasPlan` in Task 4 and the seeded test state.
- `settingsStore.setShowEvents(v: boolean)` + `calendar.showEvents` and `startByEnabled` — names match the store (Task 1, Task 4).
- Route string `'/(modals)/plan'` matches the registered `Stack.Screen name="(modals)/plan"` (Task 3) and the `router.push` target (Task 4).

## Execution Handoff

**Plan complete and saved to `docs/product/specs/plans/2026-07-07-plan-option-3-screen.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

This is the Option-3 worktree (`feat/plan-screen`), which branches off the foundation commit (after the foundation plan's Task 4). Confirm the foundation (`useStartByToggle`, `PlanReminderChip`, decoupled `startByEnabled`) is present before starting Task 1. Open a PR at the end — **never merge** (founder reviews rendered screenshots + device verification and merges by hand).
