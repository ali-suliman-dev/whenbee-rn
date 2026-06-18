# 05 — Roadmap to Launch

*From code-complete to real users. The original build phases (P0–P6 in `build-plan-final/07-ROADMAP.md`) are essentially done; what follows is the finishing-and-shipping path. Everything is governed by one gate: **D7 ≥ 25%.***

---

## Where we are

The build phases are behind us. The engine, retention spine, monetization, and Pro payoff are all in `src/`. We are at the **"finish, verify, ship"** stage — not "build the product" stage.

## Stage A — Make it green and whole (days)

1. **Fix typecheck** (`HonestNumber` `Size` union) → CI green. *[blocker]*
2. **Timer pause/resume UI** wired to the existing store actions.
3. **Reconcile CLAUDE.md + code comments** (drop "MVP", correct the deferred list).
4. Full `lint` + `typecheck` + `test` pass clean.

## Stage B — Make it real on a device (≈1 week)

5. **Dev build on a real iPhone.** Exercise the Expo-Go-guarded paths end to end:
   - RevenueCat: offerings load with live prices, purchase, **restore**, **manage subscription**, founder-reserve.
   - Honest-Day: calendar read → before/after → **confirmed write** (the one mutation).
   - Notifications: "estimate is up" + Start-By nudge fire.
6. **Link `WhenbeePresence`** and ship the **static home-screen widget** (the "never cut" surface). Live Activity / Dynamic Island = fast-follow if signing/time bites.
7. **Device QA pass** against the no-guilt invariants: amber never red, honey never regresses, no network in the core loop.

## Stage C — Beta loop (≈1 week + soak)

8. **Build the feedback board** (Supabase: `feature_requests`/`feature_votes` + RLS, guarded `services/feedback.ts`, Settings entry) — *before* TestFlight, so the beta has a feedback channel.
9. **TestFlight** to a small ADHD cohort (r/ADHD beta). Watch the funnel, fix what the soak surfaces.

## Stage D — The GO gate (do not skip)

10. **Demand proof:** ≥50 waitlist emails OR ≥5 unprompted "take my money" reactions, with excitement specifically about the **calendar-honesty** angle. (`VALIDATION-ROADMAP.md`.) If this fails, fix the pitch before launching, not the app.

## Stage E — Launch (≈1–2 weeks)

11. **App Store assets:** listing, screenshots (lead with the **Honest-Day before/after**), privacy labels (all on-device — easy), PNG icon (never `.icon`), three IAP SKUs live in App Store Connect + RC.
12. **Funnel + D7 instrumented and verified live** in PostHog (`install → first_log → aha → tier_up → paywall_view → purchase`).
13. **GTM:** Reddit-first, earn-don't-spam — beachhead r/ProductivityApps, empathy r/adhdwomen, reach-only r/ADHD; Product Hunt + creator seeding. Lead with the *calibration concept*. (`LAUNCH-AND-POSTING-PLAN.md`.)

## Stage F — Post-launch (gated on D7 ≥ 25%)

The **D7 ≥ 25% gate authorizes everything below.** Until it's met, hold.

- **Price experiments** (respond to the TimeNinja undercut with data, not a guess).
- **Earned-readiness paywall framing** (Phase 4.5 — messaging only, no entitlement change).
- **Partner layer** ("Whenbee for Two") — the first paid expansion; opt-in encrypted sync, body-doubling, coach mode.
- **Variability band**, shareable archetype polish, no-streak positioning in store copy.
- Possible future: coach/therapist PDF export, on-device LLM reflection coach (never in the time math).

---

## The one number that governs everything

> **D7 retention ≥ 25%.** It's the make-or-break metric and the gate for all paid expansion. The cruel irony — the discipline the product needs (logging) is the disability it treats — is exactly why the no-guilt invariants and the three-organ resilience design exist. Protect them; they are the retention strategy.

## Net-never-cut list (if time pressure hits)

One-tap logging · day-1 priors · honest-number suggestion · calendar padding · no-guilt tone · the static widget. Everything else can defer before these do.
