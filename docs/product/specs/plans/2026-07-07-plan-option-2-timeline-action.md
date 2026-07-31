# Option 2 — Timeline Owns Its Action — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Depends on:** `2026-07-07-plan-foundation.md` (Tasks 1–4 landed first on this branch).

**Goal:** Keep the List/Timeline segmented control but make it honest — the "Plan my day" action moves out of the toggle row and into the Timeline view as an empty state, and the reminder chip lives in the planned Timeline header.

**Architecture:** The segmented toggle stays a pure view switch. Entering Timeline before the day is planned shows a `TimelineEmptyState` that holds the single "Plan my day" action; once `dayMeta.planComputedAt` is stamped, `DayTimeline` renders the plan with the shared `PlanReminderChip` under its header. The competing button beside the toggle is removed.

**Tech Stack:** React Native (Expo SDK 54), Zustand (`dayTasksStore`, `settingsStore`), Reanimated, theme tokens, expo-router, Jest.

## Global Constraints

- Every color/spacing/size/font value comes from a token in `src/theme/tokens.ts` via `useTheme()`. No raw hex or number literals.
- `npm run lint` passes at `--max-warnings=0`; `npm run typecheck` clean.
- Run the affected jest suite + `npm test` before each commit.
- Conventional Commits. **No** `Co-Authored-By` / AI-attribution trailers.
- No guilt/shame copy. Honey/sharpness monotonic. Core loop stays on-device. Pricing read from RevenueCat; Plan-my-day stays Pro-gated (free → paywall `trigger: 'plan_my_day'`).
- One filled primary CTA per screen — the `+` FAB owns it; the empty-state button is a secondary/ghost action, never a filled indigo CTA.
- Animation HARD RULE: no bounce/overshoot/slide-in on content; fade entrances; reduced-motion → final state.
- reactCompiler gotcha: `Pressable` stays a bare touch wrapper; visual on inner `Animated.View`; reanimated values via `.get()/.set()`.

---

### Task 1: `TimelineEmptyState` — the pre-plan view

**Files:**
- Create: `src/features/today/TimelineEmptyState.tsx`
- Test: `src/features/today/__tests__/TimelineEmptyState.test.tsx`

**Interfaces:**
- Consumes: `useTheme()`, `PlanMyDayButton` (existing, `src/features/today/PlanMyDayButton.tsx`).
- Produces: `TimelineEmptyState({ onPlan, isPro }: { onPlan: () => void; isPro: boolean })` — a calendar glyph, a title, one supporting line, and the "Plan my day" button wired to `onPlan`.

- [ ] **Step 1: Write the failing test.**

```tsx
it('shows the pre-plan copy and fires onPlan', () => {
  const onPlan = jest.fn();
  const { getByText, getByTestId } = render(<TimelineEmptyState onPlan={onPlan} isPro />);
  expect(getByText('No plan for today yet')).toBeTruthy();
  fireEvent.press(getByTestId('plan-my-day-btn'));
  expect(onPlan).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it, verify it fails.** `npx jest src/features/today/__tests__/TimelineEmptyState.test.tsx` → FAIL (module missing).

- [ ] **Step 3: Implement.** All values from tokens; no bounce; fade only if animated.

```tsx
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { PlanMyDayButton } from './PlanMyDayButton';

export function TimelineEmptyState({ onPlan, isPro }: { onPlan: () => void; isPro: boolean }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: t.space[3], paddingVertical: t.space[6], paddingHorizontal: t.space[4] }}>
      <Ionicons name="calendar-outline" size={t.iconSize.lg} color={t.colors.inkSoft} />
      <Text style={{ fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold, color: t.colors.ink, fontFamily: t.fontFamily.ui }}>
        No plan for today yet
      </Text>
      <Text style={{ fontSize: t.fontSize.sm, color: t.colors.inkSoft, fontFamily: t.fontFamily.ui, textAlign: 'center' }}>
        Build a timeline around your calendar and get a start-by time.
      </Text>
      <PlanMyDayButton onPress={onPlan} isPro={isPro} label="Plan my day" />
    </View>
  );
}
```

> If `t.iconSize.lg` is missing, add it to `tokens.ts` + the `useTheme` enumeration — never inline a literal.

- [ ] **Step 4: Run tests.** `npx jest src/features/today/__tests__/TimelineEmptyState.test.tsx` → PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/features/today/TimelineEmptyState.tsx src/features/today/__tests__/TimelineEmptyState.test.tsx
git commit -m "feat(plan): add TimelineEmptyState pre-plan view"
```

---

### Task 2: Add `PlanReminderChip` to the planned Timeline header

**Files:**
- Modify: `src/features/today/DayTimeline.tsx` (import + render the chip under the header block, after line ~513)
- Test: `src/features/today/__tests__/DayTimeline.test.tsx` (existing — add a case, or create if absent)

**Interfaces:**
- Consumes: `PlanReminderChip` (foundation), `formatClockMeridiem` (`src/lib/time.ts`), `plan.startBy`.
- Produces: no new export; DayTimeline now renders the chip when `plan.startBy` is set.

- [ ] **Step 1: Write the failing test.** Render `DayTimeline` with a mocked `useDayPlan` returning a ready plan with a `startBy`; assert the chip (`testID="plan-reminder-chip"`) is present.

```tsx
it('renders the reminder chip in the planned header', () => {
  mockUseDayPlan({ status: 'ready', plan: readyPlanWithStartBy });
  mockEntitlement(true);
  const { getByTestId } = render(<DayTimeline />);
  expect(getByTestId('plan-reminder-chip')).toBeTruthy();
});
```

- [ ] **Step 2: Run it, verify it fails.** `npx jest src/features/today/__tests__/DayTimeline.test.tsx` → FAIL (no chip).

- [ ] **Step 3: Implement.** Import at top:

```tsx
import { PlanReminderChip } from './PlanReminderChip';
import { formatClockMeridiem } from '@/src/lib/time';
```

Render the chip immediately after the header `</View>` (after line ~513, before the overflow banner):

```tsx
<View style={{ paddingHorizontal: t.space[3], paddingBottom: t.space[2] }}>
  <PlanReminderChip startByClock={plan.startBy ? formatClockMeridiem(plan.startBy) : null} />
</View>
```

- [ ] **Step 4: Run tests.** `npx jest src/features/today/__tests__/DayTimeline.test.tsx` → PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/features/today/DayTimeline.tsx src/features/today/__tests__/DayTimeline.test.tsx
git commit -m "feat(plan): show start-by reminder chip in the Timeline header"
```

---

### Task 3: Rewire Today — remove the competing button, gate Timeline on planned state

**Files:**
- Modify: `src/app/(tabs)/index.tsx` (the toggle row ~lines 543–564; the timeline branch ~lines 566–570)

**Interfaces:**
- Consumes: `dayTasksStore.dayMeta.planComputedAt`, `TimelineEmptyState` (Task 1), existing `handlePlanMyDay`, `handleViewSelect`, `handleTimelineGated`.
- Produces: the toggle row now contains only `ViewToggle`; the Timeline branch shows `TimelineEmptyState` when unplanned, `DayTimeline` when planned.

- [ ] **Step 1: Add the planned selector.** Near the other `useDayTasksStore` selectors (~line 168), add:

```tsx
const planComputedAt = useDayTasksStore((s) => s.dayMeta?.planComputedAt ?? null);
```

- [ ] **Step 2: Remove `PlanMyDayButton` from the toggle row.** Replace the `<View style={{ flexDirection: 'row', justifyContent: 'space-between', ... }}>` block (lines ~544–563) that wraps `ViewToggle` + `PlanMyDayButton` with just the toggle:

```tsx
<ViewToggle
  viewMode={viewMode}
  onSelect={handleViewSelect}
  onTimelineGated={handleTimelineGated}
  isPro={isPro}
/>
```

Remove the now-unused `PlanMyDayButton` import from `index.tsx` (line 38) **only if** no longer referenced (it is still used inside `TimelineEmptyState`, imported there — so the `index.tsx` import is removed).

- [ ] **Step 3: Gate the Timeline branch on `planComputedAt`.** Replace the `viewMode === 'timeline' && isPro ? (<Animated.View…><DayTimeline /></Animated.View>)` block (~lines 566–570) with:

```tsx
{viewMode === 'timeline' && isPro ? (
  <Animated.View entering={FadeIn.duration(t.motion.base)}>
    {planComputedAt === null ? (
      <TimelineEmptyState onPlan={handlePlanMyDay} isPro={isPro} />
    ) : (
      <DayTimeline />
    )}
  </Animated.View>
) : (
  /* List lens — unchanged */
  ...
)}
```

Add the import: `import { TimelineEmptyState } from '@/src/features/today/TimelineEmptyState';`

- [ ] **Step 4: Confirm `handlePlanMyDay` still fits.** It calls `markPlanned()` (stamps `planComputedAt`) + `setViewMode('timeline')` (harmless when already there) + the export wire. No change needed — tapping the empty-state button now flips the same view from empty → planned. Leave it as-is.

- [ ] **Step 5: Lint + typecheck.** `npx eslint src/app/(tabs)/index.tsx src/features/today/TimelineEmptyState.tsx src/features/today/DayTimeline.tsx` → clean; `npm run typecheck` → clean.

- [ ] **Step 6: Commit.**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "feat(plan): Timeline owns its plan action; drop the competing toggle-row button"
```

---

### Task 4: End-to-end verification on the simulator

**Files:** none (verification only).

- [ ] **Step 1: Full suite.** `npm test` → green. `npm run lint` + `npm run typecheck` → clean.

- [ ] **Step 2: Drive the flow on the sim.** Launch (`npm run ios`), add a task, tap the **Timeline** segment → confirm `TimelineEmptyState` ("No plan for today yet" + Plan my day). Tap **Plan my day** → the same view fills with the plan; the reminder chip shows under the header reading **"Remind me to start"** (off by default). Tap the chip → it flips to amber **"Nudge me at {clock}"** after the permission prompt. Screenshot each state.

- [ ] **Step 3: Verify no silent notification.** With the chip **off**, confirm no start-by is scheduled (the foundation gate is `startByEnabled` alone, default off). With it **on**, verify a start-by schedules (unit coverage from the foundation; on device, confirm via `adb shell dumpsys notification` / the reward path — never claim it works unseen).

- [ ] **Step 4: Free-tier gate.** As a free user, tap the Timeline segment and the empty-state button → both route to the paywall (`trigger: 'plan_my_day'`). Screenshot.

- [ ] **Step 5: Commit any fixes**, else no-op.

---

## Self-Review

- **Spec coverage:** §4.1 items 1–4 → Tasks 1 (empty state), 2 (chip in header), 3 (remove competing button + gate on planned). §4.3 acceptance → Task 4 verification + Tasks 1–2 tests. Shared foundation is a separate plan (dependency noted in the header).
- **Placeholder scan:** the List-lens `...` in Task 3 Step 3 refers to the **existing, unchanged** List branch (lines ~571–630) — it is deliberately left intact, not a placeholder. All new code is complete.
- **Type consistency:** `TimelineEmptyState({ onPlan, isPro })` defined in Task 1 and consumed with those exact prop names in Task 3. `PlanReminderChip({ startByClock })` matches the foundation signature. `planComputedAt` selector type is `number | null`.

## Execution Handoff

Built on `feat/timeline-owns-action` off `main`, immediately after the foundation tasks. Ends as a PR the founder reviews + merges (Claude never merges).
