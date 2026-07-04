# Forgotten-timer protection: smart auto-close + recovery — design spec

Date: 2026-07-04 · Status: approved (design), pending spec review
Related research: `docs/product/12-FORGOTTEN-TIMER-RESEARCH.md`

## Problem

Founder's #1 pain: forgets to stop the timer. Phone on silent → misses the
buzz → the timer runs for hours. Two failures stack:

1. **Surface** — the running timer is out of sight; a silent phone means the
   over-guess is never noticed.
2. **Data** — a runaway overrun trains a fake ratio into the calibration model.
   The engine clamps it to `RATIO_CEIL = 6`, so it can't fully poison the model,
   but a clamped 6× overrun still drifts the learned bias pessimistic — the
   opposite of the product's promise.

## Goal

A forgotten stop becomes a **one-tap fix**, not a data disaster, and the model
is **never lied to** — while honoring the invariants: no guilt, amber never red,
no streaks, core loop on-device-only, honey/sharpness monotonic.

## Key insight

Whenbee is the only timer that already knows the user's **honest number**
(guess × learned bias = realistic finish). Every mechanism below spends that
asset: predict the real finish, close near it, recover against it, and refuse to
train on an unconfirmed overrun.

## What already exists (reuse, don't rebuild)

| Asset | Location | Reused for |
|---|---|---|
| `GuardrailMultiple = 'off'\|'1.5x'\|'2x'\|'3x'` + `guardrailThresholdMin` / `guardrailFactor` | `src/domain/types.ts:232`, `src/engine/guardrail.ts` | the "when Whenbee steps in" knob |
| `GuardrailCheckIn.tsx` (calm amber "Keep going / Wrap up", once per session, de-duped vs notification) | `src/features/timer/GuardrailCheckIn.tsx` | the gentle nudge |
| `LogSource = 'timed' \| 'retro'`, retro trains at half alpha (`RETRO_ALPHA_FACTOR = 0.5`) | `src/domain/types.ts:12`, `src/engine/constants.ts` | recovered-log down-weighting |
| `LogStatus = 'completed' \| 'abandoned' \| 'partial'` (only `completed` trains) | `src/domain/types.ts:15` | pending/unconfirmed = `partial` → no train |
| Honest-reached notification + `EXTEND_10` / `SNOOZE_15` actions | `src/services/notificationResponses.ts`, `timerNotifications.ts` | live event markers |
| `over` shared value (amber flip), `overrunTimerRef`, honest range, background/kv resume | `src/features/timer/useTimer.ts`, `src/stores/timerStore.ts` | overrun-amber + foreground reconcile |
| Guardrail settings rows (`GuardrailSettingRow`, `GuardrailLockedRow`) | `src/features/settings/` | Pro config surface |

**Consequence:** this is an *evolution of the hyperfocus guardrail*, not a new
subsystem.

## Feasibility constraint (drives the architecture)

A JS `setTimeout` does **not** fire while the app is backgrounded/locked (see
`docs/NATIVE-PRESENCE.md`; only a native alarm/notification fires). Therefore
true background auto-close is **not reliable on iOS today**.

Robust model: **auto-close reconciles on next foreground** from wall-clock — on
resume, if a running timer blew past its close point while the user was away,
Whenbee wraps it then and shows the recovery card. This *merges* auto-close (#2)
and the forgot-card (#7): the forgot-card IS the auto-close resolution.
Notifications still mark the nudge/close events live. True native background
close is P2, alongside the iOS Live Activity.

## Free vs Pro (decided)

- **Free, default ON — the safety net:** overrun-amber everywhere, the gentle
  nudge, auto-close-on-foreground + recovery card, the train-guard, one simple
  preset.
- **Pro, opt-in — the control:** proactive *earlier* check-in, raw
  `1.5x/2x/3x` multiples, hyperfocus-guardrail framing (existing rows).

This keeps the #1 pain out from behind the paywall ("calibration is free").

---

## The intervention ladder (one knob)

```
honest reached ──▶ amber flip (silent, visual — already the `over` value)
      │
nudge point ─────▶ gentle check-in card (foreground) + notification (background)
      │             "Still on X? Tap if you wrapped."  one tap = close now.
close point ─────▶ auto-close → PENDING log   (nudge unanswered AND user away)
      │             executed on next foreground via wall-clock reconcile
recover ─────────▶ "Wrapped X for you — when did you finish?"
                    presets from prediction: at honest (6:10) · at guess ·
                    a few min ago · still going (reopen)
```

- The knob (preset) sets the **nudge** multiple of the honest number.
- **auto-close = nudge unanswered + grace window** (continued no-interaction),
  and only when the app was NOT in the foreground (foreground users see amber and
  the card — no silent close under their nose).
- `GUARDRAIL_MIN_THRESHOLD_MIN = 25` already floors short tasks out of triggering.

### Preset → multiple (free)

| Preset (user-facing) | Nudge at | Notes |
|---|---|---|
| Lots of room | 2× honest | most forgiving |
| **Balanced (default)** | **1.5× honest** | default on install |
| Step in early | 1.25× honest | earliest nudge |

Grace window before auto-close: fixed (proposed **20 min** of continued
no-interaction past the nudge; final value tuned in the plan). Auto-close never
fires before nudge.

---

## Data model & train-guard (no new engine concept)

On auto-close (foreground reconcile):

1. Write the log with **`status: 'partial'`** (partial does not train) and
   **`source: 'retro'`**.
2. **Stop time = the predicted honest finish**, never the runaway elapsed. The
   recorded `actualMin` = honest number (rounded), not `now - startedAt`.
3. `startLocalMinute = null` (backfilled/untrusted start context → excluded from
   time-of-day insights, per existing rule).

On recovery-card resolution:

- **Confirm / adjust** → flip to `status: 'completed'`, `actualMin` = chosen
  finish, trains at **`retro` half-alpha**.
- **Still going** → reopen the session (restore running state), discard the
  pending log.
- **Ignore** (never resolved) → stays `partial` → **never trains.** The model
  cannot be lied to. This is the #10 guardrail, obtained for free.

Invariant check: `partial` logs already excluded from sharpness/honey windows →
honey stays monotonic; no guilt surface introduced.

---

## Components & boundaries

Engine (pure, `src/engine/`):
- `guardrail.ts` — extend/derive: given honest, preset multiple, and a grace,
  compute nudge-threshold-min and close-threshold-min. Pure, clock-free.
- New pure helper `autoCloseDecision(input)` → `{ shouldAutoClose, recoveredActualMin }`
  from `{ elapsedMin, honestMin, nudgeThresholdMin, closeThresholdMin, nudged }`.
  Unit-tested exhaustively.

Store (`src/stores/timerStore.ts`):
- Add derivation on `resumeFromKv` / foreground: detect "blew past close point
  while away" → surface a pending auto-close, without writing training data
  directly (routes through the calibration store's log path with the
  status/source flags).

Feature/UI (`src/features/timer/`):
- Reuse `GuardrailCheckIn` for the nudge (already de-duped).
- New `ForgotCard` (recovery presets) — mounts on foreground when a pending
  auto-close exists. Presets computed from honest/guess.
- Overrun-amber pass: ensure `over` state renders amber + live "+Nm over" on the
  timer screen, ActiveTimerBar, widget, and notification (some already do).

Settings (`src/features/settings/`):
- Free preset row (Lots of room / Balanced / Step in early) → maps to multiples.
- Existing `GuardrailSettingRow` stays for Pro (raw multiples + proactive
  check-in), gated by entitlement.

Notifications (`src/services/`):
- Nudge + close notifications reuse `scheduleTimerDone` machinery; actions:
  "I wrapped" (close now) / "Still going" (extend).

Copy (all user-facing strings via `conversion-psychology` + `humanizer`; tokens
from `tokens.ts`):
- Nudge: question, not scold. Close: "wrapped it for you," recoverable.
- First-time contextual line when auto-close first acts (not a settings tour):
  *"Whenbee wrapped this for you. Tap to fix the time — or change when it steps in."*

---

## Error handling / edge cases

- **Paused timer** past close point: don't auto-close a paused session (user
  intentionally paused). Reconcile only running sessions.
- **Genuinely long task** (user actively working, app foregrounded): amber +
  nudge card only, never a silent auto-close.
- **Reopen after "still going":** session restored to original `startedAt` +
  accumulated pause; no double-count.
- **Multiple foregrounds:** pending auto-close resolves once; de-dupe like the
  existing nudge once-per-session guard.
- **Preset = never/off (Pro):** no nudge, no auto-close; overrun-amber + forgot
  card still available as the passive net (or fully off — decide in plan).

## Testing

Engine (pure, TDD-first):
- `autoCloseDecision` truth table: below nudge, between nudge/close, past close
  w/ + w/o nudge, min-threshold floor, preset multiples.
- Recovered `actualMin` = predicted honest, never elapsed.
- Train-guard: `partial` → no model movement; `completed`+`retro` → half-alpha
  movement.

Hook/UI:
- Nudge fires once, de-duped vs notification.
- Foreground reconcile creates exactly one pending auto-close from wall-clock.
- ForgotCard presets compute correct times; "still going" restores session.
- Amber overrun renders on each surface.

## Out of scope (this spec)

- iOS Live Activity + one-tap Done + native background auto-close (P2, gated on
  paid Apple team) — separate spec.
- Motion/context-aware "still going?" (#3) — post-base exploration.
- Android presence overrun flip — already built.

## Open items for the plan (not blockers)

- Final grace-window value (proposed 20 min).
- Exact overrun-amber surfaces still missing the state (audit during build).
- Whether Pro "off" also disables the passive forgot-card net.
