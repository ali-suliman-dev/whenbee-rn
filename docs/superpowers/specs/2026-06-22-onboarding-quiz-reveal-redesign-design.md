# Onboarding quiz + reveal redesign — design spec

**Date:** 2026-06-22
**Status:** Approved (visual mocks signed off through v5). Ready for implementation plan.
**Mock of record:** `/tmp/whenbee-v5.html` (archive a copy under `docs/product/mocks/` during build).

## Why

The onboarding personality flow (name → quiz → reveal) has structural and visual problems the founder flagged from device screenshots:

1. **Name + quiz + reveal are one route** (`src/app/(onboarding)/personalize.tsx`) with internal `useState<Phase>`. Consequences:
   - Swiping back from a quiz question pops the whole route → lands on `categories` (the screen *before* the name screen), not the previous question.
   - The `StepProgress` bar is hardcoded `current={2} total={4}` for the entire block, so it never moves and the count is wrong.
2. **Quiz auto-advances** on Q1/Q2 (tap = jump) but not Q3 — inconsistent and disorienting.
3. **"See my type" is gated only on Q1** (`!hasPace`) → a (wrong) archetype can be revealed after one answer.
4. **Quiz is visually flat and boring** — sparse prompt + chip row + tiny text links. No micro-interactions, no retention pull.
5. **Reveal is a bland `surfaceRaised` card** with a crude `BeeGlyph` (hexagon + amber glow + hard border) and an in-card Continue button.
6. **Name screen** had no autofocus and inline (not bottom-pinned) buttons. **(Already fixed in code — see Done below.)**

Product invariants honored throughout: **no guilt, no streaks, no shame**; honey/sharpness monotonic; core loop on-device; one primary CTA per screen.

## Already done (in code, this session)

`NameAsk.tsx` + `personalize.tsx`: nickname field autofocuses; Continue/Skip pinned to the bottom above the keyboard (`KeyboardAvoidingView`), matching `categories.tsx`. tsc/eslint/jest green. The name phase keeps its own bottom inset; quiz/reveal phases unchanged. This refactor is superseded by the routing change below but is currently shipping correctly.

## Scope

Three deliverables:

1. **Quiz** — reimagined "Whenbee learns you" (Concept 1, Layout A), per-step routes, accurate progress, no auto-advance, bottom Skip/Next, swipe-back, gated reveal.
2. **Reveal** — E1 "collectible crest" card with an animated reveal.
3. **Patterns archetype card** — restyle the current `ArchetypeHero` into the approved "stat-sheet".

---

## 1 · Quiz — "Whenbee learns you" (Concept 1, Layout A)

### Structure: per-step routes (not internal phases)

Replace the single `personalize` route's internal phase machine with **one route per step**, so native stack swipe-back works exactly like the rest of onboarding and progress reflects the real position:

```
(onboarding)/
  welcome
  categories
  name            ← "What should I call you?" (was the 'name' phase)
  quiz/[step]     ← one question per step (pace → mid → focus), dynamic route
  reveal          ← archetype payoff (gated: only reachable after the quiz)
  ready
```

- Quiz answers persist in `onboardingStore` (Zustand), written on each Next, so they survive route changes and back-navigation. Re-entering a question shows the previously chosen option selected.
- **Reveal is gated**: it is only `router.push`ed from the last quiz step's Next (or a Skip that still has ≥ the required answer). Direct/early navigation to it is not possible. This removes the "wrong type after 1 answer" bug.
- **Skip** (from any quiz step) → behaves as today: `trackQuizSkipped()` then go to `ready` (skips the reveal entirely). Skipping is always allowed; it is not a guilt path.
- Required-answer rule unchanged from the engine's perspective: `pace` is the only required input; `mid`/`focus` enrich. If the user answers `pace` then Skips, we may still show the reveal? **Decision: Skip always goes to `ready` (no reveal).** Reveal is reached only by completing via Next. This keeps "Skip = leave the quiz" unambiguous.

> **Alternative kept on file (Layout B):** an app-native left-aligned layout (left title + subtitle, bee as a small header companion). If Layout A's centered ceremony feels too heavy in device testing, swap the per-step screen's header block for Layout B — same routes, same store, same footer. Documented so the swap is a header-only change.

### Per-question screen (Layout A)

Top-to-bottom:

1. **Comb progress** — a row of flat-top honey-comb cells, one per quiz question, centered. The cell for a completed question is honey-filled; the current cell is a partial/active amber; future cells are sunken. This **is** the accurate per-step progress (the founder's locked "accurate per-step bar", themed as a comb). Reuses the `Honeycomb`/comb geometry tokens (`honeycomb`, `accent`, `sunken`).
2. **Companion bee** — `BeeMascot` centered, `animated` (its existing buzz/blink/glance micro-life), with a soft amber radial behind it (no hard coin). The host "asking" the question.
3. **Bold question title** (`type.subtitle`-ish weight) + **one warm subtext line**: `No right answer here. Pick what's true most days, and I'll learn from it.` (Copy passed humanizer — warm, honest, no slop, no guilt.)
4. **Options** — the pinned mix: a 2×2 **tile grid** for 3–4-option questions (pace, focus), **stacked full-width rows** for 2-option questions (mid). Each option tile/row reuses the existing `ArchetypeQuizGlyph` icons. Selected state: indigo `primaryChip` fill + indigo coin-edge lift (`primaryEdge` bottom edge) + 2px translateY; the glyph flips to its amber `active` state; light haptic.
5. **Footer, one row** — **Skip (left, ghost/quiet) · Next (right, filled indigo, the one primary CTA)**. Next is disabled/muted until an option is chosen, then fills. **No "swipe back" hint text** (users know the gesture). No auto-advance — Next always required.

### Micro-interactions (motion-design budget)

- Option press: `scale(0.97)` on press-in (`scale.pressIn` token), settle on release.
- Option select: tile lifts 2px onto its coin-edge; glyph `active` animation; haptic.
- Question → question: native stack push/pop (the slide is the platform transition); swipe-right = back to the previous question (and its stored answer shows selected).
- Comb cell seal: on Next, the just-answered cell wells up with honey (reuse the honey-fill ease-out, `motion.honeyFill`, `Easing.out`). Calm, monotonic, never drains.
- Bee: ambient micro-life only (no reaction choreography required for v1; the buzz/blink/glance loop is enough). A glance-toward-choice reaction is a **nice-to-have**, not required.
- Reduced motion → all settle to final state, no travel.

---

## 2 · Reveal — E1 "collectible crest"

A payoff that feels earned, not a flat box.

### Visual

- **Card**: rounded (`radii` ~22–26), **no border, no border-like inset ring**. Background is a honey→indigo vertical gradient (dark-mode: `~#2c2654 → #211f33 → #33271f`). A soft top amber radial glow. A one-time foil shine sweep. Lift comes from a soft drop shadow only (Platform shadow / view-edge), never a stroke.
- **Crest**: a **symmetric regular flat-top hexagon** (height = width × √3/2), **no stroke**, filled with a faint top-down honey gradient. The **`BeeMascot` sits inside it, large** (no crude `BeeGlyph`).
- **Coin-hex seal**: a small gold **coin-hex** at the **top-right corner of the hexagon** (near the bee, inside the crest's proximity — not the card corner). Built in the `CoinBadge` coin style: a gradient amber face over a darker `accentEdge` bottom edge peeking below, with a `✦` mark. Small.
- **Eyebrow**: `YOUR TIME PERSONALITY` in **accent (amber `#EEAE4D`)**.
- **Title**: archetype name, large, with breathing room above the stat.
- **Stat**: big honey multiplier `1.1×` + caption `your guess, on average`.
- **Blurb**: warm, forward-looking, **no rarity / "quietly rare" line** (no ranking, nobody feels bad): `Your guesses already land close to reality. I'll sharpen this with every task you log.`
- **Continue**: pinned to the **screen bottom** (the one primary CTA), out of the card.

### Reveal animation (motion-design)

One calm beat, ease-out curves, < ~1s of staged motion:

1. Card + bee **rise in** — translateY 22→0, scale .96→1, ~700ms `cubic-bezier(0.23,1,0.32,1)` (honey/out). Bee does **not** bounce.
2. Foil **shine sweep** once across the card (~1.1s, starts ~500ms).
3. Coin-hex **stamps down** — scale ~1.8→1 with a small overshoot spring, ~500ms, starts ~600ms.
4. Eyebrow → title → stat → blurb → Continue **fade-rise** in sequence (~80ms apart).
5. After landing, the bee runs its ambient **breathing/micro-life** loop (alive, refined — `BeeMascot animated`).

Reduced motion → straight to final state. Entering-only (no exit animations — Fabric SIGABRT constraint). Build with Reanimated shared values + `withTiming`/`withDelay`/`withSpring`, per the existing `ArchetypeReveal` pattern.

> **Alternative kept on file (E2 "Honey hero"):** a full-screen, boxless reward — amber aurora behind a glowing bee, crystallizing title, clean dark bottom (glow must fade well above the Continue button so it never muddies it). If E1 ever feels too "card", E2 is the swap. Documented.

---

## 3 · Patterns archetype card — "stat-sheet"

Restyle `src/features/patterns/Archetype.tsx` `ArchetypeHero` from the current glow card into the approved stat-sheet. This is a **separate component** from the onboarding reveal (they diverged: reveal = crest, Patterns = stat-sheet).

### Visual

- **Card**: same gradient + centered shine as E1, **no border**. Shine sits in the card's middle (not low).
- **Header row**: a small **single honey hexagon glyph** (one flat-top hex, honey gradient fill, no border — **not** the bee, **not** a multi-cell cluster) on the left; to its right a column with the **amber-accent eyebrow** `YOUR TIME PERSONALITY` over the **title** (archetype name).
- **Stat rows**: three rows, dividers are a **soft amber hairline** (`accent` at low opacity), label left (`inkSoft`), value right (bold; the multiplier value in honey/amber). Derived from the user's answers + calibration:
  - `Runs` → `1.1× long` (multiplier)
  - `Mid-task` → `Stays on track` (from `mid`)
  - `Sharpest` → `Mornings` (from `focus`)
  - Rows present only for known traits; missing answers drop their row (or show a quiet "—"). Exact mapping is a small pure helper (TDD).
- **Share**: a real **pill button below the card** (`⬆ Share my archetype`) — secondary styling (`raised` bg, not indigo), so the screen keeps one primary CTA. Reuses `useShareCard('archetype')`. (Alt placement — a top-right icon button — documented but not built.)
- Keep the off-screen `ShareableCard` capture path intact.
- The `ArchetypePlaceholder` (pre-quiz state) stays, lightly restyled to match (no border, optional glyph).

---

## Components & boundaries

- New presentational components live in `src/components/` or `src/features/onboarding/` (UI), pure where possible.
  - `QuizProgressComb` — the comb step indicator (pure, props: total, current, filledFraction).
  - `QuizOptionTile` / `QuizOptionRow` (or one `QuizOption` with a `layout` prop) — reuses `ArchetypeQuizGlyph`, `Chip`-style press feedback.
  - `QuizStepScreen` — the per-question screen (bee + title + subtext + options + footer), driven by route param `step`.
  - `ArchetypeCrest` — the hex + bee + coin-hex crest (shared visual primitive; used by the reveal; could later back the Patterns glyph but Patterns uses the single-hex glyph, so keep separate).
  - `CoinHex` — the gold coin-hex seal (coin-edge style, `CoinBadge` cousin).
  - `HoneyHexGlyph` — the single honey hexagon for the Patterns header.
- Routing/state: `onboardingStore` holds quiz answers + a derived `currentStep`/progress. Engine archetype computation (`saveQuiz`) is unchanged — it already accepts partial answers.
- Layer rules respected: routes stay thin; logic in `usePersonalize`/store/engine; no `src/services`/`src/db` imports from components.
- Every spacing/size/color from `tokens.ts` via `useTheme()`. New tokens (e.g. crest hex size, coin-hex size, comb cell) added to `tokens.ts` with a matching `useTheme` line — never inlined.

## Testing

- TDD for logic: the answers→traits mapping helper, the progress/step derivation, the gating (reveal unreachable without completion). Engine `saveQuiz` already tested.
- UI: interaction tests where cheap (option select toggles state; Next disabled until a pick; Skip routes to `ready`). Snapshot/interaction tests welcome for the reveal's reduced-motion final state.
- Reduced-motion paths verified for quiz + reveal.

## Copy (humanizer-passed, warm, no guilt)

- Quiz subtext: `No right answer here. Pick what's true most days, and I'll learn from it.`
- Reveal blurb: `Your guesses already land close to reality. I'll sharpen this with every task you log.`
- Patterns share: `Share my archetype`
- No "rare", no rank, no streak, no shame anywhere.

## Out of scope

- The progress count/research decision is resolved (accurate per-step, themed as comb). No numeric counter.
- The name-screen layout is already done.
- E2 reveal and quiz Layout B are documented alternatives, not built now.

## Open follow-ups (post-build, not blocking)

- Optional bee "glance toward your choice" reaction in the quiz.
- Archive the final mock HTML under `docs/product/mocks/`.
