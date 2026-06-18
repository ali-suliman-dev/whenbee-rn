# Today ledger + wax-seal ritual — design

> **Status:** approved in visual brainstorm (founder, 2026-06-18) from rendered mocks. Ready for an implementation plan.
> **Surface:** the Today screen header zone (`src/app/(tabs)/index.tsx`), specifically the three stacked pieces under the screen header: the honey HUD, the reclaim-today line, and the daily-ritual line.
> **Mocks (source of truth for the look/motion):** `docs/superpowers/plans/bee-today-ledger-options.html` (layout A/B/C), `…/bee-ritual-fillup-dark.html`, `…/bee-ritual-altglyphs-dark.html`, `…/bee-ritual-waxseal2-dark.html` (locked choreography), `…/bee-ritual-final.html` (light + dark + presence states — the binding render).

---

## 1. Why this exists (purpose, doc-backed)

The Today header shows three rungs of the retention "reward ladder" (`build-plan-final/05-RETENTION.md`, `05b-HONEY-SYSTEM.md`, `05c-RECLAIM-AND-DISCOVERIES.md`):

| Piece | What it is | Doc intent |
|---|---|---|
| **Honey HUD** (`TodayHud`) | **Mastery** — per-category `sharpness`, tier word + bar | the companion presence; "calm, not chore"; monotonic |
| **Reclaim today** (`ReclaimTodayLine`) | **Tangible payoff** — minutes the honest number spared you today; the *steady drip* (lifetime total is the hub hero) | concrete, frequent, close-in-time ADHD reward; amber = "found time", never scold; hidden at 0 |
| **Daily ritual** (`DailyRitualLine`) | **The doorway** — opt-in "one honest thing", the lightest entry to the loop | invitation, **never a streak**; no count, no history; empty days invisible; renders only when enabled |

Today these render as three mismatched shapes (a bordered card, a loud filled pill, a faint icon row) with no expressed relationship and an inverted hierarchy (the drip louder than the HUD, the doorway the faintest thing). The docs explicitly frame honey and reclaim as a **self-balancing pair** ("honey measures mastery; reclaim pays you in time"), so they should read as one system.

**Problem statement:** unify the three into one coherent surface, fix the hierarchy, and make completing the daily ritual feel satisfying enough to *want* to do — without any streak/loss/guilt mechanic.

---

## 2. Decisions (locked)

### 2.1 Layout — **Option A: one ledger card**
Fold all three into a single card (replaces the three separate siblings on Today):

```
┌─────────────────────────────────────────────┐
│ (bee)  Setting                            ›  │   ← honey HUD (unchanged content)
│        ▓▓▓▓▓▓▓░░░░░░░                          │
│        ─────────────────────────────────────  │   ← hairline divider
│  +10m reclaimed today          ◈ Log one …    │   ← footer: reclaim (left) · ritual (right)
└─────────────────────────────────────────────┘
```
One border, one internal grid → everything aligns; reclaim demotes from a filled pill to a quiet inline stat; the ritual gets equal billing on the right. The whole card still taps through to the Whenbee hub **except** the ritual glyph + label, which is its own tap target (logs / opens the retro log).

### 2.2 Ritual glyph — **the wax seal**
A flat-top **comb cell** that seals on log. Two-tone in the app's existing glyph idiom (`EnergyGlyph`/`ReasonGlyph`): indigo line-art body + amber accent, fixed brand art colors (does **not** recolor by mode). Glyph ~27pt in the bar.

- **Resting (not done):** a faint, slowly breathing indigo hex outline + the invitation label. A calm, gain-only "ready" affordance (Zeigarnik: an open shape wants closing). Never grey/red, never a count.
- **Sealed (done):** honey-yellow fill, **indigo border in the star color** (`#5F4EE4`), an indigo `✦` mark. Resets invisibly at the next local day.

### 2.3 Reclaim ↔ ritual link — **kept**
Sealing the ritual and the reclaim number banking are the **same moment**: when the log produces a reclaim deposit, the `+10m` ticks/bumps as the seal completes. This is the gain-only hook (doorway → payoff) with no loss aversion. If a given log produced **no** deposit (`reclaimDeltaMin < 1`, see `05c §3`), the seal still plays; the reclaim simply doesn't change (and stays hidden if the lifetime-today total is 0).

### 2.4 Motion — locked choreography (calm, no overshoot)
Plays once on a successful log. Order is **border first, then honey**:

| # | Beat | Property | Duration / delay | Easing |
|---|---|---|---|---|
| 1 | Border draws itself closed | `stroke-dashoffset` 100→0 | 660ms @ 40ms (ends @700) | ease-out `(.23,1,.32,1)` |
| 2 | Honey wells up inside — **starts only after the border finishes** | `scaleY` 0→1 (origin bottom) + surface edge | 580ms @ 740ms | premium `(.4,0,.2,1)` |
| 3 | Soft warm bloom passes once | radial-gradient `opacity` 0→.5→0, `scale`→1.25 | 900ms @ 1020ms | sine `(.37,0,.63,1)` |
| 4 | `✦` fades in | `opacity` 0→1, `scale` .85→1 | 360ms @ 1240ms | ease-out |
| 5 | Radial sparkle bursts (8 amber slivers, 360°) | `rotate(a) translateY(−d)` + fade | 620ms @ 1260ms | ease-out |
| — | Reclaim number banks | `scale` 1→1.1→1 | @ 1240ms | premium |

- **No scale-jump / squash / bounce on the glyph** (explicitly rejected as tacky). Calm and deliberate — this is a once-a-day moment.
- The sparkle reuses the `EnergyGlyph` "streaks fly off" signature, spread radially (every 45°).
- **Reduced motion:** snap to the final sealed state, no motion (mirror `EnergyGlyph`/`ReasonGlyph` reduced-motion handling).

### 2.5 Copy (recommended; alternates noted)
- **Invitation (resting):** `Log one honest thing` — the brand's honesty wedge. The autonomy line ("Skipping is fine.") moves to the **accessibility label** and the first-run/expanded hint, not the compact bar. Alternates: "One honest log", "Catch one today".
- **Done (sealed):** `Today's honey set ✦` — ties to the tier word *Setting* + the seal. Alternates: "Sealed today ✦", "Caught one today ✦".
- Banned strings hold (`05c §9`): no `streak`, no `missed`, no `don't lose`, no `X in a row`, no red. Run final strings through `conversion-psychology` + `humanizer` at implementation.

---

## 3. Components & structure

Refactor the three Today siblings into one composed card. Keep the engine/store layers untouched.

- **`TodayLedgerCard`** (new, `src/components/honeycomb/` or `src/features/today/`) — composes:
  - the existing **HUD top** (bee coin + tier + honey bar + chevron) — lift the current `TodayHud` body into this, or have `TodayLedgerCard` wrap `TodayHud` and add the footer.
  - a **hairline footer** rendering `ReclaimTodayLine` (left, inline stat form) + the **ritual seal** (right). Footer is omitted entirely when both are absent (see §4).
- **`RitualSeal`** (new) — the seal glyph + label + tap target. Owns the one-shot animation (Reanimated shared values, `react-native-svg`), the resting breath, and the reduced-motion guard. Props: `done: boolean`, `onLog: () => void`. Fires the animation when `done` transitions false→true (or on press, mirroring `useReward` ownership of "did this diverge" decisions — the screen/store decides `done`).
- **Retire** the standalone `ReclaimTodayLine` placement and `DailyRitualLine` from `index.tsx`; their gating logic (reclaim `> 0`, `dailyRitualEnabled`, `doneToday = done.length > 0`) moves into `TodayLedgerCard`. `DailyRitualLine` may be deleted or reduced to the a11y/first-run copy holder.

**Layer rules:** all new files live in `src/components/**` / `src/features/today/**` and must not import `services`/`db` directly (route through the existing `useToday` hook + stores). Keep `src/app/(tabs)/index.tsx` thin — it just renders `TodayLedgerCard` with values from `useToday`.

---

## 4. Presence states (footer degrades cleanly)

Driven by `reclaimToday > 0` and `dailyRitualEnabled` (+ `doneToday`):

| reclaim | ritual | Footer |
|---|---|---|
| > 0 | on | **both** — reclaim left, seal right (hairline divider) |
| > 0 | off | reclaim only (left-aligned, `solo`) |
| 0 | on | ritual only (left-aligned, `solo`) |
| 0 | off | **no footer** — card is just the HUD top, no divider |
| > 0 | on, done | reclaim + **sealed-resting** seal ("Today's honey set ✦"), no animation |

All five rendered in `bee-ritual-final.html`, light + dark. Sealed-resting = final state with `transition:none` (no replay on remount/scroll).

---

## 5. Tokens

All values from `src/theme/tokens.ts` via `useTheme()` (project hard rule). Additions needed:

- **Seal art colors** (fixed, mode-independent — like `brand.bee`): reuse `brand.bee.body` (`#5F4EE4`) for the seal border + `✦`, `brand.bee.wing` (`#FCE7C5`) for the surface edge. Add **`brand.honeyFill: '#F5C03F'`** (the lit yellow fill) — brighter than `accent`/`brand.bee.stripe`, distinct from the indigo body. Confirm the exact yellow on device.
- **Motion timings** — add a `motion.seal` group (or individual keys) for `border 660`, `honey 580`, `bloom 900`, `mark 360`, `spark 620` + the delays above, plus reuse `motion.easing` (`standard`, `honey`) / add the premium `(.4,0,.2,1)` if not present. Remember: a new `tokens.ts` group needs a matching line in `useTheme` `resolveTheme` ([[usetheme-token-enumeration]]).
- **Reclaim text:** `colors.amberText` already mode-correct (`#8A5A12` light AA / `#EEAE4D` dark).
- Geometry (glyph box 24, hex path, sliver size) lives in the component or a small `tokens.seal` group, not inline magic numbers.

---

## 6. Invariants & compliance

- **No streak / no loss / no guilt.** Resting seal is a warm invitation; resets invisibly at next local day; no count, no history, no "missed". ✓ (`05-RETENTION §1.3.3`)
- **Amber-never-red.** Honey yellow + indigo only; no red anywhere. ✓
- **Monotonic honey untouched.** HUD content unchanged; this is presentation only. ✓
- **Gain-only pull.** Wanting comes from Zeigarnik tension + the reclaim payoff, not loss aversion. ✓
- **On-device-only loop.** No network. ✓
- **RN gotchas:** no CSS `boxShadow` (use the View-edge/`Platform.select` pattern for the light coin shadow); `Pressable` stays a bare touch wrapper with visual style on an inner `View` (reactCompiler/nativewind gotcha); read/write Reanimated shared values via `.get()/.set()`; footer never pinned to screen bottom (no safe-area concern here, it's mid-scroll).

---

## 7. Analytics

Reuse existing events; no new data class. The ritual is the existing daily-ritual concept (no streak counter). If a `ritual_logged` / `daily_ritual_*` event exists, keep it; otherwise no new event is required for MVP. Reclaim deposit already fires `reclaim_deposit` (`05c §11`). Do **not** add any streak/day-count property.

---

## 8. Out of scope / open

- **Out:** the Whenbee-hub reclaim hero + Discoveries gallery (separate surfaces); engine/`reclaimDividendMinutes` math (unchanged); widget/Live Activity presence.
- **Open (decide at build):** final copy strings (copy pass + humanizer); exact `brand.honeyFill` yellow on device; whether `RitualSeal`'s tap logs directly (retro sheet) or just marks done; haptic on seal (light impact, matches reward choreography) — recommend yes, guarded.

---

## 9. Acceptance

- The three Today pieces render as **one** ledger card matching `bee-ritual-final.html` in both themes.
- Sealing plays the locked choreography (border → honey → bloom → ✦ → radial sparkle) and banks reclaim in the same moment; reduced-motion snaps to final.
- All five presence states render correctly; footer disappears when empty.
- Zero hardcoded colors/sizes (all tokens); lint + typecheck + tests pass; no banned copy strings.
