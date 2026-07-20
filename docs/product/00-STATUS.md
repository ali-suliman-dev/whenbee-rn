# 00 — Implementation Status

*Snapshot: 2026-06-18. Verdicts are from an audit of `src/` against the final build plan. This is the "are we actually done?" page.*

## Headline

**Whenbee is code-complete on the v1 feature set.** Of the 14 product areas below, **11 are fully IMPLEMENTED**, 2 are PARTIAL (timer pause UI, native presence), and 1 is correctly ABSENT (feedback board, deferred by plan). The remaining work is finishing-touches, device verification, and launch — not feature construction.

## Build health

| Check | State | Note |
|---|---|---|
| `npm run lint` | ✅ PASS | `eslint . --max-warnings=0` → 0 errors/warnings. |
| `npm run typecheck` | ❌ **FAIL** | 2 errors, one root cause — see Blocker #1 in [02-GAP-ANALYSIS](02-GAP-ANALYSIS.md). CI is currently red. |
| `npm test` | ✅ (assumed) | 102 test files across engine/db/stores/services/features; suite is extensive. Not re-run in this audit. |

**Installed native deps confirmed:** `react-native-purchases@^10.3.0`, `posthog-react-native@^4.46.32`, `expo-sqlite@~16.0.10`, `expo-calendar@~15.0.8`, `expo-notifications@~0.32.17`, `react-native-reanimated@~4.1.0`, `react-native-svg`, `react-native-view-shot`, `zustand@^5`, `@bacons/apple-targets` (widget/Live Activity), `@expo/ui`, `expo-glass-effect`. **No Drizzle** (hand-rolled SQL migrations + repos). **No `@supabase/supabase-js`** (feedback board deferred, as planned).

## Per-area verdicts

| # | Area | Verdict | Evidence |
|---|---|---|---|
| 1 | Capture + one-tap timer (start/stop/cancel, retro, reason chips) | **PARTIAL** | `timerStore.ts` supports start/pause/resume/stop/cancel + kv resume; **timer screen has no pause/resume UI** (`useTimer.ts:159`). Retro present (`retro.tsx`). Reason chips live on the **Reward** screen (`reward/ReasonChips.tsx`), not the timer. |
| 2 | Calibration engine (M, priors, honest #, clamp, EWMA, tiers, aha, trend, adapt-speed, reset) | **IMPLEMENTED** | All of `src/engine/` — `multiplier.ts`, `priors.ts`, `ratio.ts`, `ewma.ts`, `sharpness.ts`, `insight.ts`, `trend.ts`, `confidence.ts`, `update.ts`. Pure, heavily tested. |
| 3 | Honest number + finish-time anchoring ("Done ~9:42", finish ring) | **IMPLEMENTED** | `today/FocusCard.tsx`, `timer/TimerRing.tsx` + `FinishTime.tsx`, `shared/HonestSuggestionCard.tsx`, `OptimismNudge`. |
| 4 | Honeycomb + Whenbee (tiers, hex instrument, reward choreography, 6 stages, capability unlocks, drift-health) | **IMPLEMENTED** | `components/honeycomb/*`, `engine/companion.ts` (`companionStageFor`, `capabilityFor`, drift-health), `features/reward/*`, `features/whenbee/*`. |
| 5 | Reclaim Bank + Discoveries gallery | **IMPLEMENTED** | `engine/reclaim.ts`, monotonic persistence; `discoveries` table (migration 0004), `discoveriesRepo.ts`, gallery modal + hub. **Note: CLAUDE.md still lists Discoveries as "deferred" — it is built.** |
| 6 | Start-By / reverse day planner | **IMPLEMENTED** | `engine/planner.ts` (backward pass, cut-one/multi-cut/push verdict ladder, buffer chips), `app/(tabs)/plan.tsx`, `features/planner/*`, Start-By notification. |
| 7 | ~~Honest-Day calendar padding (Pro)~~ — **DROPPED 2026-06-19** | **REMOVING** | Feature cut from the product. Code still on disk (`features/calendar/*`, `services/calendar.ts`, `honest-day.tsx`) — deletion pending, tracked as B2 in [02-GAP-ANALYSIS](02-GAP-ANALYSIS.md). Replaced by the new Pro bundle in [`specs/`](specs/). |
| 8 | Patterns / self-insight tab | **IMPLEMENTED** | `app/(tabs)/patterns.tsx`: archetype, plan-vs-wing, you-vs-past, surprise, prediction, drift-alert, calibration-map (free). Pro-gated: steals-your-time, accuracy correlations, context correlations. **CLAUDE.md still lists the correlation read as "deferred" — it is built.** |
| 9 | Monetization / paywall / RevenueCat / entitlement | **IMPLEMENTED** | `services/purchases.ts` (real + Expo-Go stub, `pro` entitlement, store prices), `features/paywall/*` (Paywall, PlanPicker, BeforeAfterHero, FounderReserveCard, ProGate, `useEntitlement`). |
| 10 | Onboarding | **IMPLEMENTED** | `app/(onboarding)/*` (welcome, categories, ready), `onboardingStore.ts` (kv-gated, TDZ-safe rehydrate). |
| 11 | Settings (categories, reminders, privacy, restore, manage-sub, data reset) | **IMPLEMENTED** (feedback board ABSENT) | `app/settings.tsx`, `categories.tsx`, `privacy.tsx`, `useAccountActions` (restore + manage-subscription), `useAccountReset`. Feedback board correctly absent. |
| 12 | Widgets / Live Activity / native presence | **PARTIAL** | Swift targets scaffolded (`targets/widget/*`), `services/liveActivity.ts` fully wired — but `WhenbeePresence` native module not linked, so every call is a **stub no-op** until the device build. See `docs/NATIVE-PRESENCE.md`. |
| 13 | Analytics (PostHog funnel) + error tracking | **IMPLEMENTED** | `services/analytics.ts` (typed funnel, fire-and-forget), `providers/AppProviders.tsx` (`PostHogErrorBoundary` + `errorTracking.autocapture`, guarded init). Both no-op safely without env keys. Note: `services/sentry.ts` no longer exists — Sentry was removed; error reporting is PostHog-only. |
| 14 | Notifications | **IMPLEMENTED** | `services/timerNotifications.ts` — local-only "estimate is up" ping + Start-By nudge, lazy native-module probe (Expo-Go/test safe). Honors no-network-in-loop. |

## Discrepancies between CLAUDE.md and reality (to reconcile)

The root `CLAUDE.md` "Deferred / fast-follow" section is **stale** — it describes a smaller MVP than what's built:

1. **Discoveries gallery** — CLAUDE.md says deferred (aha card only). **Reality: fully built** (`discoveries` table, repo, modal, hub gallery + preview).
2. **Pro correlations + context tags** — CLAUDE.md says only capture ships, the read defers. **Reality: the read is built** (`patterns/reasons.ts`, `accuracy.ts`, `context.ts` + Pro-gated surfaces).
3. The **"shipped MVP"** framing throughout CLAUDE.md, `src/app/(tabs)/plan.tsx:27`, and `src/stores/tasksStore.ts:6` should be updated — this is the finished product, not an MVP.

*(These framing fixes are being applied alongside this doc set.)*
