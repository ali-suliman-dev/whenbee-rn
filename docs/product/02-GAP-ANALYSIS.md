# 02 — Gap Analysis: What's Left to Reach Real Users

*Because the feature set is essentially complete, the gaps are finishing-work, device verification, and launch — not feature-building. Prioritized into three tiers. Each item: what, why it matters, rough effort.*

---

## Tier 0 — Blockers (must fix before anything ships)

### B1. Typecheck is red — `HonestNumber` `Size` union missing `'md'`
- **What:** `src/components/HonestNumber.tsx:25` declares `type Size = 'inline' | 'big' | 'lg' | 'xl'`, but the `sizeScale` record (line 36) defines an `md:` key and `src/features/today/FocusCard.tsx:74` passes `size="md"`. → `tsc` errors TS2353 + TS2322. CI (`npm run typecheck`) is currently failing, which blocks merge per the project gate.
- **Why:** Nothing else can merge while CI is red. This is the single highest-priority item.
- **Fix:** Add `'md'` to the `Size` union (one line). Then re-run `npm run typecheck` (must be clean) and `npx eslint src/components/HonestNumber.tsx src/features/today/FocusCard.tsx`.
- **Effort:** minutes.

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
- **What:** RevenueCat purchase + restore + manage-subscription, the paywall (live prices, founder reserve), the Honest-Day calendar **write**, notifications, and the widget/Live Activity all stub or guard in Expo Go. They must be exercised on a dev build on a real device.
- **Why:** These are the revenue and core-payoff paths. They cannot be trusted until seen working on-device.
- **Effort:** medium — a structured device pass with a checklist; use the `/verify` and `/run` flows.

### P5. Reconcile CLAUDE.md with reality
- **What:** Update the root `CLAUDE.md` "Deferred / fast-follow" section (Discoveries + Pro correlations are built, not deferred) and drop "MVP" framing. Same for `src/app/(tabs)/plan.tsx:27` and `src/stores/tasksStore.ts:6`.
- **Why:** Stale guidance misleads every future session into rebuilding or mis-scoping what already exists.
- **Effort:** small *(being applied with this doc set).*

---

## Tier 2 — Launch & validation (turning "shippable" into "shipped to users")

### L1. The GO gate (do not skip)
The original `VALIDATION-ROADMAP.md` precondition still holds: **≥50 waitlist emails OR ≥5 unprompted "take my money" reactions**, with the excitement specifically about the **calendar-honesty** angle. Validate demand for the payoff before pouring effort into launch.

### L2. App Store readiness
- App Store Connect listing, screenshots (lead with the **Honest-Day before/after** — the most screen-recordable asset), privacy nutrition labels (easy: all on-device), App Review prep, the three IAP SKUs (`wb_pro_monthly`, `wb_pro_yearly`, `wb_pro_lifetime`) + entitlement `pro` wired in RC.
- **App icon caveat:** `app.json` must use the PNG `icon`, never a `.icon` Icon Composer file (fails `actool` on older Xcode).

### L3. Funnel live + retention instrumentation
Confirm PostHog fires the real funnel on device (`install → first_log → aha → tier_up → paywall_view → purchase`) and that **D7 retention** is measurable. **D7 ≥ 25% is the make-or-break gate** that authorizes paid expansion and the partner layer.

### L4. GTM
Reddit-first, earn-don't-spam: beachhead **r/ProductivityApps**, empathy **r/adhdwomen**, reach-only **r/ADHD**. Lead with the **calibration concept**, not the app. Product Hunt + creator seeding. (Full plan: `market-research-2026/LAUNCH-AND-POSTING-PLAN.md`.)

---

## What is NOT a gap (explicitly out of scope for v1)

- **Partner layer** ("Whenbee for Two") — entire layer is post-launch, gated on hitting D7 ≥ 25%.
- **Any LLM feature** — AI coach, NL task entry, LLM weekly prose. Never in the time math.
- **Cloud sync / accounts / Android / Apple Watch.**
- **Spendable Reclaim economy, badges, social comparison** — deferred or banned by invariant.
- **Coach/therapist PDF export, tip jar** — future Pro/support surfaces.

---

## Summary: the critical path to a real v1

1. **Fix typecheck (B1).** ← do first, unblocks CI.
2. **Link the static widget + verify RevenueCat/calendar on device (P1, P4).**
3. **Pause/resume UI + feedback board (P2, P3).**
4. **Reconcile docs (P5).**
5. **Hit the GO gate (L1) → App Store assets (L2) → funnel live (L3) → Reddit/PH launch (L4).**
6. **Watch D7. If ≥25%, greenlight the partner layer and price experiments.**
