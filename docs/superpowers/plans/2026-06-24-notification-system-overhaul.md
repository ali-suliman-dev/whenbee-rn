# Notification System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Whenbee's four plain local notifications into a calm, actionable system — quick-action buttons, an honest-number "you're near the finish" ping, quiet hours, provisional opt-in, a sound option, and a redesigned settings section — handing off to the existing Live Activity so the two never double-nag.

**Architecture:** Pure timing/decision helpers in `src/lib/` (TDD). Notification content + categories live in the existing guarded services (`timerNotifications.ts`, `reviewNotifications.ts`) plus a new `notificationCategories.ts` / `notificationSetup.ts` / `notificationResponses.ts`. Settings keys go in `settingsStore`. UI is the Settings → Notifications section. No native module is added — the Live Activity is consumed via `presenceAvailable()` + a new `isFinishTimeActivityActive()` flag.

**Tech Stack:** Expo SDK 54, `expo-notifications` (lazily required, native-probe guarded), Zustand + `zustandKv`, React Native, Jest. Spec: [`docs/product/specs/2026-06-24-notification-system-overhaul.md`](../../product/specs/2026-06-24-notification-system-overhaul.md).

## Global Constraints

- **On-device only.** All notifications are local (`expo-notifications`). No APNs, no network. Reuse the existing native-probe guard (`requireOptionalNativeModule('ExpoNotificationScheduler')` → no-op when absent).
- **No guilt.** No "late / overdue / missed / time's up / behind", no red, no streaks, no badges. A passed estimate is calm data.
- **Copy is frozen.** Use the exact strings from spec §9. Re-run `humanizer` + `conversion-psychology` only if any wording changes.
- **Tokens only.** Every spacing/size/color in UI comes from `useTheme()` / `src/theme/tokens.ts`. Add a token if missing; never inline a raw number or hex.
- **Time-sensitive pings:** honest-reached + start-by use `interruptionLevel: 'timeSensitive'`. Gentle pings (hyperfocus guard, review) respect quiet hours.
- **Commits:** Conventional Commits, no AI/co-author attribution. Subagents commit with plain `git` (the `/init-cmt` interactive gate stalls autonomous runs).
- **Verify per task:** `npx jest <file>` for the task's tests, then `npx eslint <changed files>` (flat `eslint.config.js`, 0 warnings).
- **Indexed access is `T | undefined`** (`noUncheckedIndexedAccess`) — handle it, don't `!`.

---

### Task 1: Pure timing + decision helpers

**Files:**
- Create: `src/lib/notifyTiming.ts`
- Test: `src/lib/__tests__/notifyTiming.test.ts`

**Interfaces:**
- Produces:
  - `interface QuietHours { enabled: boolean; startMin: number; endMin: number }`
  - `nextAllowedFireMs(desiredMs: number, quiet: QuietHours, nowMs: number): number`
  - `honestReachedFireMs(startedAtMs: number, anchorMin: number): number`
  - `shouldSuppressHonestBanner(presenceAvailable: boolean, activityActive: boolean): boolean`
  - `guardCollidesWithHonest(honestFireMs: number, guardFireMs: number, gapMs?: number): boolean`

Rationale: these are deterministic; `src/lib/` (not `src/engine/`) because `nextAllowedFireMs` reads local clock components via `new Date(ms)` and the engine forbids clock access.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/notifyTiming.test.ts
import {
  nextAllowedFireMs,
  honestReachedFireMs,
  shouldSuppressHonestBanner,
  guardCollidesWithHonest,
  type QuietHours,
} from '@/src/lib/notifyTiming';

// A fixed local day to make minute-of-day math deterministic.
// 2026-06-24 is a Wednesday. Build ms from local components.
const at = (h: number, m = 0): number => new Date(2026, 5, 24, h, m, 0, 0).getTime();
const QUIET: QuietHours = { enabled: true, startMin: 21 * 60, endMin: 8 * 60 }; // 21:00–08:00 wrap

describe('nextAllowedFireMs', () => {
  it('returns desired unchanged when quiet hours disabled', () => {
    const off: QuietHours = { enabled: false, startMin: 0, endMin: 0 };
    expect(nextAllowedFireMs(at(23), off, at(20))).toBe(at(23));
  });

  it('returns desired unchanged when outside the quiet window', () => {
    expect(nextAllowedFireMs(at(14), QUIET, at(13))).toBe(at(14)); // 2pm, awake
  });

  it('pushes a late-night fire to the window end (next morning 08:00)', () => {
    expect(nextAllowedFireMs(at(23), QUIET, at(22))).toBe(at(32 - 24)); // 08:00 next day
  });

  it('pushes an early-morning fire (inside wrap) to 08:00 same day', () => {
    expect(nextAllowedFireMs(at(3), QUIET, at(2))).toBe(at(8));
  });

  it('treats the startMin boundary as inside (defer)', () => {
    expect(nextAllowedFireMs(at(21), QUIET, at(20))).toBe(at(32 - 24)); // 21:00 → next 08:00
  });

  it('treats the endMin boundary as outside (allow)', () => {
    expect(nextAllowedFireMs(at(8), QUIET, at(7))).toBe(at(8));
  });

  it('handles a non-wrapping window (13:00–14:00)', () => {
    const lunch: QuietHours = { enabled: true, startMin: 13 * 60, endMin: 14 * 60 };
    expect(nextAllowedFireMs(at(13, 30), lunch, at(13))).toBe(at(14));
    expect(nextAllowedFireMs(at(15), lunch, at(14, 30))).toBe(at(15));
  });
});

describe('honestReachedFireMs', () => {
  it('adds anchor minutes to the start', () => {
    expect(honestReachedFireMs(at(10), 45)).toBe(at(10, 45));
  });
});

describe('shouldSuppressHonestBanner', () => {
  it('suppresses only when presence is available AND an activity is live', () => {
    expect(shouldSuppressHonestBanner(true, true)).toBe(true);
    expect(shouldSuppressHonestBanner(true, false)).toBe(false);
    expect(shouldSuppressHonestBanner(false, true)).toBe(false);
    expect(shouldSuppressHonestBanner(false, false)).toBe(false);
  });
});

describe('guardCollidesWithHonest', () => {
  it('flags a guard within the default 60s gap of the honest ping', () => {
    expect(guardCollidesWithHonest(at(11), at(11), 60_000)).toBe(true);
    expect(guardCollidesWithHonest(at(11), at(11, 0) + 30_000, 60_000)).toBe(true);
  });
  it('allows a guard well after the honest ping', () => {
    expect(guardCollidesWithHonest(at(11), at(12), 60_000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx jest src/lib/__tests__/notifyTiming.test.ts`
Expected: FAIL — "Cannot find module '@/src/lib/notifyTiming'".

- [ ] **Step 3: Implement the helpers**

```ts
// src/lib/notifyTiming.ts
// Pure, deterministic timing + decision helpers for the notification layer.
// In src/lib (not src/engine) because quiet-hours math reads local clock
// components via new Date(ms); the engine forbids clock access. No Date.now()
// here — callers pass nowMs.

export interface QuietHours {
  enabled: boolean;
  /** Window start, minutes after local midnight (0–1439). */
  startMin: number;
  /** Window end, minutes after local midnight (0–1439). May be < startMin (wraps midnight). */
  endMin: number;
}

const MS_PER_MIN = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MIN;

/** Minute-of-day [0,1439] for a local epoch ms. */
function localMinuteOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** Local-midnight epoch ms for the day containing `ms`. */
function localMidnight(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

/** True if minute-of-day `mod` is inside [startMin, endMin), wrap-aware. start inclusive, end exclusive. */
function insideWindow(mod: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false; // empty window
  if (startMin < endMin) return mod >= startMin && mod < endMin;
  return mod >= startMin || mod < endMin; // wraps midnight
}

/**
 * If `desiredMs` lands inside the quiet window, return the next occurrence of the
 * window end (endMin); otherwise return `desiredMs` unchanged. `nowMs` is accepted
 * for symmetry/testability and future use; the shift is computed from `desiredMs`.
 */
export function nextAllowedFireMs(desiredMs: number, quiet: QuietHours, _nowMs: number): number {
  if (!quiet.enabled) return desiredMs;
  const mod = localMinuteOfDay(desiredMs);
  if (!insideWindow(mod, quiet.startMin, quiet.endMin)) return desiredMs;
  // Defer to the window end. End on the same local day if it's still ahead of
  // desired; otherwise the next day's end.
  const midnight = localMidnight(desiredMs);
  let end = midnight + quiet.endMin * MS_PER_MIN;
  if (end <= desiredMs) end += MS_PER_DAY;
  return end;
}

/** When the honest-reached ping should fire: start + the chosen anchor minutes. */
export function honestReachedFireMs(startedAtMs: number, anchorMin: number): number {
  return startedAtMs + anchorMin * MS_PER_MIN;
}

/** Suppress the honest banner only when the Live Activity ring is carrying the moment. */
export function shouldSuppressHonestBanner(presenceAvailable: boolean, activityActive: boolean): boolean {
  return presenceAvailable && activityActive;
}

/** True if the guard ping would fire within `gapMs` of the honest ping (so we skip the guard). */
export function guardCollidesWithHonest(honestFireMs: number, guardFireMs: number, gapMs = MS_PER_MIN): boolean {
  return Math.abs(guardFireMs - honestFireMs) < gapMs;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx jest src/lib/__tests__/notifyTiming.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/lib/notifyTiming.ts src/lib/__tests__/notifyTiming.test.ts
git add src/lib/notifyTiming.ts src/lib/__tests__/notifyTiming.test.ts
git commit -m "feat(notify): pure quiet-hours + honest-anchor + suppression helpers"
```

---

### Task 2: Settings store keys (quiet hours, sound, per-type toggles)

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Test: `src/stores/__tests__/settingsStore.notify.test.ts` (create)

**Interfaces:**
- Consumes: `QuietHours` from Task 1.
- Produces on the store:
  - `quietHours: QuietHours`, `setQuietHours: (q: QuietHours) => void`
  - `notificationSound: 'honey' | 'default' | 'none'`, `setNotificationSound: (v) => void`
  - `honestReachedEnabled: boolean`, `setHonestReachedEnabled: (v: boolean) => void`
  - `startByEnabled: boolean`, `setStartByEnabled: (v: boolean) => void`

Defaults: `quietHours = { enabled: true, startMin: 1260 /*21:00*/, endMin: 480 /*08:00*/ }`, `notificationSound = 'default'` (Honey option exists but maps to the system sound until the audio asset ships — see Task 4 note), `honestReachedEnabled = true`, `startByEnabled = true`. All included in `reset()`.

- [ ] **Step 1: Write the failing test**

```ts
// src/stores/__tests__/settingsStore.notify.test.ts
import { useSettingsStore } from '@/src/stores/settingsStore';

describe('settingsStore — notification keys', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  it('has calm defaults', () => {
    const s = useSettingsStore.getState();
    expect(s.quietHours).toEqual({ enabled: true, startMin: 1260, endMin: 480 });
    expect(s.notificationSound).toBe('default');
    expect(s.honestReachedEnabled).toBe(true);
    expect(s.startByEnabled).toBe(true);
  });

  it('sets and resets quiet hours + sound + per-type toggles', () => {
    const s = useSettingsStore.getState();
    s.setQuietHours({ enabled: false, startMin: 0, endMin: 0 });
    s.setNotificationSound('honey');
    s.setHonestReachedEnabled(false);
    s.setStartByEnabled(false);
    expect(useSettingsStore.getState().quietHours.enabled).toBe(false);
    expect(useSettingsStore.getState().notificationSound).toBe('honey');
    expect(useSettingsStore.getState().honestReachedEnabled).toBe(false);

    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().quietHours.enabled).toBe(true);
    expect(useSettingsStore.getState().honestReachedEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/stores/__tests__/settingsStore.notify.test.ts`
Expected: FAIL — `quietHours` is undefined.

- [ ] **Step 3: Add keys to the store**

In `src/stores/settingsStore.ts`, add the import and interface members, then the implementation + reset entries.

Add to the import block at top:

```ts
import type { QuietHours } from '@/src/lib/notifyTiming';
```

Add to `interface SettingsState` (after `setRemindersEnabled`):

```ts
  /** Per-type ping toggles, shown only when reminders are on. Default on. */
  honestReachedEnabled: boolean;
  setHonestReachedEnabled: (v: boolean) => void;
  startByEnabled: boolean;
  setStartByEnabled: (v: boolean) => void;
  /** Quiet window for gentle pings (guard, review). Time-sensitive pings ignore it. */
  quietHours: QuietHours;
  setQuietHours: (q: QuietHours) => void;
  /** Notification sound choice. 'honey' maps to the system sound until the asset ships. */
  notificationSound: 'honey' | 'default' | 'none';
  setNotificationSound: (v: 'honey' | 'default' | 'none') => void;
```

Add to the `create` body (after `setRemindersEnabled`):

```ts
      honestReachedEnabled: true,
      setHonestReachedEnabled: (honestReachedEnabled) => set({ honestReachedEnabled }),
      startByEnabled: true,
      setStartByEnabled: (startByEnabled) => set({ startByEnabled }),
      quietHours: { enabled: true, startMin: 1260, endMin: 480 },
      setQuietHours: (quietHours) => set({ quietHours }),
      notificationSound: 'default',
      setNotificationSound: (notificationSound) => set({ notificationSound }),
```

Add to the `reset()` object:

```ts
          honestReachedEnabled: true,
          startByEnabled: true,
          quietHours: { enabled: true, startMin: 1260, endMin: 480 },
          notificationSound: 'default',
```

- [ ] **Step 4: Run, verify it passes**

Run: `npx jest src/stores/__tests__/settingsStore.notify.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/stores/settingsStore.ts src/stores/__tests__/settingsStore.notify.test.ts
git add src/stores/settingsStore.ts src/stores/__tests__/settingsStore.notify.test.ts
git commit -m "feat(settings): quiet hours, sound, per-type notification toggles"
```

---

### Task 3: Expose Live Activity active-flag

**Files:**
- Modify: `src/services/liveActivity.ts:152-189`
- Test: `src/services/__tests__/liveActivity.activeFlag.test.ts` (create)

**Interfaces:**
- Consumes: existing `startFinishTimeActivity`, `endFinishTimeActivity`, `presenceAvailable` (file already exports these).
- Produces: `isFinishTimeActivityActive(): boolean` — true between a `startFinishTimeActivity` and the matching `endFinishTimeActivity`.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/__tests__/liveActivity.activeFlag.test.ts
import {
  startFinishTimeActivity,
  endFinishTimeActivity,
  isFinishTimeActivityActive,
} from '@/src/services/liveActivity';

describe('isFinishTimeActivityActive', () => {
  it('is false before start, true after start, false after end', () => {
    expect(isFinishTimeActivityActive()).toBe(false);
    startFinishTimeActivity({ taskLabel: 'Email', finishEpoch: 1_000 });
    expect(isFinishTimeActivityActive()).toBe(true);
    endFinishTimeActivity();
    expect(isFinishTimeActivityActive()).toBe(false);
  });
});
```

(If `LiveActivityAttributes` has a different shape, match it — read the type at the top of `liveActivity.ts` and adjust the test's argument. The flag behavior is what's under test.)

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/services/__tests__/liveActivity.activeFlag.test.ts`
Expected: FAIL — `isFinishTimeActivityActive` is not exported.

- [ ] **Step 3: Add the flag**

In `src/services/liveActivity.ts`, add a module-level boolean and set it in start/end, then export the getter. Near the other module state:

```ts
let finishTimeActivityActive = false;
```

In `startFinishTimeActivity`, after the existing body, set the flag (only when it actually starts — keep it simple and set unconditionally so the in-app/test path tracks intent):

```ts
  finishTimeActivityActive = true;
```

In `endFinishTimeActivity`, set it false:

```ts
  finishTimeActivityActive = false;
```

Add the exported getter at the bottom near `presenceAvailable`:

```ts
/** True while a finish-time Live Activity is live (drives notification suppression). */
export function isFinishTimeActivityActive(): boolean {
  return finishTimeActivityActive;
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npx jest src/services/__tests__/liveActivity.activeFlag.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/services/liveActivity.ts src/services/__tests__/liveActivity.activeFlag.test.ts
git add src/services/liveActivity.ts src/services/__tests__/liveActivity.activeFlag.test.ts
git commit -m "feat(presence): expose isFinishTimeActivityActive for notification handoff"
```

---

### Task 4: Notification categories + content upgrades (copy, sound, interruption, grouping, anchor)

**Files:**
- Create: `src/services/notificationCategories.ts`
- Modify: `src/services/timerNotifications.ts`
- Modify: `app.json` (time-sensitive entitlement)
- Test: `src/services/__tests__/timerNotifications.content.test.ts` (create)

**Interfaces:**
- Consumes: `honestReachedFireMs`, `nextAllowedFireMs`, `QuietHours` (Task 1); `notificationSound`, `quietHours` (Task 2 store).
- Produces (`notificationCategories.ts`):
  - `const CAT = { HONEST: 'WB_HONEST_REACHED', START_BY: 'WB_START_BY', GUARD: 'WB_GUARD', REVIEW: 'WB_REVIEW' } as const`
  - `const ACTION = { LOG: 'LOG', EXTEND_10: 'EXTEND_10', SNOOZE_15: 'SNOOZE_15', START: 'START', SNOOZE_5: 'SNOOZE_5', GUARD_OK: 'GUARD_OK', WRAP: 'WRAP', REVIEW_OPEN: 'REVIEW_OPEN', REVIEW_EVENING: 'REVIEW_EVENING' } as const`
  - `registerNotificationCategories(N: NotificationsModule): Promise<void>`
  - `resolveNotificationSound(pref): string | undefined`
- Produces (`timerNotifications.ts`, changed signatures):
  - `scheduleTimerDone(opts: { label: string; startedAt: number; honestMin: number; hasCalibration?: boolean }): Promise<void>` — fires at the honest anchor with the honest-reached copy, `WB_HONEST_REACHED` category, `timeSensitive`, thread `wb-timer`, sound. Carries `data: { kind, label, startedAt, honestMin }`.
  - `scheduleStartBy` unchanged signature, gains category `WB_START_BY`, `timeSensitive`, thread `wb-plan`, sound, revoiced body, `data`.
  - `scheduleGuardCheckIn` unchanged signature, gains category `WB_GUARD`, thread `wb-guard`, sound, revoiced body, **quiet-hours applied** to the fire time, `data`.

- [ ] **Step 1: Create the categories module**

```ts
// src/services/notificationCategories.ts
// Notification categories (interactive buttons) + sound resolution. Registered
// once at launch. Pure config + one async register call; no scheduling here.

type NotificationsModule = typeof import('expo-notifications');

export const CAT = {
  HONEST: 'WB_HONEST_REACHED',
  START_BY: 'WB_START_BY',
  GUARD: 'WB_GUARD',
  REVIEW: 'WB_REVIEW',
} as const;

export const ACTION = {
  LOG: 'LOG',
  EXTEND_10: 'EXTEND_10',
  SNOOZE_15: 'SNOOZE_15',
  START: 'START',
  SNOOZE_5: 'SNOOZE_5',
  GUARD_OK: 'GUARD_OK',
  WRAP: 'WRAP',
  REVIEW_OPEN: 'REVIEW_OPEN',
  REVIEW_EVENING: 'REVIEW_EVENING',
} as const;

export const THREAD = {
  TIMER: 'wb-timer',
  PLAN: 'wb-plan',
  GUARD: 'wb-guard',
  REVIEW: 'wb-review',
} as const;

/** Honey maps to the system sound until the bundled asset ships (see plan note). */
export function resolveNotificationSound(pref: 'honey' | 'default' | 'none'): string | undefined {
  if (pref === 'none') return undefined; // omitting sound = silent on iOS
  // When src/assets/sounds/honey.wav is bundled, return 'honey.wav' for 'honey'.
  return 'default';
}

/** Register all four interactive categories. Safe to call repeatedly. */
export async function registerNotificationCategories(N: NotificationsModule): Promise<void> {
  const fg = { opensAppToForeground: true };
  const bg = { opensAppToForeground: false };
  await Promise.all([
    N.setNotificationCategoryAsync(CAT.HONEST, [
      { identifier: ACTION.LOG, buttonTitle: 'Log it', options: fg },
      { identifier: ACTION.EXTEND_10, buttonTitle: '+10 min', options: bg },
      { identifier: ACTION.SNOOZE_15, buttonTitle: 'Snooze 15m', options: bg },
    ]),
    N.setNotificationCategoryAsync(CAT.START_BY, [
      { identifier: ACTION.START, buttonTitle: 'Start now', options: fg },
      { identifier: ACTION.SNOOZE_5, buttonTitle: 'Snooze 5m', options: bg },
    ]),
    N.setNotificationCategoryAsync(CAT.GUARD, [
      { identifier: ACTION.GUARD_OK, buttonTitle: "I'm good", options: bg },
      { identifier: ACTION.WRAP, buttonTitle: 'Wrap up', options: fg },
    ]),
    N.setNotificationCategoryAsync(CAT.REVIEW, [
      { identifier: ACTION.REVIEW_OPEN, buttonTitle: 'Open review', options: fg },
      { identifier: ACTION.REVIEW_EVENING, buttonTitle: 'This evening', options: bg },
    ]),
  ]);
}
```

- [ ] **Step 2: Write the failing content test**

This test reuses the project's existing pattern of mocking `expo-notifications`. It asserts the new content fields. (Match the mock style already used in `src/services/__tests__/` for these services — if a shared mock helper exists, reuse it.)

```ts
// src/services/__tests__/timerNotifications.content.test.ts
const scheduled: any[] = [];
jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => ({}), // pretend the native scheduler exists
}));
jest.mock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', WEEKLY: 'weekly' },
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async (req: any) => {
    scheduled.push(req);
    return 'id-1';
  }),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  setNotificationCategoryAsync: jest.fn(async () => {}),
}));

import { scheduleTimerDone } from '@/src/services/timerNotifications';

describe('scheduleTimerDone — honest-reached content', () => {
  beforeEach(() => (scheduled.length = 0));

  it('fires at the honest anchor with the no-guilt copy, category, timeSensitive, thread, sound', async () => {
    const startedAt = Date.now();
    await scheduleTimerDone({ label: 'Email', startedAt, honestMin: 30 });
    expect(scheduled).toHaveLength(1);
    const { content, trigger } = scheduled[0];
    expect(content.title).toBe("You're near the finish");
    expect(content.body).toBe('This is about when Email usually wraps. Log it when you're done.');
    expect(content.categoryIdentifier).toBe('WB_HONEST_REACHED');
    expect(content.interruptionLevel).toBe('timeSensitive');
    expect(content.threadIdentifier).toBe('wb-timer');
    expect(content.data.kind).toBe('honest');
    expect(trigger.seconds).toBeGreaterThan(1700); // ~30 min
    expect(trigger.seconds).toBeLessThan(1900);
  });

  it('uses the not-enough-data copy when hasCalibration is false', async () => {
    await scheduleTimerDone({ label: 'Email', startedAt: Date.now(), honestMin: 20, hasCalibration: false });
    expect(scheduled[0].content.title).toBe('Time check for Email');
    expect(scheduled[0].content.body).toBe('This was your estimate for Email. Log it whenever you wrap.');
  });
});
```

Note the body strings use straight apostrophes (`'`) to match the existing codebase copy (`timerNotifications.ts` uses `You've`) and the humanizer straight-quote rule — keep it exact.

- [ ] **Step 3: Run, verify it fails**

Run: `npx jest src/services/__tests__/timerNotifications.content.test.ts`
Expected: FAIL — title still "Time check", no `categoryIdentifier`.

- [ ] **Step 4: Rewrite the three schedulers in `timerNotifications.ts`**

Add imports at the top:

```ts
import { useSettingsStore } from '@/src/stores/settingsStore';
import { honestReachedFireMs, nextAllowedFireMs } from '@/src/lib/notifyTiming';
import { CAT, THREAD, resolveNotificationSound } from '@/src/services/notificationCategories';
```

Replace `scheduleTimerDone` (lines 62-93) with:

```ts
/**
 * Honest-reached ping: fires at start + honestMin (the learned, realistic finish),
 * framed as calm data. timeSensitive so it surfaces through Focus. Actionable via
 * the WB_HONEST_REACHED category. Cancels any prior one; skips if already past.
 */
export async function scheduleTimerDone(opts: {
  label: string;
  startedAt: number;
  honestMin: number;
  hasCalibration?: boolean;
}): Promise<void> {
  const N = getModule();
  if (!N) return;
  try {
    await cancelTimerDone();
    const fireMs = honestReachedFireMs(opts.startedAt, opts.honestMin);
    const secondsFromNow = Math.round((fireMs - Date.now()) / 1000);
    if (secondsFromNow <= 0) return;
    const calibrated = opts.hasCalibration ?? true;
    const content = calibrated
      ? {
          title: "You're near the finish",
          body: `This is about when ${opts.label} usually wraps. Log it when you're done.`,
        }
      : {
          title: `Time check for ${opts.label}`,
          body: `This was your estimate for ${opts.label}. Log it whenever you wrap.`,
        };
    const sound = resolveNotificationSound(useSettingsStore.getState().notificationSound);
    const id = await N.scheduleNotificationAsync({
      content: {
        ...content,
        sound,
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: CAT.HONEST,
        threadIdentifier: THREAD.TIMER,
        data: { kind: 'honest', label: opts.label, startedAt: opts.startedAt, honestMin: opts.honestMin },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow },
    });
    kv.set(NOTIF_ID_KEY, id);
  } catch {
    // best-effort; a failed schedule must never block the timer
  }
}
```

Remove the now-unused `projectedFinish` import if `scheduleStartBy` no longer needs it (it doesn't use `projectedFinish` — it uses `formatClock` only; keep `formatClock`, drop `projectedFinish` from the import on line 4).

Replace the `content` block in `scheduleStartBy` (lines 127-133) with the revoiced + enriched version:

```ts
    const sound = resolveNotificationSound(useSettingsStore.getState().notificationSound);
    const id = await N.scheduleNotificationAsync({
      content: {
        title: `Start by ${formatClock(opts.startByMs)}`,
        body: `Start ${opts.firstTaskLabel} now and you'll finish by ${formatClock(opts.deadlineMs)}.`,
        sound,
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: CAT.START_BY,
        threadIdentifier: THREAD.PLAN,
        data: { kind: 'startBy', startByMs: opts.startByMs, firstTaskLabel: opts.firstTaskLabel, deadlineMs: opts.deadlineMs },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow },
    });
```

Replace the body of `scheduleGuardCheckIn` (lines 169-185) with quiet-hours-aware scheduling + revoiced copy:

```ts
    await cancelGuardCheckIn();
    const desiredMs = opts.startedAt + opts.thresholdMin * 60_000;
    const quiet = useSettingsStore.getState().quietHours;
    const fireMs = nextAllowedFireMs(desiredMs, quiet, Date.now());
    const secondsFromNow = Math.round((fireMs - Date.now()) / 1000);
    if (secondsFromNow <= 0) return;
    const sound = resolveNotificationSound(useSettingsStore.getState().notificationSound);
    const id = await N.scheduleNotificationAsync({
      content: {
        title: `Still on ${opts.label}?`,
        body: `You've been at it about ${opts.thresholdMin} minutes. No pressure, just a nudge.`,
        sound,
        categoryIdentifier: CAT.GUARD,
        threadIdentifier: THREAD.GUARD,
        data: { kind: 'guard', label: opts.label, thresholdMin: opts.thresholdMin },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow },
    });
    kv.set(GUARD_ID_KEY, id);
```

- [ ] **Step 5: Add the time-sensitive entitlement to `app.json`**

Under `expo.ios`, add (merge with any existing `entitlements`):

```json
"entitlements": {
  "com.apple.developer.usernotifications.time-sensitive": true
}
```

- [ ] **Step 6: Run, verify it passes**

Run: `npx jest src/services/__tests__/timerNotifications.content.test.ts`
Expected: PASS.

- [ ] **Step 7: Lint + commit**

```bash
npx eslint src/services/notificationCategories.ts src/services/timerNotifications.ts src/services/__tests__/timerNotifications.content.test.ts
git add src/services/notificationCategories.ts src/services/timerNotifications.ts src/services/__tests__/timerNotifications.content.test.ts app.json
git commit -m "feat(notify): actionable honest-reached + start-by + guard pings (copy, sound, grouping, time-sensitive)"
```

> **Asset note (not a code gap):** `resolveNotificationSound` deliberately returns `'default'` for `'honey'` until `src/assets/sounds/honey.wav` is bundled and registered. When the asset lands, change the one return line and the store default to `'honey'`. The code is complete and ships today with the system sound.

---

### Task 5: Review notification — category + grouping

**Files:**
- Modify: `src/services/reviewNotifications.ts:77-88`
- Test: `src/services/__tests__/reviewNotifications.content.test.ts` (create)

**Interfaces:**
- Consumes: `CAT`, `THREAD`, `resolveNotificationSound` (Task 4); `notificationSound` (store).

The copy is already final (spec §9 keeps "Your honest week is ready" and revoices the body). Apply the body revoice + category + thread + sound.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/__tests__/reviewNotifications.content.test.ts
const scheduled: any[] = [];
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => ({}) }));
jest.mock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
  scheduleNotificationAsync: jest.fn(async (req: any) => { scheduled.push(req); return 'rid'; }),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
}));

import { scheduleWeeklyReview } from '@/src/services/reviewNotifications';

it('schedules the Monday review with revoiced body, category, thread', async () => {
  await scheduleWeeklyReview('2026-W26');
  const { content, trigger } = scheduled[0];
  expect(content.title).toBe('Your honest week is ready');
  expect(content.body).toBe('Your week in honest numbers, whenever you've got a minute.');
  expect(content.categoryIdentifier).toBe('WB_REVIEW');
  expect(content.threadIdentifier).toBe('wb-review');
  expect(trigger.weekday).toBe(2);
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/services/__tests__/reviewNotifications.content.test.ts`
Expected: FAIL — body is old, no category.

- [ ] **Step 3: Apply the change**

Add imports:

```ts
import { useSettingsStore } from '@/src/stores/settingsStore';
import { CAT, THREAD, resolveNotificationSound } from '@/src/services/notificationCategories';
```

Replace the `content` object in `scheduleWeeklyReview`:

```ts
      content: {
        title: 'Your honest week is ready',
        body: 'Your week in honest numbers, whenever you've got a minute.',
        sound: resolveNotificationSound(useSettingsStore.getState().notificationSound),
        categoryIdentifier: CAT.REVIEW,
        threadIdentifier: THREAD.REVIEW,
        data: { kind: 'review' },
      },
```

- [ ] **Step 4: Run, verify it passes**

Run: `npx jest src/services/__tests__/reviewNotifications.content.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/services/reviewNotifications.ts src/services/__tests__/reviewNotifications.content.test.ts
git add src/services/reviewNotifications.ts src/services/__tests__/reviewNotifications.content.test.ts
git commit -m "feat(notify): review ping gains category, grouping, revoiced body"
```

---

### Task 6: Response handler (reschedule + deep link) + analytics

**Files:**
- Create: `src/services/notificationResponses.ts`
- Modify: `src/services/analytics.ts:32-202` (add `notification_action` to `AppEventProps`)
- Test: `src/services/__tests__/notificationResponses.test.ts` (create)

**Interfaces:**
- Consumes: `ACTION` (Task 4); `scheduleTimerDone`, `scheduleStartBy`, `cancelTimerDone` (Task 4); `DeepLinkRouter` if present (see note); `analytics`.
- Produces: `handleNotificationResponse(response: NotificationResponseLike): Promise<void>` where
  `interface NotificationResponseLike { actionIdentifier: string; data: Record<string, unknown> }`.
  Background actions (`EXTEND_10`, `SNOOZE_15`, `SNOOZE_5`, `REVIEW_EVENING`) reschedule; foreground actions are routed by the setup module (Task 7) and only logged here.

Routing note: the deep-link router referenced by the push-notifications skill may not exist yet. To stay self-contained, this task only handles **reschedule + analytics**; foreground navigation (Log it / Start now / Wrap up / Open review) is delegated to Task 7's setup, which already runs inside React and can call `expo-router`. `handleNotificationResponse` returns after firing analytics for those.

- [ ] **Step 1: Add the analytics event**

In `src/services/analytics.ts`, inside `interface AppEventProps` (near the other notification events around line 151), add:

```ts
  notification_action: { category: string; action: string };
  notification_permission: { tier: 'provisional' | 'full' | 'denied' };
  quiet_hours_toggled: { enabled: boolean };
  notification_sound_set: { value: 'honey' | 'default' | 'none' };
```

- [ ] **Step 2: Write the failing test**

```ts
// src/services/__tests__/notificationResponses.test.ts
const calls: Record<string, any[]> = { timer: [], startBy: [] };
jest.mock('@/src/services/timerNotifications', () => ({
  scheduleTimerDone: jest.fn(async (o) => calls.timer.push(o)),
  scheduleStartBy: jest.fn(async (o) => calls.startBy.push(o)),
  cancelTimerDone: jest.fn(async () => {}),
}));
const captured: any[] = [];
jest.mock('@/src/services/analytics', () => ({ analytics: { capture: (e: string, p: any) => captured.push([e, p]) } }));

import { handleNotificationResponse } from '@/src/services/notificationResponses';

describe('handleNotificationResponse', () => {
  beforeEach(() => { calls.timer.length = 0; calls.startBy.length = 0; captured.length = 0; });

  it('+10 reschedules the honest ping 10 min later and logs the action', async () => {
    const startedAt = Date.now() - 5 * 60_000;
    await handleNotificationResponse({
      actionIdentifier: 'EXTEND_10',
      data: { kind: 'honest', label: 'Email', startedAt, honestMin: 30 },
    });
    expect(calls.timer).toHaveLength(1);
    expect(calls.timer[0].honestMin).toBe(40); // 30 + 10
    expect(captured[0]).toEqual(['notification_action', { category: 'honest', action: 'EXTEND_10' }]);
  });

  it('Snooze 15 reschedules 15 min from now', async () => {
    await handleNotificationResponse({
      actionIdentifier: 'SNOOZE_15',
      data: { kind: 'honest', label: 'Email', startedAt: Date.now(), honestMin: 30 },
    });
    expect(calls.timer).toHaveLength(1);
    // snooze re-anchors so the ping fires ~15 min from now regardless of original
    expect(calls.timer[0].honestMin).toBeGreaterThanOrEqual(15);
  });

  it('foreground actions only log (navigation handled by setup)', async () => {
    await handleNotificationResponse({ actionIdentifier: 'LOG', data: { kind: 'honest' } });
    expect(calls.timer).toHaveLength(0);
    expect(captured[0]).toEqual(['notification_action', { category: 'honest', action: 'LOG' }]);
  });
});
```

- [ ] **Step 3: Run, verify it fails**

Run: `npx jest src/services/__tests__/notificationResponses.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement the handler**

```ts
// src/services/notificationResponses.ts
// Pure-ish handler for notification button taps. Background actions reschedule
// the relevant ping; foreground actions are navigated by notificationSetup and
// only logged here. No expo-notifications import — the setup module adapts the
// real NotificationResponse into this shape.

import { analytics } from '@/src/services/analytics';
import { scheduleTimerDone, scheduleStartBy } from '@/src/services/timerNotifications';
import { ACTION } from '@/src/services/notificationCategories';

export interface NotificationResponseLike {
  actionIdentifier: string;
  data: Record<string, unknown>;
}

export async function handleNotificationResponse(res: NotificationResponseLike): Promise<void> {
  const kind = typeof res.data.kind === 'string' ? (res.data.kind as string) : 'unknown';
  analytics.capture('notification_action', { category: kind, action: res.actionIdentifier });

  switch (res.actionIdentifier) {
    case ACTION.EXTEND_10: {
      if (res.data.kind === 'honest') {
        const label = String(res.data.label ?? 'this');
        const startedAt = Number(res.data.startedAt ?? Date.now());
        const honestMin = Number(res.data.honestMin ?? 0) + 10;
        await scheduleTimerDone({ label, startedAt, honestMin });
      }
      return;
    }
    case ACTION.SNOOZE_15: {
      if (res.data.kind === 'honest') {
        const label = String(res.data.label ?? 'this');
        // Re-anchor so the next ping is ~15 min from now: startedAt = now, honestMin = 15.
        await scheduleTimerDone({ label, startedAt: Date.now(), honestMin: 15 });
      }
      return;
    }
    case ACTION.SNOOZE_5: {
      if (res.data.kind === 'startBy') {
        const firstTaskLabel = String(res.data.firstTaskLabel ?? 'this');
        const deadlineMs = Number(res.data.deadlineMs ?? Date.now());
        await scheduleStartBy({ startByMs: Date.now() + 5 * 60_000, firstTaskLabel, deadlineMs });
      }
      return;
    }
    // Foreground actions (LOG, START, WRAP, REVIEW_OPEN) + dismiss-like (GUARD_OK,
    // REVIEW_EVENING) need no rescheduling here; navigation is in notificationSetup.
    default:
      return;
  }
}
```

- [ ] **Step 5: Run, verify it passes**

Run: `npx jest src/services/__tests__/notificationResponses.test.ts`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/services/notificationResponses.ts src/services/analytics.ts src/services/__tests__/notificationResponses.test.ts
git add src/services/notificationResponses.ts src/services/analytics.ts src/services/__tests__/notificationResponses.test.ts
git commit -m "feat(notify): notification action handler (reschedule + analytics)"
```

---

### Task 7: Launch setup — handler, categories, response listener, foreground nav

**Files:**
- Create: `src/services/notificationSetup.ts`
- Modify: `src/app/_layout.tsx:20-40` (call setup once)
- Test: `src/services/__tests__/notificationSetup.test.ts` (create)

**Interfaces:**
- Consumes: `registerNotificationCategories` (Task 4), `handleNotificationResponse` (Task 6), `ACTION` (Task 4).
- Produces: `initNotifications(): () => void` — registers categories, sets the foreground presentation handler, subscribes the response listener (adapting the real response into `NotificationResponseLike` and routing foreground actions via `expo-router`), and returns an unsubscribe cleanup. No-op (returns a noop cleanup) when the native module is absent.

This is integration glue; the unit test asserts the no-module path returns a callable cleanup and does not throw. Device verification of the live button behavior is in §16 of the spec.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/__tests__/notificationSetup.test.ts
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => null })); // no native module
jest.mock('@/src/lib/isExpoGo', () => ({ isExpoGo: true }));

import { initNotifications } from '@/src/services/notificationSetup';

it('returns a noop cleanup when the native module is absent, without throwing', () => {
  const cleanup = initNotifications();
  expect(typeof cleanup).toBe('function');
  expect(() => cleanup()).not.toThrow();
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/services/__tests__/notificationSetup.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement setup**

```ts
// src/services/notificationSetup.ts
import { requireOptionalNativeModule } from 'expo-modules-core';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { router } from 'expo-router';
import { registerNotificationCategories, ACTION } from '@/src/services/notificationCategories';
import { handleNotificationResponse } from '@/src/services/notificationResponses';

type NotificationsModule = typeof import('expo-notifications');

function getModule(): NotificationsModule | null {
  if (isExpoGo) return null;
  if (!requireOptionalNativeModule('ExpoNotificationScheduler')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/** Foreground navigation for the buttons that open the app. */
function navigateForAction(actionIdentifier: string, data: Record<string, unknown>): void {
  switch (actionIdentifier) {
    case ACTION.LOG:
    case ACTION.WRAP:
      router.push('/(tabs)'); // Today, where logging/wrap-up lives
      return;
    case ACTION.START:
      router.push('/(tabs)'); // Today → start the planned task
      return;
    case ACTION.REVIEW_OPEN:
      router.push('/(tabs)/patterns'); // review surface
      return;
    default:
      return;
  }
}

/**
 * Register categories + handlers once at launch. Returns a cleanup. No-op (noop
 * cleanup) without the native module so Expo Go / tests stay clean.
 */
export function initNotifications(): () => void {
  const N = getModule();
  if (!N) return () => {};

  void registerNotificationCategories(N);

  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const sub = N.addNotificationResponseReceivedListener((response) => {
    const content = response.notification.request.content;
    const data = (content.data ?? {}) as Record<string, unknown>;
    const actionIdentifier = response.actionIdentifier;
    void handleNotificationResponse({ actionIdentifier, data });
    navigateForAction(actionIdentifier, data);
  });

  return () => sub.remove();
}
```

- [ ] **Step 4: Wire it into the root layout**

In `src/app/_layout.tsx`, inside `RootNavigator` (or the existing top-level effect block near line 33), add:

```ts
import { initNotifications } from '@/src/services/notificationSetup';
// ...
  useEffect(() => {
    const cleanup = initNotifications();
    return cleanup;
  }, []);
```

- [ ] **Step 5: Run, verify it passes**

Run: `npx jest src/services/__tests__/notificationSetup.test.ts`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/services/notificationSetup.ts src/app/_layout.tsx src/services/__tests__/notificationSetup.test.ts
git add src/services/notificationSetup.ts src/app/_layout.tsx src/services/__tests__/notificationSetup.test.ts
git commit -m "feat(notify): launch setup — categories, foreground handler, response routing"
```

> **Device-verify (spec §16, §4.2):** confirm a cold-start background `+10/Snooze` actually reschedules. If unreliable, switch those actions to `opensAppToForeground: true` routed to a silent dismiss handler (spec §4.2 fallback B).

---

### Task 8: useTimer wiring — honest anchor, LA suppression, guard min-gap

**Files:**
- Modify: `src/features/timer/useTimer.ts:219-246`
- Test: extend `src/features/timer/__tests__/useTimer.quickstart.test.tsx` or add `src/features/timer/__tests__/useTimer.notify.test.tsx`

**Interfaces:**
- Consumes: `shouldSuppressHonestBanner`, `guardCollidesWithHonest`, `honestReachedFireMs` (Task 1); `presenceAvailable`, `isFinishTimeActivityActive` (Task 3); `scheduleTimerDone`, `scheduleGuardCheckIn` (Task 4).

Current code (lines ~239-245):

```ts
    if (useSettingsStore.getState().remindersEnabled) {
      ...
        const granted = await ensureNotificationPermission();
        if (granted) await scheduleTimerDone({ label, startedAt, estimateMin });
        ...
          await scheduleGuardCheckIn({ label, startedAt, thresholdMin: guardThresholdMin });
    }
```

Change: pass `honestMin: suggestedHonestMin` to `scheduleTimerDone`; **skip** the honest banner when a Live Activity is carrying the moment; **skip** the guard when it collides with the honest ping.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/timer/__tests__/useTimer.notify.test.tsx
const sched = { timer: 0, guard: 0 };
jest.mock('@/src/services/timerNotifications', () => ({
  ensureNotificationPermission: jest.fn(async () => true),
  scheduleTimerDone: jest.fn(async () => { sched.timer++; }),
  cancelTimerDone: jest.fn(async () => {}),
  scheduleGuardCheckIn: jest.fn(async () => { sched.guard++; }),
  cancelGuardCheckIn: jest.fn(async () => {}),
  scheduleStartBy: jest.fn(async () => {}),
  cancelStartBy: jest.fn(async () => {}),
}));
let presence = { available: false, active: false };
jest.mock('@/src/services/liveActivity', () => ({
  presenceAvailable: () => presence.available,
  isFinishTimeActivityActive: () => presence.active,
  startFinishTimeActivity: jest.fn(),
  updateFinishTimeActivity: jest.fn(),
  endFinishTimeActivity: jest.fn(),
}));
// ...enable remindersEnabled in the settings store before rendering/starting.

// Assertions to encode (use the harness already in the quickstart test):
// 1. presence inactive  → scheduleTimerDone called once (banner is the only signal)
// 2. presence available+active → scheduleTimerDone NOT called (ring carries it)
// 3. guard threshold == honest anchor (within 60s) → scheduleGuardCheckIn NOT called
```

(Implement the three assertions using the same render/start helpers the existing `useTimer.quickstart.test.tsx` uses. If that harness is awkward to reuse, assert at the function boundary by extracting the schedule decision — but prefer reusing the existing test setup.)

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/features/timer/__tests__/useTimer.notify.test.tsx`
Expected: FAIL — banner still scheduled when activity active.

- [ ] **Step 3: Update the wiring in `useTimer.ts`**

Add imports:

```ts
import { presenceAvailable, isFinishTimeActivityActive } from '@/src/services/liveActivity';
import { shouldSuppressHonestBanner, guardCollidesWithHonest, honestReachedFireMs } from '@/src/lib/notifyTiming';
```

Replace the reminders block:

```ts
    if (useSettingsStore.getState().remindersEnabled) {
      const granted = await ensureNotificationPermission();
      if (granted) {
        const suppressHonest = shouldSuppressHonestBanner(presenceAvailable(), isFinishTimeActivityActive());
        if (!suppressHonest && useSettingsStore.getState().honestReachedEnabled) {
          await scheduleTimerDone({ label, startedAt, honestMin: suggestedHonestMin });
        }
        if (guardSetting !== 'off' && isPro) {
          const honestFireMs = honestReachedFireMs(startedAt, suggestedHonestMin);
          const guardFireMs = startedAt + guardThresholdMin * 60_000;
          if (!guardCollidesWithHonest(honestFireMs, guardFireMs)) {
            await scheduleGuardCheckIn({ label, startedAt, thresholdMin: guardThresholdMin });
          }
        }
      }
    }
```

(Match the existing variable names in scope — `guardSetting`, `isPro`, `guardThresholdMin`, `suggestedHonestMin` already exist per lines 221-244. If `isPro` isn't in scope here, read it the same way the surrounding code gates Pro; do not introduce a new entitlement read pattern.)

- [ ] **Step 4: Run, verify it passes**

Run: `npx jest src/features/timer/__tests__/useTimer.notify.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full timer suite to catch regressions**

Run: `npx jest src/features/timer`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/features/timer/useTimer.ts src/features/timer/__tests__/useTimer.notify.test.tsx
git add src/features/timer/useTimer.ts src/features/timer/__tests__/useTimer.notify.test.tsx
git commit -m "feat(timer): honest-number anchor, Live Activity suppression, guard min-gap"
```

---

### Task 9: Provisional permission + analytics

**Files:**
- Modify: `src/services/timerNotifications.ts:48-60` (and mirror in `reviewNotifications.ts:52-64`)
- Modify: `src/features/settings/useReminderSetting.ts`
- Test: `src/services/__tests__/timerNotifications.permission.test.ts` (create)

**Interfaces:**
- Produces: `ensureNotificationPermission(opts?: { provisional?: boolean }): Promise<boolean>` — when `provisional` and status is `notDetermined`, request with `ios: { allowProvisional: true }` (quiet, no prompt). The full prompt is requested without the flag.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/__tests__/timerNotifications.permission.test.ts
const req = jest.fn(async () => ({ granted: true }));
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => ({}) }));
jest.mock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: (...a: any[]) => req(...a),
}));

import { ensureNotificationPermission } from '@/src/services/timerNotifications';

beforeEach(() => req.mockClear());

it('requests provisional quietly when asked', async () => {
  await ensureNotificationPermission({ provisional: true });
  expect(req).toHaveBeenCalledWith({ ios: { allowProvisional: true } });
});

it('requests full permission by default', async () => {
  await ensureNotificationPermission();
  expect(req).toHaveBeenCalledWith();
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx jest src/services/__tests__/timerNotifications.permission.test.ts`
Expected: FAIL — no provisional branch.

- [ ] **Step 3: Update `ensureNotificationPermission` (both services)**

In `src/services/timerNotifications.ts`:

```ts
export async function ensureNotificationPermission(opts?: { provisional?: boolean }): Promise<boolean> {
  const N = getModule();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = opts?.provisional
      ? await N.requestPermissionsAsync({ ios: { allowProvisional: true } })
      : await N.requestPermissionsAsync();
    return next.granted;
  } catch {
    return false;
  }
}
```

Mirror the same signature change in `reviewNotifications.ts`'s `ensureReviewNotificationPermission` (keep its name; add the same `opts` param + branch).

- [ ] **Step 4: Fire the permission-tier analytics in the reminder hook**

In `src/features/settings/useReminderSetting.ts`, after a granted/denied result in `toggle`, capture the tier:

```ts
        const granted = await ensureNotificationPermission();
        analytics.capture('notification_permission', { tier: granted ? 'full' : 'denied' });
        if (!granted) return false;
```

- [ ] **Step 5: Run, verify it passes**

Run: `npx jest src/services/__tests__/timerNotifications.permission.test.ts`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
npx eslint src/services/timerNotifications.ts src/services/reviewNotifications.ts src/features/settings/useReminderSetting.ts src/services/__tests__/timerNotifications.permission.test.ts
git add src/services/timerNotifications.ts src/services/reviewNotifications.ts src/features/settings/useReminderSetting.ts src/services/__tests__/timerNotifications.permission.test.ts
git commit -m "feat(notify): provisional permission opt-in + permission-tier analytics"
```

> **Provisional wiring note:** the first quiet registration (`{ provisional: true }`) should be called once early (e.g. in `initNotifications` or first timer start). Decide the exact trigger during execution per spec §12; the helper now supports it.

---

### Task 10: Settings → Notifications section redesign

**Files:**
- Modify: `src/app/settings.tsx:308-355`
- Create: `src/features/settings/useQuietHours.ts`, `src/features/settings/useNotificationSound.ts`
- Modify: `src/theme/tokens.ts` (only if a needed spacing/size token is missing)
- Test: `src/app/__tests__/settings.notifications.test.tsx` (create — render + toggle interaction)

**Interfaces:**
- Consumes: store keys from Task 2; existing `useReminderSetting`, `useReviewNotifySetting`, `ProGate`, `GuardrailSettingRow`, `GuardrailLockedRow`, `SettingRow`, `Switch`, `AppText`.
- Produces: a redesigned section — master "Reminders" row, per-type sub-toggles revealed when on (honest-reached, start-by, existing Pro guard + review), a "Quiet hours" toggle + time range, and a sound picker. Daily check-in row stays as-is.

Design (per spec §8) — every value from `useTheme()`:
- Group container `gap: t.space[3]`.
- Sub-toggles render only when `remindersEnabled`.
- Quiet-hours row: a `Switch` + a compact time display "21:00 – 08:00" with an edit affordance (reuse the existing time-picker pattern used for `dayEndMin` elsewhere in settings — do not invent a new picker).
- Sound: a 3-way segmented control or a `SettingRow` cycling `Honey / Default / None` (reuse an existing selector pattern in the codebase; if none, a labeled row that opens an action sheet).

Because this is presentation, the test focuses on behavior (toggles call the right store setters and per-type rows appear only when reminders are on), not pixel layout.

- [ ] **Step 1: Create the two small hooks**

```ts
// src/features/settings/useQuietHours.ts
import { useCallback } from 'react';
import { analytics } from '@/src/services/analytics';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { QuietHours } from '@/src/lib/notifyTiming';

export function useQuietHours() {
  const quietHours = useSettingsStore((s) => s.quietHours);
  const set = useSettingsStore((s) => s.setQuietHours);
  const update = useCallback(
    (next: Partial<QuietHours>) => {
      const merged = { ...quietHours, ...next };
      set(merged);
      if (next.enabled !== undefined) analytics.capture('quiet_hours_toggled', { enabled: merged.enabled });
    },
    [quietHours, set],
  );
  return { quietHours, update };
}
```

```ts
// src/features/settings/useNotificationSound.ts
import { useCallback } from 'react';
import { analytics } from '@/src/services/analytics';
import { useSettingsStore } from '@/src/stores/settingsStore';

export function useNotificationSound() {
  const value = useSettingsStore((s) => s.notificationSound);
  const setStore = useSettingsStore((s) => s.setNotificationSound);
  const set = useCallback(
    (v: 'honey' | 'default' | 'none') => {
      setStore(v);
      analytics.capture('notification_sound_set', { value: v });
    },
    [setStore],
  );
  return { value, set };
}
```

- [ ] **Step 2: Write the failing interaction test**

```tsx
// src/app/__tests__/settings.notifications.test.tsx
// Render the Notifications section; assert per-type rows hidden when reminders off,
// shown when on; assert quiet-hours toggle calls setQuietHours.
// Reuse the existing settings test harness/mocks if one exists in src/app/__tests__.
import { useSettingsStore } from '@/src/stores/settingsStore';

it('hides per-type rows until reminders are on', () => {
  useSettingsStore.getState().reset(); // remindersEnabled false
  // render <SettingsScreen/>, query for "Honest finish" sub-row → expect not present
  // set remindersEnabled true, re-render → expect present
});
```

(Flesh this out against the actual settings render harness. If the screen is hard to render in isolation, at minimum assert the two new hooks drive the store setters — but prefer a render test.)

- [ ] **Step 3: Run, verify it fails**

Run: `npx jest src/app/__tests__/settings.notifications.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Rebuild the Notifications `<View>` block**

Replace the section at `settings.tsx:308-355` with the master + revealed sub-toggles + quiet hours + sound. Wire `honestReachedEnabled`/`startByEnabled` to their store setters, `useQuietHours`, `useNotificationSound`. Keep the existing Pro guard + review rows inside the revealed block, and keep the "Daily check-in" row exactly as it is. Use only `t.*` tokens. (Implementer: follow the existing `SettingRow` + `Switch` markup already in this file — shown in the read — for visual consistency; reveal sub-rows with `{remindersEnabled ? (<>…</>) : null}`.)

- [ ] **Step 5: Run, verify it passes**

Run: `npx jest src/app/__tests__/settings.notifications.test.tsx`
Expected: PASS.

- [ ] **Step 6: Visual check (required by global UI rule)**

Build to the sim, open Settings, screenshot, and critique spacing/alignment against the design skills before declaring done:

```bash
xcrun simctl io booted screenshot /tmp/whenbee-notif-settings.png
```

Open it and verify the section reads as intentional (rhythm, alignment, type scale). Fix before commit if not.

- [ ] **Step 7: Lint + commit**

```bash
npx eslint src/app/settings.tsx src/features/settings/useQuietHours.ts src/features/settings/useNotificationSound.ts src/app/__tests__/settings.notifications.test.tsx
git add src/app/settings.tsx src/features/settings/useQuietHours.ts src/features/settings/useNotificationSound.ts src/app/__tests__/settings.notifications.test.tsx
git commit -m "feat(settings): redesigned Notifications section — per-type toggles, quiet hours, sound"
```

---

### Final verification (run before opening the PR)

- [ ] **Full gate:** `npm run lint && npm run typecheck && npm test` — all green.
- [ ] **Spec coverage walk:** re-read spec §4–§9, §11–§12, §15; confirm each maps to a task above.
- [ ] **Device pass (spec §16):** background `+10/Snooze` on cold start; honey/default/none sound; time-sensitive Focus pass-through; provisional quiet delivery; LA-active suppression. Note any that need fallback B.
- [ ] **Open PR (do not merge — founder merges):**

```bash
git push -u origin <branch>
gh pr create --title "feat: notification system overhaul (actions, honest ping, quiet hours, presence handoff)" --body "Implements docs/product/specs/2026-06-24-notification-system-overhaul.md. Local-only, no-guilt. Device-verify items listed in the spec §16."
```

---

## Self-Review notes (author)

- **Spec coverage:** Pillar 1 (actions) → T4,T6,T7. Pillar 2 (honest ping) → T1,T4,T8. Pillar 3 (LA handoff) → T3,T8. Pillar 4 (quiet hours/provisional/sound/grouping/settings) → T1,T2,T4,T5,T9,T10. Copy §9 → T4,T5. Analytics §15 → T6,T9,T10. Engine/logic §11 → T1. Edge cases §14 → guarded module pattern (all service tasks), suppression (T8), wrap-around (T1).
- **Known seams (documented, not placeholders):** honey sound maps to system sound until the audio asset ships (T4 note); `hasCalibration` defaults true — threading real calibration through the timer route param is a follow-up enhancement, the shipped copy is correct for the common case; background-action reliability is the one device-gated decision (T7 note, spec §4.2).
- **Type consistency:** `scheduleTimerDone` is `{ label, startedAt, honestMin, hasCalibration? }` everywhere (T4 def, T6 reschedule, T8 call). `QuietHours` is one shape (T1) consumed by T2/T4/T10. `notificationSound` union is identical across store, resolver, hooks, analytics.
