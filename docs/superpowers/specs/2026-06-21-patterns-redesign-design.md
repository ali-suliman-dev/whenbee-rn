# Patterns screen redesign — design spec

**Date:** 2026-06-21
**Status:** Draft, pending founder review
**Mockups:** `docs/superpowers/mockups/patterns-spines.html` (3 directions), `docs/superpowers/mockups/patterns-combined.html` (chosen direction). Renders: `patterns-spines.png`, `patterns-combined2.png`.

---

## 1. Problem

The Patterns tab renders up to **16 conditional card types** through one identical shell (`PatternCard`: eyebrow + icon + dismiss + text). The result is a flat sameness-scroll with no focal point, no data visualization, no hierarchy, and Pro teasers that blend into the free cards. The one number on screen (`~25 min`) is the only spark. The screen's job — reflect your time data back at you, calmly, no guilt — is undersold by a layout that reads as a list of notifications.

## 2. Goal

Give the screen a **spine**: one emotional focal point, then a calm, sectioned story, ending in a premium Pro pitch. Add restrained motion so it feels alive without violating the product invariants (no guilt, no streaks, honey/sharpness monotonic, core loop on-device-only). Every value sourced from `src/theme/tokens.ts`.

## 3. Chosen direction — "Hero + sectioned story"

A merge of spine A (hero + feed) and B (sectioned digest). Top-to-bottom narrative:

| # | Section | Content | Source (existing) |
|---|---------|---------|-------------------|
| 0 | Weekly banner (opt) | once-a-week digest + reflective question, dismissible per ISO week | `WeeklyReview` / `view.youVsPast`, `view.biggestSurprise`, `view.archetype` |
| 1 | **Hero — identity** | time personality: title, `1.6×` avg, blurb, share chip | `Archetype` / `view.archetype` |
| 2 | **Your progress** | accuracy-over-time curve, `+8 pts` badge, then-vs-now endpoints | `YouVsPast` / `view.youVsPast` (+ new trend series, §6) |
| 3 | **What changed** | drift note (amber annotation) + this-week surprise | `DriftAlert`, `BiggestSurprise` |
| 4 | **Your numbers** | honest map: category · readiness dial · honest number; most-tracked category leads | `CalibrationMap`, `PredictionCard` (merged) |
| 5 | **Pro** | premium teaser card(s): blurred preview + Pro pill + benefit headline + amber CTA + reassurance | `StealsYourTimeLocked`, `AccuracyCorrelationsLocked`, `ContextCorrelationsLocked` → unified `ProTeaserCard` |
| — | Plan-vs-wing-it | folded into "Your progress" as a secondary line when both arms ≥3 | `PlanExperiment` |

**Narrative rationale (ux / conversion-psychology):** meet *who you are* → *you're growing* → *one thing shifted* → *the detail* → *the gentle upgrade*. Identity before pitch, payoff before sell, no guilt language anywhere. Pro sits last and is visually distinct, so it reads as "more," never as a blocked free card.

**Empty / thin-data states:** when `view.empty`, show `PatternsEmpty` only. As data accrues, each section appears under its existing min-sample gate (unchanged from current `usePatterns` derivations) — the redesign is presentation-only over the same gated view model. A section with no qualifying data renders nothing (no empty shells).

## 4. Components

All new/changed components live in `src/features/patterns/`. The route `src/app/(tabs)/patterns.tsx` stays thin — it composes sections from the existing `usePatterns()` / `useReasonInsights()` / `useContextInsights()` hooks; no business logic moves into the route.

### 4.1 `SectionHeader`
Eyebrow-style group label + hairline rule (`YOUR PROGRESS ───`). Props: `label`. Tokens: `fontSize.micro`, `letterSpacing.wide`, `colors.inkSoft`, `colors.hairline`.

### 4.2 `ArchetypeHero` (redesign of `Archetype`)
Raised card, soft amber radial glow (mode-independent), bee glyph top-right, eyebrow, title, large amber multiplier, blurb, share chip. Keeps the existing share-card capture flow. The single most prominent element on screen.

### 4.3 `ProgressChart` (new)
Accuracy-over-time area+line sparkline with an amber endpoint dot and a `+N pts` delta pill (green `success` when up, neutral when flat — **never red**). Renders the trend series from §6; falls back to a 2-point then-vs-now line when the series is too short. SVG via `react-native-svg`.

### 4.4 `DriftNote` (restyle of `DriftAlert`)
Amber-tinted annotation row (`accentSoft` bg), diamond marker, one sentence. No card chrome — reads as a margin note, not a notification.

### 4.5 `HonestMap` (restyle of `CalibrationMap`)
One card, per-category rows: name + `runs N× · <readiness>` on the left, 3-step amber readiness dial centered, honest number right-aligned with `vs 15 guess` sub. Readiness dial keeps the existing Raw/Setting/Honest logic and `progressbar` a11y semantics. `PredictionCard`'s forward honest number folds in as the most-tracked category leading the list.

### 4.6 `ProTeaserCard` (unify the three `*Locked` teasers)
The premium pattern from the reference (Honest Week card). Props:
```ts
interface ProTeaserProps {
  eyebrow: string;        // "Whenbee Pro"
  headline: string;       // benefit-led, e.g. "Know your sharpest hours."
  sub: string;            // outcome line
  cta: string;            // "Reveal my rhythm"
  preview: ReactNode;     // blurred feature visual (per feature)
  trigger: PaywallTrigger;// existing paywall trigger key
}
```
Layout: a darker inset **preview panel** (blurred feature visual + ghost label) with a `🔒 Pro` amber pill top-right → `WHENBEE PRO` amber eyebrow → bold headline → sub → full-width amber coin-edge CTA → `Cancel anytime · learned on-device` footer. Tapping the CTA pushes `/(modals)/paywall` with the feature's existing trigger. One teaser shows at a time, chosen by which Pro feature has the most user data behind it (most compelling preview); copy/preview supplied per feature.

## 5. Motion (creating-reanimated-animations + motion-design)

Personality: **Premium** (calm, decelerate, 0% overshoot). Signature curve `motion.easing.out` (`cubic-bezier(0.23,1,0.32,1)`), already in tokens.

- **Entrance:** each section rises `translateY(10→0)` + fade, staggered ~70ms top-to-bottom (`motion.enterStagger`), total < 500ms. Entering-only (project is entering-only on Fabric — no `exiting` layout animations; see memory).
- **ProgressChart:** line draws left→right on first appear (`clip-path`/stroke-dashoffset), area fades up behind it, endpoint dot pops last. Honey/sharpness stays monotonic — the line only ever reads as progress, never regression framing.
- **HonestMap dials:** lit segments fill left→right with a short stagger when the card appears.
- **Press feedback:** share chip + Pro CTA scale/translate on `:active` (CTA depresses onto its coin-edge using `depth.edge`/`depth.drop`). Per the scaffold gotcha, the press visual goes on an inner `View`, not the `Pressable`.
- **Reduced motion:** opacity-only fallbacks; no transforms.

## 6. Engine change — accuracy trend series

`ProgressChart` needs a short time series; today `view.youVsPast` exposes only two scalars (early %, recent %). Add a pure, read-only derivation in `src/engine/` (no clock access — windows derived from log ordering, timestamps passed in):

```
deriveAccuracyTrend(logs, opts) -> { points: number[]; deltaPts: number } | null
```
- Buckets completed logs into ~6–8 ordered windows, computes per-window accuracy (reuse existing accuracy helpers).
- Returns `null` below a min-log gate → `ProgressChart` falls back to the 2-point `youVsPast` line.
- Unit-tested exhaustively (engine purity discipline). Tune gate via `src/engine/constants.ts`, not inline.

No other engine or data change. The core loop is untouched; all Patterns data stays on-device.

## 7. Tokens

Reuse existing: `colors.accent`, `accentEdge`, `accentSoft`, `onAmber`, `amberText`, `primary`, `primarySoft`, `primaryWash`, `success`, `successSoft`, `raised`, `surface`, `sunken`, `hairline`, `border`, ink ramp, `radii.card/md/full`, `depth.edge/drop`, `motion.*`. New tokens only if a value is genuinely reused and missing — candidates: a `chart` geometry group (sparkline height, stroke, dot radius) and a `proTeaser` group (preview-panel height, blur radius, pill geometry). Added to `tokens.ts` with a matching `useTheme` `resolveTheme` line (see memory: a new group needs the resolver entry or `t.<key>` is undefined). No raw hex/number inlined in any component.

## 8. Out of scope

- No change to calibration math, gating thresholds, or the share-card capture pipeline.
- No new Pro features — only re-presentation of the three existing Pro correlations.
- Light-mode pass happens after dark-mode sign-off (dark is the mock; tokens already carry both modes).
- `WeeklyReview` banner keeps its current ISO-week dismissal logic unchanged.

## 9. Testing

- Engine: full unit coverage for `deriveAccuracyTrend` (TDD, write tests first) — bucketing, gate, null fallback, delta sign.
- Components: existing `usePatterns`/Patterns snapshot tests updated for the new tree; readiness-dial a11y labels preserved.
- Device verify on the iOS sim per CLAUDE.md (reset onboarding, capture screenshot) — dark mode first, then light.
- `npm run lint && npm run typecheck && npm test` green before any PR. Never merge — open PR, founder reviews.
