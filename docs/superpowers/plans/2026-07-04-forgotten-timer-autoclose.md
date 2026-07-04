# Forgotten-timer protection: smart auto-close + recovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a timer runs well past the honest number and the user isn't looking, Whenbee auto-closes it on next foreground at the *predicted* finish, offers a one-tap recovery, and never trains the calibration model on an unconfirmed overrun.

**Architecture:** Evolves the existing hyperfocus-guardrail machinery. A new pure engine module computes nudge/close thresholds from the honest number and a user preset. A foreground check detects a "forgotten" running session from wall-clock, stops the runaway, and parks a pending record. A recovery card resolves it: confirm → trains at retro half-weight; still-going → reopens; ignore → stays a `partial` row that never trains.

**Tech Stack:** TypeScript (strict), React Native + Expo (SDK 54), Zustand, expo-sqlite/kv-store, Reanimated, Jest.

## Global Constraints

- **Pure engine:** `src/engine/**` has no React/RN/Expo, no `Date.now()`/clock. Constants live in `src/engine/constants.ts`, not inline. (project rule)
- **Only `status:'completed'` trains** the model; `partial`/`abandoned` are stored but never trained. `source:'retro'` trains at half alpha (`RETRO_ALPHA_FACTOR = 0.5`). (`src/domain/types.ts:12-15`)
- **Layer boundary (ESLint):** `src/app/**` and `src/components/**` must NOT import `@/src/services/*` or `@/src/db/*` — route through a store/provider/feature hook.
- **Every spacing/size/font/color from a theme token** via `useTheme()`; add to `src/theme/tokens.ts` if missing. No inline raw numbers/hex. New token group needs a matching line in `useTheme`'s `resolveTheme`.
- **No guilt, ever. Amber never becomes red. No streaks.** Honey/sharpness is monotonic. (product invariants)
- **Core loop is on-device-only** — no network call in guess → timer → learn. (product invariant)
- **Modals:** any `(modals)/` route needs `headerShown: false` in `_layout.tsx`; slide-up sheets start with `<SheetGrabber />`; formSheet routes need the `unstable_settings` anchor.
- **Animation:** no slide-in/bounce on content entrances; fades/opacity/scale-settle only; reduced-motion → final state.
- **All user-facing copy** passes through `conversion-psychology` + `humanizer` skills; no guilt/shame language.
- **Verify before done:** `npx eslint <files>` (flat `eslint.config.js`), `npm run typecheck`, affected `npx jest <path>`, then `npm test`.
- **Commits:** Conventional Commits; NO AI/co-author attribution of any kind. Never branch or merge without explicit founder approval.

---

## File structure

**Engine (pure):**
- Create `src/engine/autoClose.ts` — threshold + decision math.
- Modify `src/engine/constants.ts` — preset factors, grace, default.
- Modify `src/engine/index.ts` — re-export.
- Create `src/engine/__tests__/autoClose.test.ts`.

**Domain:**
- Modify `src/domain/types.ts` — `ForgotStepIn` type; `PendingAutoClose` shape.

**Stores:**
- Modify `src/stores/settingsStore.ts` — `forgotStepIn` + setter (persisted); `forgotProtectSeen` one-time flag.
- Create `src/stores/forgotStore.ts` — holds the pending recovery record.
- Modify `src/stores/timerStore.ts` — `stopSilently()` (clear runaway without a log) + `reopen(snapshot)` (restore a session at its original `startedAt`).

**Feature (timer):**
- Create `src/features/timer/useForgotCheck.ts` — foreground/boot detection → forgotStore.
- Create `src/features/timer/ForgotCard.tsx` — recovery presets UI.
- Modify `src/features/timer/useTimer.ts` — unify nudge arming (free preset OR Pro guardrail).

**Settings UI:**
- Create `src/features/settings/ForgotStepInRow.tsx` — free 3-preset row.

**Wiring:**
- Modify `src/app/_layout.tsx` — mount `useForgotCheck` + render `ForgotCard` host.

**Out of scope (separate plans):** iOS Live Activity + one-tap Done + native background auto-close (P2, gated on paid Apple team). Motion/context-aware detection (#3).

---

## Task 1: Engine — preset factors + threshold/decision math

**Files:**
- Modify: `src/engine/constants.ts`
- Modify: `src/domain/types.ts`
- Create: `src/engine/autoClose.ts`
- Modify: `src/engine/index.ts`
- Test: `src/engine/__tests__/autoClose.test.ts`

**Interfaces:**
- Produces:
  - `type ForgotStepIn = 'room' | 'balanced' | 'early'`
  - `FORGOT_STEP_IN_FACTORS: Record<ForgotStepIn, number>` = `{ room: 2, balanced: 1.5, early: 1.25 }`
  - `DEFAULT_FORGOT_STEP_IN: ForgotStepIn` = `'balanced'`
  - `FORGOT_GRACE_MIN = 20`
  - `nudgeThresholdMin(input: { honestMin: number; stepIn: ForgotStepIn }): number | null`
  - `closeThresholdMin(input: { honestMin: number; stepIn: ForgotStepIn }): number | null`
  - `autoCloseDecision(input: { elapsedMin: number; honestMin: number; stepIn: ForgotStepIn }): { shouldAutoClose: boolean; recoveredActualMin: number }`

- [ ] **Step 1: Add the type to `src/domain/types.ts`**

Below the existing `GuardrailMultiple` block (around line 232) add:

```typescript
/** Free forgot-to-stop protection preset — how soon Whenbee steps in past the
 *  honest number. Maps to a multiple in the engine. Default 'balanced'. */
export type ForgotStepIn = 'room' | 'balanced' | 'early';
```

- [ ] **Step 2: Add constants to `src/engine/constants.ts`**

After the Hyperfocus guardrail block (after `GUARDRAIL_MIN_THRESHOLD_MIN`), add:

```typescript
// ── Forgot-to-stop protection (free safety net) ──────────────────────────────
import type { ForgotStepIn } from '../domain/types';

/** Nudge multiple of the honest number per preset. Auto-close follows a grace
 *  window later. 'early' is the earliest, 'room' the most forgiving. */
export const FORGOT_STEP_IN_FACTORS: Record<ForgotStepIn, number> = {
  room: 2,
  balanced: 1.5,
  early: 1.25,
};
/** Default on a fresh install — the free net is ON by default. */
export const DEFAULT_FORGOT_STEP_IN: ForgotStepIn = 'balanced';
/** Minutes of continued no-interaction past the nudge before auto-close. */
export const FORGOT_GRACE_MIN = 20;
```

Note: `GuardrailMultiple` is already imported at the top; add `ForgotStepIn` to that same `import type { ... } from '../domain/types'` line instead of a second import if the linter prefers one import. (The block above shows a standalone import for clarity — merge it into the existing type-import line to satisfy `import/no-duplicates`.)

- [ ] **Step 3: Write the failing test `src/engine/__tests__/autoClose.test.ts`**

```typescript
import {
  nudgeThresholdMin,
  closeThresholdMin,
  autoCloseDecision,
} from '../autoClose';
import { GUARDRAIL_MIN_THRESHOLD_MIN, FORGOT_GRACE_MIN } from '../constants';

describe('nudgeThresholdMin', () => {
  it('is honest × preset factor, floored at the guardrail minimum', () => {
    expect(nudgeThresholdMin({ honestMin: 60, stepIn: 'balanced' })).toBe(90);
    expect(nudgeThresholdMin({ honestMin: 60, stepIn: 'early' })).toBe(75);
    expect(nudgeThresholdMin({ honestMin: 60, stepIn: 'room' })).toBe(120);
    // 10 × 1.25 = 12.5 → below the 25-min floor → floored
    expect(nudgeThresholdMin({ honestMin: 10, stepIn: 'early' })).toBe(
      GUARDRAIL_MIN_THRESHOLD_MIN,
    );
  });

  it('returns null for an unusable honest number', () => {
    expect(nudgeThresholdMin({ honestMin: 0, stepIn: 'balanced' })).toBeNull();
    expect(nudgeThresholdMin({ honestMin: -3, stepIn: 'balanced' })).toBeNull();
    expect(nudgeThresholdMin({ honestMin: NaN, stepIn: 'balanced' })).toBeNull();
  });
});

describe('closeThresholdMin', () => {
  it('is the nudge threshold plus the grace window', () => {
    expect(closeThresholdMin({ honestMin: 60, stepIn: 'balanced' })).toBe(
      90 + FORGOT_GRACE_MIN,
    );
  });
  it('returns null when the nudge threshold is null', () => {
    expect(closeThresholdMin({ honestMin: 0, stepIn: 'balanced' })).toBeNull();
  });
});

describe('autoCloseDecision', () => {
  const base = { honestMin: 60, stepIn: 'balanced' as const };

  it('does not auto-close before the close threshold', () => {
    expect(autoCloseDecision({ ...base, elapsedMin: 100 }).shouldAutoClose).toBe(false);
  });

  it('auto-closes once elapsed passes the close threshold', () => {
    // close threshold = 90 + 20 = 110
    const d = autoCloseDecision({ ...base, elapsedMin: 111 });
    expect(d.shouldAutoClose).toBe(true);
  });

  it('recovers the PREDICTED honest finish, never the runaway elapsed', () => {
    const d = autoCloseDecision({ ...base, elapsedMin: 600 });
    expect(d.recoveredActualMin).toBe(60); // honest, not 600
  });

  it('never auto-closes when the honest number is unusable', () => {
    expect(
      autoCloseDecision({ honestMin: 0, stepIn: 'balanced', elapsedMin: 999 })
        .shouldAutoClose,
    ).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx jest src/engine/__tests__/autoClose.test.ts`
Expected: FAIL — `Cannot find module '../autoClose'`.

- [ ] **Step 5: Implement `src/engine/autoClose.ts`**

```typescript
// Forgot-to-stop protection threshold + decision math. PURE TS — no RN/Expo,
// no Date.now(). Mirrors guardrail.ts: threshold = round(honest × factor),
// floored at the shared minimum. The recovered finish is ALWAYS the predicted
// honest number, never the runaway elapsed — a forgotten stop must not train a
// fake duration into the model.
import type { ForgotStepIn } from '../domain/types';
import {
  FORGOT_STEP_IN_FACTORS,
  FORGOT_GRACE_MIN,
  GUARDRAIL_MIN_THRESHOLD_MIN,
} from './constants';

/** Elapsed-minute threshold for the gentle nudge, or null when honest is unusable. */
export function nudgeThresholdMin(input: {
  honestMin: number;
  stepIn: ForgotStepIn;
}): number | null {
  const { honestMin, stepIn } = input;
  if (!Number.isFinite(honestMin) || honestMin <= 0) return null;
  const factor = FORGOT_STEP_IN_FACTORS[stepIn];
  return Math.max(GUARDRAIL_MIN_THRESHOLD_MIN, Math.round(honestMin * factor));
}

/** Elapsed-minute threshold at which an unattended session auto-closes. */
export function closeThresholdMin(input: {
  honestMin: number;
  stepIn: ForgotStepIn;
}): number | null {
  const nudge = nudgeThresholdMin(input);
  if (nudge === null) return null;
  return nudge + FORGOT_GRACE_MIN;
}

/** Decide whether an unattended running session should auto-close, and at what
 *  duration. `recoveredActualMin` is the predicted honest finish, rounded. */
export function autoCloseDecision(input: {
  elapsedMin: number;
  honestMin: number;
  stepIn: ForgotStepIn;
}): { shouldAutoClose: boolean; recoveredActualMin: number } {
  const close = closeThresholdMin(input);
  const recoveredActualMin = Math.max(1, Math.round(input.honestMin));
  if (close === null) return { shouldAutoClose: false, recoveredActualMin };
  return { shouldAutoClose: input.elapsedMin >= close, recoveredActualMin };
}
```

- [ ] **Step 6: Re-export from `src/engine/index.ts`**

Add near the `guardrail` export (`export { guardrailFactor, guardrailThresholdMin } from './guardrail';`):

```typescript
export { nudgeThresholdMin, closeThresholdMin, autoCloseDecision } from './autoClose';
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx jest src/engine/__tests__/autoClose.test.ts`
Expected: PASS (all cases).

- [ ] **Step 8: Lint + typecheck**

Run: `npx eslint src/engine/autoClose.ts src/engine/constants.ts src/engine/index.ts src/domain/types.ts && npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/engine/autoClose.ts src/engine/constants.ts src/engine/index.ts src/domain/types.ts src/engine/__tests__/autoClose.test.ts
git commit -m "feat(engine): forgot-to-stop nudge/close thresholds + auto-close decision"
```

---

## Task 2: Engine guard — a `partial` retro log must not train the model

Proves the free train-guard (#10) holds against the real `applyLog`, so a recovered/ignored forgotten stop can never move calibration until confirmed.

**Files:**
- Test: `src/stores/__tests__/calibrationStore.partial.test.ts` (create)

**Interfaces:**
- Consumes: `useCalibrationStore().applyLog(input: ApplyLogParams): Promise<LogResult>` (`src/stores/calibrationStore.ts:242`). `ApplyLogParams` = `{ category, estimateMin, actualMin, status, source, adaptSpeed, label?, suggestedHonestMin?, startedAt?, nowMs? }`.

- [ ] **Step 1: Write the failing/guarding test**

```typescript
import { useCalibrationStore } from '../calibrationStore';

// The calibration store selects createMemoryDatabase in tests (see db/client.ts).
async function mEffectiveFor(category: string): Promise<number> {
  const detail = await useCalibrationStore.getState().getCategoryDetail(category);
  return detail?.mEffective ?? 0;
}

describe('applyLog train-guard for forgotten stops', () => {
  it('a partial retro log leaves the multiplier unchanged (never trains)', async () => {
    const apply = useCalibrationStore.getState().applyLog;
    const before = await mEffectiveFor('Workout');

    await apply({
      category: 'Workout',
      estimateMin: 30,
      actualMin: 30, // predicted honest — but partial, so it must not count
      status: 'partial',
      source: 'retro',
      adaptSpeed: 'balanced',
      startedAt: null,
    });

    const after = await mEffectiveFor('Workout');
    expect(after).toBeCloseTo(before, 6);
  });

  it('a completed retro log DOES move the multiplier (confirmed recovery)', async () => {
    const apply = useCalibrationStore.getState().applyLog;
    const before = await mEffectiveFor('Reading');
    // A big honest overrun, confirmed by the user → should move the model
    // (at half alpha because source is retro).
    await apply({
      category: 'Reading',
      estimateMin: 20,
      actualMin: 40,
      status: 'completed',
      source: 'retro',
      adaptSpeed: 'balanced',
      startedAt: null,
    });
    const after = await mEffectiveFor('Reading');
    expect(after).not.toBeCloseTo(before, 6);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest src/stores/__tests__/calibrationStore.partial.test.ts`
Expected: PASS if `applyLog` already gates training on `status==='completed'` (it filters `status === 'completed'` throughout — see `calibrationStore.ts:558,596,877`).

- [ ] **Step 3: If it FAILS on the partial case** — the store is training on non-completed rows. Fix at the training site in `applyLog` (`src/stores/calibrationStore.ts`, around line 791+ where the entry is folded into stats): guard the stats update with `if (input.status === 'completed') { ... }`, leaving the row insert unconditional. Re-run Step 2 until green. Do NOT weaken the assertion.

- [ ] **Step 4: Commit**

```bash
git add src/stores/__tests__/calibrationStore.partial.test.ts src/stores/calibrationStore.ts
git commit -m "test(calibration): guard that partial retro logs never train the model"
```

---

## Task 3: settingsStore — `forgotStepIn` preset + one-time seen flag

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Test: `src/stores/__tests__/settingsStore.forgot.test.ts` (create)

**Interfaces:**
- Produces on the settings store: `forgotStepIn: ForgotStepIn`, `setForgotStepIn(v: ForgotStepIn): void`, `forgotProtectSeen: boolean`, `markForgotProtectSeen(): void`. Persisted via the store's existing kv persistence.

- [ ] **Step 1: Write the failing test**

```typescript
import { useSettingsStore } from '../settingsStore';
import { DEFAULT_FORGOT_STEP_IN } from '@/src/engine/constants';

describe('settingsStore forgot-to-stop protection', () => {
  it('defaults to the balanced preset and unseen', () => {
    const s = useSettingsStore.getState();
    expect(s.forgotStepIn).toBe(DEFAULT_FORGOT_STEP_IN);
    expect(s.forgotProtectSeen).toBe(false);
  });

  it('setForgotStepIn updates the preset', () => {
    useSettingsStore.getState().setForgotStepIn('early');
    expect(useSettingsStore.getState().forgotStepIn).toBe('early');
  });

  it('markForgotProtectSeen latches true', () => {
    useSettingsStore.getState().markForgotProtectSeen();
    expect(useSettingsStore.getState().forgotProtectSeen).toBe(true);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest src/stores/__tests__/settingsStore.forgot.test.ts`
Expected: FAIL — properties undefined.

- [ ] **Step 3: Implement in `src/stores/settingsStore.ts`**

Add to the imports the engine default:

```typescript
import { DEFAULT_FORGOT_STEP_IN } from '@/src/engine/constants';
```

Extend the state interface near `hyperfocusGuard` (line ~101):

```typescript
  /** Free forgot-to-stop protection preset — how soon Whenbee steps in. On by
   *  default ('balanced'). Distinct from the Pro hyperfocusGuard. */
  forgotStepIn: ForgotStepIn;
  setForgotStepIn: (v: ForgotStepIn) => void;
  /** True once the auto-close has acted at least once (drives the one-time
   *  contextual explainer). */
  forgotProtectSeen: boolean;
  markForgotProtectSeen: () => void;
```

Ensure `ForgotStepIn` is in the `import type { ... } from '@/src/domain/types'` line at the top (it already imports `GuardrailMultiple`).

In the `create(...)` initializer add the defaults + setters (follow the file's existing persisted-setter pattern — most setters `set({...})` and the store persists via its kv middleware):

```typescript
  forgotStepIn: DEFAULT_FORGOT_STEP_IN,
  setForgotStepIn: (v) => set({ forgotStepIn: v }),
  forgotProtectSeen: false,
  markForgotProtectSeen: () => set({ forgotProtectSeen: true }),
```

If the store uses an explicit `partialize`/persisted-keys allowlist, add `forgotStepIn` and `forgotProtectSeen` to it. (Grep `partialize` in the file; if absent, the whole state persists and no change is needed.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/stores/__tests__/settingsStore.forgot.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck + commit**

```bash
npx eslint src/stores/settingsStore.ts && npm run typecheck
git add src/stores/settingsStore.ts src/stores/__tests__/settingsStore.forgot.test.ts
git commit -m "feat(settings): forgot-to-stop preset + one-time seen flag"
```

---

## Task 4: timerStore — `stopSilently` + `reopen` + `PendingAutoClose` snapshot read

Auto-close must stop the runaway WITHOUT writing a log (the ForgotCard writes it), and "still going" must restore the session at its ORIGINAL `startedAt` (not `now`).

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/stores/timerStore.ts`
- Test: `src/stores/__tests__/timerStore.forgot.test.ts` (create)

**Interfaces:**
- Produces:
  - `interface PendingAutoClose { taskLabel: string; category: string; guessMin: number; honestMin: number; startedAt: number; elapsedMin: number; recoveredActualMin: number }` (in `src/domain/types.ts`).
  - `timerStore.peekPersisted(): PersistedTimer | null` — read the kv snapshot without mutating state.
  - `timerStore.stopSilently(): void` — clear running state + kv + end Live Activity, write NO log.
  - `timerStore.reopen(snapshot: { taskLabel: string; category: string | null; estimateMin: number; startedAt: number; guessMin: number; taskId: string | null; suggestedHonestMin: number; isQuickStart: boolean }): void` — restore a running session at the given `startedAt`.

- [ ] **Step 1: Add `PendingAutoClose` to `src/domain/types.ts`**

Near `ForgotStepIn`:

```typescript
/** A forgotten running session detected on foreground, parked for recovery.
 *  Only ever built for a CATEGORIZED session (category non-null). */
export interface PendingAutoClose {
  taskLabel: string;
  category: string;
  guessMin: number;
  /** The honest number the user saw — the recovery default. */
  honestMin: number;
  startedAt: number;
  /** Runaway elapsed active minutes at detection (display only, never trained). */
  elapsedMin: number;
  /** Predicted honest finish, rounded — the default recovered duration. */
  recoveredActualMin: number;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
import { useTimerStore } from '../timerStore';

describe('timerStore forgot-to-stop helpers', () => {
  beforeEach(() => useTimerStore.getState().cancel());

  it('peekPersisted returns the running snapshot without clearing state', () => {
    useTimerStore.getState().start(
      { label: 'Deep work', category: 'Work', estimateMin: 45, guessMin: 40, suggestedHonestMin: 50 },
      1_000_000,
    );
    const snap = useTimerStore.getState().peekPersisted();
    expect(snap?.category).toBe('Work');
    expect(snap?.suggestedHonestMin).toBe(50);
    // still running (peek must not clear)
    expect(useTimerStore.getState().startedAt).toBe(1_000_000);
  });

  it('stopSilently clears state + kv and writes no log', () => {
    useTimerStore.getState().start(
      { label: 'Deep work', category: 'Work', estimateMin: 45 },
      1_000_000,
    );
    useTimerStore.getState().stopSilently();
    expect(useTimerStore.getState().startedAt).toBeNull();
    expect(useTimerStore.getState().peekPersisted()).toBeNull();
  });

  it('reopen restores a running session at the original startedAt', () => {
    useTimerStore.getState().reopen({
      taskLabel: 'Deep work',
      category: 'Work',
      estimateMin: 45,
      startedAt: 2_000_000,
      guessMin: 40,
      taskId: null,
      suggestedHonestMin: 50,
      isQuickStart: false,
    });
    const s = useTimerStore.getState();
    expect(s.isRunning).toBe(true);
    expect(s.startedAt).toBe(2_000_000);
    expect(s.suggestedHonestMin).toBe(50);
  });
});
```

- [ ] **Step 3: Run it**

Run: `npx jest src/stores/__tests__/timerStore.forgot.test.ts`
Expected: FAIL — methods undefined.

- [ ] **Step 4: Implement in `src/stores/timerStore.ts`**

Add the three methods to the `TimerState` interface (near `resumeFromKv`):

```typescript
  /** Read the persisted running snapshot without mutating state (foreground check). */
  peekPersisted: () => PersistedTimer | null;
  /** Stop the runaway without logging — the ForgotCard writes the recovery log. */
  stopSilently: () => void;
  /** Restore a running session at its ORIGINAL startedAt (the "still going" path). */
  reopen: (snapshot: {
    taskLabel: string;
    category: string | null;
    estimateMin: number;
    startedAt: number;
    guessMin: number;
    taskId: string | null;
    suggestedHonestMin: number;
    isQuickStart: boolean;
  }) => void;
```

Implement in the `create(...)` body:

```typescript
  peekPersisted: () => {
    const raw = kv.getString(ACTIVE_TIMER_KEY);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as PersistedTimer;
    } catch {
      return null;
    }
  },

  stopSilently: () => {
    set({ ...CLEARED });
    clearPersisted();
    endFinishTimeActivity();
  },

  reopen: (snapshot) => {
    set({
      taskLabel: snapshot.taskLabel,
      category: snapshot.category,
      estimateMin: snapshot.estimateMin,
      startedAt: snapshot.startedAt,
      pausedAccumMs: 0,
      pausedAt: null,
      isRunning: true,
      guessMin: snapshot.guessMin,
      taskId: snapshot.taskId,
      suggestedHonestMin: snapshot.suggestedHonestMin,
      isQuickStart: snapshot.isQuickStart,
      // Re-arm the nudge for the reopened session.
      guardNudged: false,
    });
    persistRunning(get());
  },
```

`endFinishTimeActivity` is already imported at the top of the file.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/stores/__tests__/timerStore.forgot.test.ts`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck + commit**

```bash
npx eslint src/stores/timerStore.ts src/domain/types.ts && npm run typecheck
git add src/stores/timerStore.ts src/domain/types.ts src/stores/__tests__/timerStore.forgot.test.ts
git commit -m "feat(timer): silent-stop + reopen + snapshot peek for forgot recovery"
```

---

## Task 5: forgotStore — holds the pending recovery record

**Files:**
- Create: `src/stores/forgotStore.ts`
- Test: `src/stores/__tests__/forgotStore.test.ts`

**Interfaces:**
- Produces: `useForgotStore` with `{ pending: PendingAutoClose | null; setPending(p: PendingAutoClose): void; clear(): void }`.

- [ ] **Step 1: Write the failing test**

```typescript
import { useForgotStore } from '../forgotStore';
import type { PendingAutoClose } from '@/src/domain/types';

const sample: PendingAutoClose = {
  taskLabel: 'Deep work',
  category: 'Work',
  guessMin: 40,
  honestMin: 50,
  startedAt: 1_000_000,
  elapsedMin: 300,
  recoveredActualMin: 50,
};

describe('forgotStore', () => {
  beforeEach(() => useForgotStore.getState().clear());

  it('starts empty', () => {
    expect(useForgotStore.getState().pending).toBeNull();
  });

  it('setPending / clear round-trip', () => {
    useForgotStore.getState().setPending(sample);
    expect(useForgotStore.getState().pending?.category).toBe('Work');
    useForgotStore.getState().clear();
    expect(useForgotStore.getState().pending).toBeNull();
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest src/stores/__tests__/forgotStore.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/stores/forgotStore.ts`**

```typescript
import { create } from 'zustand';
import type { PendingAutoClose } from '@/src/domain/types';

// Ephemeral (NOT persisted): a forgotten session detected on foreground, waiting
// for the user to confirm/adjust/reopen via the ForgotCard. Cleared once resolved.
interface ForgotState {
  pending: PendingAutoClose | null;
  setPending: (p: PendingAutoClose) => void;
  clear: () => void;
}

export const useForgotStore = create<ForgotState>((set) => ({
  pending: null,
  setPending: (p) => set({ pending: p }),
  clear: () => set({ pending: null }),
}));
```

- [ ] **Step 4: Run the test + lint + commit**

```bash
npx jest src/stores/__tests__/forgotStore.test.ts
npx eslint src/stores/forgotStore.ts && npm run typecheck
git add src/stores/forgotStore.ts src/stores/__tests__/forgotStore.test.ts
git commit -m "feat(timer): ephemeral forgot-recovery store"
```

---

## Task 6: useForgotCheck — detect a forgotten session on foreground/boot

Pure detection glue: read the snapshot, compute active elapsed, ask the engine, and if past the close threshold for a CATEGORIZED, non-paused session → stop the runaway silently and park the pending record.

**Files:**
- Create: `src/features/timer/useForgotCheck.ts`
- Test: `src/features/timer/__tests__/useForgotCheck.test.ts`

**Interfaces:**
- Consumes: `useTimerStore` (`peekPersisted`, `stopSilently`), `useSettingsStore.forgotStepIn`, `useForgotStore.setPending`, engine `autoCloseDecision`, `closeThresholdMin`.
- Produces: `export function useForgotCheck(): void` — a hook mounted once at the app root; runs the check on mount and on `AppState` → `active`. Also `export function evaluateForgotten(input: { snap: PersistedTimer; nowMs: number; stepIn: ForgotStepIn }): PendingAutoClose | null` (pure, testable).

- [ ] **Step 1: Write the failing test (pure `evaluateForgotten`)**

```typescript
import { evaluateForgotten } from '../useForgotCheck';

const running = {
  taskLabel: 'Deep work',
  category: 'Work',
  estimateMin: 45,
  startedAt: 0,
  pausedAccumMs: 0,
  pausedAt: null,
  guessMin: 40,
  taskId: null,
  suggestedHonestMin: 50, // honest = 50; balanced close = round(50×1.5)+20 = 95
  isQuickStart: false,
  guardNudged: false,
};

describe('evaluateForgotten', () => {
  it('returns null before the close threshold', () => {
    // 90 min elapsed < 95 close threshold
    const r = evaluateForgotten({ snap: running, nowMs: 90 * 60_000, stepIn: 'balanced' });
    expect(r).toBeNull();
  });

  it('parks a pending record past the close threshold, recovering the honest finish', () => {
    const r = evaluateForgotten({ snap: running, nowMs: 300 * 60_000, stepIn: 'balanced' });
    expect(r).not.toBeNull();
    expect(r?.category).toBe('Work');
    expect(r?.recoveredActualMin).toBe(50); // honest, not 300
    expect(r?.elapsedMin).toBe(300);
  });

  it('ignores a paused session (intentional pause, not forgotten)', () => {
    const paused = { ...running, pausedAt: 10 * 60_000 };
    const r = evaluateForgotten({ snap: paused, nowMs: 300 * 60_000, stepIn: 'balanced' });
    expect(r).toBeNull();
  });

  it('ignores a quick-start session with no category (out of P0 auto-bank)', () => {
    const quick = { ...running, category: null, isQuickStart: true };
    const r = evaluateForgotten({ snap: quick, nowMs: 300 * 60_000, stepIn: 'balanced' });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest src/features/timer/__tests__/useForgotCheck.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/features/timer/useForgotCheck.ts`**

```typescript
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useTimerStore } from '@/src/stores/timerStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useForgotStore } from '@/src/stores/forgotStore';
import { autoCloseDecision } from '@/src/engine';
import type { ForgotStepIn, PendingAutoClose } from '@/src/domain/types';

// The persisted timer snapshot shape (mirror of timerStore's PersistedTimer —
// re-declared here to keep the pure fn free of store internals).
interface Snap {
  taskLabel: string;
  category: string | null;
  estimateMin: number;
  startedAt: number;
  pausedAccumMs: number;
  pausedAt: number | null;
  guessMin: number;
  taskId: string | null;
  suggestedHonestMin: number;
  isQuickStart: boolean;
  guardNudged: boolean;
}

/** Active elapsed minutes, excluding paused spans. */
function activeElapsedMin(snap: Snap, nowMs: number): number {
  const pausedAccum =
    snap.pausedAt !== null ? snap.pausedAccumMs + (nowMs - snap.pausedAt) : snap.pausedAccumMs;
  return Math.max(0, Math.round((nowMs - snap.startedAt - pausedAccum) / 60_000));
}

/** PURE: decide whether a snapshot is a forgotten, auto-closable session. */
export function evaluateForgotten(input: {
  snap: Snap;
  nowMs: number;
  stepIn: ForgotStepIn;
}): PendingAutoClose | null {
  const { snap, nowMs, stepIn } = input;
  // Paused = intentional; quick-start / uncategorized = out of P0 auto-bank.
  if (snap.pausedAt !== null) return null;
  if (snap.isQuickStart || snap.category === null) return null;
  const honestMin = snap.suggestedHonestMin;
  const elapsedMin = activeElapsedMin(snap, nowMs);
  const { shouldAutoClose, recoveredActualMin } = autoCloseDecision({
    elapsedMin,
    honestMin,
    stepIn,
  });
  if (!shouldAutoClose) return null;
  return {
    taskLabel: snap.taskLabel,
    category: snap.category,
    guessMin: snap.guessMin,
    honestMin,
    startedAt: snap.startedAt,
    elapsedMin,
    recoveredActualMin,
  };
}

/** Mount once at the app root. Runs on mount + every foreground. */
export function useForgotCheck(): void {
  useEffect(() => {
    const run = () => {
      // Already parked? don't double-detect.
      if (useForgotStore.getState().pending !== null) return;
      const snap = useTimerStore.getState().peekPersisted();
      if (snap === null) return;
      const stepIn = useSettingsStore.getState().forgotStepIn;
      const pending = evaluateForgotten({ snap: snap as Snap, nowMs: Date.now(), stepIn });
      if (pending === null) return;
      // Stop the runaway now; the ForgotCard writes the recovery log.
      useTimerStore.getState().stopSilently();
      useForgotStore.getState().setPending(pending);
    };
    run(); // boot / mount
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, []);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/timer/__tests__/useForgotCheck.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck + commit**

```bash
npx eslint src/features/timer/useForgotCheck.ts && npm run typecheck
git add src/features/timer/useForgotCheck.ts src/features/timer/__tests__/useForgotCheck.test.ts
git commit -m "feat(timer): detect forgotten sessions on foreground → park for recovery"
```

---

## Task 7: ForgotCard — recovery presets that write the log

**Files:**
- Create: `src/features/timer/ForgotCard.tsx`
- Test: `src/features/timer/__tests__/ForgotCard.test.tsx`

**Interfaces:**
- Consumes: `useForgotStore` (`pending`, `clear`), `useCalibrationStore().applyLog`, `useTimerStore().reopen`, `useSettingsStore` (`forgotProtectSeen`, `markForgotProtectSeen`), `useCategoriesStore` (adaptSpeed lookup, mirroring `useTimer.onStopAndLog`).
- Produces: `export function ForgotCard(): JSX.Element | null` — renders nothing when `pending` is null.
- Recovery actions:
  - **at honest** → `applyLog({ status:'completed', source:'retro', actualMin: pending.recoveredActualMin, ... })`, clear.
  - **at guess** → same with `actualMin: pending.guessMin`.
  - **a few min ago** → same with `actualMin: Math.max(1, pending.elapsedMin - 5)` — user was near done. (Uses the runaway elapsed deliberately, because the user is asserting they only just stopped.)
  - **still going** → `reopen({...pending, estimateMin: pending.honestMin})`, clear. Writes NO log.
  - **dismiss (X / backdrop)** → `applyLog({ status:'partial', source:'retro', actualMin: pending.recoveredActualMin, ... })`, clear. A record that never trains.

- [ ] **Step 1: Write the test**

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ForgotCard } from '../ForgotCard';
import { useForgotStore } from '@/src/stores/forgotStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import type { PendingAutoClose } from '@/src/domain/types';

const pending: PendingAutoClose = {
  taskLabel: 'Deep work', category: 'Work', guessMin: 40, honestMin: 50,
  startedAt: 0, elapsedMin: 300, recoveredActualMin: 50,
};

describe('ForgotCard', () => {
  beforeEach(() => useForgotStore.getState().clear());

  it('renders nothing when there is no pending record', () => {
    const { toJSON } = render(<ForgotCard />);
    expect(toJSON()).toBeNull();
  });

  it('"at your honest number" logs a completed retro at the predicted finish and clears', async () => {
    const spy = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    useForgotStore.getState().setPending(pending);
    const { getByText } = render(<ForgotCard />);
    fireEvent.press(getByText(/honest/i));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', source: 'retro', actualMin: 50 }),
      );
      expect(useForgotStore.getState().pending).toBeNull();
    });
  });

  it('"still going" reopens the session without logging', async () => {
    const apply = jest.spyOn(useCalibrationStore.getState(), 'applyLog');
    const reopen = jest.spyOn(useTimerStore.getState(), 'reopen');
    useForgotStore.getState().setPending(pending);
    const { getByText } = render(<ForgotCard />);
    fireEvent.press(getByText(/still going/i));
    await waitFor(() => {
      expect(reopen).toHaveBeenCalled();
      expect(apply).not.toHaveBeenCalled();
      expect(useForgotStore.getState().pending).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest src/features/timer/__tests__/ForgotCard.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/features/timer/ForgotCard.tsx`**

Follow the `GuardrailCheckIn` visual pattern (amber top rule, `type.subtitle` heading, token spacing, fade entrance — NO slide/bounce; reduced-motion → final state). Render as an overlay host card. Copy below is a first pass to be run through `conversion-psychology` + `humanizer` in Step 4 before finalizing — no guilt, framed as help.

```tsx
import { useCallback } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useForgotStore } from '@/src/stores/forgotStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import type { AdaptSpeed, LogStatus } from '@/src/domain/types';

export function ForgotCard(): JSX.Element | null {
  const t = useTheme();
  const pending = useForgotStore((s) => s.pending);
  const clear = useForgotStore((s) => s.clear);

  const write = useCallback(
    async (actualMin: number, status: LogStatus) => {
      if (pending === null) return;
      const adaptSpeed: AdaptSpeed =
        useCategoriesStore.getState().categories.find((c) => c.id === pending.category)
          ?.adaptSpeed ?? 'balanced';
      await useCalibrationStore.getState().applyLog({
        category: pending.category,
        estimateMin: pending.guessMin,
        actualMin,
        status,
        source: 'retro',
        adaptSpeed,
        label: pending.taskLabel,
        suggestedHonestMin: pending.honestMin,
        startedAt: null,
      });
      useSettingsStore.getState().markForgotProtectSeen();
      clear();
    },
    [pending, clear],
  );

  const stillGoing = useCallback(() => {
    if (pending === null) return;
    useTimerStore.getState().reopen({
      taskLabel: pending.taskLabel,
      category: pending.category,
      estimateMin: pending.honestMin,
      startedAt: pending.startedAt,
      guessMin: pending.guessMin,
      taskId: null,
      suggestedHonestMin: pending.honestMin,
      isQuickStart: false,
    });
    useSettingsStore.getState().markForgotProtectSeen();
    clear();
  }, [pending, clear]);

  if (pending === null) return null;

  const seen = useSettingsStore.getState().forgotProtectSeen;

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    borderTopWidth: t.borderWidth.thick,
    borderTopColor: t.colors.accent, // amber, never red
    padding: t.space[5],
    gap: t.space[4],
    margin: t.space[4],
  };
  const heading: TextStyle = { ...(type.subtitle as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as TextStyle), color: t.colors.inkSoft };

  return (
    <Animated.View entering={FadeIn.duration(t.motion.base)} style={card}>
      <AppText style={heading}>Wrapped “{pending.taskLabel}” for you</AppText>
      <AppText style={body}>
        {seen
          ? 'When did you actually finish?'
          : 'It ran past your honest finish while you were away. When did you actually finish? You can change when I step in anytime.'}
      </AppText>
      <View style={{ gap: t.space[2.5] }}>
        <AppButton
          label={`At your honest finish · ${pending.recoveredActualMin}m`}
          variant="amber"
          size="md"
          fullWidth
          onPress={() => void write(pending.recoveredActualMin, 'completed')}
        />
        <AppButton
          label={`At your guess · ${pending.guessMin}m`}
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => void write(pending.guessMin, 'completed')}
        />
        <AppButton
          label="A few minutes ago"
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => void write(Math.max(1, pending.elapsedMin - 5), 'completed')}
        />
        <AppButton label="Still going" variant="ghost" size="md" fullWidth onPress={stillGoing} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={() => void write(pending.recoveredActualMin, 'partial')}
      >
        <AppText style={{ ...(type.caption as TextStyle), color: t.colors.inkFaint, textAlign: 'center' }}>
          Not sure — skip
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
```

Note: confirm `t.colors.inkFaint`, `t.borderWidth.thick`, `t.radii.sheet`, `t.motion.base`, `type.caption` exist (they are used across the app — grep if unsure; `GuardrailCheckIn` uses `t.borderWidth.thick`, `t.radii.sheet`, `t.motion.base`). Substitute the nearest existing token if a name differs; never inline a raw value.

- [ ] **Step 4: Run copy through the mandatory skills**

Invoke `conversion-psychology` + `humanizer` on every string in this file (heading, body, button labels, "skip"). Apply their edits. Keep: no guilt, "help" framing, amber. Re-run the test after (labels are matched by regex `/honest/i`, `/still going/i` — keep those tokens or update the test).

- [ ] **Step 5: Run the test + lint + typecheck**

```bash
npx jest src/features/timer/__tests__/ForgotCard.test.tsx
npx eslint src/features/timer/ForgotCard.tsx && npm run typecheck
```
Expected: PASS, no lint/type errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/timer/ForgotCard.tsx src/features/timer/__tests__/ForgotCard.test.tsx
git commit -m "feat(timer): forgot-to-stop recovery card with honest-number presets"
```

---

## Task 8: Wire the check + card into the app root

**Files:**
- Modify: `src/app/_layout.tsx`
- Test: manual (device/sim) — see Step 3.

**Interfaces:**
- Consumes: `useForgotCheck()`, `<ForgotCard />`.

- [ ] **Step 1: Mount the hook + host in `src/app/_layout.tsx`**

Inside the root component that already calls `resumeFromKv()` / `reconcilePresenceOnBoot()` on boot, add after those:

```tsx
import { useForgotCheck } from '@/src/features/timer/useForgotCheck';
import { ForgotCard } from '@/src/features/timer/ForgotCard';
// ...
useForgotCheck(); // must run AFTER resumeFromKv so the snapshot exists
```

Render `<ForgotCard />` as a top-level overlay above the navigator (a sibling of the `Stack`, inside the theme/safe-area providers) so it can appear over any screen. Position it via a full-screen `View` with `pointerEvents="box-none"` and bottom alignment + `useSafeAreaInsets().bottom` padding (footers/overlays must add the bottom inset).

- [ ] **Step 2: Lint + typecheck**

Run: `npx eslint src/app/_layout.tsx && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification on the sim**

Simulate a forgotten session end-to-end:
1. `npm run ios`.
2. Start a timer on a categorized task with a small honest number (e.g. seed/pick a category whose honest ≈ 3 min so the 25-min floor still applies — you'll need to fast-forward instead; simplest: temporarily set `GUARDRAIL_MIN_THRESHOLD_MIN` and `FORGOT_GRACE_MIN` to `0` locally, or edit the kv snapshot's `startedAt` far into the past via the store).
3. Reliable path: with a timer running, background the app, then use the store to backdate `startedAt` (a temporary dev button or `xcrun simctl` deep link) so elapsed exceeds the close threshold, and foreground the app.
4. Expect: the runaway timer is stopped, the ForgotCard appears with the honest-finish preset, and tapping it writes exactly one `completed`+`retro` log (verify via the category detail screen / a `console.log` in `applyLog`). Revert any temporary constant edits before committing.

- [ ] **Step 4: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "feat(timer): mount forgot-check + recovery card at the app root"
```

---

## Task 9: Free nudge for everyone + Pro override (unify arming)

Today the in-app nudge (`GuardrailCheckIn`) arms only for Pro (`useTimer.ts:251-265`). The free net needs the gentle nudge too, at the `forgotStepIn` threshold; Pro's `hyperfocusGuard` (when not `off`) overrides with its own (earlier) multiple.

**Files:**
- Modify: `src/features/timer/useTimer.ts`
- Test: `src/features/timer/__tests__/useTimer.notify.test.tsx` (extend)

**Interfaces:**
- Consumes: `nudgeThresholdMin` (engine), `guardrailThresholdMin` (engine), `useSettingsStore.forgotStepIn`, `useSettingsStore.hyperfocusGuard`, `useEntitlement.isPro`.

- [ ] **Step 1: Extend the arming logic in `useTimer.ts`**

Replace the Pro-only threshold computation (around lines 251-258) with a unified resolver:

```typescript
    const guardSetting = useSettingsStore.getState().hyperfocusGuard;
    const guardPro = useEntitlement.getState().isPro;
    const stepIn = useSettingsStore.getState().forgotStepIn;
    const alreadyNudged = useTimerStore.getState().guardNudged;
    // Pro guardrail (when set) wins — it's the earlier, user-chosen multiple.
    // Otherwise the free forgot-to-stop nudge fires at the preset threshold.
    const guardThresholdMin = alreadyNudged
      ? null
      : guardPro && guardSetting !== 'off'
        ? guardrailThresholdMin({ honestMin: suggestedHonestMin, setting: guardSetting })
        : nudgeThresholdMin({ honestMin: suggestedHonestMin, stepIn });
```

Add `nudgeThresholdMin` to the `@/src/engine` import (line 37). Leave the rest (arming the shared value, scheduling the background ping) unchanged — it already consumes `guardThresholdMin`.

- [ ] **Step 2: Add a test asserting a FREE user gets armed**

In `useTimer.notify.test.tsx`, add a case: entitlement not-Pro, `forgotStepIn='balanced'`, a categorized start with `suggestedHonestMin=60` → assert the guard/nudge is armed (e.g. the `guardrail_armed`/nudge analytics fires, or the background `scheduleGuardCheckIn`/`scheduleTimerDone` is called with the expected threshold). Mirror the existing Pro test in that file for the exact assertion style.

- [ ] **Step 3: Run the affected tests**

Run: `npx jest src/features/timer/__tests__/useTimer.notify.test.tsx`
Expected: PASS (existing Pro cases + the new free case).

- [ ] **Step 4: Lint + typecheck + commit**

```bash
npx eslint src/features/timer/useTimer.ts && npm run typecheck
git add src/features/timer/useTimer.ts src/features/timer/__tests__/useTimer.notify.test.tsx
git commit -m "feat(timer): free forgot-to-stop nudge with Pro guardrail override"
```

---

## Task 10: Settings — free preset row (room / balanced / early)

**Files:**
- Create: `src/features/settings/ForgotStepInRow.tsx`
- Modify: the settings screen that renders rows (grep `GuardrailSettingRow` usage: `src/app/(modals)/settings.tsx` or `src/features/settings/*`).
- Test: `src/features/settings/__tests__/ForgotStepInRow.test.tsx`

**Interfaces:**
- Consumes: `useSettingsStore` (`forgotStepIn`, `setForgotStepIn`).
- Produces: `export function ForgotStepInRow(): JSX.Element` — a 3-segment selector. User-facing labels: **Lots of room** / **Balanced** / **Step in early**. Not multipliers.

- [ ] **Step 1: Write the test**

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { ForgotStepInRow } from '../ForgotStepInRow';
import { useSettingsStore } from '@/src/stores/settingsStore';

describe('ForgotStepInRow', () => {
  it('reflects and updates the preset', () => {
    useSettingsStore.getState().setForgotStepIn('balanced');
    const { getByText } = render(<ForgotStepInRow />);
    fireEvent.press(getByText('Step in early'));
    expect(useSettingsStore.getState().forgotStepIn).toBe('early');
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest src/features/settings/__tests__/ForgotStepInRow.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/features/settings/ForgotStepInRow.tsx`**

Follow `GuardrailSettingRow.tsx` for structure, tokens, and copy tone (read it first). A labelled row + a 3-option segmented control mapping `Lots of room → 'room'`, `Balanced → 'balanced'`, `Step in early → 'early'`, reading/writing `useSettingsStore`. Include a one-line helper under the row explaining it in plain words (no jargon, no multiplier), e.g. "If a timer runs long while you're away, Whenbee wraps it and asks when you finished." Run the helper string through `conversion-psychology` + `humanizer`.

- [ ] **Step 4: Render it in the settings screen**

Place the row in the same section as (and above) the Pro `GuardrailSettingRow` — free net first, Pro control second. Match the surrounding section/heading pattern.

- [ ] **Step 5: Run the test + lint + typecheck + commit**

```bash
npx jest src/features/settings/__tests__/ForgotStepInRow.test.tsx
npx eslint src/features/settings/ForgotStepInRow.tsx && npm run typecheck
git add src/features/settings/ForgotStepInRow.tsx "src/app/(modals)/settings.tsx"
git commit -m "feat(settings): free forgot-to-stop preset row"
```

---

## Task 11: Overrun amber + live "+Nm over" audit (#8)

Ensure the overrun state reads consistently (amber, never red) with a live over-count on the surfaces the user actually glances at while a timer runs.

**Files:**
- Audit + modify: `src/features/timer/ActiveTimerBar.tsx` (grep the real path), the timer screen `src/app/(modals)/timer.tsx`, and the timer-done notification content `src/services/timerNotifications.ts`.
- Test: extend the relevant existing component/content test.

- [ ] **Step 1: Audit**

Grep for the over/amber state already in place:
```bash
grep -rn "over\|accent\|amber" src/features/timer/ActiveTimerBar.tsx src/app/\(modals\)/timer.tsx | head
```
The timer screen already flips amber via the `over` shared value (`useTimer.ts`). Confirm the **ActiveTimerBar** (the mini bar on other screens) also shows amber + a "+Nm over" label once elapsed exceeds `suggestedHonestMin`. If it already does, mark this task done with a note.

- [ ] **Step 2: If missing on ActiveTimerBar** — add the amber tint (`t.colors.accent`) + a small `+{overMin}m over` label computed from `elapsedMin - suggestedHonestMin` (clamped ≥ 0), using tokens only. Add/extend a render test asserting the over-label appears past honest and is absent before it. No red.

- [ ] **Step 3: Notification copy** — ensure the timer-done notification body (`timerNotifications.ts`) uses the supportive, no-guilt phrasing when over (a glance, not a scold). Run any changed string through `conversion-psychology` + `humanizer`. Keep the existing `EXTEND_10`/`SNOOZE_15` actions.

- [ ] **Step 4: Run affected tests + lint + commit**

```bash
npx jest src/services/__tests__/timerNotifications.content.test.ts
npx eslint <changed files> && npm run typecheck
git add <changed files>
git commit -m "feat(timer): consistent amber over-count across surfaces"
```

---

## Task 12: Full-suite green + docs note

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS. Fix any regression at root cause (no flaky shrug — reproduce and fix).

- [ ] **Step 2: Lint + typecheck the whole project**

Run: `npm run lint && npm run typecheck`
Expected: 0 warnings, 0 errors.

- [ ] **Step 3: Note the shipped feature in the product docs**

In `docs/product/12-FORGOTTEN-TIMER-RESEARCH.md`, add a short "Shipped (P0)" line at the top linking this plan + the spec. Do NOT restate the whole design.

- [ ] **Step 4: Commit**

```bash
git add docs/product/12-FORGOTTEN-TIMER-RESEARCH.md
git commit -m "docs: mark forgot-to-stop P0 shipped"
```

---

## Self-review notes (spec coverage)

- Ladder (nudge → auto-close → recover): Tasks 1, 6, 7, 9. ✅
- Train-guard (partial no-train, retro half-weight, recover predicted-honest not elapsed): Tasks 1, 2, 6, 7. ✅
- Free default-on + one preset (room/balanced/early → 2/1.5/1.25×): Tasks 1, 3, 10. ✅
- Foreground reconcile (JS-timer-can't-fire-backgrounded constraint): Task 6. ✅
- First-time contextual explainer (not a settings tour): Task 7 (`forgotProtectSeen`) + Task 3. ✅
- Overrun amber everywhere (#8): Task 11. ✅
- Pro control coexists (existing `GuardrailSettingRow`, override in arming): Tasks 9, 10. ✅
- Edge cases — paused (skip), quick-start/uncategorized (skip P0 auto-bank), reopen preserves startedAt, resolve-once: Tasks 4, 6, 7. ✅
- Out of scope (documented): iOS Live Activity + native background close (P2, gated); motion-aware detection (#3).
- **Deferred to plan-time (flagged in spec):** final `FORGOT_GRACE_MIN` value (using 20); whether Pro "off" also disables the passive forgot-card net — current plan keeps the free net independent of the Pro setting (forgot-check always runs on `forgotStepIn`, which is never "off"). If the founder wants an explicit global off switch, add an `'off'` member to `ForgotStepIn` + a guard in `useForgotCheck` — small follow-up, not in this plan.
