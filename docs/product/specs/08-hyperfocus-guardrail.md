# 08 — Hyperfocus guardrail  ·  Pro

**Status:** spec · **Tier:** Pro (`pro` entitlement) · **Skills applied:** ui-design:interaction-design, motion-design, creating-reanimated-animations, conversion-psychology, humanizer, react-native-expert

> Reads the shared conventions in [README.md](README.md) (invariants, layer rules, theming, motion, gating, copy). This file only states what is specific to the hyperfocus guardrail. **No-guilt applies here harder than anywhere else: amber never becomes red, no streak, no count of overruns, no "you wasted" framing, ever.** The guardrail is help, not a scold.

---

## 1. What it is

An optional, gentle check-in that surfaces when a running task has been going for a chosen multiple of its honest number (default 2×). It is the safety net for hyperfocus: the moment you look up and it is 7:30 and you forgot to eat. When it triggers, the Live Timer shows a calm amber card that says, in effect, "you've been here a while. still the right thing, or want to surface?" with two answers and nothing else. If the app is backgrounded and the user has opted into reminders, it sends one soft local notification instead. It fires once per session, then goes quiet. It never nags, never blocks, never blinks, never turns red. The honest number is what makes it work: the trigger is personalised to *your* learned pace, so it only fires when you are genuinely deep past where this task usually takes you, not at some generic 25-minute pomodoro bell.

---

## 2. The user problem + evidence

Getting *out* of a task is one of the top ADHD time pains, and almost no time app addresses it. From [07-PRO-VALUE-IDEAS §2.3](../07-PRO-VALUE-IDEAS.md):

- The felt pain, in users' words: *"I look up and it's 7:30"*, forgetting to eat, losing whole evenings inside one task ([r/ADHD](https://www.reddit.com/r/ADHD/comments/1d2sov4/)).
- **The honest number is the perfect personalised trigger no other app has.** A pomodoro bell rings on a fixed clock; Whenbee already knows that "write the email" usually takes *you* 12 minutes, so 24 minutes in is a real signal worth a tap on the shoulder. That trigger is impossible without the learned multiplier.
- Why it is paid: it is an ongoing protective service, the safety net that makes hyperfocus survivable rather than a one-off insight. It rides every timed session for as long as you subscribe.

The felt problem (conversion-psychology): the user has lost an afternoon to a task they meant to spend twenty minutes on, more than once, and hated the lurch of looking up at the clock. The guardrail names that moment *before* the whole evening is gone, using their own pace as the proof it is unusual, so it lands as a friend noticing rather than an app judging. The sell is emotional first ("the safety net that makes hyperfocus survivable"), the mechanism second.

---

## 3. Where it lives

The guardrail attaches to the **running timer** (the only place a task is actively live). Three surfaces:

| Surface | What shows | When |
|---|---|---|
| **Live Timer (in-app, foreground)** | `GuardrailCheckIn` — a calm amber card that slides up over the lower timer area | App is foregrounded on the Timer screen when the threshold is crossed. Primary surface. |
| **Local notification (backgrounded / closed)** | One soft "still on this?" ping | App is not foreground AND `remindersEnabled` is on. Reuses the `timerNotifications` pattern. |
| **Settings** | The guardrail row (Off / 1.5× / 2× / 3×) + a one-line explainer | Settings list, under the existing reminders row. Pro-gated row. |

The trigger is **scheduled at session start** (alongside the existing "estimate is up" ping in `useTimer`), so it works whether the user is staring at the timer, has the app backgrounded, or has it fully closed. Foreground delivery is the in-app card; background delivery is the notification. The two are mutually exclusive per session: whichever fires first marks the session as nudged so the other does not double up.

The guardrail **never** appears outside a running timed session, never on Today, never on the hub. It is silent during the guess and the learn steps. It touches no calibration data and trains nothing.

**Free vs Pro:** Pro gets the live guardrail. Free users see the guardrail *row* in Settings as a locked teaser (it shows the shape of the value and routes to the paywall) but get no nudge. Decision and rationale in §9.

---

## 4. User flow

**Happy path (Pro, guardrail on at 2×, user is foreground):**

1. User starts a timed task with an honest number of 20m. At session start the guardrail trigger is armed for 40m (20m × 2).
2. User works. At 40m elapsed, the `GuardrailCheckIn` card slides up calmly over the lower third of the Timer screen (the controls dim behind it, they are not removed). The ring keeps running underneath.
3. Card: "You've been on this 40 minutes. Still the right thing, or want to surface?" Two choices: **Keep going** and **Wrap up**.
4. **Keep going** dismisses the card with a soft settle. The session is marked nudged; nothing else fires for the rest of this session. The user is back on the timer, no penalty, no second card.
5. **Wrap up** dismisses the card and triggers the normal Stop-and-log flow (`onStopAndLog`) so the user lands on the reward screen with their real time logged.

**Backgrounded path (Pro, guardrail on, reminders on, app not foreground):**

1. Same arming at 40m.
2. At 40m the local notification fires: title "Still on this?", body "You've been on [task] about 40 minutes. Surface whenever you want." Tapping it deep-links back to the Live Timer (where the in-app card is already past, so it just shows the running timer; the session is marked nudged).
3. If the app is backgrounded but `remindersEnabled` is off, nothing fires (the notification is the only background channel, and notifications are opt-in). When the user next foregrounds the Timer past the threshold, the in-app card shows then instead (catch-up, see §11).

**Off path:** guardrail setting = Off → trigger is never armed, nothing schedules, no card, no notification. This is the default for a fresh install (see §11 default rationale).

**Locked / non-Pro path:**

1. Free user opens Settings, sees the guardrail row showing "2×" greyed with a small lock and the explainer line.
2. Tapping the row routes to `router.push('/(modals)/paywall')` with `trigger: 'hyperfocus_guard'`. The row never toggles on for a free user.

---

## 5. Screens & states

All values are tokens (`t.*` from `useTheme()` + `type` from `typography.ts`). Components reused: `AppText`, `AppButton` (ghost + coin-edge variants), `Screen`, the timer's existing `PaceLabel` amber-pill precedent for colour choices. New components: `GuardrailCheckIn`, `GuardrailSettingRow`, `GuardrailLockedRow`.

### GuardrailCheckIn (Live Timer, foreground, primary)

The card slides up from the bottom and sits **over the lower control area**, not over the ring. The ring and elapsed numeral stay visible above it so the user keeps their place. It is a calm sheet-like panel, not a modal scrim that blacks out the screen.

```
        ( ring still running above, dimmed slightly )

┌─────────────────────────────────────────────┐
│                                               │
│  Still on this?                               │   ← type.subtitle, ink
│                                               │
│  You've been on "Write the email" for         │   ← type.body, inkSoft
│  40 minutes. Still the right thing, or         │
│  want to surface?                              │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │              Keep going                   │ │   ← AppButton, amber coin-edge (primary)
│  └─────────────────────────────────────────┘ │
│                Wrap up                         │   ← ghost button, inkSoft
│                                               │
└─────────────────────────────────────────────┘
```

- Container: a raised panel, `t.colors.surface`, `radii.sheet` (20) on the top corners only, hairline top edge (`borderWidth.hairline`), no shadow (RN Fabric: use the View-edge technique if any lift is wanted, never CSS `boxShadow`).
- Internal vertical rhythm: `gap: t.space[4]` (16) between heading, body, and the action stack; `gap: t.space[2.5]` (10) between the two buttons. One spacing source per axis, no per-child margins.
- A small amber accent: a thin amber top rule (`t.colors.accent`, height `t.borderWidth.thick`) or an amber dot beside the heading (`t.iconSize.xs`, `radii.full`, aligned to the cap-height of "Still on this?"). Amber here = "worth a glance", the same warmth as `PaceLabel`'s over-pill, never alarm.
- Heading `type.subtitle`, ink. Body `type.body`, inkSoft, with the task label and the elapsed minutes inlined.
- Primary action: **Keep going** as the amber coin-edge `AppButton` (`tokens.burst.coinEdge` technique). Reassurance is the default answer; making "keep going" the prominent, easy tap signals there is nothing wrong with staying. (Conversion-psychology, soft sell: the calm option is the obvious one; we are not pushing the user to quit.)
- Secondary: ghost **Wrap up** (`inkSoft`), the same weight as a normal cancel, no danger styling.
- The lower controls behind the card dim to `t.opacity.pressed` (0.6) while the card is up, so focus shifts without anything disappearing. `accessibilityViewIsModal` is **not** set, the timer stays readable behind it.

### State: dismissed (Keep going)

- Card slides back down and unmounts. Session marked nudged. No residue, no badge, no "you ignored a nudge" marker (that would be a guilt mechanic).

### State: backgrounded notification

No screen. The OS notification:

```
Still on this?
You've been on Write the email about 40 minutes. Surface whenever you want.
```

Tapping deep-links to `/(modals)/timer` (the Live Timer). If the session already ended, the deep link lands on Today (graceful, see §11).

### GuardrailSettingRow (Settings, Pro)

```
┌─────────────────────────────────────────────┐
│  Hyperfocus check-in                    2× ›  │   ← label + current value, chevron
│  A gentle nudge when a task runs long.        │   ← type.caption, inkSoft
└─────────────────────────────────────────────┘
```

- A standard settings row. Tapping opens an inline segmented control or a small sheet with four options: **Off · 1.5× · 2× · 3×**. Selected value shown on the row.
- Segmented options use the app's existing segmented-control styling; selected = `primarySoft` fill, label ink; unselected = inkSoft. (Indigo for the *selection chrome* is fine; amber stays reserved for the live nudge itself.)
- Explainer caption: "A gentle nudge when a task runs long." `type.caption`, inkSoft.

### GuardrailLockedRow (Settings, non-Pro)

```
┌─────────────────────────────────────────────┐
│  Hyperfocus check-in                  🔒 2×   │   ← lock glyph, value greyed
│  A heads-up before a task eats your evening.  │   ← type.caption, inkSoft
└─────────────────────────────────────────────┘
```

- Same row frame; value greyed (`inkFaint`), lock glyph `t.iconSize.sm` inkFaint. Tapping routes to the paywall with `trigger: 'hyperfocus_guard'` rather than toggling.
- The caption sells the payoff plainly ("before a task eats your evening") without guilt.

---

## 6. Motion

Personality: **Premium / Calm** (motion-design). This is a reassurance surface that interrupts a focused state, so it must be soft, never startling. The whole point is "a friend leaning in", not "an alarm". Easing and durations from `tokens.motion`; Reanimated worklets; shared values read/written with `.get()/.set()`.

- **Card entrance:** slides up from below + fades in over `tokens.motion.sheet` (340ms), `tokens.motion.easing.out` (decelerate, gentle landing). Translate from `+t.space[16]` (64) below to rest, opacity 0→1. Entrance is the heavier beat (motion-design: entrances run longer than exits). Use an entering-style animation on the conditionally-mounted card; **no `exiting` layout animation** (Fabric SIGABRT, per README + plan.tsx note) — drive the dismiss with an explicit shared-value timing instead.
- **Controls dim:** the lower controls cross-fade to `t.opacity.pressed` (0.6) over `tokens.motion.base` (220ms) as the card rises, and back to 1 on dismiss. Opacity change pairs with the card's position move (never opacity-only as the only signal — motion-design CRITICAL).
- **Dismiss (Keep going):** card slides down + fades over `tokens.motion.base` (220ms), `tokens.motion.easing.standard`. Shorter than entrance. No overshoot, no bounce (calm, not playful).
- **Amber accent:** the top rule / dot fades in once with the card. It does **not** pulse, breathe, or blink. A pulsing alert would read as urgency/alarm and break the no-guilt, no-pressure intent.
- **No celebration, no particles, no haptic jolt.** A single soft haptic (selection-style, `Haptics.selectionAsync`) on card appearance is acceptable as a gentle "tap on the shoulder"; nothing heavier. Confirm on device whether even that is too much for a focused user (open question §13).
- **Reduced motion:** honour `ReduceMotion.System` (and `useReducedMotion()` as `useTimer` already does). Card appears and dismisses with an instant or near-instant opacity step, no slide, no dim animation (snap the dim). The notification path is unaffected.

---

## 7. Data model

This feature persists **one setting** and **per-session run flags**. It logs nothing and trains nothing.

**Setting (add to `settingsStore`, KV-persisted):**

```ts
/** Hyperfocus guardrail multiple of the honest number, or 'off'. Off by default. */
export type GuardrailMultiple = 'off' | '1.5x' | '2x' | '3x';
// in SettingsState:
hyperfocusGuard: GuardrailMultiple;            // default 'off'
setHyperfocusGuard: (v: GuardrailMultiple) => void;
// reset() restores 'off'
```

**Domain type (add to `src/domain/types.ts`):**

```ts
/** Hyperfocus guardrail trigger multiple of the honest number, or off. */
export type GuardrailMultiple = 'off' | '1.5x' | '2x' | '3x';
```

(Define it once in `domain/types.ts` and re-export / import into the store so the contract has a single home.)

**Per-session run flag (in `timerStore`):**

- Add `guardNudged: boolean` to `TimerState` (and to `PersistedTimer` so a backgrounded/closed session that already nudged does not re-nudge on resume). Set true when either channel fires. Cleared by `start`/`cancel`/`stop` (part of `CLEARED`). This is the in-app de-dupe so the card and the notification never both fire for one session.

**Notification id (in `timerNotifications`):**

- Add a `GUARD_ID_KEY = 'whenbee.guardNotifId'` alongside the existing `NOTIF_ID_KEY` / `STARTBY_ID_KEY`, so the guardrail ping can be scheduled and cancelled independently of the "estimate is up" ping.

**No new DB table.** Nothing about the guardrail is a logged event or a trained signal. The honest number it triggers on is the `suggestedHonestMin` already carried on the running timer (see §8). Honors: core loop on-device-only; no new persisted class of data; no calendar.

---

## 8. Engine / logic

The threshold is pure arithmetic on the honest number, so it goes in the engine as a tiny pure module. **TDD required — write `src/engine/__tests__/guardrail.test.ts` first.**

New pure module **`src/engine/guardrail.ts`**, exported via `src/engine/index.ts`. PURE TS — no RN/Expo, no `Date.now()`.

```ts
// src/engine/guardrail.ts
import type { GuardrailMultiple } from '../domain/types';
import { GUARDRAIL_FACTORS } from './constants';

/** Numeric factor for a setting, or null when off. 1.5x → 1.5, etc. */
export function guardrailFactor(setting: GuardrailMultiple): number | null;

/**
 * The elapsed-minutes threshold at which the guardrail fires for a session,
 * or null when off / when there is no usable honest number.
 * threshold = round(honestMin × factor). Floored at GUARDRAIL_MIN_THRESHOLD_MIN
 * so a tiny honest number (e.g. 2m) never fires a nudge 3 minutes in.
 */
export function guardrailThresholdMin(input: {
  honestMin: number;
  setting: GuardrailMultiple;
}): number | null;
```

**Constants (add to `src/engine/constants.ts`):**

```ts
// ── Hyperfocus guardrail (Pro) ───────────────────────────────────────────────
/** Setting → multiple of the honest number. 'off' has no entry. */
export const GUARDRAIL_FACTORS = { '1.5x': 1.5, '2x': 2, '3x': 3 } as const;
/** Default guardrail setting for a fresh install. */
export const DEFAULT_GUARDRAIL: GuardrailMultiple = 'off';
/** Never fire a nudge before this many elapsed minutes, regardless of factor. */
export const GUARDRAIL_MIN_THRESHOLD_MIN = 25;
```

The 25-minute floor stops a very short honest number (a 5m task at 3× = 15m) from interrupting almost immediately; below ~25 minutes the user has not "lost the evening", so the nudge would be noise. It also means a guardrail nudge always lands *after* the existing "estimate is up" ping at the honest number itself, so the two never collide confusingly.

**TDD cases (`guardrail.test.ts`):**

| # | Setup | Expect |
|---|---|---|
| 1 | setting 'off' | `guardrailFactor` → null; `guardrailThresholdMin` → null |
| 2 | setting '1.5x' | factor 1.5 |
| 3 | setting '2x' | factor 2 |
| 4 | setting '3x' | factor 3 |
| 5 | honest 20, '2x' | threshold 40 |
| 6 | honest 30, '1.5x' | threshold 45 |
| 7 | honest 10, '2x' (=20, below floor) | threshold 25 (floored) |
| 8 | honest 5, '3x' (=15, below floor) | threshold 25 (floored) |
| 9 | honest 0 or NaN | null (no usable honest number) |
| 10 | honest 200, '3x' | threshold 600 (no upper clamp — a long legit task can genuinely run long) |
| 11 | rounding: honest 17, '1.5x' (=25.5) | threshold 26 (round, then floor check) |

**Scheduling / delivery hook (feature layer):**

The wiring lives in **`useTimer`** (it already owns session start, the "estimate is up" scheduling, and the foreground stop flow). It is the natural home and keeps `timer.tsx` thin.

1. **Arming at session start** (in the existing fresh-session `useEffect`): read `useSettingsStore.getState().hyperfocusGuard` and `useEntitlement.getState().isPro` non-reactively. If Pro and not 'off', compute `thresholdMin = guardrailThresholdMin({ honestMin: suggestedHonestMin, setting })`. If non-null:
   - Schedule the background notification via a new `scheduleGuardCheckIn({ label, startedAt, thresholdMin })` (only when `remindersEnabled`, same gate the "estimate is up" ping uses).
   - Drive the **foreground** card off the timer's existing UI-thread `elapsedSec`: extend the `useFrameCallback` (or a sibling derived value) to flip a `guardDue` shared value to 1 once `elapsedSec >= thresholdMin × 60` and `guardNudged` is false. A `useAnimatedReaction` on `guardDue` (mirroring `PaceLabel`'s phase-change pattern) calls `runOnJS` to set a React state that mounts `GuardrailCheckIn` — exactly once, the moment the threshold is crossed, with zero per-second re-renders.
2. **De-dupe:** when either channel fires, set `timerStore.guardNudged = true` (persisted). On resume-from-kv, if `guardNudged` is already true, do not re-arm the foreground card or re-schedule.
3. **Cancellation:** on `onStopAndLog` / `onAbandon`, call `cancelGuardCheckIn()` alongside the existing `cancelTimerDone()`.
4. **Backgrounded-card mutual exclusion:** the foreground card only mounts when the Timer screen is focused. If the app was backgrounded and the notification fired (set `guardNudged` via the notification-response handler / on next resume), the card does not re-show. If the app was backgrounded with reminders off, no notification fired, so on next foreground past threshold the card shows then (catch-up).

**Notification function (add to `src/services/timerNotifications.ts`),** following the existing `scheduleTimerDone` pattern exactly (lazy native-module guard, best-effort, no-op in Expo Go / tests):

```ts
export async function scheduleGuardCheckIn(opts: {
  label: string;
  startedAt: number;
  thresholdMin: number;
}): Promise<void>;
export async function cancelGuardCheckIn(): Promise<void>;
```

Fire time = `startedAt + thresholdMin × 60_000`; skip silently if already past.

---

## 9. Gating

- **Live guardrail:** Pro only. Gate at the arming step in `useTimer` with `useEntitlement.getState().isPro` (non-reactive read at session start). No Pro → never arm, never schedule, never mount the card. (Gating in the hook rather than wrapping the card in `<ProGate>` is correct here because the decision is "should this session arm at all", made once at start, not a render branch.)
- **Settings row:** `<ProGate fallback={<GuardrailLockedRow />}><GuardrailSettingRow /></ProGate>` in the Settings list.
- **Decision — free users get a locked teaser row, not a live nudge and not nothing.** Rationale: the value is invisible until it fires, so a silent feature can't sell itself. The Settings row shows the *shape* ("a heads-up before a task eats your evening") and routes to the paywall. We do **not** give free users a one-time taste nudge: a guardrail that fires and then says "subscribe to keep this" would feel like a bait-and-switch on a *protective* feature, which is exactly the predatory pattern this audience punishes (07 packaging notes: never rug-pull, no card-before-value). The honest move is to show the promise in Settings and let them opt in.
- **Paywall trigger:** add `'hyperfocus_guard'` to the `paywall_view.trigger` union in `analytics.ts` and pass it on the locked-row tap: `router.push({ pathname: '/(modals)/paywall', params: { trigger: 'hyperfocus_guard' } })`.
- Never gates the core loop; never fogs calibration; the timer itself works identically for free and Pro (only the guardrail layer differs).

---

## 10. Copy

Every string is humanizer-checked (no em-dash, no AI vocab, no rule-of-three, sounds like one honest person) and obeys no-guilt (no "wasted", "distracted", "off-task", "should have", "behind", no red).

**In-app card:**
- Heading: `Still on this?`
- Body: `You've been on "{taskLabel}" for {elapsedMin} minutes. Still the right thing, or want to surface?`
- Primary button: `Keep going`
- Secondary button: `Wrap up`

**Background notification:**
- Title: `Still on this?`
- Body: `You've been on {taskLabel} about {elapsedMin} minutes. Surface whenever you want.`

**Settings (Pro row):**
- Label: `Hyperfocus check-in`
- Caption: `A gentle nudge when a task runs long.`
- Options: `Off` · `1.5×` · `2×` · `3×`
- Option sheet header (if a sheet is used): `Nudge me when a task runs past…`

**Settings (locked row):**
- Label: `Hyperfocus check-in`
- Caption: `A heads-up before a task eats your evening.`

**Tone notes (conversion-psychology + no-guilt):**
- "Surface" is the chosen verb on purpose: it frames coming up for air as the user's own move, not a correction. It matches the lived language ("I look up and it's 7:30").
- "Still the right thing?" treats staying as completely valid. Sometimes the deep dive *is* the right call; the card respects that.
- Banned strings (no-guilt invariant): "you've been distracted", "time to stop", "you're way over", "still wasting time on", "get back on track", any countdown-of-shame, any red. Never count how many times the user overran. Never compare to other days.

---

## 11. Edge cases & guardrails

- **Default is Off.** A fresh install does not nudge. The guardrail is an opt-in safety net the user chooses, not something sprung on them. (Mirrors `remindersEnabled` / `dailyRitualEnabled`, both off by default.)
- **Paused timer:** if a pause path exists (the current cut has none, but the store supports `pausedAt`), the foreground threshold must compare against **active** elapsed, not wall time, and the background notification should be rescheduled on resume to `startedAt + pausedAccum + thresholdMin×60s`. For the current no-pause cut, wall-elapsed equals active-elapsed, so the simple schedule is correct; note the dependency so a future pause feature updates both channels.
- **Very long legit task:** there is no upper clamp on the threshold (test #10). A 3-hour honest number at 2× fires at 6 hours, which is a genuine "you've been here all day" moment. The user who wants no nudge on long tasks sets a higher multiple or Off. We do not second-guess that the task might be legit; the card explicitly offers "Keep going" as the easy answer.
- **Honest number missing / tiny:** `guardrailThresholdMin` returns null for a 0/NaN honest number → no nudge armed. The 25-minute floor covers tiny honest numbers so a short task never fires almost immediately.
- **Fires once per session, then quiet.** `guardNudged` guarantees a single nudge. There is no escalation ladder, no second card, no "are you SURE you want to keep going" follow-up. One tap on the shoulder is the whole feature. (This is the deliberate read of "escalating presence" from the source idea: escalation is the *trigger being personalised and well-timed*, not repeated nagging. A nagging guardrail is a guilt mechanic.)
- **App killed before threshold:** the scheduled notification still fires (OS-level), and `guardNudged` persists in `PersistedTimer`, so on resume the foreground card does not double-fire.
- **Catch-up on foreground:** if the app was backgrounded with reminders *off* (no notification fired) and the user foregrounds the Timer already past the threshold with `guardNudged` false, the card shows immediately on focus. It is still useful then ("you came back, you've been on this a while").
- **Deep link to an ended session:** tapping the notification after the task was already stopped lands on Today (the timer modal has no active session). No error, no empty timer.
- **Setting changed mid-session:** the threshold is read once at session start (armed at start). Changing the setting mid-session does not re-arm the current session; it applies to the next one. (Simpler and avoids a half-elapsed re-computation; document in the row's behaviour.)
- **Multiplier monotonic invariant:** N/A — the guardrail reads the honest number but never writes any tier/honey/sharpness value. It is read-only on calibration.
- **No-guilt audit:** amber only, never red; no pulse/blink; one nudge max; "Keep going" is the prominent option; no overrun counter; no cross-day comparison; nothing logged; the card never blocks the timer (it sits over the controls, the ring stays live and readable).
- **Privacy:** the setting is a single enum in KV; the notification body contains the task label locally only; nothing leaves the device; no calendar, no health data.

---

## 12. Analytics

Add to `src/services/analytics.ts` (`AppEventProps`), fire-and-forget, no PII (no task labels):

```ts
guardrail_armed: { setting: GuardrailMultiple; threshold_min: number; honest_min: number };
guardrail_shown: { channel: 'in_app' | 'notification'; elapsed_min: number; threshold_min: number };
guardrail_resolved: { action: 'keep_going' | 'wrap_up'; elapsed_min: number };   // in-app card answer
guardrail_setting_changed: { from: GuardrailMultiple; to: GuardrailMultiple };
guardrail_paywall: Record<string, never>;                                         // locked-row tap
```

Also extend the existing `paywall_view.trigger` union with `'hyperfocus_guard'`.

Funnel reading: `guardrail_armed` → `guardrail_shown` → `guardrail_resolved` tells us how often the nudge fires and whether users keep going or wrap up (a high "wrap_up" share means it is genuinely catching lost time; a high "keep_going" share is also fine — it means the user felt seen and chose to stay). Do not build any "overruns prevented" guilt metric from this.

---

## 13. Build manifest & effort

**Add:**

| File | What | Size |
|---|---|---|
| `src/engine/guardrail.ts` | `guardrailFactor`, `guardrailThresholdMin` | S |
| `src/engine/__tests__/guardrail.test.ts` | TDD cases (§8) — write first | S |
| `src/features/timer/GuardrailCheckIn.tsx` | the calm amber in-app card (entrance/dismiss motion, dim, reduced-motion) | M |
| `src/features/settings/GuardrailSettingRow.tsx` | Pro Settings row + Off/1.5×/2×/3× control | S |
| `src/features/settings/GuardrailLockedRow.tsx` | non-Pro locked teaser row | S |

**Edit:**

| File | Change |
|---|---|
| `src/domain/types.ts` | add `GuardrailMultiple` |
| `src/engine/index.ts` | export `guardrailFactor`, `guardrailThresholdMin` |
| `src/engine/constants.ts` | add `GUARDRAIL_FACTORS`, `DEFAULT_GUARDRAIL`, `GUARDRAIL_MIN_THRESHOLD_MIN` |
| `src/stores/settingsStore.ts` | add `hyperfocusGuard` + `setHyperfocusGuard`; default `'off'`; reset to `'off'` |
| `src/stores/timerStore.ts` | add `guardNudged` to `TimerState` + `PersistedTimer` + `CLEARED`; persist/rehydrate it; a `markGuardNudged()` action |
| `src/features/timer/useTimer.ts` | arm at session start (Pro + setting gate), drive `guardDue` off `elapsedSec`, `useAnimatedReaction` → mount card, schedule/cancel the notification, set `guardNudged` |
| `src/services/timerNotifications.ts` | add `scheduleGuardCheckIn` + `cancelGuardCheckIn` + `GUARD_ID_KEY` |
| `src/app/(modals)/timer.tsx` | render `<GuardrailCheckIn>` when the hook flags it due |
| `src/app/(tabs)/settings.tsx` (or wherever the Settings list lives) | mount `<ProGate fallback={<GuardrailLockedRow/>}><GuardrailSettingRow/></ProGate>` under the reminders row |
| `src/services/analytics.ts` | add 5 events + `'hyperfocus_guard'` trigger |

**Token check:** the card reuses existing tokens — `radii.sheet`, `space[4]`/`space[2.5]`/`space[16]`, `colors.surface`/`accent`/`amberText`/`inkSoft`, `opacity.pressed`, `borderWidth.hairline`/`thick`, `iconSize.xs`/`sm`, `motion.sheet`/`base`/`easing.out`/`easing.standard`. No new token group required. If a dedicated slide-distance constant is wanted, reuse `space[16]` (64) rather than adding one.

**Effort:** **Medium**. The engine is tiny (S). The work is the in-app card's motion + reduced-motion + dim + de-dupe wiring in `useTimer`, the dual-channel (foreground card vs background notification) mutual exclusion, and the Settings control. Roughly the "Low-Med" the source idea estimated, landing at Medium because of the foreground/background coordination and the no-guilt motion polish.

**Dependencies:** none new. Reuses `expo-notifications` (already guarded in `timerNotifications`), `ProGate`/`useEntitlement`, the timer's `elapsedSec` driver and `PaceLabel` amber precedent, `AppButton`, `Screen`.

**Open questions (for the founder):**

1. **Default multiple if/when on:** when a user toggles the guardrail on, what does it default to — 2× (assumed) — and do we ever pre-suggest turning it on (a one-time, dismissible Settings hint), or keep it purely opt-in with no prompt? (Leaning purely opt-in to avoid any nudge-to-nudge.)
2. **Haptic on card appearance:** a single soft selection haptic as the "tap on the shoulder", or no haptic at all so a focused user is not jolted? Decide on device.
3. **Card placement:** over the lower controls (assumed) vs a top banner that does not cover the controls. Verify on the sim which reads calmer without hiding the ring (founder approves UI from rendered screenshots only).
4. **"Wrap up" semantics:** routes straight into `onStopAndLog` (assumed, lands on reward with real time) vs just dismissing and letting the user stop manually. Confirm straight-to-stop is the right, low-friction answer.
5. **Background notification when reminders are off:** current decision is no background ping unless `remindersEnabled` (notifications are opt-in), with foreground catch-up. Confirm we do not want a separate guardrail-only notification opt-in.
