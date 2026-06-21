# "Whenbee knows you" — personalization (name + greeting + time-style quiz → provisional archetype) design spec

**Date:** 2026-06-21
**Status:** Approved design, pending spec review
**Stacks on:** the Patterns redesign branch (`worktree-patterns-redesign`, PR #30 — NOT yet merged). This feature extends `ArchetypeHero`, `deriveArchetype`, `ProgressChart`, `buildAccuracySeries`, and the sectioned Patterns route introduced there. **Its PR bases on that branch; #30 must merge first.**
**Research:** `docs/product/specs/12-name-greeting-personalization.md` (name/greeting; corrected to "Whenbee"), `docs/product/04-RESEARCH-INSIGHTS.md` (Day-0 activation, archetype-as-hook).

---

## 1. Goal

Make Whenbee feel like it knows you from session 1, and put the identity-level aha (your **time personality / archetype**) on screen Day-0 — the moment the research says activation is won or lost (doc 04 §4: ~50% of conversions / ~40% of cancels happen Day 0). Three threads, one feature:

1. **Name + time-of-day greeting** on Home (doc 12, disciplined: optional, sparing, editable, warmth-only).
2. **An illustrated onboarding mini-quiz** that seeds a **provisional archetype**, shown immediately and then **refined by real data** — the calibration thesis applied to identity ("your guess, corrected by your logs").
3. **A chart thin-data fix** so `ProgressChart` shows the calm 2-point line until the sparkline is non-noisy.

**Invariants (never violate):** no guilt/shame, no streaks; amber never red; honey/sharpness monotonic; core loop + all personalization on-device; pricing from RevenueCat. **The quiz never asks for durations** — only self-perceived *style/bias* — so it stays on the right side of the wedge (Whenbee supplies the numbers from history; it doesn't ask the user to).

---

## 2. Experience

### 2.1 Onboarding personalization step (new, optional)
Flow becomes `welcome → categories → personalize → ready`. New route `src/app/(onboarding)/personalize.tsx`, spoken in Whenbee's voice, **skippable at every point** (a prominent Skip; nothing here gates the app).

**Part 1 — Name.** "What should I call you?" — free-text nickname, default no name, big **Skip**, editable later in Settings. (doc 12 rule 2/3.)

**Part 2 — Time-style mini-quiz (2–3 quick taps → archetype reveal).** Each question is a header + a row of **illustrated chips** (see §2.3). Questions:
- **Q1 (primary → bias band):** "When you plan your day, things usually take…" → `About right` / `A bit longer` / `A lot longer` / `I lose track`.
- **Q2 (nudge):** "Mid-task, you usually…" → `Stay on track` / `Fall down rabbit holes`.
- **Q3 (flavor):** "You focus best…" → `Mornings` / `Evenings` / `It varies`.

**Reveal.** After Q1 (the others are optional refinements), an animated reveal lands the archetype using `ArchetypeHero`'s visual language — "You're **The Gentle Optimist**" — shareable via the existing share-card, then → `ready`.

### 2.2 The four archetype rungs (unchanged ladder)
`deriveArchetype`'s existing ladder by average multiplier: `<1.3` **The Steady Reader**, `<1.8` **The Gentle Optimist**, `<2.6` **The Sprint Optimist**, `≥2.6` **The Dreamer**. The quiz seeds a starting multiplier that lands you on a rung; data moves it.

### 2.3 Illustrated chips (match the app's icon style)
The answer chips reuse the existing `src/components/Chip.tsx` with a **new two-tone SVG glyph set** modeled exactly on `src/features/reward/ReasonGlyph.tsx`: a 24-box, ~1.6px strokes, rounded joins, **indigo body (`colors.primary`/`primarySoft`) + amber accent (`colors.accent`)**, each playing a **one-shot, meaning-mapped delight animation on select** (reduced-motion-guarded to a still end state). One glyph per answer, e.g. Q1: a tidy target (`about right`), a clock with a small over-arc (`a bit`), a stretched/over-full clock (`a lot`), a gentle spiral/tangle (`lose track`); Q2: a straight arrow (`on track`) vs a branching path (`rabbit holes`); Q3: sun (`mornings`), moon (`evenings`), half-sun (`varies`). The reveal animation and every glyph come from the motion/SVG skills, not hand-tuned magic numbers.

### 2.4 Provisional → earned ("goes up and down")
- The quiz answer maps to a **seed multiplier** `M0` (Q1: about→1.15, a-bit→1.5, a-lot→2.1, lose-track→3.0; Q2 `rabbit holes` multiplies `M0` by a small bump, capped). Stored once in KV.
- Below the **earned gate** (the existing 12 logs / ≥2 categories), the archetype is computed from a **blend of the seed (as prior) with the data so far** — reusing the engine's blend-with-prior shape, weight shifting to data as logs accrue. So the rung can shift as real timing corrects the self-guess.
- **At/above** the earned gate, the seed is fully washed out — pure data archetype (unchanged behavior).
- The hero wears a quiet **"Provisional · still learning"** marker while seeded-but-not-earned; it drops once earned. A rung change is framed warmly ("Your logs say you're more **The Sprint Optimist**") — **never** as regression (no-guilt; the archetype label is identity, not a score, so this doesn't touch the monotonic-honey invariant).

### 2.5 Skipper placeholder hero
No seed + below the earned gate → the hero slot shows an **inviting placeholder** (`ArchetypePlaceholder`): "Meet your time personality — take the 20-sec quiz, or keep logging and I'll figure it out," with a CTA that **re-opens the quiz** (the quiz is a reusable component reachable post-onboarding from here and from Settings). It converts to the real `ArchetypeHero` once seeded or data-earned. The hero slot is **never empty**.

### 2.6 Name + greeting on Home (doc 12)
- Home shows a time-of-day greeting at the top: "Good morning/afternoon/evening" + (if a name exists) the name **selectively, not every render**. Buckets per doc 12 (morning 05–11:59, afternoon 12–16:59, evening 17–04:59); never "Good night" as a greeting; never "Good morning, undefined".
- **Sparing name density:** a guard decides when Whenbee uses the name (first open of the day / a genuine win / a return after a gap) — rare, like a close friend. Greeting may reference the archetype occasionally, under the same guard. Warmth-only; never references slipping, never pressures.

### 2.7 Chart thin-data fix
`ProgressChart` currently shows the multi-bucket sparkline at ≥6 logs, which renders 6 single-log buckets → the spiky, self-contradictory "63%→50% / steady / rising curve" seen on device. Fix: raise `ACCURACY_TREND_MIN_LOGS` so the sparkline needs enough logs that each of the 6 buckets holds ≥2 (i.e. **12**); below that, `ProgressChart` falls back to the calm 2-point then-vs-now line (which only needs the existing `youVsPast` gate of 6). Pure + tested.

---

## 3. Architecture & placement

One-directional flow respected (UI → stores → services/engine). New/changed units, each focused:

**Engine (pure TS, no clock, TDD):**
- `src/engine/archetypeSeed.ts` (new): `seedMultiplierFor(answers) → number` (quiz answers → `M0`) and `provisionalArchetypeMultiplier(seedM, dataLogsRatios) → number` (blend seed-prior with data). Constants (seed values, blend pseudo-count) in `src/engine/constants.ts`.
- `src/engine/greeting.ts` (new): `greetingFor(hour: number, name?: string) → string` — pure bucket mapping; the `Date.now()`/hour read stays in the hook.
- `src/engine/constants.ts`: raise `ACCURACY_TREND_MIN_LOGS` (6 → 12); add seed/blend constants.

**Domain/stores (KV via `src/lib/kv.ts`):**
- `src/stores/settingsStore.ts`: add `displayName?: string` (nickname) + setter, persisted; editable from Settings.
- Onboarding store (or settings): add `archetypeSeed?: { m0: number; source: 'quiz'; tookAt: number }` + `setArchetypeSeed`, persisted. No seed = quiz not taken.

**Patterns (extends the redesign):**
- `src/features/patterns/usePatterns.ts` `deriveArchetype`: accept the optional seed; below the earned gate, return a **provisional** `ArchetypeCard` (`provisional: true`) from the blended multiplier; with no seed + below gate, return `null` (→ placeholder). Earned path unchanged. Add `provisional` to `ArchetypeCard`.
- `src/features/patterns/Archetype.tsx`: `ArchetypeHero` gains a `provisional` marker; add `ArchetypePlaceholder` (skipper invite, deep-links to the quiz).
- Route `src/app/(tabs)/patterns.tsx`: render `ArchetypeHero` when archetype present, else `ArchetypePlaceholder` when below gate and not empty.
- `src/features/patterns/ProgressChart.tsx` / `buildAccuracySeries`: the §2.7 gate change.

**Onboarding:**
- `src/app/(onboarding)/personalize.tsx` (new step) + `src/features/onboarding/` components: `NameAsk`, `TimeStyleQuiz` (reusable — also a modal/Settings entry), `ArchetypeReveal`, and `ArchetypeQuizGlyph.tsx` (the two-tone SVG set, modeled on `ReasonGlyph`).
- `_layout.tsx` onboarding stack: insert `personalize` before `ready`.

**Home greeting:**
- `src/features/today/useToday.ts`: expose the greeting string (reads the hour, calls `greetingFor`, applies the name-density guard).
- `src/app/(tabs)/index.tsx`: render it at the top.

**Whenbee voice:**
- `src/features/whenbee/`: a `nameDensity` guard helper for sparing name use in companion lines.

**Tokens & skills:**
- Any new spacing/size/color (quiz layout, reveal, provisional pill, greeting) added to `src/theme/tokens.ts` (+ `resolveTheme` line if a new group). No inlined raw values.
- Mandatory skills at build time: `react-native-expert`, `typescript-expert`, `ui-design:react-native-design`/`visual-design-foundations`/`mobile-ios-design`/`interaction-design` + `emil-design-eng`, `creating-reanimated-animations` + `motion-design` (reveal, glyph + chip motion), `svg-animations` (the quiz glyphs + reveal), `conversion-psychology` + `humanizer` (every string), `retention-optimization` (Day-0 framing), `react-native-architecture`/`software-architecture` (store fields, onboarding step).

**Analytics (existing service):** `personalize_shown`, `name_set` / `name_skipped`, `quiz_answered{q,value}`, `quiz_completed{archetype}`, `quiz_skipped`, `archetype_reopened`.

---

## 4. Data flow

Quiz answers → `seedMultiplierFor` → `M0` → KV (`archetypeSeed`). On Patterns load, `deriveArchetype` reads the seed + the user's completed-log ratios → `provisionalArchetypeMultiplier` → rung → `ArchetypeCard{provisional}`. Once logs cross the earned gate, the data archetype supersedes the seed. Name → `displayName` in settings → `greetingFor(hour, name?)` in `useToday` → Home. All on-device; no network anywhere in this feature.

## 5. Error / edge handling
- No name → bare greeting (never "undefined").
- Skip quiz → no seed → placeholder hero (§2.5).
- Seed present but user later logs lots of data → seed washes out cleanly at the gate (no discontinuity: the blend already trends to data).
- Reduced motion → reveal + glyph animations fall back to still end states; chip selection still reads.
- Wrong/edited name → editable in Settings (dodges the "that's not my name" complaint).

## 6. Testing
- **Engine (TDD):** `seedMultiplierFor` (each answer combo), `provisionalArchetypeMultiplier` (rung shifts as data grows; seed washes out at gate), `greetingFor` (each bucket, name optional, no "undefined"), raised `ACCURACY_TREND_MIN_LOGS` (sparkline vs 2-point fallback boundary).
- **Components:** quiz flow renders + is skippable; chips select with glyphs; reveal renders the archetype; `ArchetypeHero` provisional marker; `ArchetypePlaceholder` invite + re-open; greeting with/without name.
- **Device verify (manual, dark + reduced-motion):** the onboarding quiz, reveal, hero states, Home greeting — screenshot-compare; confirm chips match the reward-chip style.

## 7. Out of scope
- No change to the calibration time-math, gating thresholds (other than the archetype seed + the chart gate), or RevenueCat.
- No LLM. The quiz is deterministic rules.
- Companion-naming ("what should I call Whenbee?") from doc 12 §5 is a **future** add-on, not this feature.
- Light-mode polish follows dark-mode sign-off (tokens already carry both).

## 8. Stacking note
Because this extends the Patterns redesign, its PR bases on `worktree-patterns-redesign` and must merge **after** PR #30. The chart fix (§2.7) touches redesign-only code, which is why it lives here rather than as a standalone commit on main.
