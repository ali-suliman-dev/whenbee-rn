# 02 — Gap Analysis: What's Left to Reach Real Users

*Because the feature set is essentially complete, the gaps are finishing-work, device verification, and launch — not feature-building. Prioritized into three tiers. Each item: what, why it matters, rough effort.*

---

## Tier 0 — Blockers (must fix before anything ships)

### B1. Typecheck — `HonestNumber` `Size` union missing `'md'` — ✅ FIXED (2026-06-18)
Added `'md'` to the `Size` union + `honestNumberMd` to the `sizeScale` value type in `src/components/HonestNumber.tsx`. `npm run typecheck` is green again.

### B2. Remove the calendar / Honest-Day feature from code (decision 2026-06-19)
- **What:** Delete the calendar feature end to end and re-point the paywall to the new Pro bundle. Manifest:
  - Delete: `src/features/calendar/buildHonestDay.ts` (+ tests), `src/features/calendar/useHonestDay.ts`, `src/services/calendar.ts` (+ tests), `src/app/(modals)/honest-day.tsx`.
  - Edit: `src/features/whenbee/WhenbeeHub.tsx` (remove `make_day_honest` CTA + honest-day routing), `src/app/settings.tsx` (remove the "Make my whole day honest" row + `openHonestDay`), `src/features/paywall/*` (remove the `make_day_honest` trigger + the calendar before/after `BeforeAfterHero`; replace the paywall hero with the new Pro bundle), `src/services/analytics.ts` (drop calendar/`make_day_honest` events), the `(modals)` route registry.
  - Remove the `expo-calendar` dependency + `app.json` calendar permission strings; re-run `npx expo prebuild --clean`.
- **Why:** Founder dropped calendar entirely; leaving dead, permission-bearing code risks App Review questions and confuses future work.
- **How:** On a branch → PR (per the project's no-self-merge rule). Run lint + typecheck + test after; the paywall must still open against the new Pro bundle.
- **Effort:** Medium (surgical, ~10 files + paywall reframe).

---

## Tier 1 — Pre-launch (needed for a credible v1 on real devices)

### P1. Native presence: link `WhenbeePresence` (widget + Live Activity)
- **What:** Swift targets (`targets/widget/*`) and the JS bridge (`services/liveActivity.ts`) are fully scaffolded, but the native module isn't linked — every call is a no-op. See `docs/NATIVE-PRESENCE.md`.
- **Why:** The plan marks the **static home-screen widget as "never cut"** (it's the silent, no-push re-engagement channel). The Live Activity is the first thing to defer if time is short. Whenbee's whole retention story leans on ambient presence.
- **Decision:** ship the **static widget** for v1; treat the Live Activity / Dynamic Island as fast-follow if signing/time bites.
- **Effort:** medium — requires the device build, App Group write, ActivityKit module, signing.

### P2. Timer pause/resume UI
- **What:** `timerStore.ts` already supports pause/resume/active-time accounting; the timer screen exposes no control (`useTimer.ts:159`).
- **Why:** It's a listed core-loop feature (interrupted tasks are the norm for the audience). Without it, a paused task either over-counts wall-clock or the user cancels and loses the log.
- **Effort:** small — wire a button to the existing store actions; respect amber/no-guilt styling.

### P3. Feedback board (Supabase)
- **What:** Anonymous-default feature-request + vote board. Needs `@supabase/supabase-js`, env keys, `src/services/feedback.ts` (guarded so a network failure never touches the loop), a Settings entry, and `feature_requests`/`feature_votes` tables + **RLS**. Separate data class — never task/calibration data.
- **Why:** The plan builds this **first in the launch phase, before TestFlight**, so the beta has a feedback loop from day one.
- **Effort:** medium — backend + table + RLS + one screen.

### P4. Real-device verification of everything guarded in Expo Go
- **What:** RevenueCat purchase + restore + manage-subscription, the paywall (live prices, founder reserve), notifications, and the widget/Live Activity all stub or guard in Expo Go. They must be exercised on a dev build on a real device.
- **Why:** These are the revenue and core-payoff paths. They cannot be trusted until seen working on-device.
- **Effort:** medium — a structured device pass with a checklist; use the `/verify` and `/run` flows.

### P5. Reconcile CLAUDE.md with reality
- **What:** Update the root `CLAUDE.md` "Deferred / fast-follow" section (Discoveries + Pro correlations are built, not deferred) and drop "MVP" framing. Same for `src/app/(tabs)/plan.tsx:27` and `src/stores/tasksStore.ts:6`.
- **Why:** Stale guidance misleads every future session into rebuilding or mis-scoping what already exists.
- **Effort:** small *(being applied with this doc set).*

---

## Tier 2 — Launch & validation (turning "shippable" into "shipped to users")

### L1. The GO gate (do not skip)
The original `VALIDATION-ROADMAP.md` precondition still holds: **≥50 waitlist emails OR ≥5 unprompted "take my money" reactions**, with the excitement specifically about the **"it learns how long things really take you"** angle. Validate demand for the payoff before pouring effort into launch.

### L2. App Store readiness
- App Store Connect listing, screenshots (lead with the **honest-number reveal + the Pro PDF report / Honest Week**), privacy nutrition labels (easy: all on-device), App Review prep, the three IAP SKUs (`wb_pro_monthly`, `wb_pro_yearly`, `wb_pro_lifetime`) + entitlement `pro` wired in RC.
- **App icon caveat:** `app.json` must use the PNG `icon`, never a `.icon` Icon Composer file (fails `actool` on older Xcode).

### L3. Funnel live + retention instrumentation
Confirm PostHog fires the real funnel on device (`install → first_log → aha → tier_up → paywall_view → purchase`) and that **D7 retention** is measurable. **D7 ≥ 25% is the make-or-break gate** that authorizes paid expansion and the partner layer.

### L4. GTM
Reddit-first, earn-don't-spam: beachhead **r/ProductivityApps**, empathy **r/adhdwomen**, reach-only **r/ADHD**. Lead with the **calibration concept**, not the app. Product Hunt + creator seeding. (Full plan: `market-research-2026/LAUNCH-AND-POSTING-PLAN.md`.)

---

## Resolved: what Pro actually is (calendar DROPPED entirely)

Research ([07-PRO-VALUE-IDEAS](07-PRO-VALUE-IDEAS.md)) resolved the calendar question, and the founder decision (2026-06-19) is to **drop the calendar / Honest-Day feature entirely — no write, no read, no import.** The new Pro = a payoff bundle that's independently validated as paid value — clinician/coach **PDF export**, a cadenced **weekly/monthly review ritual**, an in-app **day-capacity check** (planned tasks vs available hours — no calendar), a narrowing **confidence band**, persistent **widget/Live Activity presence**, **routines with a learned total**, **long-range history**, a **hyperfocus guardrail**, a **focus-window planner**, and **per-category goals**; the existing Pro correlations fold into the review ritual. **Full specs: [`specs/`](specs/).**

**First Pro build (recommended):** PDF export + review ritual + day-capacity check + confidence band — validated, compounding, mostly reuses existing engine output.

**Calendar code removal is a pending task** — see "Tier 0 / Blockers" below.

## What is NOT a gap (explicitly out of scope for v1)

- **Partner layer** ("Whenbee for Two") — entire layer is post-launch, gated on hitting D7 ≥ 25%.
- **Any LLM feature in the core loop** — NL task entry, LLM time math. (An *optional* LLM "Estimate Coach" prose layer over deterministic insight is a possible add-on tier — never in the math.)
- **Cloud sync / accounts / Android.** (Apple Watch is a candidate Pro add-on, not v1.)
- **Spendable Reclaim economy, badges, social comparison** — deferred or banned by invariant.
- **Calendar write-back** — dropped from Pro (read-only import stays). **Tip jar** — future support surface.

---

## Summary: the critical path to a real v1

1. **Remove the calendar feature from code (B2).** ← on a branch/PR.
2. **Build the new Pro bundle** (start with PDF export + review ritual + capacity check + confidence band — see [`specs/`](specs/)).
3. **Link the static widget + verify RevenueCat on device (P1, P4).**
4. **Pause/resume UI + feedback board (P2, P3).**
5. **Reconcile docs (P5).**
6. **Hit the GO gate (L1) → App Store assets (L2) → funnel live (L3) → Reddit/PH launch (L4).**
7. **Watch D7. If ≥25%, greenlight the partner layer and price experiments.**
