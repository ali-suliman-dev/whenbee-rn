# FocusCard + Task Rows Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Today's FocusCard (honest-number hero + Start button + finish projection) and TaskRow (interactive indigo edge, bottom-aligned ink minutes, no chevron, no done-strikethrough), and keep RunningFocusCard visually consistent.

**Architecture:** Pure presentation changes to four feature components + two theme additions (a 24px `HonestNumber` size, a row edge-marker token). No engine/data/store changes. The finish projection reuses the existing `projectedFinish`/`formatClockMeridiem` time helpers, computed in the screen and passed to FocusCard as a prop.

**Tech Stack:** React Native (Expo SDK 54), reanimated, @expo/vector-icons, Jest + @testing-library/react-native.

## Global Constraints

- **Every spacing/size/font/color value comes from a token in `src/theme/tokens.ts` / role in `src/theme/typography.ts` via `useTheme()` / `type`.** No inline raw numbers or hex. Missing value → add a token.
- **`src/app/**` and `src/components/**` must NOT import `src/services/*` or `src/db/*`.** (`src/lib/*` and `src/engine` are allowed.)
- **Amber-never-red.** The learned-gap stays amber (`amberText`); nothing red. No strikethrough/scold on Done rows. No guilt/streak copy.
- **One filled indigo per screen:** the FocusCard Start button is the filled indigo; TaskRow uses a thin indigo *edge* (not a fill) as a semantic "interactive" marker.
- **Reanimated under reactCompiler:** never function-form `style` on `Pressable`; animate an inner `Animated.View`; shared values via `.get()/.set()`.
- **Copy is verbatim, no em dashes:** FocusCard context line `guessed {guess} · +{delta} learned` (left) and `done {finishClock}` (right); Start button label `Start`; done row `took {actualMin} min`.
- **Lint gate:** `npm run lint` = `eslint . --max-warnings=0`. Flat `eslint.config.js` (no `.eslintrc.js`).
- **Known unrelated test failure:** `src/app/settings.tsx` copyAudit fails pre-existing — not introduced here, do not fix.
- **Stray nested worktree:** jest may collect duplicate suites under `.claude/worktrees/` that fail on a native-module invariant — environmental. Verify with `npx jest <paths> --testPathIgnorePatterns '/.claude/worktrees/'`.
- **Git staging:** the working tree has unrelated WIP. Each task stages ONLY its exact files — never `git add .` / `-A` / `git add src/`.

---

## File structure

- **Modify** `src/theme/typography.ts` — add `honestNumberMd` (24px tabular) role.
- **Modify** `src/components/HonestNumber.tsx` — add `'md'` size mapped to `honestNumberMd`.
- **Modify** `src/theme/tokens.ts` — add `row: { edgeW, edgeH }` geometry.
- **Modify** `src/features/today/FocusCard.tsx` — full redesign; new `finishClock` prop.
- **Modify** `src/app/(tabs)/index.tsx` — compute + pass `finishClock`.
- **Modify** `src/features/today/RunningFocusCard.tsx` — `tone="raised"` + flex-end header parity.
- **Modify** `src/features/today/TaskRow.tsx` — interactive edge, bottom-aligned ink minutes, no chevron, no done strikethrough, "took N min".
- **Tests:** `src/components/__tests__/HonestNumber.test.tsx` (new), `src/features/today/__tests__/FocusCard.test.tsx` (new), `src/features/today/__tests__/TaskRow.test.tsx` (new), update `src/features/today/__tests__/todayScreen.test.tsx`.

---

## Task 1: HonestNumber 'md' (24px) size

**Files:**
- Modify: `src/theme/typography.ts`
- Modify: `src/components/HonestNumber.tsx`
- Test: `src/components/__tests__/HonestNumber.test.tsx`

**Interfaces:**
- Produces: `type.honestNumberMd` role; `HonestNumber` accepts `size="md"`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/__tests__/HonestNumber.test.tsx
import { render, screen } from '@testing-library/react-native';
import { HonestNumber } from '@/src/components/HonestNumber';

describe('HonestNumber', () => {
  it('renders an md-size value with its unit', () => {
    render(<HonestNumber size="md" value="~30" unit="min" />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('min')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/HonestNumber.test.tsx --testPathIgnorePatterns '/.claude/worktrees/'`
Expected: FAIL — TS/`size="md"` not assignable (Size union lacks `'md'`), or no `md` mapping.

- [ ] **Step 3: Add the typography role**

In `src/theme/typography.ts`, add after the `bigNumber` line (uses `fs.xl` = 24):

```ts
  honestNumberMd: { fontFamily: 'Inter-Bold',     fontSize: fs.xl,       lineHeight: 28, letterSpacing: -0.5,  fontVariant: ['tabular-nums'] as const },
```

- [ ] **Step 4: Add the `'md'` size to HonestNumber**

In `src/components/HonestNumber.tsx`:
- Change the `Size` type: `type Size = 'inline' | 'md' | 'big' | 'xl';`
- Extend `sizeScale` so it includes `md: type.honestNumberMd` (and widen the value type to include `typeof type.honestNumberMd`):

```ts
const sizeScale: Record<Size, typeof type.multiplier | typeof type.honestNumberMd | typeof type.bigNumber | typeof type.honestNumberXl> = {
  inline: type.multiplier,
  md: type.honestNumberMd,
  big: type.bigNumber,
  xl: type.honestNumberXl,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/components/__tests__/HonestNumber.test.tsx --testPathIgnorePatterns '/.claude/worktrees/'`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `npx eslint src/theme/typography.ts src/components/HonestNumber.tsx src/components/__tests__/HonestNumber.test.tsx`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/theme/typography.ts src/components/HonestNumber.tsx src/components/__tests__/HonestNumber.test.tsx
git commit -m "feat(theme): add 24px md size to HonestNumber"
```

---

## Task 2: FocusCard redesign + finish projection wiring

**Files:**
- Modify: `src/features/today/FocusCard.tsx`
- Modify: `src/app/(tabs)/index.tsx`
- Test: `src/features/today/__tests__/FocusCard.test.tsx` (new), `src/features/today/__tests__/todayScreen.test.tsx` (update focus assertions)

**Interfaces:**
- Consumes: `HonestNumber size="md"` (Task 1); `AppButton({ label, variant, fullWidth, icon, onPress })`; `Card tone="raised"`; `GapLine`; `OptimismNudge`; `formatClockMeridiem`, `projectedFinish` from `@/src/lib/time`.
- Produces: `FocusCard` now requires a `finishClock: string` prop (e.g. `"4:11pm"`).

- [ ] **Step 1: Write the failing FocusCard test**

```tsx
// src/features/today/__tests__/FocusCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FocusCard } from '@/src/features/today/FocusCard';
import type { CalibrationSummary } from '@/src/domain/types';

const summary: CalibrationSummary = {
  guessMinutes: 15,
  honestMinutes: 30,
  multiplier: 2,
  basis: 'personal',
  rangeLabel: '',
  confidence: 'medium',
} as unknown as CalibrationSummary;

describe('FocusCard', () => {
  it('renders the hero number, gap, finish projection, and Start', () => {
    const onStart = jest.fn();
    render(
      <FocusCard category="cleaning" categoryLabel="Cleaning" taskTitle="Clean the kitchen"
        summary={summary} finishClock="4:11pm" onStart={onStart} />,
    );
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('+15 learned')).toBeOnTheScreen();
    expect(screen.getByText('done 4:11pm')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Start'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/today/__tests__/FocusCard.test.tsx --testPathIgnorePatterns '/.claude/worktrees/'`
Expected: FAIL — `finishClock` prop unknown / `done 4:11pm` not found / no `Start`.

- [ ] **Step 3: Rewrite FocusCard**

Replace the contents of `src/features/today/FocusCard.tsx` with:

```tsx
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { HonestNumber } from '@/src/components/HonestNumber';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { GapLine } from './GapLine';
import { OptimismNudge } from './OptimismNudge';
import type { CalibrationSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// FocusCard — Today's "next task" centerpiece (before start). The honest number is
// the hero (right, baseline-aligned with the title); the guess→plan gap is the bar;
// the context line states the learned gap (amber) and the finish projection; one
// full-width indigo Start button is the single filled-indigo affordance. No play
// coin, no eyebrow dot, no focal top border — flat surface, calm hierarchy.
// ──────────────────────────────────────────────────────────────────────────────

interface FocusCardProps {
  category: string;
  categoryLabel: string;
  taskTitle: string;
  summary: CalibrationSummary;
  /** Projected finish clock, e.g. "4:11pm" (computed by the screen from now + honest). */
  finishClock: string;
  onStart: () => void;
}

export function FocusCard({ category, categoryLabel, taskTitle, summary, finishClock, onStart }: FocusCardProps) {
  const t = useTheme();

  const delta = summary.honestMinutes - summary.guessMinutes;
  const showNudge = summary.basis === 'personal' && summary.honestMinutes > summary.guessMinutes;

  const eyebrowText: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    fontSize: t.fontSize['2xs'],
    letterSpacing: 1.5,
    lineHeight: 12,
  };
  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: t.space[3],
  };
  const eyebrow: TextStyle = { ...eyebrowText, color: t.colors.inkSoft };
  const title: TextStyle = {
    ...(type.heading as unknown as TextStyle),
    fontSize: t.fontSize.base,
    color: t.colors.ink,
  };
  const contextRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const guessLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const learned: TextStyle = { color: t.colors.amberText, fontFamily: 'Inter-Bold' as TextStyle['fontFamily'] };
  const finishLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontVariant: ['tabular-nums'],
  };

  return (
    <Card tone="raised" style={{ gap: t.space[4] }}>
      <View style={header}>
        <View style={{ flex: 1, gap: t.space[1.5] }}>
          <Text style={eyebrow}>NEXT · {categoryLabel.toUpperCase()}</Text>
          <Text style={title} numberOfLines={1}>
            {taskTitle}
          </Text>
        </View>
        <HonestNumber
          size="md"
          tone="ink"
          value={`~${summary.honestMinutes}`}
          unit="min"
          unitSize={t.fontSize.bodySm}
        />
      </View>

      <GapLine guessMin={summary.guessMinutes} honestMin={summary.honestMinutes} />

      <View style={contextRow}>
        <Text style={guessLabel}>
          guessed {summary.guessMinutes}
          {delta > 0 ? (
            <Text>
              {' · '}
              <Text style={learned}>+{delta} learned</Text>
            </Text>
          ) : null}
        </Text>
        <Text style={finishLabel}>done {finishClock}</Text>
      </View>

      <AppButton
        label="Start"
        variant="indigo"
        fullWidth
        icon={<Ionicons name="play" size={t.iconSize.sm} color={t.colors.onIndigo} />}
        onPress={onStart}
      />

      {showNudge ? (
        <OptimismNudge
          honestMin={summary.honestMinutes}
          category={category}
          guessMin={summary.guessMinutes}
          multiplier={summary.multiplier}
        />
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 4: Run the FocusCard test to verify it passes**

Run: `npx jest src/features/today/__tests__/FocusCard.test.tsx --testPathIgnorePatterns '/.claude/worktrees/'`
Expected: PASS. (If `CalibrationSummary` requires other fields, the `as unknown as CalibrationSummary` cast in the test already covers it; the component only reads `guessMinutes`, `honestMinutes`, `multiplier`, `basis`.)

- [ ] **Step 5: Wire `finishClock` in the screen**

In `src/app/(tabs)/index.tsx`:
- Add the import:

```ts
import { projectedFinish, formatClockMeridiem } from '@/src/lib/time';
```

- In the `FocusCard` JSX (the `focus && summary` branch), add the prop:

```tsx
            <FocusCard
              category={focus.category}
              categoryLabel={categoryName(focus.category)}
              taskTitle={focus.label}
              summary={summary}
              finishClock={formatClockMeridiem(projectedFinish(Date.now(), summary.honestMinutes))}
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
```

- [ ] **Step 6: Update the screen test's focus assertions**

In `src/features/today/__tests__/todayScreen.test.tsx`, the focus-card test currently asserts the OLD copy `guessed 15 min` and `+15 min`. Replace those two assertions:

```tsx
    expect(screen.getByText('Leave for work')).toBeOnTheScreen();
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('+15 learned')).toBeOnTheScreen();
    expect(screen.getByText('Start')).toBeOnTheScreen();
```

(Remove the old `screen.getByText('guessed 15 min')` and `screen.getByText('+15 min')` lines. Keep the empty-state negative assertions.)

- [ ] **Step 7: Run the screen test**

Run: `npx jest src/features/today/__tests__/todayScreen.test.tsx --testPathIgnorePatterns '/.claude/worktrees/'`
Expected: PASS (all suites in the file).

- [ ] **Step 8: Lint**

Run: `npx eslint src/features/today/FocusCard.tsx "src/app/(tabs)/index.tsx" src/features/today/__tests__/FocusCard.test.tsx src/features/today/__tests__/todayScreen.test.tsx`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/features/today/FocusCard.tsx "src/app/(tabs)/index.tsx" src/features/today/__tests__/FocusCard.test.tsx src/features/today/__tests__/todayScreen.test.tsx
git commit -m "feat(today): redesign FocusCard with honest-number hero, finish projection, Start button"
```

---

## Task 3: RunningFocusCard consistency pass

**Files:**
- Modify: `src/features/today/RunningFocusCard.tsx`

**Interfaces:**
- Consumes: `Card tone="raised"`.

- [ ] **Step 1: Switch the card tone + header alignment**

In `src/features/today/RunningFocusCard.tsx`:
- Change `<Card tone="focal" style={{ gap: t.space[4] }}>` to `<Card tone="raised" style={{ gap: t.space[4] }}>` (drops the indigo top border so it matches the redesigned FocusCard surface — no jump on start).
- In the `topline` style object, change `alignItems: 'center'` to `alignItems: 'flex-end'` so the elapsed clock baseline-aligns with the title block, matching FocusCard's header.

- [ ] **Step 2: Typecheck the file's project**

Run: `npm run typecheck`
Expected: clean (no errors).

- [ ] **Step 3: Lint**

Run: `npx eslint src/features/today/RunningFocusCard.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/today/RunningFocusCard.tsx
git commit -m "feat(today): match RunningFocusCard surface to redesigned FocusCard"
```

---

## Task 4: TaskRow redesign + edge token + verification

**Files:**
- Modify: `src/theme/tokens.ts`
- Modify: `src/features/today/TaskRow.tsx`
- Test: `src/features/today/__tests__/TaskRow.test.tsx` (new)

**Interfaces:**
- Consumes: `tokens.row.edgeW`, `tokens.row.edgeH` (added this task).
- Produces: `TaskRow` unchanged prop signature (`title`, `categoryLabel`, `honestMin`, `actualMin?`, `done?`, `onPress?`).

- [ ] **Step 1: Add the edge token**

In `src/theme/tokens.ts`, add a new top-level entry near `progress` (the interactive "you can start this" marker geometry):

```ts
  // The thin indigo left-edge on actionable Today rows (TaskRow) — a semantic
  // "interactive" marker (colors.primary), not a category color.
  row: { edgeW: 3, edgeH: 20 },
```

- [ ] **Step 2: Write the failing TaskRow test**

```tsx
// src/features/today/__tests__/TaskRow.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TaskRow } from '@/src/features/today/TaskRow';

describe('TaskRow', () => {
  it('queued: shows ink estimate, an interactive edge, and fires onPress', () => {
    const onPress = jest.fn();
    render(<TaskRow title="Buy groceries" categoryLabel="Errands" honestMin={25} onPress={onPress} />);
    expect(screen.getByText('~25')).toBeOnTheScreen();
    expect(screen.getByText('min')).toBeOnTheScreen();
    expect(screen.getByTestId('taskrow-edge')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Buy groceries'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('done: shows a "took N min" receipt with no strikethrough and no edge', () => {
    render(<TaskRow title="Writing an email" categoryLabel="Admin & email" honestMin={30} actualMin={35} done />);
    expect(screen.getByText('took')).toBeOnTheScreen();
    expect(screen.getByText('35')).toBeOnTheScreen();
    expect(screen.queryByTestId('taskrow-edge')).toBeNull();
    const title = screen.getByText('Writing an email');
    const flat = (Array.isArray(title.props.style) ? title.props.style : [title.props.style]).flat();
    expect(flat.some((s) => s && s.textDecorationLine === 'line-through')).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/features/today/__tests__/TaskRow.test.tsx --testPathIgnorePatterns '/.claude/worktrees/'`
Expected: FAIL — no `taskrow-edge` testID; current done row still has `line-through`.

- [ ] **Step 4: Rewrite TaskRow**

Replace the contents of `src/features/today/TaskRow.tsx` with:

```tsx
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// TaskRow — one Today list task, in two states:
//   • queued — pressable; a thin indigo left edge marks it "startable" (semantic,
//              not a category color). Title + category, the honest estimate pinned
//              to the row's bottom edge in ink. No play badge, no chevron — the
//              FocusCard owns the single filled-indigo "start" affordance.
//   • done   — non-interactive; leading success check, muted title (NO strikethrough
//              — the check + dimming say "done"; a strike would read as a scold),
//              "took N min" receipt. Kept on the day as visible progress.
// Flat surface + hairline. The estimate is ink (not muted) so it reads clearly at
// the same size as the body — clarity from contrast, not from a bigger number.
// ──────────────────────────────────────────────────────────────────────────────

interface TaskRowProps {
  title: string;
  categoryLabel: string;
  /** Learned honest estimate (minutes). Shown on queued rows. */
  honestMin: number;
  /** Actual minutes once finished. Shown on done rows when known. */
  actualMin?: number | null;
  done?: boolean;
  onPress?: () => void;
}

export function TaskRow({ title, categoryLabel, honestMin, actualMin, done = false, onPress }: TaskRowProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  function pressIn() {
    if (reducedMotion || done) return;
    opacity.set(withTiming(t.opacity.pressed, { duration: t.motion.fast }));
  }
  function pressOut() {
    if (reducedMotion || done) return;
    opacity.set(withTiming(1, { duration: t.motion.fast }));
  }

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
    minHeight: t.size.control.lg,
    position: 'relative',
    overflow: 'hidden',
    opacity: done ? 0.7 : 1,
  };
  // Semantic "interactive" edge — thin indigo bar, vertically centered, on queued rows only.
  const edge: ViewStyle = {
    position: 'absolute',
    left: 0,
    top: '50%',
    width: t.row.edgeW,
    height: t.row.edgeH,
    marginTop: -t.row.edgeH / 2,
    backgroundColor: t.colors.primary,
    borderTopRightRadius: t.row.edgeW,
    borderBottomRightRadius: t.row.edgeW,
  };
  const badge: ViewStyle = {
    width: t.space[8],
    height: t.space[8],
    borderRadius: t.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.successSoft,
  };
  const titleText: TextStyle = {
    ...(type.bodyLg as unknown as TextStyle),
    fontSize: t.fontSize.base,
    color: done ? t.colors.inkSoft : t.colors.ink,
  };
  const catText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const timeWrap: ViewStyle = { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'baseline', gap: t.space[0.5] };
  const estNum: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.base,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  const estUnit: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  const content = (
    <Animated.View style={[row, pressStyle]}>
      {done ? (
        <View style={badge}>
          <Ionicons name="checkmark" size={t.iconSize.sm} color={t.colors.success} />
        </View>
      ) : (
        <View testID="taskrow-edge" style={edge} />
      )}

      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <Text style={titleText} numberOfLines={1}>
          {title}
        </Text>
        <Text style={catText}>{categoryLabel}</Text>
      </View>

      {done ? (
        actualMin != null ? (
          <View style={timeWrap}>
            <Text style={estUnit}>took </Text>
            <Text style={estNum}>{actualMin}</Text>
            <Text style={estUnit}>min</Text>
          </View>
        ) : null
      ) : (
        <View style={timeWrap}>
          <Text style={estNum}>~{honestMin}</Text>
          <Text style={estUnit}>min</Text>
        </View>
      )}
    </Animated.View>
  );

  if (done || !onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${categoryLabel}, honest estimate ${honestMin} minutes. Tap to start.`}
    >
      {content}
    </Pressable>
  );
}
```

- [ ] **Step 5: Run the TaskRow test to verify it passes**

Run: `npx jest src/features/today/__tests__/TaskRow.test.tsx --testPathIgnorePatterns '/.claude/worktrees/'`
Expected: PASS (both cases).

- [ ] **Step 6: Full verification**

Run: `npx eslint src/theme/tokens.ts src/features/today/TaskRow.tsx src/features/today/__tests__/TaskRow.test.tsx && npm run typecheck && npx jest src/features/today src/components/__tests__/HonestNumber.test.tsx --testPathIgnorePatterns '/.claude/worktrees/'`
Expected: eslint clean; `tsc --noEmit` clean; all listed suites pass.

- [ ] **Step 7: Commit**

```bash
git add src/theme/tokens.ts src/features/today/TaskRow.tsx src/features/today/__tests__/TaskRow.test.tsx
git commit -m "feat(today): redesign TaskRow with interactive edge, ink minutes, no scold on done"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** FocusCard B (Task 2), 24px number (Task 1), finish projection (Task 2 wiring), RunningFocusCard consistency (Task 3), TaskRow B + edge token + no-strikethrough (Task 4). The Card `focal`→`raised` decision is applied per-component (FocusCard Task 2, RunningFocusCard Task 3); the shared `Card` is NOT edited (lower blast radius), matching spec §5 decision (a).
- **Type consistency:** `finishClock: string` is defined in Task 2's `FocusCardProps` and passed from `index.tsx` in the same task. `HonestNumber size="md"` (Task 1) is consumed in Task 2. `tokens.row.edgeW/edgeH` (Task 4 Step 1) are consumed in Task 4 Step 4.
- **No nested Pressable:** FocusCard is a plain `Card` (not pressable) with the `AppButton` as the sole action — avoids the double-fire of a Pressable-inside-Pressable. (Spec mentioned an optional whole-card tap; dropped deliberately to avoid the RN nested-pressable bug. The Start button is the affordance.)
- **finishClock in tests:** the screen test does not assert the clock value (it depends on `Date.now()`); the FocusCard unit test passes `finishClock="4:11pm"` explicitly and asserts `done 4:11pm`.
- **Amber/red:** `+{delta} learned` uses `amberText`; no red anywhere; done row has no strikethrough.
