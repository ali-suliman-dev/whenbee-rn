# Patterns screen redesign — design spec

> **Status:** approved direction (founder, 2026-06-17) · binding once the written spec is reviewed.
> **Scope:** a full structural redesign of the **Patterns tab** (`src/app/(tabs)/patterns.tsx` + `src/features/patterns/*`). Visual + IA only. **The engine, the derivations' math, the db, and the free/Pro boundary do not change.** Every card stays a pure read-only projection over the calibration engine.
> **Skills that drove it:** `react-native-architecture`, `ui-design:react-native-design`, `ui-design:mobile-ios-design`, `ui-design:interaction-design`, `svg-illustration`, `humanizer`, `conversion-psychology`, `retention-optimization`, `clean-code`, `coding-standards`.

---

## 1. Why (the problem)

The Patterns tab is the **Mirror** retention organ (`05-RETENTION.md` §2.3) — its job is self-understanding ("oh, THAT'S why"), never a score. The logic is already built: `usePatterns.ts` derives all eleven cards as pure projections, each returning `null` until its min-sample gate is met. The *presentation* is the problem:

1. **No hierarchy.** Every card is the same flat box, same eyebrow, same size, stacked in one scroll. Nothing is the hero — including the Archetype, which the build spec (`03-FEATURES.md` §4.1) designates as the **Patterns hero**.
2. **Barren early life.** Because unearned cards simply *hide*, the make-or-break first sessions render one or two lonely cards floating in black (see the shipped screenshot — only "Plan vs wing it (pending)" + "Biggest surprise"). Reads as *empty/broken*, not *warming up*.
3. **No earning narrative.** The spec wants forming cards to feel like *progress toward* an insight (`03-FEATURES.md` D13–D15 confidence/readiness dials). Today they vanish — the user sees nothing happening.
4. **Pro is a dead teaser**, not the "loud home of the earning narrative" the spec calls for (`03-FEATURES.md` D15).
5. **No warmth or visual signature** — it's a spreadsheet in the dark.

## 2. Goals / non-goals

**Goals**
- A clear visual **spine**: a hero identity, then labelled sections, then a Pro earning home.
- One repeating **instrument motif** (the gauge / bar) so the screen reads as a single tactical instrument top-to-bottom.
- Turn empty/forming states into **earning dials** — anticipation, not absence.
- Make the Pro section the **loud earning home** (readiness, not a wall).
- Honour every brand invariant: amber-never-red, no streak/fail/missed language, passive·sparse·on-demand, min-sample gates, on-device.

**Non-goals (out of scope for this spec)**
- No engine / derivation-math changes. No db schema changes.
- No change to the free/Pro boundary (Model B, locked 2026-06-15: Patterns mostly free; **only** S3/S4 accuracy+context correlations and S12 "what steals your time" are Pro). *Note: `05b-HONEY-SYSTEM.md` §8 — "Patterns = fully Pro" — is stale; Model B supersedes it.*
- No new cards/insights. No LLM. No Reclaim/Discoveries surfaces (those live on the Whenbee hub).

## 3. Information architecture (the spine)

The screen renders, in order:

| # | Region | Contents | Source card(s) |
|---|---|---|---|
| 0 | **Header** | "Patterns" + subtitle "What your time keeps telling you." | `ScreenHeader` |
| 1 | **Hero — Your time personality** | Archetype as a gauge identity. Two states: *earned* (name + multiplier + gauge + Share) / *forming* (progress to identity). | `archetype` |
| 2 | **This week** (section) | Biggest surprise (est-vs-actual mini-bars) · What changed (drift) | `biggestSurprise`, `driftAlert` |
| 3 | **Your growth** (section) | vs past-you (Δ pts) · Plan vs wing it — split row | `youVsPast`, `planExperiment` |
| 4 | **Still forming** (section) | Earning dials for free cards not yet earned (e.g. calibration map). Hidden when nothing is forming. | derived `forming[]` |
| 5 | **Go deeper · Pro** (section) | Loud earning home: readiness cards for "What steals your time" (S12) + "When you're sharpest" (S3/S4) + an upsell footer. | `ProGate` + correlations |
| — | **Empty** (no completed logs) | One calm illustrated hero only. | `PatternsEmpty` (restyled) |

Rules:
- A **section header renders only if it has at least one visible child** (no empty labels).
- The **prediction card** (S7) stays off Patterns — it lives on Today/Timer (`03-FEATURES.md` §4.1). Remove it from the Patterns scroll (currently rendered there).
- `WeeklyReview` keeps its place at the top of the scroll **above the hero only when due** (weekly modal cadence unchanged); otherwise not shown. It is not a section.
- Calibration map: when earned → a normal card under "Your growth"; when forming → a dial under "Still forming". One source, two presentations.

## 4. The hero — `PatternsHero`

A new component replacing the plain `Archetype` card as the screen's anchor.

**Earned state** (when `view.archetype !== null`):
- Eyebrow: `YOUR TIME PERSONALITY` (indigo).
- Name: `archetype.title` (display weight, e.g. "The Sprint Optimist").
- Line: `archetype.blurb` with the multiplier called out in amber (`{averageMultiplier}×`).
- **Gauge**: a horizontal track; fill position maps `averageMultiplier` onto an `OPTIMIST → HONEST·1× → REALIST` scale; an amber tick marks the `1×` honest anchor. The gauge is the screen's signature motif (reused below).
- **Share** pill (reuses the existing share path used by the aha/archetype share).

**Forming state** (when `archetype === null`):
- Same shell, but body becomes the most important earning dial: `Your time personality is forming` + a dial/bar + `{current} of {target} logs — {target−current} more reveals it.` Targets from existing constants (`ARCHETYPE_MIN_LOGS` / `ARCHETYPE_MIN_CATEGORIES`; surface the binding gate). No Share pill.

The hero uses `Card tone="focal"` (the single restrained indigo top edge) so it reads as the centerpiece without a gradient (dark-mode rule: solid surfaces, no gradients).

## 5. The gauge motif — `Gauge` (new shared primitive)

One small, theme-tokened component reused everywhere a 0–1 (or min–max) reading appears:
- Hero personality gauge (with the `1×` tick).
- Est-vs-actual mini-bars in Biggest Surprise.
- Pro readiness bars.

Props: `value` (0–1), optional `tickAt` (0–1), `tone` (`indigo` default / `amber`). Pure View + tokens (`progress.track`, `colors.surfaceSunken` track, `colors.primary`/`accent` fill, `radii.full`). Respects reduced-motion (fills set without animating). This dedupes the three ad-hoc bars in the mockup into one tested primitive.

## 6. Sections — `PatternsSection`

A tiny wrapper: an uppercase muted section label (`This week` / `Your growth` / `Still forming`) + its children, with consistent top spacing. Renders nothing if it has no children (callers pass a boolean `show`). Keeps the screen's rhythm in one place instead of per-card margins (CLAUDE.md: one spacing source per axis).

## 7. Forming dials — `FormingDial`

The anti-barren fix. For each free card that is gated-out but *close*, render a dial row: a conic progress ring (`current/target`) + title + `{n} more …` sub-line. Driven by a new derived list:

```ts
// src/features/patterns/usePatterns.ts — derived, pure, no new math
export interface FormingProgress {
  id: 'archetype' | 'youVsPast' | 'planExperiment' | 'calibrationMap';
  title: string;     // "Your calibration map"
  blurb: string;     // "2 more logged tasks and the full map fills in."
  current: number;   // logs counted toward the gate
  target: number;    // the binding min-sample constant
}
// derivePatterns adds: forming: FormingProgress[]  (only cards that are null AND have current>0)
```

- The hero consumes the `archetype` forming item directly (§4); the rest render under "Still forming".
- Only show a dial once the user has **at least one** log toward it (`current > 0`) — a brand-new user sees the empty hero, not a wall of zero-dials.
- Targets are the existing exported constants; **no new gates, no new thresholds.**

## 8. Pro — the loud earning home

Replaces the current quiet locked fallbacks. For each Pro insight (S12 "What steals your time", S3/S4 "When you're sharpest"):
- A `ProReadinessCard`: title + one-line benefit + a **readiness bar** (amber `Gauge`) + status chip (`ALMOST READY` / `EARNING`) + a `{current} of {target} logs` sub-line.
- Readiness is derived from data the screen already has (correlation sample counts / category log counts); **no entitlement check changes** — `ProGate` still controls the *unlocked* render. When unlocked + earned, the existing `StealsYourTime` / `AccuracyCorrelations` render in place of the readiness card.
- Footer upsell: `See the why — Pro` button + sub-line `Everything above stays free. Pro adds the why.` (conversion-psychology: anticipation + honest framing; humanizer: no AI-slop).

This keeps the paywall on *insight depth*, never on the companion or the free calibration surface.

## 9. Copy

All user-facing strings pass `conversion-psychology` (clarity, motivation, anticipation) + `humanizer` (no AI tells), and honour no-guilt/no-streak. Examples are illustrative; finalize during implementation:
- Hero forming: `Your time personality is forming · 3 more logs reveals it.`
- Surprise: `Cleaning stretched the most.` / `Now you know.`
- Pro readiness: `Cleaning is almost ready to reveal why it runs over.`
- Banned: `streak`, `missed`, `failed`, `you should`, `don't lose`, red, n-of-1/quantified-self/audit jargon.

## 10. Component inventory

**New** (`src/features/patterns/` unless noted)
- `PatternsHero.tsx` — earned/forming archetype hero.
- `PatternsSection.tsx` — labelled section wrapper.
- `FormingDial.tsx` — conic ring + progress copy.
- `ProReadinessCard.tsx` — Pro earning-home card.
- `src/components/Gauge.tsx` — shared gauge/bar primitive (lives in components — generic, used beyond Patterns-eligible later).

**Changed**
- `src/app/(tabs)/patterns.tsx` — rebuilt to the §3 spine (sections, hero, forming, Pro). Stays thin (routes carry no logic).
- `usePatterns.ts` — add `forming: FormingProgress[]` + per-Pro readiness to `PatternsView` (pure derivations + tests). Remove `prediction` from the Patterns view (moves off-screen).
- `PatternsEmpty.tsx` — restyled to a single calm illustrated hero (svg-illustration: a quiet geometric honeycomb/gauge motif, no creature).
- `Archetype.tsx` — folded into `PatternsHero` (delete or thin to the earned-body render).
- The Pro locked components (`StealsYourTimeLocked`, `AccuracyCorrelationsLocked`, `ContextCorrelationsLocked`) — replaced by `ProReadinessCard` instances (delete or repoint).

**Reused unchanged**
- `Card`, `ScreenHeader`, `ProGate`, `useTheme`, all engine derivations, `confidenceFor`, `BiggestSurprise`/`YouVsPast`/`PlanExperiment`/`DriftAlert`/`CalibrationMap` bodies (re-skinned to the gauge motif where they show a ratio).

## 11. Brand & invariant compliance

- [x] Amber-never-red — overruns/surprises use amber; no red anywhere.
- [x] No streak/fail/missed/guilt language; empty + forming states are calm and hopeful.
- [x] Passive · sparse · on-demand — cards still gate on min-sample; dismiss preserved.
- [x] Min-sample gates unchanged — dials *visualize* the existing gates, never lower them.
- [x] On-device, deterministic, no LLM. Engine math untouched (read-only).
- [x] Every spacing/size/font/color from `tokens.ts` via `useTheme()` — no inline values; add a token if missing.
- [x] No gradients in dark mode; solid surfaces + hairlines.
- [x] Pro boundary unchanged (Model B); paywall stays on insight depth.

## 12. Testing

- `usePatterns` new derivations (`forming[]`, Pro readiness) get pure unit tests in `__tests__` alongside the existing derivation tests: forming appears only when `current>0 && card===null`; targets equal the constants; readiness fraction monotonic in sample count; prediction no longer in the view.
- Update `patternsScreen.test.tsx`: hero earned vs forming render; section headers hide when empty; Pro readiness vs unlocked render via `ProGate`.
- Gauge: a small render test (value→width, tick position, reduced-motion sets without animating).
- `npm run lint` (0 warnings) + `npm run typecheck` + `npm test` green before done.

## 13. Phasing (single plan, ordered)

1. `Gauge` primitive + tests.
2. `usePatterns` data additions (`forming[]`, readiness) + tests; drop `prediction` from view.
3. `PatternsHero` (earned + forming) + `PatternsSection`.
4. `FormingDial` + "Still forming" wiring.
5. `ProReadinessCard` + Pro earning home.
6. Rebuild `patterns.tsx` spine; restyle `PatternsEmpty`; re-skin reused card bodies to the gauge motif.
7. Copy pass (conversion-psychology + humanizer); a11y labels; lint/typecheck/test.
