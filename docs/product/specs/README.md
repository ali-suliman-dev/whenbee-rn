# Pro feature specs

Detailed, build-ready specs for the **new Whenbee Pro bundle** (calendar/Honest-Day dropped 2026-06-19). Each file is one feature, specified precisely enough to implement without re-deciding product or design. Rationale + evidence for *why* these features live in [../07-PRO-VALUE-IDEAS.md](../07-PRO-VALUE-IDEAS.md).

> **⚠️ FREE/PRO RE-SPLIT — decided 2026-06-21 (this note wins over the table's old "First build?" column).** An audit found several specs duplicate already-shipped free code. Updated gating:
> - **04 Day-capacity check → DROPPED FROM PRO. It is FREE.** The fits/over/which-to-cut math already ships free in the Start-By planner (`src/engine/planner.ts` `planBackward` + `cutLadder` + `VerdictCard`). The only genuinely-new, useful piece is a durable global **End of day** setting — also free (it is configuration, not a payoff). See [docs/plans/day-end-setting.md](../../plans/day-end-setting.md) and [docs/superpowers/plans/2026-06-21-free-bucket.md](../../superpowers/plans/2026-06-21-free-bucket.md). Do **not** build 04 as a Pro feature.
> - **02 Review ritual → SPLIT-GATED.** Viewing your week is FREE (the existing `WeeklyReview` content stays free). Only the *scheduled ritual surface* + the two Pro correlation cards (steals-your-time, when-you're-sharpest) are Pro.
> - **07 Long-range history → SPLIT-GATED (and the riskiest gate).** The recent 30-day window + receipts are FREE; only *depth* (90/365/all, season-compare, re-open past reviews) is Pro. It is the purest "view your own data" — confirm it earns a paywall slot before building, or soften to a free view with a lighter Pro hook.
> - **03 / 05** already split free vs Pro inside their own specs (point number / static widget = free; band / rich ring = Pro). Unchanged.

## The specs

| # | Spec | One-liner | First build? |
|---|---|---|---|
| 01 | [PDF report export](01-pdf-report-export.md) | Clinician/coach/self PDF of your real durations & bias | ✅ recommended |
| 02 | [Review ritual](02-review-ritual.md) | Cadenced "Honest Week / Month" recap (the retention ritual) | ✅ **split** — week content free; ritual+correlations Pro |
| 03 | [Confidence band](03-confidence-band.md) | Honest *range* (P25–P75) that visibly narrows over time | ✅ recommended (band UI ~80% built) |
| 04 | [Day-capacity check](04-day-capacity-check.md) | "Will today actually fit?" — in-app, **no calendar** | ❌ **NOT PRO** — math ships free; only the End of day setting is new (free) |
| 05 | [Persistent presence](05-persistent-presence.md) | Home/lock-screen widget + Live Activity (finish scaffold) | next |
| 06 | [Routines](06-routines.md) | Multi-step sequences with one learned honest total | next |
| 07 | [Long-range history](07-long-range-history.md) | Unlimited history + re-openable past reviews (the data moat) | next — **split** (30d free; depth Pro; riskiest gate, reconfirm) |
| 08 | [Hyperfocus guardrail](08-hyperfocus-guardrail.md) | Soft, no-guilt nudge when a task runs 2× over | next |
| 09 | [Focus-window planner](09-focus-window-planner.md) | Fit tasks inside your daily good-hours/med window | later |
| 10 | [Per-category goals](10-per-category-goals.md) | No-guilt accuracy goals/experiments per category | later |

Optional future add-on (not full-spec'd yet): **LLM "Estimate Coach"** prose layer over deterministic insight — separate tier, never in the time math. Tier-3 candidates (Day Ledger, custom categories/sub-splits, brain-dump capture, CSV/JSON export, cosmetics, Apple Watch, "what next" mode) are listed in [../07-PRO-VALUE-IDEAS.md](../07-PRO-VALUE-IDEAS.md) §Tier 3.

---

## Shared conventions (every spec obeys these)

These come from `CLAUDE.md` / `AGENTS.md` / `docs/ARCHITECTURE.md` / `docs/THEMING.md`. Specs reference them instead of repeating.

**Product invariants (never violate):**
- **No guilt, ever.** Amber (`t.colors.accent` / `t.colors.amberText`), **never red** for the user's own behavior. No streaks, no shame, no decay, no loss state. Empty states are calm.
- **Honey/sharpness is monotonic.** Never show a metric going backward.
- **Core loop stays on-device-only.** No network — and no LLM — in guess → timer → learn. (The optional Estimate Coach is the *only* sanctioned network feature, off the loop, Pro-gated.)
- **Pricing from RevenueCat.** Gate on the `pro` entitlement, never a hardcoded flag or product id.
- **No calendar.** No EventKit, no `expo-calendar`, no calendar permission anywhere in the new Pro.

**Architecture (one-directional):** `UI (app/components/features) → stores/providers/hooks → services/db → engine (PURE) ← domain types`.
- New product math goes in **`src/engine/`** as pure, clock-free, dependency-free TS, exported via `src/engine/index.ts`, tuned via `src/engine/constants.ts`. **TDD required** (write engine tests first).
- `src/domain/types.ts` is the contract — change types there first.
- `src/app/**` & `src/components/**` must **not** import `src/services/*` or `src/db/*` — route through a store/provider/feature hook. Routes are thin.
- Persistence: SQLite repos (`src/db`) for logged data; `src/lib/kv.ts` for KV. New tables = a new append-only migration.

**Gating:** wrap Pro UI in `<ProGate fallback={<…Locked/>}>` (`src/features/paywall/ProGate.tsx`) or branch on `useEntitlement((s) => s.isPro)`. Non-Pro sees a calm locked teaser that shows the *shape* of the value, with a CTA to `/(modals)/paywall` carrying a `trigger`. Never gate the core loop; never fog calibration.

**Theming:** every spacing/size/font/color value is a token from `src/theme/tokens.ts` via `useTheme()` (`t.space`, `t.colors`, `t.radii`, `t.iconSize`, `t.borderWidth`, `t.size`) + `type` from `src/theme/typography.ts`. No raw numbers/hex. If a needed token is missing, the spec says "add token X to tokens.ts."

**Motion:** durations/easing from `tokens.motion` (e.g. `base = 220ms`), Reanimated worklets, `ReduceMotion.System` honored, entering-only on conditionally-unmounted views (no `exiting` layout anim — it SIGABRTs on Fabric). Read/write shared values with `.get()/.set()`.

**RN gotchas:** no CSS `boxShadow` (use the View-edge/coin technique); `Pressable` is a bare touch wrapper with visual style on an inner `View`; footers add `useSafeAreaInsets().bottom`.

**Analytics:** add typed events to `src/services/analytics.ts` (fire-and-forget, never throws). Each spec lists its events (`<feature>_viewed`, `<feature>_paywall`, etc.) wired to the funnel.

**Copy:** every user-facing string passes `conversion-psychology` (felt problem, clarity, no fake urgency) + `humanizer` (no em-dash, no AI vocab, no rule-of-three, sounds like one honest person) + the no-guilt rule. Specs give the **exact strings**.

---

## Spec template (each file follows this)

```markdown
# <NN> — <Feature name>  ·  Pro

**Status:** spec · **Tier:** Pro (`pro` entitlement) · **Skills applied:** <list>

## 1. What it is (one paragraph a non-engineer understands)
## 2. The user problem + evidence  (cite 07-PRO-VALUE-IDEAS sources)
## 3. Where it lives  (which tab/route/surface; entry points; free vs Pro view)
## 4. User flow  (numbered, happy path + the locked/non-Pro path)
## 5. Screens & states  (each state: layout, tokens, type scale, spacing, components reused; ASCII wireframe; empty / loading / error / not-enough-data states)
## 6. Motion  (what animates, tokens/easing, reduced-motion fallback)
## 7. Data model  (domain types to add/change; db table/migration or kv; what’s persisted)
## 8. Engine / logic  (pure functions, signatures, file paths, constants; TDD cases)
## 9. Gating  (ProGate placement, paywall trigger name, locked-teaser design)
## 10. Copy  (every exact string; humanizer-checked; no-guilt)
## 11. Edge cases & guardrails  (low-n, zero data, rollover, privacy, no-guilt checks)
## 12. Analytics  (event names + props)
## 13. Build manifest & effort  (files to add/edit, S/M/L, dependencies, open questions)
```
