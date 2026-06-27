# Routine Build Timeline-Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `RoutineBuildView` as a vertical timeline rail with a payoff-first hierarchy, a thumb-zone action dock, edit-in-sheet rows, and swipe-to-delete.

**Architecture:** A pure helper (`buildRoutineRail`) turns the draft steps + finish-by into an ordered list of rail rows (start cap → step → breather → … → finish cap) with per-step honest minutes and derived clock times. The view renders those rows with the existing `PlanRail` gutter (same component the run view uses), so build and run read as one product. Editing happens in in-surface overlay sheets modeled on `ConfirmSheet`; deletion is `ReanimatedSwipeable` (the `TaskRow` pattern). Save + Add live in a non-scrolling bottom dock.

**Tech Stack:** React Native (Expo SDK 54), TypeScript (strict, `noUncheckedIndexedAccess`), Zustand (`routinesStore`), `react-native-gesture-handler/ReanimatedSwipeable`, `react-native-reanimated`, Jest.

## Global Constraints

- Every spacing/size/font/color value comes from a token in `src/theme/tokens.ts` via `useTheme()`. If a value is missing, add it to `tokens.ts` (+ matching `useTheme` resolver line) and consume the token — never inline a raw number or hex.
- Engine stays pure: no `Date.now()`, no React/RN in `src/engine`. The new rail helper lives in `src/features/routines/`, not the engine, because it formats display rows.
- No bounce/spring/overshoot on content entrances; no translate-in slides on content; buttons never animate in. Fades + ≤1px scale settle only. Reduced motion → final state.
- Primary CTA uses the default `AppButton` size — never `size="lg"`. One primary (filled `indigo`) per screen; `＋ Step` is secondary (`ghost`).
- Every sheet: `headerShown: false`, opens with `<SheetGrabber />`, renders its own title.
- Product invariants: no guilt/streaks/shame; overrun amber never red; honey monotonic; pricing from RevenueCat; core loop on-device-only.
- Draft has no `transitionFactor`; the build view uses `TRANSITION_PRIOR` (`src/engine/constants.ts`) for the in-between multiplier, matching the current `honestTotal` calc.
- Run `npx eslint <files>` + `npm run typecheck` + `npx jest <files>` before each commit. Conventional Commits; NO AI/co-author attribution; do NOT merge.

---

## File Structure

- **Create** `src/features/routines/routineRailModel.ts` — pure: `buildRoutineRail()` → ordered `RailRow[]` + totals + start-by minute-of-day.
- **Create** `src/features/routines/__tests__/routineRailModel.test.ts` — exhaustive unit tests.
- **Create** `src/features/routines/StepEditorSheet.tsx` — in-surface overlay sheet to add/edit one step (title + category + duration).
- **Create** `src/features/routines/FinishEditorSheet.tsx` — in-surface overlay sheet wrapping `FinishTimeWheel`.
- **Create** `src/features/routines/RoutineRail.tsx` — renders the model rows (PlanRail gutter + step card + breather + caps + swipe-to-delete).
- **Create** `src/features/routines/AnimatedHonestTotal.tsx` — hero total that cross-fades the number on change.
- **Rewrite** `src/features/routines/RoutineBuildView.tsx` — new hierarchy: name-as-title, hero total, rail, bottom dock; remove old heading, inline composer, bottom finish wheel, and the local `StepRow`.
- **Maybe modify** `src/theme/tokens.ts` (+ `useTheme`) — only if a needed spacing/size token is missing (Task 6).

---

### Task 1: Pure rail model

**Files:**
- Create: `src/features/routines/routineRailModel.ts`
- Test: `src/features/routines/__tests__/routineRailModel.test.ts`

**Interfaces:**
- Consumes: `stepHonestMinutes`, `routineHonestTotal` from `@/src/engine`.
- Produces:
  - `type RailRow = { kind: 'start'; clockMin: number | null } | { kind: 'step'; id: string; label: string; category: string; guessMin: number; honestMin: number; clockMin: number | null } | { kind: 'breather'; min: number } | { kind: 'finish'; clockMin: number | null }`
  - `interface RoutineRailModel { rows: RailRow[]; honestTotalMin: number; startByMin: number | null }`
  - `function buildRoutineRail(input: { steps: { id: string; label: string; category: string; guessMin: number }[]; mFor: (category: string) => number; transitionFactor: number; doneByMinuteOfDay: number | null }): RoutineRailModel`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/routines/__tests__/routineRailModel.test.ts
import { buildRoutineRail } from '../routineRailModel';

// stepHonestMinutes(guess, m) = max(5, round5(guess*m)); routineHonestTotal sums then
// applies transitionFactor and round5s. With m=1, transitionFactor=1 the honest total
// equals the sum of per-step honest minutes (no in-between), so breathers are 0.
const mOne = () => 1;

describe('buildRoutineRail', () => {
  it('returns empty rows for no steps', () => {
    const m = buildRoutineRail({ steps: [], mFor: mOne, transitionFactor: 1, doneByMinuteOfDay: null });
    expect(m.rows).toEqual([]);
    expect(m.honestTotalMin).toBe(0);
    expect(m.startByMin).toBeNull();
  });

  it('builds start → step → finish for one step (no breather)', () => {
    const m = buildRoutineRail({
      steps: [{ id: 'a', label: 'Get ready', category: 'getting_ready', guessMin: 20 }],
      mFor: mOne,
      transitionFactor: 1,
      doneByMinuteOfDay: null,
    });
    expect(m.rows.map((r) => r.kind)).toEqual(['start', 'step', 'finish']);
    expect(m.honestTotalMin).toBe(20);
  });

  it('inserts a breather row between consecutive steps', () => {
    const m = buildRoutineRail({
      steps: [
        { id: 'a', label: 'A', category: 'x', guessMin: 20 },
        { id: 'b', label: 'B', category: 'y', guessMin: 20 },
      ],
      mFor: mOne,
      transitionFactor: 1.5, // forces in-between minutes
      doneByMinuteOfDay: null,
    });
    expect(m.rows.map((r) => r.kind)).toEqual(['start', 'step', 'breather', 'step', 'finish']);
    const breather = m.rows.find((r) => r.kind === 'breather');
    expect(breather && breather.kind === 'breather' && breather.min).toBeGreaterThan(0);
  });

  it('clock times are null when no finish-by is set', () => {
    const m = buildRoutineRail({
      steps: [{ id: 'a', label: 'A', category: 'x', guessMin: 20 }],
      mFor: mOne,
      transitionFactor: 1,
      doneByMinuteOfDay: null,
    });
    expect(m.startByMin).toBeNull();
    expect(m.rows.every((r) => (r.kind === 'step' || r.kind === 'start' || r.kind === 'finish' ? r.clockMin === null : true))).toBe(true);
  });

  it('derives start-by and cumulative clock times from finish-by', () => {
    // two 20-min steps, transitionFactor 1 → honestTotal 40, no breather.
    // finish 8:40 = 520 min. start = 520 - 40 = 480 (8:00). step A at 480, step B at 500.
    const m = buildRoutineRail({
      steps: [
        { id: 'a', label: 'A', category: 'x', guessMin: 20 },
        { id: 'b', label: 'B', category: 'y', guessMin: 20 },
      ],
      mFor: mOne,
      transitionFactor: 1,
      doneByMinuteOfDay: 520,
    });
    expect(m.startByMin).toBe(480);
    const [start, stepA, stepB, finish] = [m.rows[0], m.rows[1], m.rows[2], m.rows[3]];
    expect(start && start.kind === 'start' && start.clockMin).toBe(480);
    expect(stepA && stepA.kind === 'step' && stepA.clockMin).toBe(480);
    expect(stepB && stepB.kind === 'step' && stepB.clockMin).toBe(500);
    expect(finish && finish.kind === 'finish' && finish.clockMin).toBe(520);
  });

  it('start-by floors at 0 when the routine is longer than the finish-by', () => {
    const m = buildRoutineRail({
      steps: [{ id: 'a', label: 'A', category: 'x', guessMin: 30 }],
      mFor: mOne,
      transitionFactor: 1,
      doneByMinuteOfDay: 10,
    });
    expect(m.startByMin).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/routines/__tests__/routineRailModel.test.ts`
Expected: FAIL — `buildRoutineRail` not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/routines/routineRailModel.ts
import { stepHonestMinutes, routineHonestTotal } from '@/src/engine';

export type RailRow =
  | { kind: 'start'; clockMin: number | null }
  | {
      kind: 'step';
      id: string;
      label: string;
      category: string;
      guessMin: number;
      honestMin: number;
      clockMin: number | null;
    }
  | { kind: 'breather'; min: number }
  | { kind: 'finish'; clockMin: number | null };

export interface RoutineRailModel {
  rows: RailRow[];
  honestTotalMin: number;
  /** Minute-of-day to start so the routine finishes by doneBy; null when unset. */
  startByMin: number | null;
}

const round5 = (n: number): number => Math.round(n / 5) * 5;

export interface BuildRoutineRailInput {
  steps: { id: string; label: string; category: string; guessMin: number }[];
  /** Effective multiplier for a category (learned or prior). */
  mFor: (category: string) => number;
  transitionFactor: number;
  doneByMinuteOfDay: number | null;
}

export function buildRoutineRail(input: BuildRoutineRailInput): RoutineRailModel {
  const { steps, mFor, transitionFactor, doneByMinuteOfDay } = input;

  if (steps.length === 0) {
    return { rows: [], honestTotalMin: 0, startByMin: null };
  }

  const perStep = steps.map((s) => stepHonestMinutes(s.guessMin, mFor(s.category)));
  const honestTotalMin = routineHonestTotal(perStep, transitionFactor);
  const sumSteps = perStep.reduce((a, b) => a + b, 0);
  const nGaps = Math.max(0, steps.length - 1);
  const totalBreather = Math.max(0, honestTotalMin - sumSteps);
  const breatherEach = nGaps > 0 ? totalBreather / nGaps : 0;

  const startByMin =
    doneByMinuteOfDay === null ? null : Math.max(0, doneByMinuteOfDay - honestTotalMin);

  const rows: RailRow[] = [{ kind: 'start', clockMin: startByMin }];
  let cursor = startByMin; // running minute-of-day, or null

  steps.forEach((step, i) => {
    const honestMin = perStep[i] ?? 0;
    rows.push({
      kind: 'step',
      id: step.id,
      label: step.label,
      category: step.category,
      guessMin: step.guessMin,
      honestMin,
      clockMin: cursor,
    });
    if (cursor !== null) cursor += honestMin;

    if (i < steps.length - 1) {
      rows.push({ kind: 'breather', min: round5(breatherEach) });
      if (cursor !== null) cursor += breatherEach;
    }
  });

  rows.push({ kind: 'finish', clockMin: doneByMinuteOfDay });
  return { rows, honestTotalMin, startByMin };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/routines/__tests__/routineRailModel.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/features/routines/routineRailModel.ts src/features/routines/__tests__/routineRailModel.test.ts && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/routines/routineRailModel.ts src/features/routines/__tests__/routineRailModel.test.ts
git commit -m "feat(routines): pure rail model for the build timeline"
```

---

### Task 2: Step editor sheet

In-surface overlay (modeled on `ConfirmSheet`, `src/components/ConfirmSheet.tsx`) for adding or editing one step. No modal route — the build view is a swapped sub-view, so the sheet lives in-surface and toggles on a `visible` prop.

**Files:**
- Create: `src/features/routines/StepEditorSheet.tsx`

**Interfaces:**
- Consumes: `TaskTitleField`, `CategoryChips`, `usePickerCategories` (`@/src/features/shared/CategoryChips`), `guessCategory` (`@/src/features/shared/categoryGuess`), `DurationWheel` (`@/src/features/planner/DurationWheel`), `seedGuessForCategory`, `DEFAULT_STEP_GUESS` (`./calibrationSeed`), `useCalibrationStore`, `SheetGrabber`, `AppButton`, `AppText`, `useTheme`, `type`.
- Produces: `interface StepDraft { label: string; category: string; guessMin: number }` and
  `function StepEditorSheet(props: { visible: boolean; mode: 'add' | 'edit'; initial?: { label: string; category: string; guessMin: number } | null; onSubmit: (step: StepDraft) => void; onCancel: () => void }): JSX.Element | null`

- [ ] **Step 1: Read the references**

Read `src/components/ConfirmSheet.tsx` (overlay/backdrop/animation structure) and the current composer block in `src/features/routines/RoutineBuildView.tsx:213-250` (title→guessCategory→CategoryChips→seed wiring) so the sheet preserves the calibration-seed behavior.

- [ ] **Step 2: Implement the sheet**

```tsx
// src/features/routines/StepEditorSheet.tsx
import { useEffect, useState } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { tokens } from '@/src/theme/tokens';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { TaskTitleField } from '@/src/components/TaskTitleField';
import { DurationWheel } from '@/src/features/planner/DurationWheel';
import { CategoryChips, usePickerCategories } from '@/src/features/shared/CategoryChips';
import { guessCategory } from '@/src/features/shared/categoryGuess';
import { seedGuessForCategory, DEFAULT_STEP_GUESS } from './calibrationSeed';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

export interface StepDraft {
  label: string;
  category: string;
  guessMin: number;
}

interface StepEditorSheetProps {
  visible: boolean;
  mode: 'add' | 'edit';
  initial?: { label: string; category: string; guessMin: number } | null;
  onSubmit: (step: StepDraft) => void;
  onCancel: () => void;
}

const ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

export function StepEditorSheet({ visible, mode, initial, onSubmit, onCancel }: StepEditorSheetProps) {
  const t = useTheme();
  const categories = usePickerCategories();
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [guessed, setGuessed] = useState<string | null>(null);
  const [guessMin, setGuessMin] = useState(DEFAULT_STEP_GUESS);

  // Reset local state each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setLabel(initial?.label ?? '');
    setCategory(initial?.category ?? null);
    setGuessed(null);
    setGuessMin(initial?.guessMin ?? DEFAULT_STEP_GUESS);
  }, [visible, initial]);

  if (!visible) return null;

  const handleTitleChange = (v: string) => {
    setLabel(v);
    const guess = guessCategory(v, { namedCats: categories, availableIds: categories.map((c) => c.id) });
    setGuessed(guess);
    if (category === null && guess !== null) setCategory(guess);
  };

  const handlePickCategory = (id: string) => {
    setCategory(id);
    const seeded = seedGuessForCategory(id, statsByCategory);
    if (seeded !== DEFAULT_STEP_GUESS) setGuessMin(seeded);
  };

  const canSubmit = label.trim().length > 0;
  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ label: label.trim(), category: category ?? 'admin', guessMin });
  };

  const backdrop: ViewStyle = {
    ...StyleSheetAbsoluteFill,
    backgroundColor: t.colors.scrim,
    justifyContent: 'flex-end',
  };
  const sheet: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingBottom: t.space[6],
    gap: t.space[4],
  };
  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };

  return (
    <Animated.View style={backdrop} entering={ENTER}>
      <Pressable style={StyleSheetAbsoluteFill} onPress={onCancel} accessibilityLabel="Dismiss" />
      <View style={sheet}>
        <SheetGrabber />
        <AppText style={titleStyle}>{mode === 'add' ? 'Add a step' : 'Edit step'}</AppText>
        <TaskTitleField
          variant="underline"
          value={label}
          onChangeText={handleTitleChange}
          placeholder="Step name"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        <CategoryChips
          categories={categories}
          value={category}
          onChange={handlePickCategory}
          guessedId={guessed}
        />
        <DurationWheel valueMin={guessMin} onChange={setGuessMin} />
        <View style={{ flexDirection: 'row', gap: t.space[2] }}>
          <AppButton label={mode === 'add' ? 'Add step' : 'Save step'} variant="indigo" disabled={!canSubmit} onPress={handleSubmit} />
          <AppButton label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </View>
    </Animated.View>
  );
}

const StyleSheetAbsoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
```

> NOTE for implementer: confirm `t.colors.scrim` and `t.radii.sheet` exist in `src/theme/tokens.ts`; if either is missing, add it as a token in Task 6 and import it here (do not inline). `type.subtitle` is the established sheet-title style (see `add-task.tsx`).

- [ ] **Step 3: Lint + typecheck**

Run: `npx eslint src/features/routines/StepEditorSheet.tsx && npm run typecheck`
Expected: no errors (resolve any missing-token errors by adding the token in Task 6, then re-run).

- [ ] **Step 4: Commit**

```bash
git add src/features/routines/StepEditorSheet.tsx
git commit -m "feat(routines): in-surface step editor sheet"
```

---

### Task 3: Finish-by editor sheet

**Files:**
- Create: `src/features/routines/FinishEditorSheet.tsx`

**Interfaces:**
- Consumes: `FinishTimeWheel` (`@/src/features/planner/FinishTimeWheel`), `SheetGrabber`, `AppButton`, `AppText`, `useTheme`, `type`.
- Produces: `function FinishEditorSheet(props: { visible: boolean; valueMs: number | null; onChange: (ms: number) => void; onClear: () => void; onClose: () => void }): JSX.Element | null`

- [ ] **Step 1: Implement** (same backdrop/sheet shell as `StepEditorSheet`; body is the wheel)

```tsx
// src/features/routines/FinishEditorSheet.tsx
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { tokens } from '@/src/theme/tokens';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { FinishTimeWheel } from '@/src/features/planner/FinishTimeWheel';

interface FinishEditorSheetProps {
  visible: boolean;
  valueMs: number | null;
  onChange: (ms: number) => void;
  onClear: () => void;
  onClose: () => void;
}

const ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);
const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

export function FinishEditorSheet({ visible, valueMs, onChange, onClear, onClose }: FinishEditorSheetProps) {
  const t = useTheme();
  if (!visible) return null;

  const backdrop: ViewStyle = { ...FILL, backgroundColor: t.colors.scrim, justifyContent: 'flex-end' };
  const sheet: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingBottom: t.space[6],
    gap: t.space[4],
  };
  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };

  return (
    <Animated.View style={backdrop} entering={ENTER}>
      <Pressable style={FILL} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={sheet}>
        <SheetGrabber />
        <AppText style={titleStyle}>Finish by</AppText>
        <FinishTimeWheel valueMs={valueMs} mode="be done by" showModes={false} onChange={onChange} />
        <View style={{ flexDirection: 'row', gap: t.space[2] }}>
          <AppButton label="Done" variant="indigo" onPress={onClose} />
          {valueMs !== null ? <AppButton label="Clear" variant="ghost" onPress={onClear} /> : null}
        </View>
      </View>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `npx eslint src/features/routines/FinishEditorSheet.tsx && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/routines/FinishEditorSheet.tsx
git commit -m "feat(routines): in-surface finish-by editor sheet"
```

---

### Task 4: The rail (rows + swipe-to-delete)

Renders a `RoutineRailModel` as PlanRail rows. Step rows are tappable (edit) and swipeable (delete); breather rows show the in-between minutes; start/finish caps show clock times or a CTA.

**Files:**
- Create: `src/features/routines/RoutineRail.tsx`

**Interfaces:**
- Consumes: `PlanRail` (`@/src/features/planner/PlanRail`), `RailRow`/`RoutineRailModel` (`./routineRailModel`), `categoryName` (`@/src/features/shared/categoryName`), `formatClock` (`@/src/lib/time`), `ReanimatedSwipeable` (`react-native-gesture-handler/ReanimatedSwipeable`), `haptics` (`@/src/lib/haptics`), `useTheme`, `type`, `AppText`.
- Produces: `function RoutineRail(props: { model: RoutineRailModel; onEditStep: (id: string) => void; onDeleteStep: (id: string) => void; onAddStep: () => void; onEditFinish: () => void }): JSX.Element`

- [ ] **Step 1: Read the swipe reference**

Read `src/features/today/TaskRow.tsx:1-15,323-390` for the `ReanimatedSwipeable` + `renderRightActions` pattern. Mirror it: `friction`, `rightThreshold`, a red-free delete action using `t.colors.danger`, haptic on open.

- [ ] **Step 2: Implement**

```tsx
// src/features/routines/RoutineRail.tsx
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { PlanRail } from '@/src/features/planner/PlanRail';
import { categoryName } from '@/src/features/shared/categoryName';
import { formatClock } from '@/src/lib/time';
import { haptics } from '@/src/lib/haptics';
import type { RoutineRailModel, RailRow } from './routineRailModel';

// Minute-of-day → "8:40" using the shared system-aware clock formatter. A fixed
// non-DST reference date (epoch + minutes) is fine; formatClock reads only H:M.
function clockLabel(min: number | null): string | undefined {
  if (min === null) return undefined;
  const REF_MIDNIGHT = 0; // 1970-01-01 local midnight is offset by tz, but H:M of (min) is stable enough for display
  return formatClock(REF_MIDNIGHT + min * 60_000);
}

interface RoutineRailProps {
  model: RoutineRailModel;
  onEditStep: (id: string) => void;
  onDeleteStep: (id: string) => void;
  onAddStep: () => void;
  onEditFinish: () => void;
}

export function RoutineRail({ model, onEditStep, onDeleteStep, onAddStep, onEditFinish }: RoutineRailProps) {
  const t = useTheme();
  const { rows } = model;

  const row: ViewStyle = { flexDirection: 'row', alignItems: 'stretch' };
  const cardCol: ViewStyle = { flex: 1, justifyContent: 'center', paddingVertical: t.space[2] };
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2],
    gap: t.space[0.5],
    minHeight: t.size.planCardMin,
    justifyContent: 'center',
  };
  const titleStyle: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
  const metaStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const capStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const breatherStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const addStyle: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.primary };
  const deleteAction: ViewStyle = {
    backgroundColor: t.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.space[4],
    borderRadius: t.radii.card,
    marginVertical: t.space[2],
  };
  const deleteText: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.onDanger };

  const railStateRow = (kind: RailRow['kind'], i: number) => ({
    isFirst: i === 0,
    isLast: i === rows.length - 1,
  });

  return (
    <View>
      {rows.map((r, i) => {
        const { isFirst, isLast } = railStateRow(r.kind, i);

        if (r.kind === 'start' || r.kind === 'finish') {
          const onPress = r.kind === 'finish' ? onEditFinish : undefined;
          const label =
            r.kind === 'start'
              ? r.clockMin !== null ? `${clockLabel(r.clockMin)}  start` : 'start'
              : r.clockMin !== null ? `${clockLabel(r.clockMin)}  done by` : '＋ set a finish time';
          return (
            <Pressable key={`cap-${i}`} onPress={onPress} disabled={!onPress} style={row} accessibilityRole={onPress ? 'button' : undefined}>
              <PlanRail state="next" isFirst={isFirst} isLast={isLast} prevState="next" />
              <View style={cardCol}><AppText style={capStyle}>{label}</AppText></View>
            </Pressable>
          );
        }

        if (r.kind === 'breather') {
          return (
            <View key={`breather-${i}`} style={row}>
              <PlanRail state="breather" isFirst={isFirst} isLast={isLast} prevState="next" />
              <View style={cardCol}><AppText style={breatherStyle}>+{r.min}m in-between</AppText></View>
            </View>
          );
        }

        // step
        return (
          <ReanimatedSwipeable
            key={r.id}
            friction={2}
            rightThreshold={t.space[10]}
            onSwipeableWillOpen={() => haptics.selection()}
            renderRightActions={() => (
              <Pressable onPress={() => onDeleteStep(r.id)} accessibilityLabel={`Remove ${r.label}`}>
                <View style={deleteAction}><AppText style={deleteText}>Remove</AppText></View>
              </Pressable>
            )}
          >
            <Pressable style={row} onPress={() => onEditStep(r.id)} accessibilityRole="button" accessibilityLabel={`Edit ${r.label}`}>
              <PlanRail state="next" isFirst={isFirst} isLast={isLast} prevState="next" />
              <View style={cardCol}>
                <View style={card}>
                  <AppText style={titleStyle} numberOfLines={1}>{r.label}</AppText>
                  <AppText style={metaStyle} numberOfLines={1}>
                    {categoryName(r.category)} · {r.honestMin}m honest
                    {r.clockMin !== null ? ` · ${clockLabel(r.clockMin)}` : ''}
                  </AppText>
                </View>
              </View>
            </Pressable>
          </ReanimatedSwipeable>
        );
      })}

      {/* Add step tail */}
      <Pressable onPress={onAddStep} style={row} accessibilityRole="button" accessibilityLabel="Add a step">
        <PlanRail state="next" isLast prevState="next" />
        <View style={cardCol}><AppText style={addStyle}>＋ add step</AppText></View>
      </Pressable>
    </View>
  );
}
```

> NOTE for implementer: confirm `t.colors.danger`/`t.colors.onDanger`, `t.size.planCardMin`, `haptics.selection` exist; if any is missing, add the token (Task 6) or use the established equivalent (`AppButton`'s `danger` variant already references the danger colors — grep them). The `clockLabel` tz caveat: if the existing app formats minute-of-day elsewhere, reuse that helper instead — grep `minuteOfDay` formatting in `src/features` before shipping `clockLabel`.

- [ ] **Step 3: Lint + typecheck**

Run: `npx eslint src/features/routines/RoutineRail.tsx && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/routines/RoutineRail.tsx
git commit -m "feat(routines): timeline rail rows with swipe-to-delete"
```

---

### Task 5: Hero total (cross-fade on change)

**Files:**
- Create: `src/features/routines/AnimatedHonestTotal.tsx`

**Interfaces:**
- Consumes: `AppText`, `useTheme`, `type`, `react-native-reanimated` (`Animated`, `FadeIn`, `ReduceMotion`).
- Produces: `function AnimatedHonestTotal(props: { minutes: number }): JSX.Element`

- [ ] **Step 1: Implement** (key the number by value so it cross-fades; no translate, no spring)

```tsx
// src/features/routines/AnimatedHonestTotal.tsx
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { View, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { tokens } from '@/src/theme/tokens';

const ENTER = FadeIn.duration(tokens.motion.fast).reduceMotion(ReduceMotion.System);

export function AnimatedHonestTotal({ minutes }: { minutes: number }) {
  const t = useTheme();
  const num: TextStyle = { ...(type.honestNumberLg as unknown as TextStyle), color: t.colors.ink };
  const caption: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  return (
    <View style={{ gap: t.space[0.5] }}>
      {/* keyed so the number opacity-crossfades when the total changes; opacity only */}
      <Animated.View key={minutes} entering={ENTER}>
        <AppText style={num}>About {minutes} min</AppText>
      </Animated.View>
      <AppText style={caption}>including the in-between time</AppText>
    </View>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `npx eslint src/features/routines/AnimatedHonestTotal.tsx && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/routines/AnimatedHonestTotal.tsx
git commit -m "feat(routines): hero honest total with opacity cross-fade"
```

---

### Task 6: Assemble the new build view + tokens

Rewrite `RoutineBuildView` to the new hierarchy and delete the old heading, inline composer, local `StepRow`, and bottom finish wheel. Add any missing tokens first.

**Files:**
- Modify: `src/theme/tokens.ts` (+ `src/theme/useTheme.ts` resolver) — only for tokens referenced above that don't yet exist (`scrim`, `radii.sheet`, `danger`/`onDanger`, `size.planCardMin`). Grep each before adding; reuse if present.
- Rewrite: `src/features/routines/RoutineBuildView.tsx`

**Interfaces:**
- Consumes: `buildRoutineRail` (`./routineRailModel`), `RoutineRail`, `StepEditorSheet`/`StepDraft`, `FinishEditorSheet`, `AnimatedHonestTotal`, store actions (`setName`, `addStep`, `editStep`, `removeStep`, `setDoneBy`, `saveDraft`), `useCalibrationStore`, `priorFor`, `TRANSITION_PRIOR` (`@/src/engine`), `TaskTitleField`, `AppButton`, `useSafeAreaInsets`, `useTheme`, `type`.
- Produces: `function RoutineBuildView(props: { onDone: () => void }): JSX.Element` (unchanged public prop).

- [ ] **Step 1: Add missing tokens (only if grep shows they're absent)**

Grep first: `grep -nE "scrim|radii.*sheet|\bdanger\b|onDanger|planCardMin" src/theme/tokens.ts`. For each absent token, add it to the matching group in `src/theme/tokens.ts` AND add/confirm the resolver line in `src/theme/useTheme.ts` (a new `tokens.ts` group needs a matching `t.<key>` line or it resolves `undefined`). Use values consistent with neighbors (e.g. `scrim: 'rgba(0,0,0,0.45)'`, `radii.sheet: 24`). Then:

Run: `npm run typecheck`
Expected: no missing-token errors from Tasks 2–4.

- [ ] **Step 2: Rewrite the view**

```tsx
// src/features/routines/RoutineBuildView.tsx
import { useMemo, useReducer } from 'react';
import { ScrollView, View, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';
import { TaskTitleField } from '@/src/components/TaskTitleField';
import { useRoutinesStore, type DraftStep } from '@/src/stores/routinesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { priorFor, TRANSITION_PRIOR } from '@/src/engine';
import { buildRoutineRail } from './routineRailModel';
import { RoutineRail } from './RoutineRail';
import { AnimatedHonestTotal } from './AnimatedHonestTotal';
import { StepEditorSheet, type StepDraft } from './StepEditorSheet';
import { FinishEditorSheet } from './FinishEditorSheet';

const MS_PER_MIN = 60_000;

// Which editor sheet is open. `editId` null in 'step' mode = adding.
type SheetState =
  | { kind: 'none' }
  | { kind: 'step'; editId: string | null }
  | { kind: 'finish' };

function sheetReducer(_state: SheetState, next: SheetState): SheetState {
  return next;
}

export function RoutineBuildView({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const draft = useRoutinesStore((s) => s.draft);
  const setName = useRoutinesStore((s) => s.setName);
  const addStep = useRoutinesStore((s) => s.addStep);
  const editStep = useRoutinesStore((s) => s.editStep);
  const removeStep = useRoutinesStore((s) => s.removeStep);
  const setDoneBy = useRoutinesStore((s) => s.setDoneBy);
  const saveDraft = useRoutinesStore((s) => s.saveDraft);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  const [sheet, setSheet] = useReducer(sheetReducer, { kind: 'none' } as SheetState);

  const mFor = (c: string) => statsByCategory[c]?.mEffective ?? priorFor(c);

  const model = useMemo(
    () =>
      buildRoutineRail({
        steps: draft.steps,
        mFor,
        transitionFactor: TRANSITION_PRIOR,
        doneByMinuteOfDay: draft.doneByMinuteOfDay,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.steps, draft.doneByMinuteOfDay, statsByCategory],
  );

  const canSave = draft.name.trim().length > 0 && draft.steps.length > 0;

  const editing: DraftStep | null =
    sheet.kind === 'step' && sheet.editId !== null
      ? draft.steps.find((s) => s.id === sheet.editId) ?? null
      : null;

  const handleStepSubmit = (step: StepDraft) => {
    if (sheet.kind === 'step' && sheet.editId !== null) {
      editStep(sheet.editId, step);
    } else {
      addStep(step);
    }
    setSheet({ kind: 'none' });
  };

  const doneByMs = useMemo(() => {
    if (draft.doneByMinuteOfDay === null) return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() + draft.doneByMinuteOfDay * MS_PER_MIN;
  }, [draft.doneByMinuteOfDay]);

  const handleDoneByChange = (ms: number) => {
    const d = new Date(ms);
    setDoneBy(d.getHours() * 60 + d.getMinutes());
  };

  const nameStyle: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const dock: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
    paddingHorizontal: t.space[4],
    paddingTop: t.space[3],
    paddingBottom: insets.bottom + t.space[3],
    borderTopWidth: t.borderWidth.hairline,
    borderTopColor: t.colors.hairline,
    backgroundColor: t.colors.bg,
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ gap: t.space[4], paddingHorizontal: t.space[4], paddingTop: t.space[3], paddingBottom: t.space[8] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name = the title */}
        <TaskTitleField
          variant="underline"
          value={draft.name}
          onChangeText={setName}
          placeholder="Name this routine"
          returnKeyType="done"
          textStyle={nameStyle}
        />

        <AnimatedHonestTotal minutes={model.honestTotalMin} />

        <RoutineRail
          model={model}
          onEditStep={(id) => setSheet({ kind: 'step', editId: id })}
          onDeleteStep={removeStep}
          onAddStep={() => setSheet({ kind: 'step', editId: null })}
          onEditFinish={() => setSheet({ kind: 'finish' })}
        />
      </ScrollView>

      {/* Thumb-zone dock — one primary (Save), one secondary (Step) */}
      <View style={dock}>
        <View style={{ flex: 1 }}>
          <AppButton label="＋ Step" variant="ghost" fullWidth onPress={() => setSheet({ kind: 'step', editId: null })} />
        </View>
        <View style={{ flex: 1 }}>
          <AppButton
            label="Save"
            variant="indigo"
            fullWidth
            disabled={!canSave}
            onPress={() => { void saveDraft().then(onDone); }}
            accessibilityLabel={canSave ? 'Save routine' : 'Add a name and at least one step to save'}
          />
        </View>
      </View>

      <StepEditorSheet
        visible={sheet.kind === 'step'}
        mode={editing ? 'edit' : 'add'}
        initial={editing}
        onSubmit={handleStepSubmit}
        onCancel={() => setSheet({ kind: 'none' })}
      />
      <FinishEditorSheet
        visible={sheet.kind === 'finish'}
        valueMs={doneByMs}
        onChange={handleDoneByChange}
        onClear={() => { setDoneBy(null); setSheet({ kind: 'none' }); }}
        onClose={() => setSheet({ kind: 'none' })}
      />
    </View>
  );
}
```

> NOTE for implementer:
> - Confirm `TaskTitleField` accepts a `textStyle` prop; if not, add it (forward to the inner `TextInput` style) so the name renders at `type.heading`. Grep `TaskTitleField.tsx` props first.
> - Confirm `AppButton` supports `fullWidth`; the current code uses it elsewhere — grep. If absent, wrap each button in a `flex:1` `View` (already done) and the button stretches via its own style, or add `fullWidth`.
> - Delete the now-unused imports/helpers from the old file (`CategoryChips`, `DurationWheel`, `FinishTimeWheel`, `guessCategory`, `seedGuessForCategory`, `stepHonestMinutes`, `routineHonestTotal`, local `StepRow`, `composerReducer`). `npm run lint` (`--max-warnings=0`) will fail on any unused import — that's the gate.

- [ ] **Step 3: Lint + typecheck + full test run**

Run: `npx eslint src/features/routines/ && npm run typecheck && npx jest src/features/routines`
Expected: no errors; rail-model tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/routines/RoutineBuildView.tsx src/theme/tokens.ts src/theme/useTheme.ts
git commit -m "feat(routines): timeline-rail build view with thumb dock and edit sheets"
```

---

### Task 7: Device verification

- [ ] **Step 1: Build + open the build screen**

Run: `npm run ios` (dev build — Expo Go cannot run this app). Navigate Plan tab → Routines → New (Pro account). If not Pro, flip the entitlement per the dev path.

- [ ] **Step 2: Screenshot-verify each state**

Capture with `xcrun simctl io booted screenshot` and *look critically* (per the global frontend-craft rule):
- Empty draft: name placeholder reads as a title; hero total `About 0 min`; rail shows start cap + `＋ add step`; dock pinned above the tab bar, Save disabled.
- Add two steps via the sheet: breather row appears between them with `+Nm in-between`; hero total cross-fades (no slide/bounce); honest minutes correct.
- Set a finish-by: start cap shows `H:MM start`, finish cap shows `H:MM done by`, step caps show clock times.
- Swipe a step left → Remove; tap a step → edit sheet pre-filled.
- Verify alignment: rail spine runs unbroken through every node; step cards share one left edge; no column drift.

- [ ] **Step 3: Reduced-motion pass**

Enable iOS Reduce Motion; confirm the hero total updates instantly (no fade) and sheets appear at final state.

- [ ] **Step 4: Final gate**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all green. Open a PR (do NOT merge — founder reviews).

---

## Self-Review

**Spec coverage:**
- Drop the heading / name-as-title → Task 6 (`TaskTitleField` with `nameStyle`, no heading). ✓
- Hero honest total, count/fade on change → Task 5 + Task 6. ✓
- Rail with step/breather/finish nodes, reuse PlanRail → Tasks 1, 4. ✓
- Breather = display-only distributed gap → Task 1 (`breatherEach`, engine untouched). ✓
- Clock times only when finish-by set, derived backward → Task 1 (`startByMin`, cumulative clock). ✓
- Tap-to-edit sheet, swipe-to-delete, add at tail, finish sheet → Tasks 2, 3, 4. ✓
- Bottom dock, one primary, default size, safe-area → Task 6. ✓
- Motion within no-bounce rule → Tasks 4, 5 (fades only). ✓
- Tokens only, add if missing → Task 6 Step 1. ✓
- Sheets `headerShown:false` + `SheetGrabber` → Tasks 2, 3. ✓

**Placeholder scan:** Implementer NOTEs are verification directives (grep-then-confirm), not deferred work — each names the exact file to check and the fallback. No "TBD"/"add error handling"/"write tests for the above".

**Type consistency:** `buildRoutineRail` input/`RailRow`/`RoutineRailModel` names match across Tasks 1, 4, 6. `StepDraft` (Task 2) matches `addStep`/`editStep` shape `{ label, category, guessMin }` (store). `SheetState` reducer used only in Task 6. `model.honestTotalMin` consumed by `AnimatedHonestTotal`. ✓

**Known risk to validate during execution:** `clockLabel` minute-of-day → epoch conversion uses a fixed reference; the existing app may format minute-of-day elsewhere (Task 4 NOTE says grep and reuse). If timezone offset shifts the displayed hour, build the epoch from today-midnight (as `doneByMs` does in Task 6) instead of epoch 0.
