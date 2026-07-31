# Forgot-to-stop Timer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual "Forgot to stop?" affordance to the live Timer that lets the user log a *corrected* finish time (retro, half-weight) instead of the inflated full elapsed.

**Architecture:** A quiet indigo text link under `PaceLabel` opens a bottom overlay (built like `ForgotCard`) offering `~5 / ~15 min ago` presets + a "Pick the exact time" `FinishTimeWheel`. Confirm calls a new `useTimer.onForgotStopAndLog(finishMs)` which logs via `timerStore.stop(finishMs)` + `applyLog({ source:'retro' })` — no new plumbing, since `stop(ts)` already derives `actualMin` from any timestamp.

**Tech Stack:** React Native + Expo, expo-router, Zustand stores, Reanimated (FadeIn only), Jest + @testing-library/react-native.

**Spec:** `docs/product/specs/forgot-to-stop-timer.md`

## Global Constraints

- **Tokens only** — every color/space/size/font from `src/theme/tokens.ts` via `useTheme()`. No inline hex/number. Dark + light must both read.
- **Lint 0 warnings** (`npm run lint`), **typecheck strict** (`npm run typecheck`), **`npm test` green** before every commit.
- **No guilt copy** — help framing only; no red, no shame, no streaks.
- **Honey/sharpness monotonic** — retro logs train, never subtract.
- **On-device only** — no network in this flow.
- **Animation rule** — overlay uses `FadeIn` opacity-only (no slide/spring); reduced-motion → final state.
- **One primary CTA** — the Forgot entry is *text* (indigo `primaryBright`), never a filled button; `Stop & log` stays the one filled CTA.
- **Retro weight** — `source:'retro'` (halves EWMA alpha via `RETRO_ALPHA_FACTOR` in `src/engine/ewma.ts`). Honest for an approximate finish.
- **Quick-start** — the link is hidden when `timer.isQuickStart` (no honest anchor to correct).
- **Copy pass** — final user-facing strings run through `conversion-psychology` + `humanizer` (drafts below are starting points).

---

### Task 1: Pure preset builder

**Files:**
- Create: `src/features/timer/forgotPresets.ts`
- Test: `src/features/timer/__tests__/forgotPresets.test.ts`

**Interfaces:**
- Produces: `buildForgotPresets(elapsedMin: number): ForgotPreset[]` where `ForgotPreset = { offsetMin: number; actualMin: number }`. Offsets `[5, 15]`; a preset is included iff `actualMin = floor(elapsedMin) − offsetMin ≥ 1`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/timer/__tests__/forgotPresets.test.ts
import { buildForgotPresets } from '../forgotPresets';

describe('buildForgotPresets', () => {
  it('returns both presets when elapsed is well past 15m', () => {
    expect(buildForgotPresets(32)).toEqual([
      { offsetMin: 5, actualMin: 27 },
      { offsetMin: 15, actualMin: 17 },
    ]);
  });

  it('floors a fractional elapsed before subtracting', () => {
    expect(buildForgotPresets(32.9)).toEqual([
      { offsetMin: 5, actualMin: 27 },
      { offsetMin: 15, actualMin: 17 },
    ]);
  });

  it('drops a preset whose corrected actual would be < 1m', () => {
    // elapsed 16 → 5-ago = 11 (ok), 15-ago = 1 (ok)
    expect(buildForgotPresets(16)).toEqual([
      { offsetMin: 5, actualMin: 11 },
      { offsetMin: 15, actualMin: 1 },
    ]);
    // elapsed 15 → 15-ago = 0 (dropped)
    expect(buildForgotPresets(15)).toEqual([{ offsetMin: 5, actualMin: 10 }]);
  });

  it('returns [] when elapsed is under 6m (no valid preset)', () => {
    expect(buildForgotPresets(5)).toEqual([]);
    expect(buildForgotPresets(0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/timer/__tests__/forgotPresets.test.ts`
Expected: FAIL — "Cannot find module '../forgotPresets'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/timer/forgotPresets.ts
// Fixed "minutes ago you finished" offsets for the manual Forgot-to-stop sheet.
// A preset is only offered when its corrected actual is a real (≥1m) duration.
export interface ForgotPreset {
  /** How many minutes ago the user says they finished. */
  offsetMin: number;
  /** The actual minutes that offset would log = floor(elapsed) − offset. */
  actualMin: number;
}

const OFFSETS_MIN = [5, 15] as const;

export function buildForgotPresets(elapsedMin: number): ForgotPreset[] {
  const elapsed = Math.floor(elapsedMin);
  return OFFSETS_MIN
    .map((offsetMin) => ({ offsetMin, actualMin: elapsed - offsetMin }))
    .filter((p) => p.actualMin >= 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/timer/__tests__/forgotPresets.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/timer/forgotPresets.ts src/features/timer/__tests__/forgotPresets.test.ts
git add src/features/timer/forgotPresets.ts src/features/timer/__tests__/forgotPresets.test.ts
git commit -m "feat(timer): add forgot-to-stop preset builder"
```

---

### Task 2: `useTimer` — shared reward tail + `onForgotStopAndLog` + `onForgotNotSure`

**Files:**
- Modify: `src/features/timer/useTimer.ts` (extract helper from `onStopAndLog` ~448–537; add two callbacks; extend `UseTimerResult`)
- Test: `src/features/timer/__tests__/useTimer.forgot.test.tsx`

**Interfaces:**
- Consumes: `useTimerStore().stop(finishMs: number) => { actualMin: number }`, `useCalibrationStore().applyLog(ApplyLogParams)`.
- Produces (added to `UseTimerResult`):
  - `onForgotStopAndLog: (finishMs: number, method: 'preset' | 'wheel') => Promise<void>` — stops at `finishMs`, logs `status:'completed', source:'retro'`, navigates to reward.
  - `onForgotNotSure: () => Promise<void>` — stops now, logs `status:'partial', source:'retro'` (never trains), dismisses to Today (no reward).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/timer/__tests__/useTimer.forgot.test.tsx
import { renderHook, act } from '@testing-library/react-native';
import { useTimer } from '../useTimer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { createMemoryDatabase } from '@/src/db';

const mockReplace = jest.fn();
const mockDismiss = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), dismiss: (...a: unknown[]) => mockDismiss(...a), push: jest.fn() },
}));

const params = { taskId: undefined, label: 'Write proposal', category: 'Work', estimateMin: 30, guessMin: 25 };

describe('useTimer forgot-to-stop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCalibrationStore.getState().setDatabase(createMemoryDatabase());
    // Seed a running session started 32m ago so the hook attaches (no fresh start()).
    const startedAt = Date.now() - 32 * 60_000;
    useTimerStore.setState({ isRunning: true, isQuickStart: false, startedAt, taskLabel: 'Write proposal',
      category: 'Work', estimateMin: 30, guessMin: 25, taskId: null, suggestedHonestMin: 30, pausedAccumMs: 0, guardNudged: false } as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('onForgotStopAndLog logs a completed retro at the corrected finish and goes to reward', async () => {
    const spy = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    const { result } = renderHook(() => useTimer(params));
    const startedAt = useTimerStore.getState().startedAt as number;
    const finishMs = startedAt + 17 * 60_000; // "15 min ago" of a 32m elapsed

    await act(async () => { await result.current.onForgotStopAndLog(finishMs, 'preset'); });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', source: 'retro', actualMin: 17, estimateMin: 25 }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/(modals)/reward');
  });

  it('onForgotNotSure logs a partial retro and dismisses (no reward)', async () => {
    const spy = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    const { result } = renderHook(() => useTimer(params));

    await act(async () => { await result.current.onForgotNotSure(); });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial', source: 'retro' }));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/timer/__tests__/useTimer.forgot.test.tsx`
Expected: FAIL — `result.current.onForgotStopAndLog is not a function`.

- [ ] **Step 3a: Add `LogSource` to the domain type import**

In `src/features/timer/useTimer.ts`, extend the existing type import:

```ts
import type { AdaptSpeed, CalibrationConfidence, HonestRange, LogSource } from '@/src/domain/types';
```

- [ ] **Step 3b: Extract the shared reward tail**

Add this `useCallback` ABOVE `onStopAndLog` (it captures the same stable closure vars):

```ts
  // Shared tail for every "completed" stop path: write the calibration log, fire
  // the first-completion activation event, set the reward, flip Today + plan
  // bookkeeping, then navigate to the reward. Both the normal Stop (timed) and the
  // manual Forgot (retro) funnel through here — only actualMin + source differ.
  const logCompletedAndReward = useCallback(
    async (args: { actualMin: number; source: LogSource; label: string; category: string }) => {
      const { actualMin, source, label: resolvedLabel, category: resolvedCategory } = args;
      const adaptSpeed: AdaptSpeed =
        useCategoriesStore.getState().categories.find((c) => c.id === resolvedCategory)?.adaptSpeed ??
        'balanced';

      const result = await applyLog({
        category: resolvedCategory,
        estimateMin: guessMin,
        actualMin,
        status: 'completed',
        source,
        adaptSpeed,
        label: resolvedLabel,
        suggestedHonestMin,
        startedAt: startedAtRef.current ?? undefined,
      });

      if (!firstTaskCompletedFiredRef.current) {
        void useCalibrationStore.getState().loadReclaimSummary().then((summary) => {
          if (summary.companion.lifetimeNectar === 1 && !firstTaskCompletedFiredRef.current) {
            firstTaskCompletedFiredRef.current = true;
            analytics.capture('first_task_completed');
          }
        }).catch(() => { /* analytics fire-and-forget; never break the core loop */ });
      }

      useRewardStore.getState().setReward({ actualMin, guessMin, category: resolvedCategory, label: resolvedLabel, result });

      if (taskId) {
        useDayTasksStore.getState().completeTask(taskId, { completedAt: Date.now(), actualMin });
        void useDayTasksStore.getState().reload();
      }
      if (taskId) {
        const planStore = usePlanStore.getState();
        const planActive = planStore.active;
        if (planActive !== null) {
          const planTask = planActive.tasks.find((t) => t.id === taskId);
          if (planTask?.status === 'running') planStore.completeTask(taskId, actualMin);
        }
      }

      router.replace('/(modals)/reward');
    },
    [applyLog, guessMin, suggestedHonestMin, taskId],
  );
```

- [ ] **Step 3c: Slim `onStopAndLog` to use the helper**

Replace the body of `onStopAndLog` FROM the `const resolvedLabel =` line THROUGH `router.replace('/(modals)/reward');` with:

```ts
    const resolvedLabel = labelOverride ?? label;
    const resolvedCategory = categoryOverride ?? category;
    await logCompletedAndReward({ actualMin, source: 'timed', label: resolvedLabel, category: resolvedCategory });
```

Update its dep array to: `[stop, logCompletedAndReward, category, label, clearOverrunTimer]`.

- [ ] **Step 3d: Add `onForgotStopAndLog` and `onForgotNotSure`**

Add after `onStopAndLog`:

```ts
  // Manual "I forgot to stop — I finished at finishMs". stop(finishMs) derives the
  // corrected actualMin from that timestamp; the log is source:'retro' (half weight)
  // because a reconstructed finish is approximate. Mirrors onStopAndLog's teardown.
  const onForgotStopAndLog = useCallback(
    async (finishMs: number, method: 'preset' | 'wheel') => {
      stoppingLocallyRef.current = true;
      clearOverrunTimer();
      const { actualMin } = stop(finishMs);
      void cancelTimerDone();
      void cancelGuardCheckIn();
      endFinishTimeActivity();
      const elapsedMin = Math.max(0, Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 60_000));
      analytics.capture('forgot_stop_logged', {
        method,
        corrected_min: actualMin,
        elapsed_min: elapsedMin,
        delta_min: Math.max(0, elapsedMin - actualMin),
      });
      await logCompletedAndReward({ actualMin, source: 'retro', label, category });
    },
    [stop, clearOverrunTimer, logCompletedAndReward, label, category],
  );

  // "Not sure yet" — stop now, record a PARTIAL retro (never trains, excluded from
  // the model) as best-effort history, then dismiss to Today. No reward (nothing to
  // celebrate) and never a guilt beat.
  const onForgotNotSure = useCallback(async () => {
    stoppingLocallyRef.current = true;
    clearOverrunTimer();
    const { actualMin } = stop(Date.now());
    void cancelTimerDone();
    void cancelGuardCheckIn();
    endFinishTimeActivity();
    const adaptSpeed: AdaptSpeed =
      useCategoriesStore.getState().categories.find((c) => c.id === category)?.adaptSpeed ?? 'balanced';
    try {
      await applyLog({
        category,
        estimateMin: guessMin,
        actualMin,
        status: 'partial',
        source: 'retro',
        adaptSpeed,
        label,
        startedAt: startedAtRef.current ?? undefined,
      });
    } catch {
      /* history log is best-effort; teardown + dismiss must still happen */
    }
    router.dismiss();
  }, [stop, clearOverrunTimer, applyLog, category, guessMin, label]);
```

- [ ] **Step 3e: Expose them**

Add to the `UseTimerResult` interface:

```ts
  /** Manual forgot-to-stop: log a corrected completed retro at finishMs, then reward. */
  onForgotStopAndLog: (finishMs: number, method: 'preset' | 'wheel') => Promise<void>;
  /** Manual forgot-to-stop escape: log a partial (never trains) and dismiss. */
  onForgotNotSure: () => Promise<void>;
```

And add `onForgotStopAndLog, onForgotNotSure,` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/timer/__tests__/useTimer.forgot.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Regression + lint + commit**

```bash
npx jest src/features/timer src/stores/__tests__/timerStore.test.ts
npx eslint src/features/timer/useTimer.ts src/features/timer/__tests__/useTimer.forgot.test.tsx
git add src/features/timer/useTimer.ts src/features/timer/__tests__/useTimer.forgot.test.tsx
git commit -m "feat(timer): log corrected forgot-to-stop finish as retro"
```

Expected: existing `useTimer.*` + `timerStore` suites still green (guards the shared-helper refactor).

---

### Task 3: `ForgotStopSheet` overlay component

**Files:**
- Create: `src/features/timer/ForgotStopSheet.tsx`
- Test: `src/features/timer/__tests__/ForgotStopSheet.test.tsx`

**Interfaces:**
- Consumes: `buildForgotPresets` (Task 1), `FinishTimeWheel` (`valueMs`, `mode='be done by'`, `showModes={false}`, `onChange(ms)`), `AppButton`, `AppText`, `useTheme`, `haptics`, `formatClock`.
- Produces: `ForgotStopSheet(props)` where
  ```ts
  interface ForgotStopSheetProps {
    startedAt: number;
    elapsedMin: number;
    honestMin: number;
    onConfirm: (finishMs: number, method: 'preset' | 'wheel') => void;
    onStillGoing: () => void;
    onNotSure: () => void;
  }
  ```
  A preset maps to `finishMs = startedAt + actualMin * 60_000`. The wheel default is `clamp(startedAt + honestMin*60_000, startedAt + 60_000, Date.now())`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/timer/__tests__/ForgotStopSheet.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ForgotStopSheet } from '../ForgotStopSheet';

// Mock the wheel to a button that emits a fixed finish ms via onChange, so the
// picker-mode confirm can be asserted without driving a real drum scroll.
jest.mock('@/src/features/planner/FinishTimeWheel', () => {
  const { Pressable, Text } = require('react-native');
  return {
    FinishTimeWheel: ({ onChange }: { onChange: (ms: number) => void }) => (
      <Pressable testID="wheel" onPress={() => onChange(1_000 + 22 * 60_000)}>
        <Text>wheel</Text>
      </Pressable>
    ),
  };
});

const baseProps = {
  startedAt: 1_000,
  elapsedMin: 32,
  honestMin: 30,
  onConfirm: jest.fn(),
  onStillGoing: jest.fn(),
  onNotSure: jest.fn(),
};

describe('ForgotStopSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders both presets with corrected labels', () => {
    const { getByText } = render(<ForgotStopSheet {...baseProps} />);
    expect(getByText(/~5 min ago/)).toBeTruthy();
    expect(getByText(/27m/)).toBeTruthy();
    expect(getByText(/~15 min ago/)).toBeTruthy();
    expect(getByText(/17m/)).toBeTruthy();
  });

  it('pressing a preset confirms with startedAt + actualMin', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(<ForgotStopSheet {...baseProps} onConfirm={onConfirm} />);
    fireEvent.press(getByText(/~5 min ago/));
    expect(onConfirm).toHaveBeenCalledWith(1_000 + 27 * 60_000, 'preset');
  });

  it('"Pick the exact time" reveals the wheel and confirms its value', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(<ForgotStopSheet {...baseProps} onConfirm={onConfirm} />);
    fireEvent.press(getByText(/pick the exact time/i));
    fireEvent.press(getByTestId('wheel')); // emits 1_000 + 22m
    fireEvent.press(getByText(/^Log /)); // confirm button
    expect(onConfirm).toHaveBeenCalledWith(1_000 + 22 * 60_000, 'wheel');
  });

  it('shows only the wheel path when no preset is valid (elapsed < 6)', () => {
    const { queryByText, getByText } = render(<ForgotStopSheet {...baseProps} elapsedMin={4} />);
    expect(queryByText(/min ago/)).toBeNull();
    expect(getByText(/pick the exact time/i)).toBeTruthy();
  });

  it('footer routes Still going and Not sure yet', () => {
    const onStillGoing = jest.fn();
    const onNotSure = jest.fn();
    const { getByText } = render(<ForgotStopSheet {...baseProps} onStillGoing={onStillGoing} onNotSure={onNotSure} />);
    fireEvent.press(getByText(/still going/i));
    fireEvent.press(getByText(/not sure yet/i));
    expect(onStillGoing).toHaveBeenCalled();
    expect(onNotSure).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/timer/__tests__/ForgotStopSheet.test.tsx`
Expected: FAIL — "Cannot find module '../ForgotStopSheet'".

- [ ] **Step 3: Write the component**

```tsx
// src/features/timer/ForgotStopSheet.tsx
import { useState } from 'react';
import { View, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import { formatClock } from '@/src/lib/time';
import { FinishTimeWheel } from '@/src/features/planner/FinishTimeWheel';
import { buildForgotPresets } from '@/src/features/timer/forgotPresets';

// ──────────────────────────────────────────────────────────────────────────────
// ForgotStopSheet — manual "I forgot to stop" recovery on the LIVE timer. Same
// overlay construction as ForgotCard (scrimOverlay dim + surfaceRaised card), but
// driven by props off the running session rather than forgotStore.pending.
//
//  • choices — amber presets ("~5/~15 min ago · Nm"), each stating what it logs,
//    plus a ghost "Pick the exact time". No "About now" (that's just Stop & log).
//  • picker  — FinishTimeWheel; the confirm shows the minutes it will log.
//
// Amber marks the LOG actions (presets + the picker confirm); navigation is ghost.
// Motion: opacity-only FadeIn (animation hard rule); reduced-motion → final state.
// ──────────────────────────────────────────────────────────────────────────────

export interface ForgotStopSheetProps {
  startedAt: number;
  elapsedMin: number;
  honestMin: number;
  onConfirm: (finishMs: number, method: 'preset' | 'wheel') => void;
  onStillGoing: () => void;
  onNotSure: () => void;
}

export function ForgotStopSheet({
  startedAt, elapsedMin, honestMin, onConfirm, onStillGoing, onNotSure,
}: ForgotStopSheetProps): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const [mode, setMode] = useState<'choices' | 'picker'>('choices');
  const [pickedMs, setPickedMs] = useState<number | null>(null);

  const presets = buildForgotPresets(elapsedMin);
  const stepMs = 5 * 60_000;
  const nowMs = Date.now();
  const defaultFinishMs = Math.min(
    nowMs,
    Math.max(startedAt + 60_000, Math.round((startedAt + Math.max(1, honestMin) * 60_000) / stepMs) * stepMs),
  );
  const finishMs = pickedMs ?? defaultFinishMs;
  const clampedFinishMs = Math.min(nowMs, Math.max(startedAt + 60_000, finishMs));
  const pickedActualMin = Math.max(1, Math.round((clampedFinishMs - startedAt) / 60_000));

  const card: ViewStyle = {
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    padding: t.space[5],
    gap: t.space[4],
  };
  const heading: TextStyle = { ...(type.subtitle as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as TextStyle), color: t.colors.inkSoft };
  const skip: TextStyle = { ...(type.caption as TextStyle), color: t.colors.inkFaint };
  const enter = reducedMotion ? undefined : FadeIn.duration(t.motion.base);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Animated.View entering={enter} style={[StyleSheet.absoluteFillObject, { backgroundColor: t.colors.scrimOverlay }]} />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: insets.bottom + t.space[4], paddingHorizontal: t.space[4] }}>
        <Animated.View entering={enter} style={card} accessibilityViewIsModal accessibilityLiveRegion="polite">
          {mode === 'choices' ? (
            <>
              <AppText style={heading}>When did you actually stop?</AppText>
              <AppText style={body}>
                {`The timer kept running past your finish. Pick when you really stopped — I’ll log that, not the full ${Math.floor(elapsedMin)}m.`}
              </AppText>
              <View style={{ gap: t.space[2.5] }}>
                {presets.map((p) => (
                  <AppButton
                    key={p.offsetMin}
                    label={`~${p.offsetMin} min ago  ·  ${p.actualMin}m`}
                    variant="amber"
                    size="md"
                    fullWidth
                    onPress={() => {
                      haptics.selection();
                      onConfirm(startedAt + p.actualMin * 60_000, 'preset');
                    }}
                  />
                ))}
                <AppButton
                  label="Pick the exact time"
                  variant="ghost"
                  size="md"
                  fullWidth
                  onPress={() => { haptics.light(); setMode('picker'); }}
                />
              </View>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.hairline }} />
              <View style={{ flexDirection: 'row', gap: t.space[2.5] }}>
                <View style={{ flex: 1 }}>
                  <AppButton label="Still going" variant="ghost" size="md" fullWidth onPress={onStillGoing} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Not sure yet — stop without a trained log"
                  onPress={onNotSure}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <AppText style={skip}>Not sure yet</AppText>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <AppText style={heading}>When did you finish?</AppText>
              <AppText style={body}>Spin to the time you actually stopped.</AppText>
              <View style={{ paddingVertical: t.space[2] }}>
                <FinishTimeWheel valueMs={clampedFinishMs} mode="be done by" showModes={false} onChange={(ms) => setPickedMs(ms)} />
              </View>
              <AppButton
                label={`Log ${formatClock(clampedFinishMs)}  ·  ${pickedActualMin}m`}
                variant="amber"
                size="md"
                fullWidth
                onPress={() => { haptics.selection(); onConfirm(clampedFinishMs, 'wheel'); }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to the quick options"
                onPress={() => { haptics.light(); setMode('choices'); }}
                style={{ alignItems: 'center', justifyContent: 'center', paddingTop: t.space[1] }}
              >
                <AppText style={skip}>Back</AppText>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/timer/__tests__/ForgotStopSheet.test.tsx`
Expected: PASS (5 tests). If `haptics`/`type`/`AppButton` need env mocks, mirror `ForgotCard.test.tsx` (it renders the same primitives with no extra mocks — none should be needed).

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/timer/ForgotStopSheet.tsx src/features/timer/__tests__/ForgotStopSheet.test.tsx
git add src/features/timer/ForgotStopSheet.tsx src/features/timer/__tests__/ForgotStopSheet.test.tsx
git commit -m "feat(timer): add ForgotStopSheet overlay"
```

---

### Task 4: Wire the link + sheet into the Timer screen

**Files:**
- Modify: `src/app/(modals)/timer.tsx` (`TimerScreen`: add `forgotOpen` state, the link under `PaceLabel`, and the sheet render + confirm routing)
- Test: `src/features/timer/__tests__/timerScreen.forgot.test.tsx`

**Interfaces:**
- Consumes: `timer.onForgotStopAndLog` / `timer.onForgotNotSure` (Task 2), `ForgotStopSheet` (Task 3), `timer.isQuickStart`, `timer.elapsedSec`, `timer.startedAt`, `estimateMin` (honest anchor).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/timer/__tests__/timerScreen.forgot.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Timer from '@/src/app/(modals)/timer';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { createMemoryDatabase } from '@/src/db';

const mockReplace = jest.fn();
const mockDismiss = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), dismiss: (...a: unknown[]) => mockDismiss(...a), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));

describe('Timer screen — forgot-to-stop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCalibrationStore.getState().setDatabase(createMemoryDatabase());
    const startedAt = Date.now() - 32 * 60_000;
    mockParams = { label: 'Write proposal', category: 'Work', estimateMin: '30', guessMin: '25' };
    useTimerStore.setState({ isRunning: true, isQuickStart: false, startedAt, taskLabel: 'Write proposal',
      category: 'Work', estimateMin: 30, guessMin: 25, taskId: null, suggestedHonestMin: 30, pausedAccumMs: 0, guardNudged: false } as never);
  });

  it('opens the sheet from the link and logs a corrected retro on a preset', async () => {
    const spy = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    const { getByText } = render(<Timer />);
    fireEvent.press(getByText(/forgot to stop/i));
    fireEvent.press(getByText(/~15 min ago/));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', source: 'retro', actualMin: 17 }));
      expect(mockReplace).toHaveBeenCalledWith('/(modals)/reward');
    });
  });

  it('hides the link on a quick-start session', () => {
    useTimerStore.setState({ isQuickStart: true } as never);
    mockParams = { quick: '1' };
    const { queryByText } = render(<Timer />);
    expect(queryByText(/forgot to stop/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/timer/__tests__/timerScreen.forgot.test.tsx`
Expected: FAIL — no "Forgot to stop?" element found.

- [ ] **Step 3a: Import the sheet + state**

In `src/app/(modals)/timer.tsx`, add the import near the other feature imports:

```ts
import { ForgotStopSheet } from '@/src/features/timer/ForgotStopSheet';
```

Inside `TimerScreen`, add state (near `showCaptureSheet`):

```ts
  const [forgotOpen, setForgotOpen] = useState(false);
```

- [ ] **Step 3b: Add the link under `PaceLabel`**

In the bottom controls block, immediately AFTER `<PaceLabel … />` and BEFORE `<View style={controlsRow}>`, add (only when not quick-start):

```tsx
          {!timer.isQuickStart ? (
            <Pressable
              onPress={() => { haptics.light(); setForgotOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel="Forgot to stop the timer earlier"
              hitSlop={t.size.hitSlop}
              style={{ alignSelf: 'center', paddingVertical: t.space[1] }}
            >
              <AppText
                style={{
                  ...(type.caption as TextStyle),
                  color: t.colors.primaryBright,
                  textDecorationLine: 'underline',
                }}
              >
                Forgot to stop?
              </AppText>
            </Pressable>
          ) : null}
```

(`haptics` is already imported in `timer.tsx`; `type` is imported; `TextStyle` is imported.)

- [ ] **Step 3c: Render the sheet**

At the end of `TimerScreen`'s JSX, alongside the other conditionally-mounted overlays (after the `showCaptureSheet` block), add:

```tsx
        {forgotOpen ? (
          <ForgotStopSheet
            startedAt={timer.startedAt}
            elapsedMin={Math.floor(timer.elapsedSec.get() / 60)}
            honestMin={estimateMin}
            onConfirm={(finishMs, method) => {
              setForgotOpen(false);
              void timer.onForgotStopAndLog(finishMs, method);
            }}
            onStillGoing={() => setForgotOpen(false)}
            onNotSure={() => {
              setForgotOpen(false);
              void timer.onForgotNotSure();
            }}
          />
        ) : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/timer/__tests__/timerScreen.forgot.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Full gate + commit**

```bash
npm run lint
npm run typecheck
npx jest src/features/timer
git add src/app/'(modals)'/timer.tsx src/features/timer/__tests__/timerScreen.forgot.test.tsx
git commit -m "feat(timer): surface Forgot-to-stop link + sheet on the live timer"
```

Expected: 0 lint warnings, typecheck clean, timer suite green.

---

### Task 5: Device / simulator visual verify (no code unless a fix falls out)

**Files:** none (verification). Any fix loops back to Task 3/4.

- [ ] **Step 1: Deep-link to a running timer**

```bash
xcrun simctl openurl booted "whenbee:///timer?label=Write%20proposal&category=Work&estimateMin=30&guessMin=25"
```

Wait ~15s for JS boot; let it run a couple minutes (or seed a back-dated session).

- [ ] **Step 2: Screenshot the entry + sheet**

Tap `Forgot to stop?` on the sim, then:

```bash
xcrun simctl io booted screenshot /tmp/forgot-entry.png
```

- [ ] **Step 3: Critique against the checklist (spec §Visual-verify)**
  - Two amber presets: do they read as one warm choice-pair, not two competing filled primaries? If heavy, switch the preset face to `accentSoft` + `amberText` (keep the semantic) and re-shoot.
  - Indigo link weight vs the ring/CTA — if it pulls the eye too hard, drop to `t.colors.inkSoft`.
  - Spacing/type on the token scale; amber only on log actions.
  - **Any throwaway timer you stop on-device LOGS into calibration** — end test runs via the sheet's "Still going" (no log) or reset the `Work` category afterward, and tell the founder which logs were added.

- [ ] **Step 4: If a visual fix was needed, commit it**

```bash
git add -A && git commit -m "fix(timer): tune Forgot-to-stop sheet emphasis from device review"
```

---

## Self-Review

**Spec coverage:**
- Entry link above controls, indigo, text-only, hidden on quick-start → Task 4 (3b) ✅
- Sheet overlay reusing ForgotCard language, presets amber / pick-exact ghost, no "About now" → Task 3 ✅
- Presets 5 & 15, `E−N ≥ 1` gating, wheel-only fallback → Task 1 + Task 3 ✅
- Pick-exact wheel default = honest finish clamped `[start+1m, now]` → Task 3 ✅
- Corrected log via `stop(finishMs)` + `source:'retro'` → Task 2 ✅
- "Still going" (keep running) / "Not sure yet" (partial, no train, dismiss) → Task 2 + Task 3/4 ✅
- Shared reward-tail DRY refactor guarded by regression → Task 2 (Step 5) ✅
- Analytics `forgot_stop_logged` → Task 2 (3d) ✅
- Visual verify (two-amber weight, link weight) → Task 5 ✅
- Reduced-motion / guardrail-dim / clamp edge cases → Task 3 (FadeIn guard, clamp) + inherited footer dim ✅

**Placeholder scan:** none — every step ships real code/commands.

**Type consistency:** `onForgotStopAndLog(finishMs, method)` and `onForgotNotSure()` signatures match across Task 2 (definition + interface), Task 3 (`onConfirm` shape), and Task 4 (call sites). `ForgotPreset { offsetMin, actualMin }` consistent Task 1↔3. `buildForgotPresets` name consistent. `source:'retro'` / `status:'partial'` match `LogSource`/`LogStatus`.

---

## Execution Handoff

Choose after review.
