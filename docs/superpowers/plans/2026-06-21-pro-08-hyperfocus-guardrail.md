# Hyperfocus Guardrail (Pro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** A gentle, opt-in Pro check-in that surfaces ONCE when a running task passes a chosen multiple of its honest number (default 2×): a calm amber card in-app, or one soft notification if backgrounded. Never nags, never blocks, never red.

**Architecture:** Pure threshold math in `src/engine/guardrail.ts` (TDD). One setting (`hyperfocusGuard`) in `settingsStore` (kv) + one per-session flag (`guardNudged`) in `timerStore` (persisted, so a backgrounded session that already nudged won't re-nudge). Arming + dual-channel (foreground card vs background notification, mutually exclusive) wired in `useTimer`. Full spec: `docs/product/specs/08-hyperfocus-guardrail.md` (read §5 card, §6 motion, §10 copy).

**Tech Stack:** Expo SDK 54, RN 0.81 (Fabric), TS strict + `noUncheckedIndexedAccess`, Zustand, Reanimated, expo-notifications (guarded), Jest.

## Global Constraints

- **No-guilt applies harder here than anywhere:** amber never red; ONE nudge per session then silent; no escalation, no second card, no overrun counter, no cross-day comparison. Banned strings (spec §10): "distracted", "time to stop", "way over", "wasting", "get back on track", "behind", "should have". "Keep going" is the prominent option.
- **Off by default.** Fresh install never nudges (mirrors `remindersEnabled` default false).
- **Reads the model, never writes it.** The guardrail logs nothing, trains nothing, touches no tier/honey/sharpness.
- **Theming:** tokens only via `useTheme()` + `typography`. Reuse `AppButton`/`AppText`/`Screen`, the `PaceLabel` amber precedent. The card reuses `radii.sheet`, `space[*]`, `colors.surface/accent/amberText/inkSoft`, `opacity.pressed`, `motion.*` (no new token group needed; if a slide distance is wanted reuse `space[16]`).
- **Motion:** Premium/Calm. Entering-only (no `exiting` layout anim — Fabric SIGABRT); drive dismiss with an explicit shared-value timing. `.get()/.set()`. Honor `ReduceMotion.System` + `useReducedMotion()` (as `useTimer` already does). No pulse/blink, no heavy haptic (a single `Haptics.selectionAsync` on appearance is the most allowed).
- **Layer rule:** UI → hook/store → engine/services. The card lives in `features/timer`, the rows in `features/settings`.
- **Guarded notifications:** reuse the `getModule()` + `ensureNotificationPermission()` pattern in `timerNotifications.ts`; missing native module (Expo Go/tests) = silent no-op.
- **Commits:** Conventional Commits, **no AI/co-author trailers** (HARD RULE), plain `git`, no `init-cmt`.
- **Never merge.** Open a PR and stop.

---

### Task 1: Engine — `guardrail.ts` (TDD)

**Files:**
- Modify: `src/engine/constants.ts`
- Create: `src/engine/guardrail.ts`
- Modify: `src/engine/index.ts`
- Create: `src/engine/__tests__/guardrail.test.ts`
- (Imports `GuardrailMultiple` from domain — do Task 2 first.)

**Interfaces:**
- Produces (via `src/engine/index.ts`): `guardrailFactor(setting): number | null`, `guardrailThresholdMin({ honestMin, setting }): number | null`, and constants `GUARDRAIL_FACTORS`, `DEFAULT_GUARDRAIL`, `GUARDRAIL_MIN_THRESHOLD_MIN`.

- [ ] **Step 1: Add constants** to `src/engine/constants.ts`:

```ts
import type { GuardrailMultiple } from '../domain/types';

// ── Hyperfocus guardrail (Pro) ───────────────────────────────────────────────
/** Setting → multiple of the honest number. 'off' has no entry. */
export const GUARDRAIL_FACTORS = { '1.5x': 1.5, '2x': 2, '3x': 3 } as const;
/** Default guardrail for a fresh install. */
export const DEFAULT_GUARDRAIL: GuardrailMultiple = 'off';
/** Never fire a nudge before this many elapsed minutes, regardless of factor. */
export const GUARDRAIL_MIN_THRESHOLD_MIN = 25;
```

- [ ] **Step 2: Write the failing tests** — `src/engine/__tests__/guardrail.test.ts` (spec §8 cases):

```ts
import { guardrailFactor, guardrailThresholdMin } from '../guardrail';

describe('guardrailFactor', () => {
  it('off → null', () => expect(guardrailFactor('off')).toBeNull());
  it('maps each multiple', () => {
    expect(guardrailFactor('1.5x')).toBe(1.5);
    expect(guardrailFactor('2x')).toBe(2);
    expect(guardrailFactor('3x')).toBe(3);
  });
});

describe('guardrailThresholdMin', () => {
  it('off → null', () => expect(guardrailThresholdMin({ honestMin: 20, setting: 'off' })).toBeNull());
  it('honest 20, 2x → 40', () => expect(guardrailThresholdMin({ honestMin: 20, setting: '2x' })).toBe(40));
  it('honest 30, 1.5x → 45', () => expect(guardrailThresholdMin({ honestMin: 30, setting: '1.5x' })).toBe(45));
  it('floors below the 25-min minimum: honest 10, 2x (=20) → 25', () =>
    expect(guardrailThresholdMin({ honestMin: 10, setting: '2x' })).toBe(25));
  it('floors: honest 5, 3x (=15) → 25', () =>
    expect(guardrailThresholdMin({ honestMin: 5, setting: '3x' })).toBe(25));
  it('honest 0 → null', () => expect(guardrailThresholdMin({ honestMin: 0, setting: '2x' })).toBeNull());
  it('honest NaN → null', () => expect(guardrailThresholdMin({ honestMin: NaN, setting: '2x' })).toBeNull());
  it('no upper clamp: honest 200, 3x → 600', () =>
    expect(guardrailThresholdMin({ honestMin: 200, setting: '3x' })).toBe(600));
  it('rounds then floors: honest 17, 1.5x (=25.5) → 26', () =>
    expect(guardrailThresholdMin({ honestMin: 17, setting: '1.5x' })).toBe(26));
});
```

- [ ] **Step 3: Run → fail.** `npx jest src/engine/__tests__/guardrail.test.ts`

- [ ] **Step 4: Implement `src/engine/guardrail.ts`:**

```ts
import type { GuardrailMultiple } from '../domain/types';
import { GUARDRAIL_FACTORS, GUARDRAIL_MIN_THRESHOLD_MIN } from './constants';

/** Numeric factor for a setting, or null when off. */
export function guardrailFactor(setting: GuardrailMultiple): number | null {
  if (setting === 'off') return null;
  return GUARDRAIL_FACTORS[setting];
}

/** Elapsed-minute threshold at which the guardrail fires, or null when off / no usable
 *  honest number. threshold = round(honestMin × factor), floored at the minimum. */
export function guardrailThresholdMin(input: {
  honestMin: number;
  setting: GuardrailMultiple;
}): number | null {
  const factor = guardrailFactor(input.setting);
  if (factor === null) return null;
  if (!Number.isFinite(input.honestMin) || input.honestMin <= 0) return null;
  return Math.max(GUARDRAIL_MIN_THRESHOLD_MIN, Math.round(input.honestMin * factor));
}
```

- [ ] **Step 5: Export** from `src/engine/index.ts`:

```ts
export { guardrailFactor, guardrailThresholdMin } from './guardrail';
export { GUARDRAIL_FACTORS, DEFAULT_GUARDRAIL, GUARDRAIL_MIN_THRESHOLD_MIN } from './constants';
```

(If `constants` is re-exported wholesale, skip the second line.)

- [ ] **Step 6: Run → pass. Commit.**

```bash
git add src/engine/guardrail.ts src/engine/constants.ts src/engine/index.ts src/engine/__tests__/guardrail.test.ts
git commit -m "feat(engine): add hyperfocus guardrail threshold math (pure)"
```

---

### Task 2: Domain type `GuardrailMultiple`

**Files:** Modify `src/domain/types.ts` (do BEFORE Task 1 implementation).

- [ ] **Step 1:** Add:

```ts
/** Hyperfocus guardrail trigger multiple of the honest number, or off. */
export type GuardrailMultiple = 'off' | '1.5x' | '2x' | '3x';
```

- [ ] **Step 2:** `npm run typecheck` → clean. Commit (or fold into Task 1).

```bash
git add src/domain/types.ts
git commit -m "feat(domain): add GuardrailMultiple type"
```

---

### Task 3: `settingsStore` — `hyperfocusGuard` (TDD)

**Files:** Modify `src/stores/settingsStore.ts`; add tests to `src/stores/__tests__/settingsStore.test.ts`.

**Interfaces:** `hyperfocusGuard: GuardrailMultiple` (default `'off'`), `setHyperfocusGuard(v)`, `reset()` restores `'off'`.

- [ ] **Step 1: Failing tests:**

```ts
describe('settingsStore hyperfocusGuard', () => {
  beforeEach(() => useSettingsStore.getState().reset());
  it('defaults to off', () => expect(useSettingsStore.getState().hyperfocusGuard).toBe('off'));
  it('sets a value', () => {
    useSettingsStore.getState().setHyperfocusGuard('2x');
    expect(useSettingsStore.getState().hyperfocusGuard).toBe('2x');
  });
  it('reset restores off', () => {
    useSettingsStore.getState().setHyperfocusGuard('3x');
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().hyperfocusGuard).toBe('off');
  });
});
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** — import `DEFAULT_GUARDRAIL` + `GuardrailMultiple`; add `hyperfocusGuard: DEFAULT_GUARDRAIL`, `setHyperfocusGuard: (hyperfocusGuard) => set({ hyperfocusGuard })`, and add `hyperfocusGuard: DEFAULT_GUARDRAIL` to the `reset()` object.
- [ ] **Step 4: Run → pass. Commit.**

```bash
git add src/stores/settingsStore.ts src/stores/__tests__/settingsStore.test.ts
git commit -m "feat(settings): add hyperfocus guardrail setting (off by default)"
```

---

### Task 4: `timerStore` — per-session `guardNudged`

**Files:** Modify `src/stores/timerStore.ts`; add a test to the existing timer store test if present.

**Interfaces:** `guardNudged: boolean` on `TimerState` AND `PersistedTimer` (so a resumed session that already nudged won't re-nudge); `markGuardNudged(): void`; `CLEARED` sets it false; persist + rehydrate it.

- [ ] **Step 1: Implement** — add `guardNudged: boolean` to the `TimerState` interface and the `PersistedTimer` interface; add `guardNudged: false` to the `CLEARED` object; in the persist snapshot (the `PersistedTimer` build near line 85) include `guardNudged: state.guardNudged`; in the rehydrate path read it back (default false if absent); add an action `markGuardNudged: () => set({ guardNudged: true })`. Reading the file first to match the exact snapshot/rehydrate shape.
- [ ] **Step 2: Test** — if `src/stores/__tests__/timerStore.test.ts` exists, add: starting a session sets `guardNudged` false; `markGuardNudged()` flips it true; `cancel`/`stop` clears it back to false. If no timer store test exists, add a minimal one.
- [ ] **Step 3: Run → pass. typecheck. Commit.**

```bash
git add src/stores/timerStore.ts src/stores/__tests__/timerStore.test.ts
git commit -m "feat(timer): add per-session guardNudged flag"
```

---

### Task 5: `timerNotifications` — guard ping

**Files:** Modify `src/services/timerNotifications.ts`.

**Interfaces:** `scheduleGuardCheckIn({ label, startedAt, thresholdMin }): Promise<void>`, `cancelGuardCheckIn(): Promise<void>`, `GUARD_ID_KEY`. Mirror `scheduleTimerDone`/`cancelTimerDone` exactly (lazy `getModule()` guard, best-effort, no-op in Expo Go/tests, store the scheduled id in kv).

- [ ] **Step 1: Implement** — add `const GUARD_ID_KEY = 'whenbee.guardNotifId';`. `scheduleGuardCheckIn` schedules a notification at `startedAt + thresholdMin*60_000`; skip silently if already past; title `Still on this?`, body `You've been on {label} about {thresholdMin} minutes. Surface whenever you want.`; store the id in kv at `GUARD_ID_KEY`; cancel any prior guard ping first (mirror how `scheduleTimerDone` cancels). `cancelGuardCheckIn` cancels the stored id and clears the key. Read the existing two functions and copy their structure precisely.
- [ ] **Step 2: typecheck + lint.** `npm run typecheck && npx eslint src/services/timerNotifications.ts`
- [ ] **Step 3: Commit.**

```bash
git add src/services/timerNotifications.ts
git commit -m "feat(timer): add guardrail check-in notification"
```

---

### Task 6: `useTimer` — arm + dual-channel delivery + de-dupe

**Files:** Modify `src/features/timer/useTimer.ts`.

**Interfaces:** The hook gains a `guardDue: boolean` (React state) it returns so the screen can mount the card, plus internal arming. It reads `useSettingsStore.getState().hyperfocusGuard` + `useEntitlement.getState().isPro` non-reactively at session start.

- [ ] **Step 1: Read the file** to locate: the fresh-session `useEffect` (~line 162, where `scheduleTimerDone` is called after permission), the `elapsedSec` shared value + `useFrameCallback` (~196), and the `onStopAndLog`/`onAbandon` callbacks (~220/~300) where `cancelTimerDone()` is called.

- [ ] **Step 2: Arm at session start.** Inside the fresh-session effect, after the existing `scheduleTimerDone` block, add (Pro + setting gate, non-reactive reads):

```ts
const guardSetting = useSettingsStore.getState().hyperfocusGuard;
const guardPro = useEntitlement.getState().isPro;
const guardThresholdMin = guardPro
  ? guardrailThresholdMin({ honestMin: suggestedHonestMin, setting: guardSetting })
  : null;
if (guardThresholdMin != null) {
  analytics.capture('guardrail_armed', { setting: guardSetting, threshold_min: guardThresholdMin, honest_min: suggestedHonestMin });
  // background ping only when reminders are enabled (same gate as scheduleTimerDone)
  if (granted) await scheduleGuardCheckIn({ label, startedAt, thresholdMin: guardThresholdMin });
}
// stash the threshold in a ref for the foreground reaction
guardThresholdSecRef.current = guardThresholdMin != null ? guardThresholdMin * 60 : null;
```

Add `const guardThresholdSecRef = useRef<number | null>(null);` near the other refs. Import `guardrailThresholdMin` from `@/src/engine`, `scheduleGuardCheckIn`/`cancelGuardCheckIn` from the notifications service, `useSettingsStore`, `useEntitlement`, `analytics`.

- [ ] **Step 3: Foreground card driver.** Add `const [guardDue, setGuardDue] = useState(false);`. Drive it off the existing `elapsedSec` with a `useAnimatedReaction` (mirror the `FinishTime`/`PaceLabel` pattern — format/JS work via `runOnJS`, never call non-worklets in the worklet):

```ts
const markGuardNudged = useTimerStore((s) => s.markGuardNudged);
const fireGuard = useCallback(() => {
  if (useTimerStore.getState().guardNudged) return;
  markGuardNudged();
  setGuardDue(true);
  void cancelGuardCheckIn(); // foreground won; don't also fire the background ping
  analytics.capture('guardrail_shown', {
    channel: 'in_app',
    elapsed_min: Math.floor(elapsedSec.value / 60),
    threshold_min: Math.round((guardThresholdSecRef.current ?? 0) / 60),
  });
}, [markGuardNudged]);

useAnimatedReaction(
  () => {
    const th = guardThresholdSecRef.current;
    return th != null && elapsedSec.value >= th;
  },
  (due, prev) => {
    if (due && !prev) runOnJS(fireGuard)();
  },
);
```

(Confirm `useTimerStore` is the timer store hook name; adjust import.)

- [ ] **Step 4: Cancel on stop/abandon.** In `onStopAndLog` and `onAbandon`, alongside the existing `void cancelTimerDone();`, add `void cancelGuardCheckIn();`.

- [ ] **Step 5: Return + resolve actions.** Return `guardDue`, a `keepGoing()` (`() => setGuardDue(false)` — the card is dismissed; session already marked nudged) and `wrapUp()` (`() => { setGuardDue(false); return onStopAndLog(); }`) from the hook. Fire `guardrail_resolved` with the action in each.

- [ ] **Step 6: De-dupe on resume.** On resume-from-kv (where the store rehydrates), if `guardNudged` is already true the reaction's `markGuardNudged` guard + the persisted flag prevent a re-show; verify no arming re-schedules a ping when `guardNudged` is true (guard the Step-2 block with `&& !useTimerStore.getState().guardNudged`).

- [ ] **Step 7: typecheck + lint.** `npm run typecheck && npx eslint src/features/timer/useTimer.ts`

- [ ] **Step 8: Commit.**

```bash
git add src/features/timer/useTimer.ts
git commit -m "feat(timer): arm hyperfocus guardrail and drive the in-app check-in"
```

---

### Task 7: UI — `GuardrailCheckIn` card + render in the timer screen

**Files:** Create `src/features/timer/GuardrailCheckIn.tsx`; modify `src/app/(modals)/timer.tsx`.

**Interfaces:** `<GuardrailCheckIn taskLabel elapsedMin onKeepGoing onWrapUp />` — the calm amber slide-up panel over the lower controls per spec §5/§6. Props from the hook's `guardDue`/`keepGoing`/`wrapUp`.

UI — no unit test. Build per spec §5 (layout), §6 (motion), §10 (copy):
- Panel: `t.colors.surface`, `radii.sheet` top corners, hairline top edge, thin amber top rule (`t.colors.accent`) or amber dot at cap-height of the heading. No `boxShadow`.
- Copy: heading `Still on this?`; body `You've been on "{taskLabel}" for {elapsedMin} minutes. Still the right thing, or want to surface?`; primary amber coin-edge `AppButton` `Keep going` (the prominent default) → `onKeepGoing`; ghost `Wrap up` (`inkSoft`) → `onWrapUp`.
- Motion: slide up + fade in over `t.motion.sheet`, `easing.out`, entering-only; dismiss via explicit shared-value timing over `t.motion.base` (NO `exiting`). Lower controls behind dim to `t.opacity.pressed` while up. Reduced motion → instant. Optional single `Haptics.selectionAsync` on appearance.
- Banned strings absent; amber only, never red; the ring stays readable behind (not a full scrim).

- [ ] **Step 1: Build the card.**
- [ ] **Step 2: Render in `timer.tsx`** — pull `guardDue`/`keepGoing`/`wrapUp` from `useTimer`, render `{guardDue ? <GuardrailCheckIn taskLabel={label} elapsedMin={...} onKeepGoing={keepGoing} onWrapUp={wrapUp} /> : null}` over the controls. Compute `elapsedMin` from the displayed elapsed (floor to minute).
- [ ] **Step 3: typecheck + lint.** `npm run typecheck && npx eslint src/features/timer/GuardrailCheckIn.tsx 'src/app/(modals)/timer.tsx'`
- [ ] **Step 4: Commit.** `git commit -m "feat(timer): add hyperfocus guardrail check-in card"`

---

### Task 8: Settings — Pro row + locked row

**Files:** Create `src/features/settings/GuardrailSettingRow.tsx`, `src/features/settings/GuardrailLockedRow.tsx`; modify `src/app/settings.tsx`.

**Interfaces:** `GuardrailSettingRow` (Pro) shows current value + an Off/1.5×/2×/3× control writing `settingsStore.setHyperfocusGuard`, fires `guardrail_setting_changed`. `GuardrailLockedRow` (non-Pro) shows the shape + routes to paywall (`trigger: 'hyperfocus_guard'`), fires `guardrail_paywall`.

UI — no unit test. Per spec §5/§9/§10:
- Pro row: title `Hyperfocus check-in`, caption `A gentle nudge when a task runs long.`, options `Off · 1.5× · 2× · 3×` (selected = `primarySoft` fill chrome — selection chrome may be indigo; the live nudge stays amber).
- Locked row: title `Hyperfocus check-in`, caption `A heads-up before a task eats your evening.`, lock glyph, value greyed; tap → `router.push({ pathname: '/(modals)/paywall', params: { trigger: 'hyperfocus_guard' } })`.
- Mount in `src/app/settings.tsx` UNDER the reminders row: `<ProGate fallback={<GuardrailLockedRow />}><GuardrailSettingRow /></ProGate>`. Reuse the file's existing `SettingRow` shape for visual consistency.

- [ ] **Step 1: Build both rows.**
- [ ] **Step 2: Mount under the reminders row.**
- [ ] **Step 3: typecheck + lint.**
- [ ] **Step 4: Commit.** `git commit -m "feat(settings): add hyperfocus guardrail rows (Pro + locked)"`

---

### Task 9: Analytics + `hyperfocus_guard` trigger

**Files:** Modify `src/services/analytics.ts`, `src/features/paywall/Paywall.tsx`.

- [ ] **Step 1:** Add to `AppEventProps`:

```ts
guardrail_armed: { setting: GuardrailMultiple; threshold_min: number; honest_min: number };
guardrail_shown: { channel: 'in_app' | 'notification'; elapsed_min: number; threshold_min: number };
guardrail_resolved: { action: 'keep_going' | 'wrap_up'; elapsed_min: number };
guardrail_setting_changed: { from: GuardrailMultiple; to: GuardrailMultiple };
guardrail_paywall: Record<string, never>;
```

Import `GuardrailMultiple` into `analytics.ts` if event prop typing needs it (or inline the union). Add `| 'hyperfocus_guard'` to the `paywall_view.trigger` union.

- [ ] **Step 2:** Add `'hyperfocus_guard'` to `Paywall.tsx`'s `Trigger` union + `isTrigger`.
- [ ] **Step 3:** typecheck + lint + commit.

```bash
git add src/services/analytics.ts src/features/paywall/Paywall.tsx
git commit -m "feat(analytics): add guardrail events and hyperfocus_guard trigger"
```

---

### Task 10: Full gate + PR (do NOT merge)

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test` → all green.
- [ ] **Step 2:**

```bash
git push -u origin feat/pro-08-hyperfocus-guardrail
gh pr create --title "feat: hyperfocus guardrail (Pro)" \
  --body "Pro, opt-in (off by default), no-guilt hyperfocus check-in: fires once when a task passes a chosen multiple of its honest number — calm amber in-app card, or one soft notification if backgrounded. Pure engine threshold math, kv setting + per-session guardNudged flag, dual-channel mutual exclusion in useTimer. Spec: docs/product/specs/08-hyperfocus-guardrail.md. Plan: docs/superpowers/plans/2026-06-21-pro-08-hyperfocus-guardrail.md. Sim verification pending (founder)."
```

Do NOT merge. Report PR URL, commits, gate output, deviations, main HEAD unchanged.

---

## Self-Review

**Spec coverage** (vs `docs/product/specs/08-hyperfocus-guardrail.md`): engine factor+threshold+floor ✔ (T1), `GuardrailMultiple` ✔ (T2), kv setting off-by-default ✔ (T3), per-session `guardNudged` persisted ✔ (T4), guarded guard-ping ✔ (T5), arm + foreground `useAnimatedReaction` driver + cancel-on-stop + de-dupe + mutual exclusion ✔ (T6), calm amber card + render ✔ (T7), Pro + locked Settings rows ✔ (T8), 5 events + trigger ✔ (T9). Off-training-path + no-guilt enforced throughout.

**Placeholder scan:** engine/setting/store steps carry full code + tests. T6 wiring gives concrete code blocks anchored to read line numbers (instructs reading first to match exact shapes — not hand-waved). T7/T8 UI reference spec wireframe/copy with every token, state, copy string, motion rule, and banned-string list pinned.

**Type consistency:** `GuardrailMultiple`, `guardrailFactor`/`guardrailThresholdMin`, `hyperfocusGuard`/`setHyperfocusGuard`, `guardNudged`/`markGuardNudged`, `scheduleGuardCheckIn`/`cancelGuardCheckIn`, the hook's `guardDue`/`keepGoing`/`wrapUp`, and the five `guardrail_*` events are consistent T1–T9.
