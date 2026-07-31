# Whenbee — Product Docs

> **Status: Whenbee is a code-complete v1, not an MVP.** Nearly the entire "final" build plan is implemented in `src/` today — the full calibration engine, the Honeycomb + Whenbee companion (6 stages, capability unlocks, drift-health), the Reclaim Bank, the Discoveries gallery, the Start-By planner, the Patterns self-insight tab (including the Pro correlations), RevenueCat monetization, onboarding, settings, PostHog. What remains is the **new Pro bundle** (see [`specs/`](specs/)), finishing-work, and launch-prep. **The calendar / Honest-Day feature was dropped 2026-06-19** — its code is slated for removal. Treat this product as a near-shippable app, never as a prototype or MVP.

This folder is the single source of truth for **what Whenbee is, what's built, what's left, and how it ships**. It distills the research that lived scattered across `Ideas/04-productivity-adhd/whenbee/` (build-plan-final, market-research-2026, idea/, important-docs/, docs/) into one structure we can actually follow.

## Read in this order

| Doc | What it answers |
|---|---|
| [00-STATUS.md](00-STATUS.md) | What is actually built right now (IMPLEMENTED / PARTIAL / ABSENT per area, with file paths). |
| [01-FEATURE-CATALOG.md](01-FEATURE-CATALOG.md) | The complete final feature set, grouped by area, each tagged with its current build state. |
| [02-GAP-ANALYSIS.md](02-GAP-ANALYSIS.md) | What's missing to put this in front of real users — prioritized into blockers / pre-launch / launch. |
| [03-RETENTION-MONETIZATION.md](03-RETENTION-MONETIZATION.md) | The locked Model-B paywall, pricing, and the retention model (honey, Whenbee, Reclaim, the three-organ design). |
| [04-RESEARCH-INSIGHTS.md](04-RESEARCH-INSIGHTS.md) | The 10x / game-changing ideas, net-new recommendations, and the open founder decisions the research surfaced. |
| [05-ROADMAP-TO-LAUNCH.md](05-ROADMAP-TO-LAUNCH.md) | The path from code-complete to real users, with the retention gate that governs everything. |
| [06-BRAND-VOICE.md](06-BRAND-VOICE.md) | The voice rules and ban-list every user-facing string must pass. |
| [07-PRO-VALUE-IDEAS.md](07-PRO-VALUE-IDEAS.md) | Research-backed Pro features people will actually pay for (3 live research passes), and the resolved Pro definition (calendar dropped). |
| [11-APP-STORE-LAUNCH-BLOCKERS.md](11-APP-STORE-LAUNCH-BLOCKERS.md) | **⛔ Pre-submission gate.** Every App Store rejection/friction risk from the 2026-06-21 reviewer audit, with fix plans + production-ready legal/reviewer copy. **Do not submit until its P0+P1 items are checked off.** |
| [specs/](specs/) | **Build-ready specs** for each new Pro feature (PDF export, review ritual, confidence band, day-capacity, presence, routines, history, hyperfocus guardrail, focus-window, goals). Start at [specs/README.md](specs/README.md). |
| [research/2026-06-19-reclaim-bank-retention-evaluation.md](research/2026-06-19-reclaim-bank-retention-evaluation.md) | Deep-dive: is the Reclaim Bank counter the right retention mechanic? Verdict (keep + reframe, don't delete), the "reclaimed"-word trust risk, and what actually drives stickiness for this app. |
| [research/2026-06-20-calendar-honest-day-reintroduction.md](research/2026-06-20-calendar-honest-day-reintroduction.md) | Reintroducing the dropped calendar / Honest-Day feature. Decisive access answer (native EventKit reads Google too — $0, on-device — vs. Google OAuth), competitor mechanics, Reddit demand, market/WTP, and a read-only opt-in reintroduction that keeps every invariant. |

## The product in one paragraph

Whenbee is a near-zero-friction iOS app for "time optimists" — people (the core audience is ADHD time-blindness) who chronically under-estimate how long things take. You guess a duration, run a one-tap timer, and the app silently learns your **personal per-category bias multiplier**, then shows an **honest number** wherever you plan. Calibration is the wedge and stays 100% free; the paid payoff is a **bundle of compounding value** — clinician/coach PDF export, a cadenced weekly/monthly review ritual, a day-capacity check, a narrowing confidence band, persistent presence, read-only calendar import, and routines (see [07-PRO-VALUE-IDEAS](07-PRO-VALUE-IDEAS.md)). **Calendar *write-back* is dropped; read-only import stays.**

## The invariants that never bend

1. **No guilt, ever.** Amber, never red. No streaks, no shame, no decay. Empty days are fine.
2. **Honey/sharpness is monotonic.** Tier never goes backward (`displayed = max(prev, new)`).
3. **The core loop is on-device-only.** No network call — and no LLM — in guess → timer → learn.
4. **Pricing is read from RevenueCat**, never hardcoded. The `pro` entitlement is the only gate authority.
5. **Calibration is 100% free.** Charge for the payoff layer (export, review ritual, capacity, presence, routines), never the sensor.

## Source provenance

The research lives at `~/Business/income/Ideas/04-productivity-adhd/whenbee/`:
- `build-plan-final/` — the master spec (00-OVERVIEW … 09-BRAND-VOICE, plus `mvp/`).
- `market-research-2026/` — competitor analysis, review mining, the 10x feature research, self-insight retention.
- `idea/03-06-game-changing.md`, `important-docs/Monetization.md` — the highest-leverage strategy notes.
- `docs/RETENTION-REWARD-BANK-BRAINSTORM.md` — the Reclaim/Discoveries origin.
- `.claude/docs/ai/whenbee/10x/session-{1,2,3}.md` — partner-layer origin (S1/S2 → built into `08-PARTNER-LAYER`, gated on D7) and overrun-reasons (S3, largely built). **S1 Part-2 "insight→action" features (smallest-step, if-then, hyperfocus interrupt, transition category, ambient body double) are net-new and unbuilt — see `04-RESEARCH-INSIGHTS`.**

These docs distill that material as of 2026-06-18. When the spec and reality disagree, **reality (the code) wins** and is recorded here.
