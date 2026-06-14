# Analytics — PostHog Instrumentation Guide

Handoff doc for building PostHog insights, funnels, and retention cohorts.
All instrumentation is in `src/services/analytics.ts` (typed contract) and
`src/providers/AnalyticsProvider.tsx` (lifecycle sink).

---

## Distinct ID (stable, anonymous)

PostHog generates a UUID on first init and persists it via AsyncStorage
automatically. No PII is collected. The ID is stable across app updates and
relaunches. Nothing in the codebase resets it.

---

## Event Catalogue

### Lifecycle

| Event | When fired | Key props | Once-only? |
|---|---|---|---|
| `app_installed` | First launch ever | — | Yes (kv-gated) |
| `app_open` | Every launch | — | No |
| `onboarding_completed` | User taps Done in onboarding | `categories_picked: number`, `custom_category_added: boolean` | No (fires once naturally) |

### Core Loop

| Event | When fired | Key props |
|---|---|---|
| `task_started` | Timer opened | `category`, `guess_min`, `source` (`today`/`fab`/`addtask`/`timed`/`retro`) |
| `task_logged` | A log completes | `category`, `guess_min`, `actual_min`, `ratio`, `entry_type`, `sharpness_after`, `tier_after` |
| `first_log` | User's very first `task_logged` | `time_since_install_sec` |
| `honey_ripened` | Each `applyLog` call | `sharpness_before`, `sharpness_after`, `delta` |
| `tier_up` | Tier index increased | `from_tier`, `to_tier` |
| `aha_shown` | Insight/discovery card surfaced | `category`, `multiplier`, `n` |

### Reclaim

| Event | When fired | Key props |
|---|---|---|
| `reclaim_deposit` | Counted log banks ≥1m | `minutes`, `category`, `source` |
| `reclaim_total_view` | Reclaim hub card viewed | `lifetime_minutes` |

### Decision-Moment Surfacing

| Event | When fired | Key props |
|---|---|---|
| `honest_suggestion_shown` | Honest number rendered at a decision point | `category`, `guess_min`, `suggested_min` |
| `optimistic_nudge_shown` | Pre-commit nudge fired | `category`, `guess_min`, `multiplier` |

### Overrun Reason Chips

| Event | Key props |
|---|---|
| `overrun_reason_shown` | `category`, `direction` (`over`/`under`) |
| `overrun_reason_tagged` | `category`, `direction`, `reason`, `source` (`manual`/`auto`/`custom`) |
| `overrun_reason_skipped` | `category`, `direction` |

### Start-By Planner

| Event | Key props |
|---|---|
| `plan_built` | `n_tasks`, `status` (`fits`/`over`), `freed_min` |
| `plan_cut_one` | same |
| `plan_reprojected` | same |

### Monetization

| Event | Key props |
|---|---|
| `paywall_view` | `trigger` (`make_day_honest`/`settings_upgrade`) |
| `plan_selected` | `plan` (`yearly`/`lifetime`/`monthly`) |
| `trial_started` | `plan`, `price`, `result` |
| `purchase` | `plan`, `price`, `result` |
| `restore_purchases` | `plan?`, `price?`, `result` |

### Native Presence

| Event | Key props |
|---|---|
| `widget_added` | `surface` (`home`/`lock`/`live_activity`) |
| `widget_engaged` | `surface` |

### Calendar

| Event | Key props |
|---|---|
| `calendar_padded` | `events_count`, `day_end_shift_min` |
| `reminder_enabled` | — |
| `reminder_disabled` | — |

---

## Funnel to Build in PostHog

Create a **Funnel insight** with these steps in order:

```
app_open
  → onboarding_completed
  → first_log
  → aha_shown
  → paywall_view
  → trial_started   (or purchase)
```

**Configuration:**
- Conversion window: 14 days (to catch delayed aha moments)
- Ordered: Yes (strict order)
- Entry event: `app_open`

The `first_log` step is the activation gate. ~40–50% of conversions happen
Day 0 — the first-session aha is make-or-break (see `06-RELEASE-AND-METRICS §1`).

---

## Retention Cohort — D1 / D7 / D30

**Goal:** Measure whether users who log tasks come back.

**Create a Retention insight:**
- Cohort entry event: `first_log` (not `app_open` — returning without logging is not retention)
- Retention event: `app_open` (or `task_logged` for stricter engagement)
- Breakdown by: none for overall; optionally by `tier_after` from `task_logged`
- Target: D7 ≥ 25% (make-or-break KPI per §3)

**Suggested saved cohorts:**
1. `Activated` — users who fired `first_log` within 24h of `app_installed`
2. `Aha-reached` — users who fired `aha_shown` at least once
3. `Reclaim-viewers` — users who fired `reclaim_total_view` at least once

---

## Reclaim Hypothesis

Test whether Reclaim-hub viewers show higher D7/D30 retention.

**Create a Breakdown insight:**
- Event: `app_open` (or any activity metric)
- Breakdown: Whether user previously fired `reclaim_total_view`
- Compare retention curves between the two groups

**Threshold to test:** users with `reclaim_deposit` `minutes` sum ≥ 60 in
Week 1 vs. users below that threshold — does the tangible payoff drive return?

---

## Key Metrics Dashboard — Recommended Panels

| Panel | Type | Event / config |
|---|---|---|
| DAU / WAU | Trend | `app_open` — unique users |
| Activation rate | Trend | `first_log` unique / `app_installed` unique |
| First-log time | Distribution | `first_log.time_since_install_sec` |
| Aha rate | Trend | `aha_shown` unique users / `first_log` unique |
| Paywall conversion | Funnel | `paywall_view → trial_started` |
| D1 / D7 / D30 retention | Retention | Entry: `first_log` |
| Reclaim hypothesis | Breakdown | `reclaim_total_view` vs. not |
| Tier progression | Trend | `tier_up` by `to_tier` |
| Widget add rate | Trend | `widget_added` unique users |

---

## Source Files

- `src/services/analytics.ts` — typed event contract (`AppEventProps`)
- `src/providers/AnalyticsProvider.tsx` — sink wiring + lifecycle events
- `src/lib/install.ts` — install timestamp + once-only flag helpers
- `src/services/__tests__/analytics.funnel.test.ts` — funnel sequence tests
