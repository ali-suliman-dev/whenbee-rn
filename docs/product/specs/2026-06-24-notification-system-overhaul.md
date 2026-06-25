# Notification System Overhaul — Design Doc

> Status: draft (2026-06-24). Brainstorm-approved, pre-plan. No code yet.
> Owns the **notification layer**. The Live Activity surface is owned by
> [`05-persistent-presence.md`](05-persistent-presence.md) +
> [`11-live-activity-timer-control.md`](11-live-activity-timer-control.md) — this doc
> references them and defines the **notification ↔ Live Activity handoff**, it does not
> re-spec the ring.

---

## 0. One-paragraph vision

Whenbee's notifications today are four plain title+body pings, mostly off by default, that
force an app-open to act on. This overhaul turns them into a small, calm, **actionable**
system: every ping carries quick buttons so passing a mark is one tap; the "time's up"
moment fires at the **honest number** (the learned, realistic finish) framed as data, never
failure; a soft honey sound and the bee's voice replace the system ding and the flat copy;
and the whole thing respects **quiet hours** and earns its place with a **provisional**
opt-in instead of a hard permission wall. The beautiful live surface (Lock-Screen ring,
Dynamic Island) is the Live Activity from spec 05/11 — this layer hands off to it cleanly so
the two never double-nag.

This is one cohesive release (no phasing). Pillars 1, 2, 4 are pure `expo-notifications` +
settings + copy/asset work. Pillar 3 is integration glue onto the already-specced native
presence module.

---

## 1. Product invariants (never violate)

- **No guilt, ever.** No "late", "overdue", "missed", "behind", no red, no streaks, no
  badge counts, no shame. A passed estimate is **data**, stated calmly.
- **Honey/sharpness is monotonic.** Nothing here touches calibration or tier.
- **Core loop is on-device-only.** All notifications stay **local** (`expo-notifications`,
  no APNs, no network). Same guard pattern as today's `timerNotifications.ts`.
- **Calm cadence.** A calm app does not ping at 11pm. Quiet hours and restraint are the
  brand — never trade them for engagement.
- **One primary action per surface.** A notification has at most one foreground/primary
  button; the rest are quiet reschedules/dismissals.
- **Pricing read from RevenueCat**, never hardcoded (only relevant where a ping is Pro).

---

## 2. Locked decisions (the spine)

1. **Stay local.** No remote push, no service-extension rich media in this cut. The
   "beautiful" surface is the Live Activity, not a decorated banner.
2. **Action buttons via notification categories** — the headline UX win, pure expo.
3. **The "time passed" ping fires at the honest number**, not the raw estimate. It is a
   rename+reframe of today's `scheduleTimerDone`, not a second ping.
4. **`interruptionLevel: timeSensitive`** for the honest-reached + start-by pings (surfaces
   through Focus), `passive`/`active` for the gentle ones. Quiet hours still applies.
5. **Live Activity, when active, owns the moment.** The amber ring carries the overrun; the
   banner suppresses or softens so the user isn't told twice. (§6)
6. **Quiet hours** default ~21:00–08:00 local, user-adjustable, on by default. Non-time-
   sensitive pings defer to the window's end; time-sensitive ones still fire (calm copy).
7. **Provisional auth** for first delivery — pings arrive quietly in Notification Center
   with no prompt; the full prompt is earned in context.
8. **Soft honey sound**, not the system ding. One short bundled asset, reused everywhere.
9. **No new nagging surfaces.** No capacity push, no "come back" re-engagement ping, no
   daily-ritual ping (the ritual stays in-app, per current design).

---

## 3. Current state → what changes

Today (verbatim from code):

| # | Ping | Fires at | Gate | Tier | Title / Body |
|---|---|---|---|---|---|
| 1 | Time check | `startedAt + estimateMin` | `remindersEnabled` (OFF) | Free | "Time check" / "Your honest estimate for {label} is up. Log it whenever you wrap up." |
| 2 | Start-by | plan `startByMs` | `remindersEnabled` (OFF) | Free | "Start by {clock}" / "Begin {task} now to finish by {clock}." |
| 3 | Hyperfocus guard | `honestMin × multiple` | `hyperfocusGuard` + reminders (OFF) | Pro | "Still on this?" / "You've been on {label} about {min} minutes. Surface whenever you want." |
| 4 | Monday review | Mon 9:00 | `reviewNotifyEnabled` (OFF) | Pro | "Your honest week is ready" / "A calm look back, whenever you have a minute." |

All plain title+body. No actions, sound, grouping, quiet hours. Permission asked on first
timer start / on review toggle.

Changes:
- #1 → **Honest-reached ping**: anchor moves estimate → honest number; gains buttons +
  timeSensitive + honey sound. (§5)
- #2, #3, #4 → gain **buttons**, honey sound, thread grouping, quiet-hours respect, voice
  pass. Triggers/gates unchanged. (§4, §9)
- New: **quiet hours**, **provisional flow**, **Notifications settings redesign**, **LA
  handoff**. (§6, §7, §8, §12)
- No new ping *types*. The system gets richer, not louder.

---

## 4. Pillar 1 — Act from the banner (categories + actions)

Pure `expo-notifications`: `setNotificationCategoryAsync` at launch, one category per ping
type, handled in a single `addNotificationResponseReceivedListener`.

### 4.1 Category / action matrix

| Category id | Ping | Buttons (id · title · options) | Foreground? |
|---|---|---|---|
| `WB_HONEST_REACHED` | honest-reached | `LOG · Log it` (foreground) · `EXTEND_10 · +10 min` · `SNOOZE_15 · Snooze 15m` | Log opens; others background |
| `WB_START_BY` | start-by | `START · Start now` (foreground) · `SNOOZE_5 · Snooze 5m` | Start opens; snooze background |
| `WB_GUARD` | hyperfocus | `OK · I'm good` (dismiss) · `WRAP · Wrap up` (foreground) | Wrap opens; ok background |
| `WB_REVIEW` | Monday review | `OPEN · Open review` (foreground) · `EVENING · This evening` | Open opens; evening background |

Notes:
- **One foreground/primary per category** (invariant). The rest are quiet.
- `Log it` opens the app — logging needs a real duration confirm, can't be guessed silently.
- `+10 min` / `Snooze` / `This evening` are **pure reschedules**: cancel the pending id,
  re-add with a shifted trigger. They write nothing to SQLite.
- `I'm good` just dismisses (marks `guardNudged`, already in state).

### 4.2 Background execution — the real constraint (resolve at build)

iOS runs a non-foreground notification action by launching the app **in the background** and
delivering the response to JS. `expo-notifications`' `addNotificationResponseReceivedListener`
is the channel. **Open risk:** reliable JS execution + re-scheduling inside that short
background launch is not guaranteed across cold-start states. Two fallbacks, decide at build:
  - **A (preferred):** background action runs the reschedule in the listener; verify on a
    real device that a cold-start background launch completes the `cancel + add`.
  - **B (safe fallback):** if A proves flaky, make `+10/Snooze` `opensAppToForeground: true`
    but route to a **silent handler screen** that reschedules and immediately dismisses (no
    visible app), so the user still gets one-tap behavior.
This is the one notification-layer piece that needs device verification (everything else is
deterministic). Live Activity verification is already owned by 05/11.

### 4.3 Handler

Single listener in the existing notification service (extend `timerNotifications.ts` or a new
`notificationActions.ts`), switching on `response.actionIdentifier`. Reschedules reuse the
existing `scheduleTimerDone/scheduleStartBy/...` functions with a new fire time. Foreground
actions route through the existing `DeepLinkRouter` pattern (per the skill's deep-link model)
to the timer / review screens.

---

## 5. Pillar 2 — The honest-reached ping (your "time passed", de-guilted)

### 5.1 What changes

Today's #1 fires at `startedAt + estimateMin` (the raw guess). It moves to fire at the
**honest number** — `startedAt + honestMin` — the learned, bias-adjusted point where this
user actually tends to finish this category. That's the genuinely useful "you're around the
moment you usually wrap" ping, not an arbitrary guess deadline.

- `honestMin` already computed at timer start (used by the ring + Live Activity `finishEpoch`).
  Reuse it; no new engine math. If the category has no calibration yet (not-enough-data), fall
  back to the raw estimate and keep the copy neutral.
- `interruptionLevel: timeSensitive` so it surfaces through Focus modes — but **copy stays
  calm data**, never an alarm.
- Carries the `WB_HONEST_REACHED` category (§4) so it's actionable.
- Honey sound (§7).

### 5.2 No-guilt copy (the whole point)

Run through `humanizer` + `conversion-psychology` (see §9 for the lens). Leads with the useful
fact (this is *when you usually finish*), sounds like a friend, no pressure:

- Title: `You're near the finish`
- Body: `This is about when {label} usually wraps. Log it when you're done.`
- Not-enough-data fallback — Title: `Time check for {label}` / Body: `This was your estimate
  for {label}. Log it whenever you wrap.`

Never "time's up", "over", "late". Framed as the learned number doing its job.

### 5.3 Dedupe with the existing hyperfocus guard

The guard (#3) already fires later at `honestMin × multiple`. Both can be armed. Rule: they
are different moments (honest finish vs. far-overrun check-in) and may both fire, but **never
within the same minute** — if `multiple` is small enough that they'd collide, suppress the
guard (the honest-reached ping already covered the moment). Add a min-gap guard in scheduling.

---

## 6. Pillar 3 — Live Activity handoff (integration only)

The Lock-Screen ring + Dynamic Island is **spec 05/11**, not re-specced here. This pillar is
the **mutual-suppression contract** so the banner and the live ring never tell the user the
same thing twice.

- **When a Live Activity is active for the running task:** the honest-reached banner is
  **suppressed** (the amber ring already carries the moment on the Lock Screen). Implementation:
  at `scheduleTimerDone` time, check `presenceAvailable() && activityStartedForThisTask` and
  skip the banner, OR downgrade it to `interruptionLevel: passive` so it lands quietly in
  Notification Center as a log-prompt without buzzing. Decide at build; default = suppress.
- **When no Live Activity (Expo Go, pre-link, user disabled Live Activities, free tier minimal
  variant):** the honest-reached banner is the **only** signal — it fires normally with its
  buttons. This is the graceful degradation path.
- **Start-by / review / guard** are unrelated to the running-timer ring and always fire as
  banners.
- **Overrun:** the ring flips amber (05 §6). The banner never sends a *second* "still going"
  unless the user armed the hyperfocus guard. No new overrun banner.

No native work in this doc — it consumes `presenceAvailable()` and the activity-active flag the
05 bridge already exposes.

---

## 7. Pillar 4 — Calm controls + delight

### 7.1 Quiet hours (pure logic, TDD)

- New setting `quietHours: { enabled: boolean; startMin: number; endMin: number }` (minutes
  from midnight, local). Default `{ enabled: true, start: 21:00, end: 08:00 }`.
- Pure helper `nextAllowedFireTime(desiredMs, quiet, nowMs): number` in `src/engine/` (or
  `src/lib/`), unit-tested first. Rule:
  - **Time-sensitive pings** (honest-reached, start-by) **ignore** quiet hours — they're tied
    to a live task and matter now; but they still use calm copy/sound.
  - **Gentle pings** (review, and any future digest) **defer** to the quiet window's end.
  - Handle the wrap-around window (21:00–08:00 spans midnight) — the classic off-by-one.
- TDD cases: inside window → pushed to end; outside → unchanged; window wrap; disabled →
  identity; desired exactly at boundary.

### 7.2 Provisional opt-in

- First registration uses `requestPermissionsAsync({ ios: { allowProvisional: true } })` so
  pings deliver **quietly** to Notification Center with no system prompt.
- Upgrade to full (banners + sound) in context the first time the user **engages** a ping or
  toggles a reminder on — then the standard prompt appears, having already shown value.
- Settings reflects state honestly: provisional shows a "Delivering quietly — turn on banners"
  affordance, not a fake "on".

### 7.3 Honey sound

- One short, soft chime asset (~0.5–1s, warm, no sharp transient). `content.sound = 'honey.caf'`
  (or `.wav`), bundled via app config; reused by all pings.
- **Asset gap (open):** this audio file does not exist yet. Source or commission it; until then
  pings use `default`. Must respect the silent switch / Focus like any sound.

### 7.4 Thread grouping

- `threadIdentifier` per type: `wb-timer`, `wb-plan`, `wb-guard`, `wb-review` so Notification
  Center collapses tidily instead of stacking loose banners.

---

## 8. Settings → Notifications redesign

"Make the section more in it." Current `settings.tsx:308` is a flat list of toggles. Redesign
into a grouped, intentional section (real tokens only — `t.space[*]`, `t.colors.*`, `type.*`;
add tokens to `tokens.ts` if a value is missing, never inline):

```
Notifications
┌──────────────────────────────────────────────┐
│  Reminders                          [ on  ●]  │  master (remindersEnabled)
│  Honest, calm nudges tied to your day.        │  type.body / inkSoft
│                                               │
│  ── when on ──────────────────────────────    │
│  Honest finish reached              [ on  ●]  │  free
│  Start-by nudge                     [ on  ●]  │  free
│  Hyperfocus check-in        PRO     [ off ○]  │  pro (existing)
│  Monday review              PRO     [ off ○]  │  pro (existing)
│                                               │
│  ── quiet ────────────────────────────────    │
│  Quiet hours                        [ on  ●]  │  new
│  21:00 – 08:00                     [ edit ]   │  time pickers
│  Sound      Honey ▾                           │  honey | default | none
└──────────────────────────────────────────────┘
```

- Coordinates with `Settings → Presence` (05 §5.7) — the **Live Activity / ring toggle lives
  there**, not duplicated here. A one-line cross-link ("Lock-Screen ring lives in Presence")
  is fine.
- Per-type sub-toggles are revealed only when the master `Reminders` is on (progressive
  disclosure), so the section isn't a wall of switches when off.
- Provisional state surfaces here (§7.2).

---

## 9. Copy (no-guilt, humanized) — final

Every string below was written with the two skills as the gate, not as an afterthought:

- **`humanizer`** — no em-dash, no rule-of-three, no AI vocab (no "surface", "seamless",
  "elevate"), simple `is/has`, reads naturally aloud, varied rhythm.
- **`conversion-psychology`** — lead with the *felt* benefit (this is when you usually finish,
  not an arbitrary deadline), be specific over vague, sound like one real person talking to a
  friend, soft never pushy. **The fear/FOMO/scarcity levers are deliberately NOT used** — they
  are guilt-adjacent and banned by the product invariant. The transferable levers here are
  specificity, instant clarity, and the calm "after" framing.

These are the strings to ship (re-run both skills at plan time only if wording is touched).

**Honest-reached** — `You're near the finish` / `This is about when {label} usually wraps. Log
it when you're done.`
  - not-enough-data — `Time check for {label}` / `This was your estimate for {label}. Log it
    whenever you wrap.`

**Start-by** — `Start by {clock}` / `Start {label} now and you'll finish by {clock}.`
  - *(revoiced: "Begin" → "Start"; added the felt after-state "you'll finish by".)*

**Hyperfocus** — `Still on {label}?` / `You've been at it about {min} minutes. No pressure,
just a nudge.`
  - *(revoiced: dropped the jargon "Surface whenever you want".)*

**Monday review** — `Your honest week is ready` / `Your week in honest numbers, whenever you've
got a minute.`

**Button titles** (short, verb-first, no period) — `Log it`, `+10 min`, `Snooze 15m`, `Start
now`, `Snooze 5m`, `I'm good`, `Wrap up`, `Open review`, `This evening`.

**Settings** — Reminders sub-label: `Quiet nudges that follow your day, nothing naggy.`
Quiet-hours helper: `No banners during these hours. Live task pings still come through,
quietly.` Sound labels: `Honey`, `Default`, `None`.

**Verified across all strings:** no "behind / late / missed / overdue / time's up", no red
language, no three-part lists, no em-dash, no AI vocab, every line reads aloud like a person.

---

## 10. Data model / persistence

No new SQLite, no migration. New keys in `settingsStore` (Zustand + KV), all opt-out-safe:
- `quietHours: { enabled, startMin, endMin }` — default `{ true, 1260, 480 }`.
- `notificationSound: 'honey' | 'default' | 'none'` — default `'honey'` (falls back to
  `'default'` until the asset ships).
- `honestReachedEnabled`, `startByEnabled` — per-type free sub-toggles (default on when master
  on). Pro toggles `hyperfocusGuard`, `reviewNotifyEnabled` already exist — unchanged.
- Permission tier (`provisional | full | denied`) is **derived** from
  `getPermissionsAsync()`, not stored as truth (per the skill: never cache permission as
  source of truth).

---

## 11. Engine / logic (pure, TDD)

- `nextAllowedFireTime(desiredMs, quiet, nowMs)` — §7.1, wrap-around aware, clamped.
- `shouldSuppressHonestBanner(presenceAvailable, activityActiveForTask)` — §6 boolean.
- `honestReachedFireTime(startedAtMs, honestMin, estimateMin, hasCalibration)` — picks honest
  vs estimate anchor.
- Min-gap guard between honest-reached and hyperfocus (§5.3).
All pure, in `src/engine/` (or `src/lib/`), exported via index, tests first. No calibration
math added — these only pick *when*, never *what* the honest number is.

---

## 12. Permission / provisional flow

1. App launch: register categories (`setNotificationCategoryAsync` × 4), set delegate/handler.
2. First reminder-relevant moment (timer start / toggle on): `requestPermissionsAsync` with
   `allowProvisional: true` → quiet delivery, no prompt.
3. On first engagement (tap/action) or explicit toggle: request **full** authorization in
   context.
4. Denied + `!canAskAgain`: toggle fails calm, toast routes to iOS Settings (existing string
   `settings.tsx:40`). Never nag, never re-prompt in a loop.
5. Re-check status on every relevant entry (user can change it in Settings anytime).

---

## 13. Motion

Notifications themselves carry no app-controlled motion (OS-rendered). Motion lives only in
the **Settings redesign**:
- Sub-toggle group reveal on master-on: opacity fade + a hair of height settle, `entering`-only
  (never `exiting` — SIGABRT on Fabric per README), `ease-out`, no overshoot, ≤ motion tokens.
- Quiet-hours time-picker expand: standard fade, no slide-in-and-bounce.
- Reduced-motion → final state, no travel.
(Live Activity ring motion is 05 §6.)

---

## 14. Edge cases (must all be handled)

- **Expo Go / tests / pre-link binary:** native scheduler probe fails → every schedule is a
  no-op (existing guard). CI green.
- **No calibration yet:** honest-reached uses estimate + neutral copy (§5.1).
- **Permission denied / provisional only:** schedule still "succeeds" silently; the ping lands
  quietly or not at all; UI never claims it's on.
- **Quiet-hours wrap-around (21:00–08:00):** the off-by-one trap — covered by TDD (§7.1).
- **Background action on cold start:** §4.2 risk — fallback B if A is flaky.
- **Live Activity active:** honest banner suppressed/softened (§6); no double-nag.
- **Timer stopped before fire:** existing cancel on stop/abandon/toggle-off — extend to cancel
  by category id; verify no orphaned pending requests after a reschedule.
- **DST / timezone shift:** quiet-hours and weekly review compute from local components, not
  absolute ms, so a DST change keeps "9:00 Monday" correct (reuse `WEEKLY` trigger semantics).
- **Honey sound missing:** falls back to `default`; `none` honored.
- **Multiple reschedules ("+10" twice):** each cancels the prior pending id first; never stack.

---

## 15. Analytics

Reuse the existing fire-and-forget pattern, guarded so it's silent in Expo Go. Extend the
typed events:
- `reminder_enabled` / `reminder_disabled` ✓ (exist).
- `notification_action` `{ category, action }` — fired on any button tap (`Log it`, `+10 min`,
  `Snooze`, `Start now`, `Wrap up`, etc.). The key new funnel signal: are buttons used?
- `quiet_hours_toggled` `{ enabled }`, `notification_sound_set` `{ value }`.
- `notification_permission` `{ tier: 'provisional' | 'full' | 'denied' }` on resolution.
- Keep existing `guardrail_shown { channel }`, `review_notify_toggled`.
No event measures raw deliveries (OS-owned). Action-tap rate is the success metric (§20).

---

## 16. Testing strategy

- **Engine (TDD, required):** `nextAllowedFireTime`, `honestReachedFireTime`,
  `shouldSuppressHonestBanner`, min-gap guard — exhaustive unit tests, written first.
- **Service:** mock the `expo-notifications` module (as today) — assert correct category id,
  trigger time, sound, interruption level per ping; assert reschedule cancels prior id.
- **Handler:** simulate `response` objects per `actionIdentifier`; assert reschedule vs
  foreground-route branch.
- **Device (manual, the one place sim can't):** §4.2 background action on cold start; honey
  sound; Focus-mode pass-through of time-sensitive; provisional quiet delivery; LA-active
  suppression. Use a real device per the README device-verify note.

---

## 17. Explicitly out of scope (this version)

- Remote / APNs push (stays on-device-only).
- Notification Service Extension rich media (banner images), communication-notification bee
  avatar, content extension custom UI — heavy native for marginal gain over the Live Activity.
  Re-evaluate post-launch.
- Any re-engagement / "come back" ping, capacity push, daily-ritual ping — guilt-adjacent,
  banned.
- Badge counts.
- Android presence (iOS-only cut, per 05).

---

## 18. Build manifest & effort

**Pure-expo (no native) — the bulk:**
- Category/action registration + single response handler — **M**
- Honest-reached anchor move + dedupe + suppression hook — **S**
- Quiet-hours engine helper + wiring — **S** (logic) / **S** (settings)
- Provisional flow — **S**
- Settings → Notifications redesign (RN, tokens) — **M**
- Copy + humanizer pass — **S**
- Honey sound asset — **S** (source/commission) + wiring **XS**

**Native:** none new here — consumes the 05/11 presence module + `presenceAvailable()`. The LA
itself is 05/11's manifest.

**Tests:** engine TDD + service mocks — **M**.

Net: a medium feature, almost entirely expo + design + copy. The only device-gated risk is the
background action (§4.2); the only asset gap is the honey sound (§7.3).

---

## 19. Open questions (resolve at build)

1. **Background action reliability (§4.2)** — does a cold-start background launch reliably run
   the reschedule in JS, or do we need fallback B (silent handler screen)? Device test decides.
2. **LA-active honest banner** — suppress entirely, or downgrade to `passive` log-prompt? Lean
   suppress; confirm against the real Lock-Screen ring feel.
3. **Honey sound** — produce in-house or license? Needs to match the brand's calm voice and not
   clip on the silent switch.
4. **Quiet-hours default window** — 21:00–08:00 assumed; validate against target persona.
5. **Provisional → full upgrade trigger** — on first action tap vs. first explicit toggle vs.
   both? Pick the least naggy that still unlocks banners when wanted.

---

## 20. Success criteria

- A user can pass their honest finish and **log / extend / snooze in one tap**, no app-open,
  on a real device.
- The honest-reached moment reads as **calm data** — zero guilt language, verified by humanizer
  + a read-aloud check.
- **No double-nag:** when the Live Activity is live, the banner doesn't repeat the moment.
- **Quiet hours respected:** no gentle ping lands in the window; time-sensitive task pings come
  through quietly.
- The Notifications settings section reads as **intentional and calm**, not a wall of switches.
- `notification_action` tap-rate is measurable and non-trivial (buttons actually used).
- Invariants intact: on-device-only, no streaks, no badges, no red, honey untouched.
