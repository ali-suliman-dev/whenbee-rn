# Onboarding Quiz + Reveal Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the onboarding personality flow — split name/quiz/reveal into per-step routes with accurate progress, an immersive companion-led quiz with no auto-advance, an animated "collectible crest" reveal, and a restyled Patterns archetype stat-sheet.

**Architecture:** Convert the single `personalize` route (internal phase machine) into discrete `(onboarding)` routes (`name`, `quiz/[step]`, `reveal`) so native stack swipe-back and a real per-step progress indicator work. Quiz answers live in `onboardingStore`. New presentational components are pure and token-driven. Reveal + Patterns cards are separate components (crest vs stat-sheet).

**Tech Stack:** Expo SDK 54, expo-router 6 (typed routes), Zustand (`onboardingStore` + `zustandKv`), react-native-reanimated, react-native-svg, the engine (`saveQuiz`), `tokens.ts`/`useTheme`.

## Global Constraints

- Expo SDK 54 only; use `npx expo install` for deps; `npx expo-doctor` 18/18.
- Every spacing/size/color/radius/opacity/motion value comes from `tokens.ts` via `useTheme()`. New value → add a token (+ matching `useTheme` resolve line) — never inline a raw number/hex.
- `src/app/**` and `src/components/**` must NOT import `src/services/*` or `src/db/*`. Route through store/provider/feature hook.
- Routes in `src/app/` are thin — logic in `src/features/*`/`src/stores/*`/engine.
- Reanimated: read/write shared values with `.get()/.set()`, never `.value`. No `exiting` layout animations (Fabric SIGABRT) — entering-only. Imported helpers used in worklets need `'worklet';`.
- Footers pinned to bottom add `useSafeAreaInsets().bottom`.
- Product invariants: no guilt, no streaks, no shame; honey/sharpness monotonic; one filled/indigo/fullWidth primary CTA per screen.
- All user-facing copy is warm, humanizer-passed, no AI-slop, no "rare"/rank/streak language. Exact strings: quiz subtext `No right answer here. Pick what's true most days, and I'll learn from it.`; reveal blurb `Your guesses already land close to reality. I'll sharpen this with every task you log.`; share label `Share my archetype`.
- Run `npx eslint <files>` + `npx tsc --noEmit` + relevant `npx jest` before each commit. Conventional Commits, NO AI/co-author trailers. NEVER merge — open a PR and stop.
- Verify UI on the simulator (`npm run ios`); reduced-motion paths must settle to final state.

---

### Task 0: Branch + tokens

**Files:**
- Modify: `src/theme/tokens.ts`
- Modify: `src/theme/useTheme.ts` (add resolve line for any new token group)

**Interfaces:**
- Produces: `t.reveal` group `{ crestW, coinHex, gradient stops keys }`, `t.quizComb` group `{ cell, gap }`. (Reuse existing `honeycomb`, `accent`, `accentEdge`, `primaryEdge`, `gradients`, `motion`, `burst.coinEdge` where they already fit; only add what's missing.)

- [ ] **Step 1:** Create branch: `git checkout -b feat/onboarding-quiz-reveal-redesign` (carries the already-done name-screen fix + the spec/plan docs).
- [ ] **Step 2:** Add a `reveal` token group to `tokens.ts` (geometry/motion only — colors come from existing `colors`/`brand`): crest hex width, coin-hex width, the reveal gradient is built from existing `colors` so no new hex. Add `quizComb: { cell, gap }` reusing `honeycomb` ratios. Add the matching line(s) to `useTheme`'s resolve so `t.reveal`/`t.quizComb` are defined (see [[usetheme-token-enumeration]]).
- [ ] **Step 3:** `npx tsc --noEmit` → clean.
- [ ] **Step 4:** Commit: `git commit -am "feat(onboarding): add reveal + quiz-comb tokens"`.

---

### Task 1: Quiz answers + gating in onboardingStore (TDD)

**Files:**
- Modify: `src/stores/onboardingStore.ts`
- Test: `src/stores/__tests__/onboardingStore.quiz.test.ts`

**Interfaces:**
- Produces: store fields `quizAnswers: Partial<QuizAnswers>`, `setQuizAnswer(key, value)`, `clearQuiz()`, selector `quizComplete()` (true once `pace` set), and `QUIZ_STEPS: readonly (keyof QuizAnswers)[]` exported (`['pace','mid','focus']`). Reveal route reads `quizAnswers`; only reachable after Next on the last step.

- [ ] **Step 1: Failing test** — answering steps accumulates, `clearQuiz` resets, `quizComplete` reflects `pace`:
```ts
import { useOnboardingStore } from '@/src/stores/onboardingStore';
test('quiz answers accumulate and gate', () => {
  const s = useOnboardingStore.getState();
  s.clearQuiz();
  expect(useOnboardingStore.getState().quizAnswers).toEqual({});
  s.setQuizAnswer('pace', 'bit');
  expect(useOnboardingStore.getState().quizAnswers.pace).toBe('bit');
  s.setQuizAnswer('mid', 'track');
  expect(Object.keys(useOnboardingStore.getState().quizAnswers)).toHaveLength(2);
});
```
- [ ] **Step 2:** Run `npx jest src/stores/__tests__/onboardingStore.quiz.test.ts` → FAIL.
- [ ] **Step 3:** Implement `quizAnswers`/`setQuizAnswer`/`clearQuiz`/`QUIZ_STEPS` in the store (persisted via existing `zustandKv` config; set flags via captured `state` in `onRehydrateStorage` — never the store const).
- [ ] **Step 4:** Run jest → PASS. `npx eslint` + `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit: `feat(onboarding): persist quiz answers + gating in store`.

---

### Task 2: Archetype traits mapping (TDD)

**Files:**
- Create: `src/features/patterns/archetypeTraits.ts`
- Test: `src/features/patterns/__tests__/archetypeTraits.test.ts`

**Interfaces:**
- Produces: `archetypeTraits(answers: Partial<QuizAnswers>, multiplier: number): { label: string; value: string; amber?: boolean }[]`. Row 1 always present: `{ label:'Runs', value: '${multiplier.toFixed(1)}× long', amber:true }`. `mid` → `{ label:'Mid-task', value: 'Stays on track' | 'Falls down rabbit holes' }`. `focus` → `{ label:'Sharpest', value:'Mornings'|'Evenings'|'Varies' }`. Missing answers drop their row.

- [ ] **Step 1: Failing test:**
```ts
import { archetypeTraits } from '@/src/features/patterns/archetypeTraits';
test('builds rows from answers', () => {
  const r = archetypeTraits({ pace:'bit', mid:'track', focus:'morning' }, 1.1);
  expect(r[0]).toEqual({ label:'Runs', value:'1.1× long', amber:true });
  expect(r).toHaveLength(3);
});
test('drops rows for missing answers', () => {
  expect(archetypeTraits({ pace:'bit' }, 1.4)).toHaveLength(1);
});
```
- [ ] **Step 2:** Run jest → FAIL.
- [ ] **Step 3:** Implement the pure mapping (exhaustive `mid`/`focus` value→label maps; `noUncheckedIndexedAccess`-safe).
- [ ] **Step 4:** jest PASS; eslint/tsc clean.
- [ ] **Step 5:** Commit: `feat(patterns): archetype traits mapping helper`.

---

### Task 3: QuizProgressComb component (UI)

**Files:**
- Create: `src/features/onboarding/QuizProgressComb.tsx`
- Test (interaction/snapshot, optional): `src/features/onboarding/__tests__/QuizProgressComb.test.tsx`

**Interfaces:**
- Produces: `<QuizProgressComb total={number} current={number} />` — a centered row of flat-top honey-comb cells; cells `< current` honey-filled (`accent`), `=== current` partial/active, `> current` sunken (`surfaceSunken`). Geometry from `t.quizComb`/`t.honeycomb`. Reanimated honey-fill on the current cell (`motion.honeyFill`, `Easing.out`); reduced-motion → final. Entering-only.

- [ ] **Step 1:** Build the component (SVG flat-top hex via the `hexPath` pattern from `Honeycomb.tsx`; do not import Honeycomb's cell — it is category-bound). Tokens only.
- [ ] **Step 2:** `npx eslint` + `npx tsc --noEmit` clean.
- [ ] **Step 3:** Commit: `feat(onboarding): honey-comb quiz progress indicator`.

---

### Task 4: QuizOption (tile + row) component (UI)

**Files:**
- Create: `src/features/onboarding/QuizOption.tsx`

**Interfaces:**
- Produces: `<QuizOption layout="tile"|"row" label glyph={QuizGlyphKind} selected onPress />`. Reuses `ArchetypeQuizGlyph` (with `active={selected}`). Selected = `primaryChip` fill + indigo coin-edge (`primaryEdge`, depth from `burst.coinEdge`/`depth`) + 2px lift; press-in `scale.pressIn`. Pressable is a bare wrapper; visual style on an inner View (reactCompiler gotcha). Light haptic on select (expo-haptics, guarded).

- [ ] **Step 1:** Build `QuizOption` (tile = column glyph-over-label; row = horizontal glyph+label). Tokens only; coin-edge like `AppButton`.
- [ ] **Step 2:** eslint/tsc clean.
- [ ] **Step 3:** Commit: `feat(onboarding): quiz option tile/row with select feedback`.

---

### Task 5: Routes — split personalize into name / quiz/[step] / reveal

**Files:**
- Create: `src/app/(onboarding)/name.tsx`
- Create: `src/app/(onboarding)/quiz/[step].tsx`
- Create: `src/app/(onboarding)/reveal.tsx`
- Modify: `src/app/(onboarding)/_layout.tsx` (register routes; gestureEnabled per-step back)
- Modify: `src/app/(onboarding)/categories.tsx` (its Continue now → `/name`)
- Delete/Reduce: `src/app/(onboarding)/personalize.tsx` (logic moves out)
- Create: `src/features/onboarding/QuizStepScreen.tsx`
- Modify: `src/features/onboarding/StepProgress.tsx` (now driven by a real global index)
- Modify: `src/features/onboarding/usePersonalize.ts`

**Interfaces:**
- Consumes: store from Task 1 (`quizAnswers`, `setQuizAnswer`, `QUIZ_STEPS`, `clearQuiz`), `usePersonalize` (`saveName`, `saveQuiz`, `trackQuizSkipped`, `trackQuizShown`), `QuizProgressComb` (Task 3), `QuizOption` (Task 4), `ArchetypeReveal` (Task 7), `BeeMascot`.
- Produces: ordered onboarding route list for progress: `['welcome','categories','name','quiz/0','quiz/1','quiz/2','reveal','ready']` (a small `onboardingFlow.ts` constant mapping pathname → index/total). `name` route renders the existing `NameAsk` (already bottom-pinned/autofocus); its Continue → `/quiz/0`. `quiz/[step]` renders `QuizStepScreen` for `QUIZ_STEPS[step]`; Next → next step or (last) `saveQuiz(answers)` then `/reveal`; Skip → `trackQuizSkipped()` + `/ready`. `reveal` reads `quizAnswers`, computes the card via `saveQuiz`, renders `ArchetypeReveal`, Continue → `/ready`.

- [ ] **Step 1:** Create `src/features/onboarding/onboardingFlow.ts` — exported `ONBOARDING_STEPS` array + `stepIndexFor(pathname)` + `ONBOARDING_TOTAL`. (Pure; small jest test that `quiz/1` resolves to its index.)
- [ ] **Step 2:** Update `StepProgress` to accept `current`/`total` from `onboardingFlow` (keep the animated Pill); every onboarding screen passes its real index. (Quiz screens use `QuizProgressComb` instead for the in-quiz feel, but the comb count = number of quiz steps; the top thin bar is dropped on quiz/reveal to avoid double progress — decision in spec.)
- [ ] **Step 3:** Build `QuizStepScreen` (Layout A): `QuizProgressComb` (total = `QUIZ_STEPS.length`, current = step), centered `BeeMascot animated`, bold title (`currentQuestion.prompt`) + warm subtext, options (tile grid for 3–4 / rows for 2 via `QuizOption`), footer one-row **Skip (left, ghost) · Next (right, indigo, disabled until answered)**. Writes via `setQuizAnswer`. No auto-advance.
- [ ] **Step 4:** Create the three route files (`name`, `quiz/[step]`, `reveal`) — thin; wire navigation + store per Interfaces. Register in `_layout.tsx`. Point `categories` Continue → `/name`. Reduce `personalize.tsx` (delete the phase machine; if expo-router needs the file gone, remove it and update any links).
- [ ] **Step 5:** Move the QUESTIONS array + the tile/row layout decision out of `TimeStyleQuiz.tsx` into `QuizStepScreen`/a shared `quizQuestions.ts`; keep `TimeStyleQuiz` only if the re-open modal (`(modals)/archetype-quiz.tsx`) still needs it — otherwise refactor that modal to reuse `QuizStepScreen` in a sheet. (Document which path taken.)
- [ ] **Step 6:** `npx eslint` (all touched) + `npx tsc --noEmit` + `npx jest src/features/onboarding` → clean. Manually verify on sim: swipe-back from quiz step → previous step; progress accurate; reveal not reachable early; Skip → ready.
- [ ] **Step 7:** Commit: `feat(onboarding): per-step quiz routes with accurate progress + swipe-back`.

---

### Task 6: CoinHex + ArchetypeCrest components (UI)

**Files:**
- Create: `src/components/bee/CoinHex.tsx`
- Create: `src/features/onboarding/ArchetypeCrest.tsx`

**Interfaces:**
- Produces: `<CoinHex size mark="✦" />` — flat-top hex with a gradient `accent` face over an `accentEdge` bottom edge peeking below (coin-edge depth, cousin of `CoinBadge`). `<ArchetypeCrest beeSize />` — a symmetric flat-top hexagon (NO stroke, faint honey gradient fill) with a large `BeeMascot` centered and a small `CoinHex` at the hexagon's top-right corner.

- [ ] **Step 1:** Build `CoinHex` (two stacked hex `Path`s: darker edge offset down, gradient face on top; `✦` centered, `onAmber` color). Tokens only.
- [ ] **Step 2:** Build `ArchetypeCrest` (hex SVG fill-only + `BeeMascot` + `CoinHex` top-right).
- [ ] **Step 3:** eslint/tsc clean.
- [ ] **Step 4:** Commit: `feat(reveal): coin-hex seal + archetype crest`.

---

### Task 7: ArchetypeReveal redesign — collectible crest + animation

**Files:**
- Modify: `src/features/onboarding/ArchetypeReveal.tsx` (replace BeeGlyph + flat card)
- Remove crude usage: `src/components/BeeGlyph.tsx` (delete if now unused — grep first)

**Interfaces:**
- Consumes: `ArchetypeCrest` (Task 6). Same props as today: `{ title, blurb, multiplier, onContinue }`.
- Produces: the E1 card (gradient bg, no border, foil shine, amber eyebrow, big title, honey multiplier stat, warm blurb) + Continue pinned at the screen bottom (NOT in the card). Animated reveal choreography per spec.

- [ ] **Step 1:** Replace the card body: gradient background View (build the honey→indigo gradient with `react-native-svg` `LinearGradient` or layered Views — no CSS), `borderWidth: 0`, soft lift via `Platform.select` shadow/view-edge (no stroke). `ArchetypeCrest` at top. Eyebrow `colors.accent`. Move `AppButton` Continue OUT of the card into a bottom-pinned footer in the `reveal` route (so the card is button-less and reusable).
- [ ] **Step 2:** Animation (Reanimated, `.get()/.set()`, entering-only): card+bee rise (`translateY 22→0, scale .96→1`, `motion.reveal`, `easing.out`); foil shine sweep (translateX); CoinHex stamp (`scale 1.8→1` `withSpring` small overshoot, delay ~600); eyebrow→title→stat→blurb→button `fadeUp` staggered (~80ms). After landing, `BeeMascot animated` ambient loop continues. Reduced-motion → final state.
- [ ] **Step 3:** Update/extend the existing reveal test for the reduced-motion final state. eslint/tsc/jest clean.
- [ ] **Step 4:** Delete `BeeGlyph.tsx` if unused (grep `BeeGlyph` → only this file) and remove its import.
- [ ] **Step 5:** Commit: `feat(reveal): animated collectible-crest archetype reveal`.

---

### Task 8: HoneyHexGlyph + Patterns archetype stat-sheet

**Files:**
- Create: `src/components/HoneyHexGlyph.tsx`
- Modify: `src/features/patterns/Archetype.tsx` (`ArchetypeHero` → stat-sheet; `ArchetypePlaceholder` light restyle)

**Interfaces:**
- Consumes: `archetypeTraits` (Task 2), `useShareCard('archetype')`, `HoneyHexGlyph`.
- Produces: `ArchetypeHero` rendering — gradient+centered-shine card (no border); header row = `HoneyHexGlyph` (single honey hex) + column (amber-accent eyebrow over title); three trait rows from `archetypeTraits(card.answers, card.averageMultiplier)` with soft amber hairline dividers; a real **Share pill button below the card** (secondary `raised`, label `Share my archetype`, calls `archetypeShare.onShare`). Keep the off-screen `ShareableCard` capture intact.

- [ ] **Step 1:** Build `HoneyHexGlyph` (one flat-top hex, honey gradient fill, no border).
- [ ] **Step 2:** Rewrite `ArchetypeHero`: gradient card (no border), header (glyph + eyebrow/title), trait rows (map `archetypeTraits`), amber hairlines, Share pill below the card. Ensure `ArchetypeCard` type carries the answers needed for traits (extend `usePatterns` if needed — keep it a selector, no service import).
- [ ] **Step 3:** Lightly restyle `ArchetypePlaceholder` to match (no border).
- [ ] **Step 4:** eslint/tsc + `npx jest src/features/patterns` clean. Verify on sim.
- [ ] **Step 5:** Commit: `feat(patterns): archetype stat-sheet card with share button`.

---

### Task 9: Cleanup, full verification, PR

- [ ] **Step 1:** Remove dead code: old `TimeStyleQuiz` auto-advance/`finish`/"See my type" path if fully replaced; any unused imports. Grep for `personalize` references.
- [ ] **Step 2:** Archive the approved mock: copy `/tmp/whenbee-v5.html` → `docs/product/mocks/2026-06-22-onboarding-quiz-reveal.html`; commit.
- [ ] **Step 3:** Full gate: `npm run lint` + `npm run typecheck` + `npm test` → all green.
- [ ] **Step 4:** Sim walkthrough (reset onboarding container): welcome → categories → name (autofocus, bottom buttons) → quiz×3 (comb fills, no auto-advance, Skip-left/Next-right, swipe-back works) → reveal (animation plays, Continue at bottom) → ready. Plus Patterns tab shows the stat-sheet + share. Screenshot-verify the reveal + stat-sheet against `/tmp/whenbee-v5.html`.
- [ ] **Step 5:** Push branch; open PR (`gh pr create`) with summary + before/after screenshots. **STOP — do not merge.**

---

## Self-Review

**Spec coverage:** routing split (T5) ✓; accurate progress (T0 tokens, T3 comb, T5 onboardingFlow) ✓; no auto-advance + Skip-left/Next-right + swipe-back (T4/T5) ✓; gated reveal (T1/T5) ✓; companion quiz Layout A (T5) ✓; Layout B documented (spec) ✓; E1 animated reveal (T6/T7) ✓; E2 documented (spec) ✓; Patterns stat-sheet (T2/T8) ✓; honey-hex glyph + amber eyebrow + amber hairlines + share pill (T8) ✓; name screen done (pre-existing) ✓; copy strings (Global Constraints) ✓; tokens-only + no new hex inline (T0 + each task) ✓.

**Placeholders:** none — each task has concrete files, interfaces, commands. Logic tasks (T1/T2 + onboardingFlow) carry failing-test code; UI tasks (T3/T4/T6/T7/T8) describe structure (UI-only components don't require TDD per project rules) with exact tokens/behavior.

**Type consistency:** `QuizAnswers` keys `pace|mid|focus` used consistently; `archetypeTraits(answers, multiplier)` signature stable across T2/T8; `QUIZ_STEPS`/`ONBOARDING_STEPS` named consistently; `ArchetypeReveal` props unchanged so T5 wiring matches.

## Risks

- **T5 is the risky refactor** (routing + the `(modals)/archetype-quiz` reuse + StepProgress). Do it carefully, verify swipe-back + progress on-device before moving on. Everything else is additive/visual.
- Keep `usePersonalize`/engine `saveQuiz` semantics intact — only the call sites move.
