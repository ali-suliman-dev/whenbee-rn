# 01 — Feature Catalog (Final Product)

*The complete feature set for the finished product, grouped by area. Each row carries a build state: ✅ built · ◐ partial · ○ not built (deferred/future). "Free/Pro" marks the Model-B gate. This is the full surface — not an MVP cut.*

The free product is the **entire calibration experience**. Pro gates only the payoff bundle (see §D): PDF export, the review ritual, day-capacity check, confidence band, persistent presence, routines, long-range history, the focus/hyperfocus tools, goals, and the existing correlations + on-device sharing. **No calendar feature.**

---

## A. Core loop — capture & timing

| Feature | State | Tier |
|---|---|---|
| Timer-as-log (Start → live ring → "Stop & log"; the timer *is* the log) | ✅ | Free |
| Live timer ring (count-up, comet sweep, breathing, "you guessed N" reference) | ✅ | Free |
| Kind pace line ("on track · breathe") | ✅ | Free |
| Over-guess state = amber, never red ("+N over — that's ok, now we know") | ✅ | Free |
| Cancel timer, no penalty | ✅ | Free |
| Retroactive entry (half-weight) for untimed tasks | ✅ | Free |
| Rough-time chips (15/30/45/1h/custom) + gut-guess capture | ✅ | Free |
| FAB add-task on Today; "Finished something?" inline log chip | ✅ | Free |
| Add-to-today vs Add-&-start | ✅ | Free |
| Timer **pause/resume** (counts active time only) | ◐ | Free | *Store-complete; no timer-screen UI yet (`useTimer.ts:159`). See gap analysis.* |
| Over/under-run reason chips (one-tap, optional, model-isolated → `log_tags`) | ✅ | Free | *Currently on the Reward screen, not the timer.* |
| Auto-detected reason pre-fill (pause→interrupted, late-start→started late) | ◐ | Free | *Reason capture built; auto-prefill heuristics partial.* |

## A′. Finish-time anchoring & brain breathers

| Feature | State | Tier |
|---|---|---|
| Finish-Time ring on live timer (`Started 9:14` · `Done ~9:42`, amber re-projection) | ✅ | Free |
| `Done ~9:42` at the decision moment (Today focus card + add-task) | ✅ | Free |
| Dual readout + `timeDisplayMode` (`~14 min left · done ~9:42`) | ✅ | Free |
| Adaptive / learned-focus-span breather, hyperfocus gentle check | ○ | Free | *Future.* |

## B. Calibration & insights (engine surfaced)

| Feature | State | Tier |
|---|---|---|
| Personal per-category multiplier `M` (EWMA of ln-ratios blended with prior) | ✅ | Free |
| Day-1 population priors (10 seed categories + global fallback) | ✅ | Free |
| Honest number `round5(guess × M)` at the decision moment | ✅ | Free |
| Provenance ("based on last N times" / "typical patterns", n<3 boundary) | ✅ | Free |
| "Optimistic again" pre-commit nudge | ✅ | Free |
| Aha / discovery card (`n≥5 ∧ |M−1|≥0.4 ∧ variance shrinking`) | ✅ | Free |
| Ratio clamp (`clamp(actual/estimate, 1/6, 6)`) | ✅ | Free |
| Calibration trend chart (rolling M, 30d) + rule-based caption | ✅ | Free |
| Recent tasks list (est vs actual bars + ratio) | ✅ | Free |
| Adaptation tuning (Steady / Balanced / Reactive α presets) | ✅ | Free |
| Per-category reset | ✅ | Free |
| Recurring-task multiplier memory (≥3 own logs → own M) | ✅ | Free |
| Calibration confidence axis (Raw / Setting / Honest; honest-range) | ✅ | Free | *Engine present (`confidence.ts`); "earned-readiness" UI narrative partial.* |
| Reason-aware honest number (note from correlation data) | ◐ | Pro | *Correlation read built; prescriptive note partial.* |

## C. The Honeycomb + Whenbee companion

| Feature | State | Tier |
|---|---|---|
| Honey % (engine `sharpness`) + five tiers `[0,40,64,82,93]` (Raw→…→Honest) | ✅ | Free |
| Monotonic — no decay, no streak (`max(prev,new)`) | ✅ | Free |
| Honeycomb SVG instrument (hex cell per category, amber fill) | ✅ | Free |
| Reward moment (+1 nectar → cell fill → count-up → honey bar) + cap/bloom celebration | ✅ | Free |
| Goal-gradient "X logs to next" + level trail + biggest-blind-spot card | ✅ | Free |
| "Honeycomb sealed ✦" hold state at Honest | ✅ | Free |
| Gentle daily ritual (opt-in, no streak) | ✅ | Free |
| Whenbee 6-stage capability-bearing companion (stages 1–5 = tiers, stage 6 = Keeper) | ✅ | Free |
| Capability unlocks per stage (finish-time → done-time → start-by → full-day forecast → drift-recal → keeper) | ✅ | Free |
| 3-layer fuel (Effort floor · Mastery body capping at Honest · oscillating Drift-health) | ✅ | Free |
| Procedural-unique + user-named Whenbee (default ships; naming optional) | ✅ | Free |
| Earned-reveal personalization after first ripen; cosmetics; life-drift recal UI | ◐/○ | Free | *Drift-recheck card built; deeper personalization/cosmetics future.* |

## Reclaim & Discoveries

| Feature | State | Tier |
|---|---|---|
| **Reclaim Bank** — lifetime monotonic "minutes the honest number spared you" (`reclaimDividendMinutes`); hero card + Today line + (evening) widget state | ✅ | Free |
| **Discoveries gallery** — banking aha cards into a growing collection (dedup by category + M-gap) | ✅ | Free |
| Spendable Reclaim economy / badges / social comparison | ○ (banned/deferred) | — |

## D. Pro — the payoff bundle (calendar dropped 2026-06-19)

> The calendar / Honest-Day feature is **removed** from the product (decision 2026-06-19). Pro is now a bundle of compounding, validated payoff value. **Full specs: [`specs/`](specs/).**

| Feature | State | Tier | Spec |
|---|---|---|---|
| Clinician/coach/self **PDF report export** | ○ to build | **Pro** | [specs/01](specs/01-pdf-report-export.md) |
| **Honest Week / month** review ritual (cadenced) | ○ to build | **Pro** | [specs/02](specs/02-review-ritual.md) |
| **Honest range / confidence band** (narrows over time) | ○ to build | **Pro** | [specs/03](specs/03-confidence-band.md) |
| **Day-capacity / over-commitment check** (in-app, no calendar) | ○ to build | **Pro** | [specs/04](specs/04-day-capacity-check.md) |
| **Persistent presence** (widget + Live Activity) | ◐ scaffolded | **Pro** | [specs/05](specs/05-persistent-presence.md) |
| **Routines** with a learned honest total | ○ to build | **Pro** | [specs/06](specs/06-routines.md) |
| **Long-range history** & report archive | ○ to build | **Pro** | [specs/07](specs/07-long-range-history.md) |
| **Hyperfocus guardrail** (soft overrun nudge) | ○ to build | **Pro** | [specs/08](specs/08-hyperfocus-guardrail.md) |
| **Focus-window planner** (energy/med window) | ○ to build | **Pro** | [specs/09](specs/09-focus-window-planner.md) |
| **Per-category goals / experiments** | ○ to build | **Pro** | [specs/10](specs/10-per-category-goals.md) |
| Existing Pro correlations (steals-your-time, accuracy, context) | ✅ | **Pro** | folds into review ritual |

## D′. Reverse Day Planner — "Start-By Plan"

| Feature | State | Tier |
|---|---|---|
| Backward pass + start-by headline + timeline | ✅ | Free |
| "Cut one" feasibility verdict (ranked one-tap cuts, multi-cut, push-deadline) | ✅ | Free |
| Persist + render active plan; one-tap "I'm behind" re-projection | ✅ | Free |
| Duration pre-fill (always editable) + auto-buffer chips (Off/+5/+10/+20) | ✅ | Free |
| Variability "safe / if-it-goes-well" range pair | ○ | Free | *Net-new — we have the data, don't surface it. See research insights.* |
| On-device NL task entry (Apple Foundation Models) | ○ | Future | *No LLM in the time math, ever.* |

## E. Settings & account-less management

| Feature | State | Tier |
|---|---|---|
| Categories management (add/rename custom) | ✅ | Free |
| Gentle reminders toggle (off by default) | ✅ | Free |
| Privacy panel ("all data on-device") | ✅ | Free |
| Upgrade-to-Pro row + Pro card | ✅ | Free |
| Restore purchases + Manage Subscription (Apple-required) | ✅ | Free |
| Data reset (wipe all) | ✅ | Free |
| In-app feedback board (Supabase, anonymous-default, separate data class) | ○ | Free | *Deferred — needs Supabase. Build before TestFlight.* |
| Tip jar ("Support development") | ○ | Free (future) |

## F. Onboarding

| Feature | State |
|---|---|
| 3-step flow (welcome / category pick 3–5 / ready), "time optimist" reframe, on-device + no-guilt promises, no account, mastery preview | ✅ |

## G. Cross-cutting

| Feature | State |
|---|---|
| Custom categories everywhere; amber-never-red; no-guilt empty states; haptics; Reduce Motion; Dynamic Type; toasts; dark mode | ✅ |
| Tab nav (Today · Plan · Whenbee · Patterns; Settings via gear) | ✅ |
| PostHog funnel (install→first_log→aha→tier_up→paywall→purchase) | ✅ |
| Widget / Lock Screen / Live Activity finish-time ring | ◐ (scaffolded, native module unlinked) |
| Opt-in finish-time notifications; cloud sync / Android / Apple Watch | ○ (future) |

## I. Patterns / self-insight ("Mirror")

| Feature | State | Tier |
|---|---|---|
| Time Personality / Archetype | ✅ | Free |
| With-vs-Without-Plan Audit | ✅ | Free |
| You vs Past-You | ✅ | Free |
| Biggest Surprise This Week · Prediction Cards · "What changed?" drift alert · Category Calibration Map | ✅ | Free |
| **Accuracy correlations** ("when you're sharpest") | ✅ | **Pro** |
| **"What steals your time"** reason correlations + weekly card | ✅ | **Pro** |
| Optional context tags → correlations | ✅ | **Pro** |
| AI Reflection Coach (LLM) | ○ | Future | *Only ever proposes tasks/categories, never computes times.* |

## Partner layer — "Whenbee for Two" (entire layer is future, gated on D7 retention)

| Phase | Feature | Tier |
|---|---|---|
| P0 | Pairing + encrypted presence beacon (Supabase, revocable) | infra |
| P1 | Shared Honest Card (static Free / live Paid) | Free + Pro |
| P2 | Nudge-not-nag (pre-canned, rate-limited) | Free |
| P3 | Leave-by honestly (shared event, reuses Start-By) | Pro |
| P4 | Body-double "Focus together" (synced rings) | Pro |
| P5 | Coach / buddy mode (read-only weekly accuracy) | Pro |

> Only a minimal encrypted beacon ever crosses the wire (task title, honest finish, status). Logs, multipliers, sharpness, location **never** leave the device.
