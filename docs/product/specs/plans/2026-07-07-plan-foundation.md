# Plan-surface Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the start-by reminder into a plan-owned opt-in and add the shared `PlanReminderChip` + `useStartByToggle`, so every surface direction (Options 1/2/3) reuses one honest reminder control.

**Architecture:** Start-by stops being nested under the global `remindersEnabled` master; it becomes gated by `startByEnabled` alone (default `false`). A self-contained chip reads/writes that flag through a permission-aware toggle hook that mirrors the existing `useReminderSetting`. No UI surface decisions live here — this is the shared base Options 1/2/3 branch from.

**Tech Stack:** React Native (Expo SDK 54), Zustand (`settingsStore`), `expo-notifications` (via `src/services/timerNotifications.ts`), Reanimated, theme tokens (`src/theme/tokens.ts`), Jest.

## Global Constraints

- Every color/spacing/size/font value comes from a token in `src/theme/tokens.ts` via `useTheme()`. No raw hex or number literals.
- `npm run lint` must pass at `--max-warnings=0`; `npm run typecheck` clean (`strict`, `noUncheckedIndexedAccess`).
- Run the affected jest suite + `npm test` before each commit.
- Conventional Commits. **No** `Co-Authored-By` / AI-attribution trailers (project HARD RULE).
- No guilt/shame copy. Honey/sharpness monotonic. Core loop stays on-device.
- Animation HARD RULE: no bounce/overshoot/slide-in on content; switch settles, entrances fade; reduced-motion → final state.
- reactCompiler gotcha: `Pressable` stays a bare touch wrapper; visual + press animation on an inner `Animated.View`; reanimated shared values via `.get()/.set()`.

---

### Task 1: Decouple the start-by gate + flip the default

**Files:**
- Modify: `src/stores/settingsStore.ts` (init `startByEnabled: true` → `false`, line ~150; reset block `startByEnabled: true` → `false`, line ~232)
- Modify: `src/features/today/useStartByReminder.ts` (drop the `remindersEnabled` read line ~25; change gate line ~29; update the header comment lines ~18–22)
- Test: `src/features/today/__tests__/useStartByReminder.test.ts` (existing — extend/adjust)

**Interfaces:**
- Consumes: `settingsStore.startByEnabled: boolean`, `settingsStore.setStartByEnabled(v: boolean)`.
- Produces: `useStartByReminder(plan: PlanResult | null): void` now schedules iff `startByEnabled` is true (independent of `remindersEnabled`).

- [ ] **Step 1: Adjust the failing test first.** In `useStartByReminder.test.ts`, set the scenario that previously required `remindersEnabled=true` to use only `startByEnabled=true`, and add a case asserting that with `remindersEnabled=false, startByEnabled=true` a start-by **is** scheduled (previously it wasn't). Example assertion body:

```ts
it('schedules start-by on startByEnabled alone, ignoring the master', () => {
  useSettingsStore.setState({ remindersEnabled: false, startByEnabled: true });
  renderHook(() => useStartByReminder(planWithFutureStartBy));
  expect(scheduleStartBy).toHaveBeenCalledTimes(1);
});

it('does not schedule when startByEnabled is false even if master is on', () => {
  useSettingsStore.setState({ remindersEnabled: true, startByEnabled: false });
  renderHook(() => useStartByReminder(planWithFutureStartBy));
  expect(scheduleStartBy).not.toHaveBeenCalled();
  expect(cancelStartBy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it, verify it fails.** `npx jest src/features/today/__tests__/useStartByReminder.test.ts` → FAIL (gate still reads the master).

- [ ] **Step 3: Change the gate.** In `useStartByReminder.ts` remove `const remindersEnabled = useSettingsStore((s) => s.remindersEnabled);` and change:

```ts
const enabled = startByEnabled;
```

Update the header comment: replace the "Opt-in twice over: master `remindersEnabled` … AND … `startByEnabled`" paragraph with: "Opt-in via `startByEnabled` alone (default off) — the plan surface owns this reminder; the global reminders master no longer gates it."

- [ ] **Step 4: Flip the defaults.** In `settingsStore.ts` set `startByEnabled: false` in both the initial state (~line 150) and the reset block (~line 232).

- [ ] **Step 5: Run tests.** `npx jest src/features/today/__tests__/useStartByReminder.test.ts` → PASS. Then `npx jest src/stores` → PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/stores/settingsStore.ts src/features/today/useStartByReminder.ts src/features/today/__tests__/useStartByReminder.test.ts
git commit -m "feat(reminders): decouple start-by nudge into a plan-owned opt-in (default off)"
```

---

### Task 2: `useStartByToggle` — permission-aware toggle hook

**Files:**
- Create: `src/features/today/useStartByToggle.ts`
- Test: `src/features/today/__tests__/useStartByToggle.test.ts`

**Interfaces:**
- Consumes: `ensureNotificationPermission()`, `cancelStartBy()` from `src/services/timerNotifications`; `settingsStore.startByEnabled`, `setStartByEnabled`; `analytics.capture`.
- Produces: `useStartByToggle(): { enabled: boolean; toggle: (next: boolean) => Promise<boolean> }`. `toggle(true)` requests permission, returns `false` (leaving the flag off) if denied; `toggle(false)` clears the flag and cancels any scheduled start-by. Returns the resulting effective state.

- [ ] **Step 1: Write the failing test.** Mock `timerNotifications` (`ensureNotificationPermission`, `cancelStartBy`) and `analytics`.

```ts
it('enables only when permission is granted', async () => {
  (ensureNotificationPermission as jest.Mock).mockResolvedValue(true);
  const { result } = renderHook(() => useStartByToggle());
  await act(async () => { expect(await result.current.toggle(true)).toBe(true); });
  expect(useSettingsStore.getState().startByEnabled).toBe(true);
});

it('stays off when permission is denied', async () => {
  (ensureNotificationPermission as jest.Mock).mockResolvedValue(false);
  const { result } = renderHook(() => useStartByToggle());
  await act(async () => { expect(await result.current.toggle(true)).toBe(false); });
  expect(useSettingsStore.getState().startByEnabled).toBe(false);
});

it('disabling cancels the scheduled nudge', async () => {
  useSettingsStore.setState({ startByEnabled: true });
  const { result } = renderHook(() => useStartByToggle());
  await act(async () => { await result.current.toggle(false); });
  expect(useSettingsStore.getState().startByEnabled).toBe(false);
  expect(cancelStartBy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it, verify it fails.** `npx jest src/features/today/__tests__/useStartByToggle.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement the hook** (mirrors `useReminderSetting`):

```ts
import { useCallback } from 'react';
import { analytics } from '@/src/services/analytics';
import { ensureNotificationPermission, cancelStartBy } from '@/src/services/timerNotifications';
import { useSettingsStore } from '@/src/stores/settingsStore';

/**
 * The start-by nudge setting, owned by the plan surface. Turning it on asks for
 * notification permission first — if declined (or on a build without the native
 * module) the flag stays off and `toggle` reports false. Turning it off cancels
 * any pending start-by. Independent of the global reminders master.
 */
export function useStartByToggle() {
  const enabled = useSettingsStore((s) => s.startByEnabled);
  const setEnabled = useSettingsStore((s) => s.setStartByEnabled);

  const toggle = useCallback(
    async (next: boolean): Promise<boolean> => {
      if (next) {
        const granted = await ensureNotificationPermission();
        analytics.capture('notification_permission', { tier: granted ? 'full' : 'denied' });
        if (!granted) return false;
        setEnabled(true);
        analytics.capture('startby_reminder_enabled', {});
        return true;
      }
      setEnabled(false);
      analytics.capture('startby_reminder_disabled', {});
      await cancelStartBy();
      return false;
    },
    [setEnabled],
  );

  return { enabled, toggle };
}
```

- [ ] **Step 4: Run tests.** `npx jest src/features/today/__tests__/useStartByToggle.test.ts` → PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/features/today/useStartByToggle.ts src/features/today/__tests__/useStartByToggle.test.ts
git commit -m "feat(reminders): add permission-aware useStartByToggle hook"
```

---

### Task 3: `PlanReminderChip` — the shared in-context reminder control

**Files:**
- Create: `src/features/today/PlanReminderChip.tsx`
- Test: `src/features/today/__tests__/PlanReminderChip.test.tsx`

**Interfaces:**
- Consumes: `useStartByToggle()` (Task 2); `useTheme()`; `haptics`; `Ionicons`.
- Produces: `PlanReminderChip({ startByClock }: { startByClock: string | null })`. Renders `null` when `startByClock` is null (no start-by in the plan). On = amber; off = quiet. Tap toggles.

- [ ] **Step 1: Write the failing test.** Mock `useStartByToggle`.

```tsx
it('renders nothing without a start-by clock', () => {
  const { toJSON } = render(<PlanReminderChip startByClock={null} />);
  expect(toJSON()).toBeNull();
});

it('shows the on copy with the clock when enabled', () => {
  (useStartByToggle as jest.Mock).mockReturnValue({ enabled: true, toggle: jest.fn() });
  const { getByText } = render(<PlanReminderChip startByClock="12:35 PM" />);
  expect(getByText(/12:35 PM/)).toBeTruthy();
});

it('toggles on press', () => {
  const toggle = jest.fn();
  (useStartByToggle as jest.Mock).mockReturnValue({ enabled: false, toggle });
  const { getByRole } = render(<PlanReminderChip startByClock="12:35 PM" />);
  fireEvent.press(getByRole('switch'));
  expect(toggle).toHaveBeenCalledWith(true);
});
```

- [ ] **Step 2: Run it, verify it fails.** `npx jest src/features/today/__tests__/PlanReminderChip.test.tsx` → FAIL (module missing).

- [ ] **Step 3: Implement the component.** Bare `Pressable` wrapper; visual on inner `Animated.View`; all values from tokens; reduced-motion safe (press scale via `withTiming`, no overshoot).

```tsx
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';
import { useStartByToggle } from './useStartByToggle';

export function PlanReminderChip({ startByClock }: { startByClock: string | null }) {
  const t = useTheme();
  const { enabled, toggle } = useStartByToggle();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const onPressIn = useCallback(() => scale.set(withTiming(t.scale.pressIn, { duration: t.motion.press })), [scale, t]);
  const onPressOut = useCallback(() => scale.set(withTiming(1, { duration: t.motion.press })), [scale, t]);
  const onPress = useCallback(() => { haptics.light(); void toggle(!enabled); }, [enabled, toggle]);

  if (startByClock === null) return null;

  const bg = enabled ? t.colors.accentSoft : t.colors.surfaceSunken;
  const fg = enabled ? t.colors.amberText : t.colors.inkSoft;
  const label = enabled ? `Nudge me at ${startByClock}` : 'Remind me to start';

  return (
    <Pressable
      testID="plan-reminder-chip"
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={enabled ? `Start reminder on, ${startByClock}. Tap to turn off.` : 'Start reminder off. Tap to turn on.'}
      hitSlop={6}
    >
      <Animated.View style={[{
        flexDirection: 'row', alignItems: 'center', gap: t.space[2],
        paddingHorizontal: t.space[3], paddingVertical: t.space[2],
        backgroundColor: bg, borderRadius: t.radii.md, borderCurve: 'continuous',
      }, aStyle]}>
        <Ionicons name={enabled ? 'notifications' : 'notifications-outline'} size={t.iconSize.sm} color={fg} />
        <Text style={{ flex: 1, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.medium, color: fg, fontFamily: t.fontFamily.ui }}>
          {label}
        </Text>
        <View style={{ width: t.space[6], height: t.space[4], borderRadius: t.radii.full, backgroundColor: enabled ? t.colors.accent : t.colors.hairline, alignItems: enabled ? 'flex-end' : 'flex-start', justifyContent: 'center', paddingHorizontal: 2 }}>
          <View style={{ width: t.space[3], height: t.space[3], borderRadius: t.radii.full, backgroundColor: t.colors.surface }} />
        </View>
      </Animated.View>
    </Pressable>
  );
}
```

> If `t.iconSize.sm`, `t.radii.md`, `t.scale.pressIn`, `t.motion.press`, or `t.colors.amberText` are missing on the resolved theme, add them in `tokens.ts` **and** the `resolveTheme` enumeration in `useTheme` (see the `usetheme-token-enumeration` gotcha) — never inline a literal.

- [ ] **Step 4: Run tests.** `npx jest src/features/today/__tests__/PlanReminderChip.test.tsx` → PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/features/today/PlanReminderChip.tsx src/features/today/__tests__/PlanReminderChip.test.tsx
git commit -m "feat(plan): add shared PlanReminderChip reminder control"
```

---

### Task 4: Move the start-by row out from under the master in Settings

**Files:**
- Modify: `src/app/settings.tsx` (master note ~line 361; move the "Start-by nudge" `SettingRow` out of the `remindersEnabled ? (...)` block, ~lines 388–400)

**Interfaces:**
- Consumes: `settingsStore.startByEnabled`, `setStartByEnabled` (already imported in settings.tsx).

- [ ] **Step 1: Update the master note.** Change line ~361 from `note="Pings for honest finish, start-by nudges, and more."` to `note="Pings for honest finish and more."` (start-by no longer belongs to the master).

- [ ] **Step 2: Move the Start-by row.** Cut the `SettingRow` for "Start-by nudge" (lines ~388–400) out of the `{remindersEnabled ? ( ... )}` block and render it as an always-visible row directly under the master row (before the `{remindersEnabled ? (` block), with an updated note:

```tsx
{/* Start-by nudge — plan-owned, independent of the master. Always visible. */}
<SettingRow
  icon="arrow-forward-circle-outline"
  title="Start-by nudge"
  note="A reminder when it's time to begin. Also toggled from your day plan."
  trailing={
    <Switch
      value={startByEnabled}
      onValueChange={setStartByEnabled}
      trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
      accessibilityLabel="Start-by nudge"
    />
  }
/>
```

- [ ] **Step 3: Verify the section renders.** Deep-link to Settings on the sim (`xcrun simctl openurl booted "whenbee:///settings"`) and screenshot — confirm the Start-by row shows above the master's sub-rows and toggling it is independent of the master.

- [ ] **Step 4: Lint + typecheck.** `npx eslint src/app/settings.tsx` → clean; `npm run typecheck` → clean.

- [ ] **Step 5: Commit.**

```bash
git add src/app/settings.tsx
git commit -m "feat(settings): surface start-by nudge as an independent, always-visible row"
```

---

## Self-Review

- **Spec coverage:** §2.1 (decouple + default flip) → Task 1; §2.2 (`PlanReminderChip` + permission path) → Tasks 2–3; the Settings-decoupling note in §2.1 → Task 4. §2.3 (calendar gate unchanged) → no task (intentionally untouched). §2.4 acceptance → covered by Task 1/2 tests.
- **Placeholder scan:** none — every step has concrete code or an exact command.
- **Type consistency:** `useStartByToggle` returns `{ enabled, toggle }` in Task 2 and is consumed with those names in Task 3; `startByEnabled`/`setStartByEnabled` names match `settingsStore`. `cancelStartBy` used in Tasks 1 & 2 matches `src/services/timerNotifications`.

## Execution Handoff

This foundation lands first (on `feat/timeline-owns-action`, shared base). Options 1 & 3 worktrees branch from the commit after Task 4.
