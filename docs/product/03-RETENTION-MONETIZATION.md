# 03 — Retention & Monetization

*The locked model. Sources: `build-plan-final/` 05-RETENTION, 05b-HONEY, 05c-RECLAIM, 06-MONETIZATION, 08-PARTNER, plus `important-docs/Monetization.md`.*

---

## Part 1 — Monetization (Model B, LOCKED 2026-06-15)

> **The thesis:** Calibration is 100% free — every category, full depth. **Pro gates only the payoff: Honest-Day calendar padding + "what steals your time" correlations + on-device share.** Charge for the payoff, never the sensor.

### Why free calibration
The make-or-break metric is **D7 ≥ 25% on an unproven audience**. Calibration *is* the retention engine and the proof-of-value, so it must be free — no category cap, no insight-depth gate. Honest-Day is the cleanest single reason to pay. On-device, no backend, no LLM → marginal cost ≈ $0, gross margin ≈ 85%; **pricing is positioning, not cost-recovery.**

### Pricing — LOCKED
| Tier | Price | Notes |
|---|---|---|
| Free | $0 | The entire calibration product; the no-card "try before you buy". |
| Monthly | **$4.99/mo** | 7-day trial. Anchor, not the target. |
| Yearly | **$34.99/yr** | **Hero**, "Save 42%", 7-day trial (≈ $2.92/mo). |
| Lifetime | **$89 one-time** | "Pay once. No subscriptions, ever." Non-consumable. Cap at ≤25% of revenue mix. |
| Founder | **$49** | A *reservation, not a charge* — struck against $89 in the pre-readiness reserve flow. |

- **Picker order:** Yearly (hero) → Lifetime → Monthly (mini), mapped by RevenueCat **package type**, not array order.
- **Trial:** 7-day on both subscription SKUs (chosen over 3-day: 39.8% vs 55.4% Day-0 cancel). Lifetime can't carry a trial; the free tier is its trial.
- **Prices read from `package.product.priceString`** (localized) — never hardcoded.

### Free vs Pro
- **Free:** full logging + retro; Honeycomb/honey/Whenbee hub; honest-number for all categories; full calibration insight per category (aha + trend + recent + tune + reset); Discoveries gallery; the whole Patterns free tier (archetype, plan-vs-wing, you-vs-past, surprise, prediction, drift, calibration map); Start-By planner; recurring memory; the native widget + Live Activity.
- **Pro (entitlement `pro`):** Honest-Day calendar import + auto-padding + capacity warning; "what steals your time" correlations + reason-aware note; accuracy/context correlations; on-device share (Start-By plan + archetype cards).

### Paywall triggers
- **Primary:** `make_day_honest` — "Make my whole day honest" CTA.
- **Secondary:** `steals_your_time` — locked Patterns teaser.
- **Tertiary:** `settings_upgrade` — Settings Pro card.
- **Never:** install, onboarding, first session, during a timer, after a log, or on any calibration insight. **There is no `insight_locked` gate** — that model is retired.

The three-aha map: AHA#1 "it knows me" (day-1 priors) = no paywall; AHA#2 "this is why my days collapse" (multiplier divergence) = **free, banks to Discoveries**; AHA#3 calendar import = the primary paywall.

### RevenueCat discipline
Single entitlement `pro` on all three products (`wb_pro_monthly/yearly/lifetime`); gate on the **entitlement**, never the product id. One `default` offering, custom RN paywall (not the dashboard template). `EntitlementProvider` + `useEntitlement()` + `<ProGate>`; components never call `Purchases` directly. **MMKV/cache is a render hint only** — the RC server record (backed by the Apple receipt) is the authority; survives reinstall via `getCustomerInfo()`. Restore + Manage Subscription always visible (Apple-required).

### No-trap discipline (a brand promise to a subscription-burned audience)
The genuinely-useful free tier *is* the real zero-risk trial. Honest pre-charge copy is mandatory ("Free for 7 days — we'll remind you before anything is charged. Cancel in two taps."). Never monetize forgetfulness. Lifetime is featured equally with the hero (ADHD subscription-aversion is real).

---

## Part 2 — Retention model

> **The rule every mechanic must pass:** (1) intrinsic, not bribed; (2) loss-proof — if it can ever produce a loss/guilt/"you failed" state, it is banned.

### Honey / sharpness
- Honey = the engine's `sharpness` (0–100, per category) — **derived, never an awarded score**; cached for instant paint, always rederivable, never persisted as truth.
- **Five tiers, fixed thresholds `[0,40,64,82,93]`:** Raw → Setting → Ripening → Thickening → **Honest** (≥93 = sealed).
- Honey is **not** the multiplier `M`. `M` is what we plan with; honey is the confidence/ripeness skin.
- **Monotonic, non-negotiable:** `displayed = max(prev, new)`. No decay, no "slipped back," no red, no guilt. At Honest the cell **seals** (wax cap) and holds — explicit completion, no infinite treadmill.

### The core loop (Hook model)
Trigger → Action → Variable Reward → Investment, all from **one behavior: logging a task**. Reward beats: `+1 nectar` → cell fills amber → warm non-evaluative headline → "now we both know" framing → honey bar animates → conditional cap/bloom confetti (only on tier-up to Honest) → two off-ramps, never a "keep going" trap. **Variability is informational** (which category moved, did an aha qualify, did a tier tick) — all true facts from deterministic thresholds. No randomized schedule, no jackpot, no token economy.

### Whenbee companion (avatar of mastery, never a pet)
- **Six stages:** 1–5 map to the five tiers (`companion.maxTier`, monotonic); stage 6 = **Keeper**, a set-once prestige once enough cells reach Honest.
- **Growth = capability, not cosmetics** — each tier unlocks real planning power (finish-time → `Done ~9:42` → start-by anchor → full Honest-Day forecast → proactive drift recalibration).
- **3-layer fuel (why guilt is structurally impossible):**
  - **Effort floor** — every log = +1 nectar; never-decreasing. Achievable by anyone, even with wild estimates → never stuck.
  - **Mastery body** — monotonic honey, caps at Honest, never decays.
  - **Drift-health (keystone)** — responds to recent timings vs baseline; **oscillates, never caps, re-earnable, guilt-proof.** Positive-valence "curious/alert" when drift rises ("something shifted — re-check?"). The living post-Honest expression that solves graduation churn.
  - Absence freezes layers 1–2 (frozen ≠ lost), leaves layer 3. **No fuel can drain.**
- Procedurally-unique + optional one-word user name (default "Whenbee"). **No companion-setup screen in onboarding** (protects Day-0 activation); optional earned reveal after first ripen.

### Reclaim Bank (the compounding number)
The user is paid in the resource a time-app uniquely produces — **time**. A lifetime bank, denominated in minutes of misjudgment the honest number spared you:
```
guessError  = |actual − estimate|
honestError = |actual − honestShown|
dividend    = max(0, round(guessError − honestError))   // ≥ 0 by construction → only rises
```
Honest by construction (measured from realized `actual`, not a hypothetical), monotonic, fair both directions (rewards under-estimator *and* over-reserver), gaming-resistant. Surfaces: hub hero card, Today inline line, evening widget state. **Zero deposits are never rendered** — silence, never a soft failure. Kept **non-spendable** (pure trophy); a spendable economy stays deferred to avoid overjustification crowding out intrinsic motivation.

### Discoveries (variable-ratio self-knowledge)
On each first-time `detectInsight(...)` for a category, append a `discovery` and grow the gallery ("7 things you've learned about your time"). A genuine variable-ratio schedule, but the payload is real self-knowledge, not a loot drop. Re-fires only if `M` moved ≥ 0.4 (a genuinely new truth). Cards never expire, lock, or grey out.

### The three-organ design (the answer to graduation churn)
One product, three independent organs, one companion face:
- **🗓 Planner** — daily utility → the *habitual* return reason.
- **🪞 Mirror** (Patterns) — compounding self-insight → the *curiosity* return reason.
- **🐕 Watchdog** — drift detection ("mornings ran 2× long this month — re-check?") → the *zero-effort* return reason; pulls lapsed users back.

Why three: **resilience.** Missing the daily ritual no longer severs retention; any organ can pull a user back. The headline KPI is **resurrection rate** (lapsed 7+ days → Watchdog nudge → return).

### Banned mechanics (outright)
XP/points/levels/currency; streaks & streak-shaming; leaderboards/social ranking; any loss-framing (HP loss, dying pet, "you failed"); any decaying progress; pet neglect/hunger/sickness; FOMO events; guilt win-back copy.

### Notifications
**Default OFF, opt-in only.** Event/anchor-based, never time-based guilt; never reference a missed day; frequency-capped; every notification hands immediate value or doesn't fire. **The widget is the silent re-engagement channel; push stays off.**

### KPI targets
D1 > 25% / D7 toward 25%+ / D30 > 8% (beating productivity benchmarks of 15–20% / 8–10% / 3–5%). PostHog funnel: `install → first_log → aha → cell_capped → paywall_view → purchase`. **Do not optimize time-in-app or session length** — getting on time in real life is the goal.
