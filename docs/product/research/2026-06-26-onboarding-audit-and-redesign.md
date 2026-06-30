# Onboarding Audit + Retention Research + Redesign Spec

**Date:** 2026-06-26
**Scope:** Full audit of the current Whenbee onboarding flow, evidence-backed research on what onboarding patterns drive retention/stickiness (and what to avoid), and a concrete redesign spec + visual mock to guide implementation.
**Status:** Research + spec. No code written yet — implementation gated on founder approval of the flow + visuals.
**Rev b (2026-06-26):** Two adjustments after the "10-step / intro-guide" question — (1) quiz 3 → **4** value-bearing questions (added seed-sharpening `sink` Q; no padding, hard cap 4); (2) notification soft-ask **moved off Ready → after the first calibration**. The "~10 steps" heuristic is paywall-funnel advice and does **not** apply to us (no paywall in onboarding); no feature tour/carousel — teach by doing. Everything else in v1 stands.

> Read order: §1 (what we have today) → §2 (what the evidence says) → §3 (the gap) → §4 (redesigned flow + specs) → §5 (copy) → §6 (motion) → §7 (metrics) → §8 (build plan). Mock: `docs/product/specs/mocks/onboarding-redesign-v1.html`.

---

## 0. TL;DR

Whenbee's onboarding is **already well above average** — premium motion, a no-guilt voice, an on-device privacy promise, and a genuine personalization payoff (the archetype reveal). It is not broken. The evidence says the highest-leverage moves are about **sequence, hand-off, and earning each ask**, not a rebuild:

1. **Reorder for peak-end.** Put the reward (archetype reveal) *before* the chore (picking categories). Today the user does setup work (categories) before any payoff.
2. **Reflect answers back, visibly.** The reveal should read as *computed from what you just told me*, not a generic card. This is the single highest-converting move in every top app studied (Rise, Opal, Noom, Cal AI).
3. **Never land on a dead screen.** The #1 silent killer: onboarding ends, user hits an empty Today. Hand them **one obvious first action** (time your first thing) — because Whenbee's real aha (guess → timer → honest number) can only happen *after* onboarding, the hand-off IS the activation funnel.
4. **Prime permissions, don't cold-ask.** Notifications get a framed soft-ask tied to value ("a gentle nudge when a timer ends — never a streak to break"), fired *after the first calibration* (rev b) — not a native prompt on a blank screen.
5. **Keep it short and keep the paywall out.** Calibration is free; the payoff bundle is Pro. Onboarding stays pure activation — this is already correct and a competitive advantage. Do not import the Noom/Cal-AI quiz-funnel-into-paywall pattern.

Everything below is the evidence and the build detail behind those five.

---

## 1. Current-state audit

Flow today (8 screens): `welcome → categories → name → quiz/0 → quiz/1 → quiz/2 → reveal → ready` → `(tabs)`.

### 1.1 Screen-by-screen

| # | Route | Job | Headline | CTA | Collects |
|---|---|---|---|---|---|
| 1 | `(onboarding)/welcome.tsx` | Value anchor | "You're not lazy. You're a time optimist." | Get started → | nothing |
| 2 | `(onboarding)/categories.tsx` | Pick what to learn | "What makes you run late?" | Continue → | 1–N categories (seed + custom) |
| 3 | `(onboarding)/name.tsx` | Optional nickname | "What should I call you?" | Continue / Skip | display name (optional) |
| 4–6 | `(onboarding)/quiz/[step].tsx` | Personalization quiz | Q1 pace / Q2 mid-task / Q3 focus | Next → / Skip | 1 required + 2 optional answers |
| 7 | `(onboarding)/reveal.tsx` | Archetype payoff | "YOUR TIME PERSONALITY" + 1 of 4 types + multiplier | Continue → | nothing (writes seed) |
| 8 | `(onboarding)/ready.tsx` | Completion ceremony | "One tap to start. One tap to ripen." | Open my day → | nothing (commits all) |

**The quiz (`src/features/onboarding/quizQuestions.ts`):** 3 questions.
- **Q1 `pace` (required):** "When you plan your day, things usually take…" → `about` / `bit` / `lot` / `lose`. Drives the seed multiplier: `{about:1.15, bit:1.5, lot:2.1, lose:3.0}`.
- **Q2 `mid` (optional):** "Mid-task, you usually…" → `track` / `rabbit`. `rabbit` multiplies seed ×1.15.
- **Q3 `focus` (optional):** "You focus best…" → `morning` / `evening` / `varies`. Cosmetic only.
- Seed → 1 of 4 archetypes: Steady Reader (m<1.3) / Gentle Optimist (1.3–1.8) / Sprint Optimist (1.8–2.6) / Dreamer (≥2.6). `engine/archetypeSeed.ts`, `usePersonalize.ts`.

**State & persistence (`stores/onboardingStore.ts`):** Zustand + KV. Persists `completed`, `picked`, `quizAnswers`. `complete()` writes categories to `categoriesStore`, sets `completed=true`, fires `onboarding_completed`, `router.replace('/(tabs)')`. Retake path exists via `(modals)/archetype-quiz.tsx` without resetting `completed`.

**Motion:** Fade + scale + SVG-path only (no slide-up/bounce, per the app invariant). Staggered `FadeInDown` at `enterStagger` 70ms; reveal card has a one-pass light sweep; quiz options have a coin-edge press; the bee/lock/crest glyphs have ambient loops paused off-screen. All respect `useReducedMotion()`. This is genuinely good and on-brand — keep it.

**Analytics already firing:** `personalize_shown`, `name_set`/`name_skipped`, `quiz_skipped`, `quiz_completed` (with archetype), `archetype_reopened`, `onboarding_completed` (categories count + custom flag).

### 1.2 Friction points found in the code

1. **Work-before-reward ordering.** Categories (a chore) and the optional name step both sit *before* the quiz and the reveal payoff. The first dopamine hit (your archetype) arrives only on screen 7.
2. **Name step is a disconnected, optional, cosmetic full screen mid-flow** — a pure friction tax between categories and the quiz with no payoff attached.
3. **Quiz "Skip" is opaque** — top-right Skip jumps straight to ready, silently discarding the reveal; no signal of what's lost.
4. **The reveal doesn't *show its work*.** It states the type and multiplier but never visibly ties them to the answers the user just gave, so the personalization can read as canned.
5. **No first-run bridge.** `complete()` → `replace('/(tabs)')`. If Today is empty, the user lands on a dead screen the instant motivation peaks. **This is the biggest gap.**
6. **No permission priming.** Notifications (and, for Pro, calendar) are never primed in-flow; the user meets cold native prompts later, after the motivated moment has passed.
7. **Mastery trail ("Raw → Setting → Ripening → Thickening → Honest") is unlabeled** — a nice visual with no legend, so its meaning is lost.
8. **Seed multiplier is recomputed live from `pace`**; swiping back and changing the answer silently changes the revealed type with no acknowledgement.

---

## 2. What the evidence says

Two research passes (25+ sources each: RevenueCat State of Subscription Apps 2025, Reforge/First Round, Appcues, Superwall, screensdesign teardowns, Mobbin flows, academic IKEA-effect work, Adapty, Userpilot benchmarks). Full citations at §9.

### 2.1 Onboarding is the biggest Day-0 retention lever
- Users who complete onboarding retain **2–3× higher**; the most-cited single fix is removing one forced step before value, worth **15–30% on D1** [vmobify].
- The mechanism is **time-to-value**: products that deliver the aha within ~5 min show **~40% higher 30-day retention** than those needing 15+ min [Amplitude].
- **Activation = the user performing the action that correlates with long-term value.** More users to "aha" in the first session lifts D1/D7/D30 [Chameleon]. A 25% activation lift ≈ ~34% revenue [Userpilot].

### 2.2 The reflect-answers-back / personalization-reveal move (the highest-value pattern)
Every top app converts on the same beat: **ask a few things, then mirror them into a tangible, "built-for-me" artifact.**
- **Rise (sleep):** quiz → "building your personalized plan" → shows your computed sleep-need number **and lets you adjust it** → personal Energy Schedule. Co-built, not extractive [screensdesign].
- **Opal (screen time):** reads real data → "*Jacob, Opal will get you back 5 years of your life*" + before/after chart. Retention.Blog argues this projection is the conversion engine [retention.blog].
- **Cal AI / Noom:** the whole funnel exists to make the final "your plan" reveal feel earned; loaders that show your inputs "shaping the plan" convert the sunk cost [RevenueCat Noom teardown].
- **Psychology:** sunk-cost + labor-illusion + the **IKEA effect** (Norton/Mochon/Ariely 2012 — effortful self-made results are valued more) — **but only if the effort ends in a completed, credible result.** A quiz that dead-ends destroys the effect [ScienceDirect].

→ **Whenbee's archetype reveal is exactly this move** and it's already built. The work is to make it *visibly computed from the answers*, and to put it *before* the setup chore.

### 2.3 "Earn the aha" vs "instant value" — and which Whenbee is
- Longer onboarding can convert *better* when value is non-obvious and the user has no concrete first action in mind (Rise CTO: *"fewer screens is not actually better… if it creates more value but needs more friction, we do it"*) [RevenueCat]. Lose It! raised trial rates **double digits** purely by adding questions (the *promise* of personalization) [RevenueCat].
- BUT global onboarding completion after 30 days is **~8.4%** — every step is an exit [Digia]. Long flows only pay in high-intent categories.
- **Whenbee's specific situation:** the true aha (guess → timer → honest number) **cannot physically happen inside onboarding** — it needs a real timed task. So onboarding's job is *not* to deliver the aha; it's to (a) deliver a **proxy aha** (the archetype reveal, computed from the quiz) and (b) **hand the user straight into the real first calibration.** This is the How We Feel / Tiimo model (short, activation-first), **not** the Noom model. A few personalization questions are right; a 50-screen funnel is wrong.

### 2.4 The post-onboarding hand-off is where apps die silently
- **84% of 3-day-trial cancellations happen within 24h; 55% on Day 0** [RevenueCat State of Subscription Apps 2025].
- The fix is **one obvious first action**, not more information — "the solution isn't more information, it's fewer choices." Greg → "add your plants, take a photo"; Structured → builds day one *inside* onboarding; Routinery → starter routine in ~2 min; Duolingo → withholds the dashboard until *after* the first lesson [UserOnboard, RevenueCat post-purchase screen].
- **Empty states are an onboarding surface, not a 404** — "two parts instruction, one part delight" [UserOnboard].

### 2.5 Permission priming
- **Soft-ask first** (in-app, with context) then fire the one-shot native prompt only after a yes; users are **~89% more likely to opt in when they trigger the prompt themselves** [Appcues, OneSignal].
- iOS denial is effectively permanent — never burn the native prompt cold [vmobify]. Opal's "request Screen Time last, privacy-framed" is the clean pattern [Mobbin].

### 2.6 Anti-patterns to avoid (most are already banned by our invariants)
- Guilt copy on permission denial — Reflectly's *"YOU SAID NO TO MY SMALL REMINDERS?"* [Medium]. **We forbid this.**
- Streak/badge shame loops — Stoic rewards the first reflection with a streak + badges [screensdesign]. **We forbid streaks.**
- Premature paywall before the first win — Bend fires its paywall before any stretch [screensdesign]. **Our paywall isn't in onboarding — keep it that way.**
- Permission stacking on cold launch; generic feature-led copy ("track your progress, build a streak" → 0.58% convert) [Adapty, Medium]; creeping paywalls that move free→paid (Routinery, toxic to the ADHD audience) [r/adhdwomen].

### 2.7 The closest role models (and why)
**How We Feel** (free, ~1 min to first check-in, no account wall, reflection *is* the product) and **Tiimo** (neurodivergent planner; onboarding literally titled *"how to start planning even if you hate planning,"* unfinished tasks move to tomorrow, never failed). Both are short, anti-shame, activation-first, and make the user's own input the payoff — Whenbee's exact ethos. **Llama Life** (ADHD timeboxing where *time estimation is the product*, gentle end-chime, mascot not drill sergeant) is the nearest functional cousin and validates "make time visible" as the transferable aha.

---

## 3. The gap (audit × evidence)

| Evidence principle | Whenbee today | Action |
|---|---|---|
| Reward before chore (peak-end) | Categories + name *before* reveal | **Reorder:** quiz → reveal → categories |
| Reflect answers back, visibly | Reveal states type but hides its math | **Show the answer→number link** on the reveal |
| One obvious first action at hand-off | `replace('/(tabs)')` → possibly empty | **Add a first-run primer** funnelling to first guess |
| Prime permissions, don't cold-ask | No priming | **Framed soft-ask** for notifications on ready |
| Earn each ask; keep it short | Name = friction with no payoff | **Fold name** into the warm moment, drop the standalone screen |
| No dead ends / no shame | (already compliant) | Keep; add a micro-legend to the mastery trail |
| Paywall out of onboarding | (already compliant) | Keep — it's an advantage |

---

## 4. Redesigned flow + specs

**Design principle:** *Short, activation-first, reward-before-chore, ending in one real action.* Same ~7 beats, resequenced so investment compounds into a payoff and the payoff funnels into the first calibration.

### 4.1 New sequence

```
1  Welcome          value anchor — the honest number (keep, tighten)
2  Quiz Q1–Q4       start personalization immediately (investment) — 4 value-bearing Qs, no padding
3  Reveal           proxy aha — archetype computed from your answers (PEAK)
4  Categories       motivated setup — "sharpen your number where it slips"
5  Ready            one real action + optional nickname folded in (NO soft-ask here)
   ──────────────── (tabs) ────────────────
6  First-run Today  guided empty state → "Time your first thing"
7  Notif soft-ask   fires AFTER the first calibration — value already landed
```

Rationale: open with value (Welcome), spend the user's effort *up front* on the quiz (sunk-cost/IKEA), pay it off immediately with the reveal (peak), *then* ask for the categories chore while motivation is high, then hand off into the real loop. Name moves from a standalone friction screen to a quiet optional line inside the warm Ready moment.

### 4.2 Screen specs

All values are existing tokens from `src/theme/tokens.ts` (`useTheme()`); the mock encodes them verbatim. Light theme is the hero.

**① Welcome** — *keep, tighten.*
- Headline `fontSize['2xl']` / `fontWeight.bold` / `letterSpacing.tight`, `colors.ink`: **"You're not lazy. You're a time optimist."**
- Body `body` / `inkSoft` / `lineHeight.relaxed`: one sentence, then the **OverflowBar** (guess 15m vs honest 24m) as the live value proof. Keep the "An example — yours come from your own timers" footnote.
- Privacy footer card (LockGlyph): **"No account, no email. Everything stays on this phone."** — strong differentiator, keep.
- CTA `AppButton` default (md), indigo, full-width: **"Show me how →"**
- Progress: dot 1 of 5.

**② Quiz (Q1–Q3)** — *move earlier; reduce first-step pressure; add micro-context.*
- Keep the `BeeMascot` (`companion.quizBee` 92px) above each prompt.
- Prompt `subtitle` / `medium`; global subtext (keep): "No right answer here. Pick what's true most days, and I'll learn from it."
- **Add a one-line "why I ask" under Q1** (`sm` / `inkFaint`): "This sets your starting point — it sharpens the moment you time a real task." (kills the "data grab" read, per Noom teardown principle).
- Q1 keeps the safe `lose` ("I lose track") option = the "can't fail screen 1" pattern.
- Options: keep coin-edge `QuizOption` + the `ArchetypeQuizGlyph` stroke-draw on select.
- **Clarify Skip:** relabel the top-right control to **"Skip to my type"** so the trade is explicit, not silent.
- **Quiz length — 3 → 4 questions (rev b).** The "~10 steps" heuristic is *paywall-funnel* advice (length manufactures sunk-cost to lift trial conversion). **We have no paywall in onboarding**, so length-for-sunk-cost buys us nothing; a step only earns its place if it (a) sharpens the seed/honest number or (b) makes the reveal feel more *yours*. On that test we add exactly **one** value-bearing question and stop. Final quiz:
  - Q1 `pace` (required) — seeds the multiplier.
  - Q2 `mid` (track / rabbit) — seeds (×1.15 on rabbit).
  - **Q3 `sink` (NEW, seed-sharpening):** "Where does time run away from you most?" → meetings / chores / errands / deep work. Feeds a per-area prior so the first honest number is sharper *and* the reveal echo can name it. (Engine: extend `archetypeSeed` to weight the matching category prior; logic-layer, TDD.)
  - Q4 `focus` (mornings / evenings / varies) — cosmetic personalization flavor only; kept because it makes the reveal feel tailored at near-zero friction. If it ever reads as filler, cut it — do **not** replace it to chase a step count.
  - **Do not exceed 4.** No padding to hit 10.
- Progress: dots 2 of 5 (the 4 quiz steps share one segment with an inner 1/4·2/4·3/4·4/4 fill, so the bar doesn't feel like 9 steps).

**③ Reveal** — *make it show its work; this is the peak.*
- Keep the premium dark collectible card (`reveal.*` tokens, gradient + bloom + one-pass sweep).
- Eyebrow: **"YOUR TIME PERSONALITY"**.
- **NEW — answer→number line** above the title (`bodySm` / `reveal.blurbOn`): a compact echo of the inputs, e.g. *"You plan tight · rabbit-hole on deep work →"* then the big multiplier. Now that `sink` is captured (rev b), the echo can name the area too. This is the reflect-back move (Rise/Opal). It makes the number provably *yours*.
- Title = archetype; multiplier `{m.toFixed(1)}×` with caption "your guess, on average"; blurb.
- Soften the disclaimer to match the warm voice: *"A first read from your answers. Every task you time makes it sharper — and your type can move as your numbers do."*
- CTA: **"Sharpen it on my tasks →"** (bridges into categories with intent, not a generic "Continue").
- Progress: dots 3 of 5.

**④ Categories** — *now a motivated setup, reframed.*
- Headline: **"Where does time slip most?"** (was "What makes you run late?" — reframe from blame to the thing they just learned about themselves).
- Body: "Pick a few. I'll sharpen your honest number here first." Keep seed chips + "Add your own" + count-aware nudge.
- CTA: **"Continue →"** (disabled < 1 pick).
- Progress: dots 4 of 5.

**⑤ Ready** — *one real action; name folded in. (Soft-ask removed — see ⑦, rev b.)*
- Headline (keep the cadence): **"One tap to start. One tap to ripen."**
- Keep the **HoneyTrail** but add a one-line legend (`sm` / `inkFaint`): "Raw → Honest: your accuracy ripens as you log. It only ever ripens — no streak to break." (fixes the unlabeled-trail gap; reinforces no-guilt).
- **Name folded here**, quiet and optional: a single ghost line — "Anything I should call you?" inline field, skippable, no payoff theatre. (Removes the standalone screen; keeps the ~13% activation lift from asking.)
- CTA: **"Time my first thing →"** (was "Open my day" — names the *action*, not the destination).
- **Why no soft-ask here (rev b):** Ready was the densest screen, and a notification ask *before* the user has felt any value is weaker. Moved to right after the first calibration, where value just landed and the ask is self-evidently relevant (per OneSignal: user-triggered/at-peak-relevance opt-in ≈ +89%).

**⑥ First-run Today (the hand-off)** — *new, the most important addition.*
- After `complete()`, Today must render a **guided first-run state**, never a blank list. One card, one action: **"Time your first thing"** with a tap-to-add affordance and a single line: "Guess how long it'll take, hit start, and I'll show you the honest number." This is the empty-state-as-onboarding surface (UserOnboard: two parts instruction, one part delight). The first guess→timer→complete is the **activation event** we measure.

**⑦ Notification soft-ask — after the first calibration (rev b, moved from ⑤).**
- Fires once, immediately after the **first** `guess → timer → completed` (the moment the first honest number is revealed) — never on a cold screen, never before value.
- In-app card (amber-tinted, not the native prompt): "Want a gentle nudge when a timer ends? No streaks, no scolding — just the honest number when it counts." → **"Sounds good"** fires the one native prompt; **"Not now"** dismisses and is re-offerable later from another relevant moment. Soft-ask state lives in KV; the native prompt fires only on accept (iOS one-shot).
- Calendar permission stays out entirely — it's Pro, primed inside the Pro feature.

### 4.3 What we are deliberately NOT doing
- No paywall in onboarding (calibration is free; payoff bundle is Pro). 
- No streaks, badges, or guilt copy anywhere (invariant).
- No 30–50 screen quiz funnel (wrong model for us; value is delivered by doing, not by a longer survey).
- No cold native permission prompts.
- No calendar permission in onboarding (calendar is Pro; prime it inside the Pro feature, not here).

---

## 5. Copy (shaped by conversion-psychology + humanizer)

Principles applied: name the shared failure and absolve (Tiimo); concrete over abstract; one clear CTA per screen that names the *action*; no AI-slop tells (no "unlock," "seamless," "elevate," no em-dash overuse, no rule-of-three padding); no guilt.

| Screen | Element | Copy |
|---|---|---|
| Welcome | Headline | You're not lazy. You're a time optimist. |
| Welcome | Body | I learn how long things really take you, then show the honest number — so you stop planning around a guess. |
| Welcome | CTA | Show me how → |
| Quiz Q1 | Why-I-ask | This sets your starting point. It sharpens the moment you time a real task. |
| Quiz Q3 | Prompt (new) | Where does time run away from you most? |
| Quiz Q3 | Options | Meetings · Chores · Errands · Deep work |
| Quiz | Skip control | Skip to my type |
| Reveal | Answer echo | From your answers: |
| Reveal | Disclaimer | A first read from your answers. Every task you time makes it sharper — and your type can move as your numbers do. |
| Reveal | CTA | Sharpen it on my tasks → |
| Categories | Headline | Where does time slip most? |
| Categories | Body | Pick a few. I'll sharpen your honest number here first. |
| Ready | Trail legend | Raw → Honest: your accuracy ripens as you log. It only ever ripens — no streak to break. |
| Ready | Name line | Anything I should call you? (optional) |
| Ready | CTA | Time my first thing → |
| First-run | Card | Time your first thing — guess how long it'll take, hit start, and I'll show you the honest number. |
| Post-calibration | Notif soft-ask | Want a gentle nudge when a timer ends? No streaks, no scolding — just the honest number when it counts. |

---

## 6. Motion (within the app's hard rules)

No slide-up, no bounce/overshoot on content; fade / opacity / subtle scale / SVG-path only; durations ≤ motion tokens; reduced-motion → final state. All already honored — the redesign adds no new motion classes, only:
- **Reveal answer-echo line:** opacity fade in the existing reveal stagger (slot it at ~180ms, before the title at 320ms). No movement.
- **Notification soft-ask card (Ready):** appears at full opacity in the existing `Reveal` stagger — no special entrance (buttons/cards never animate in per the rule).
- **First-run Today card:** opacity fade only.

Keep the coin-edge press on options, the one-pass reveal sweep, and the ambient glyph loops (paused off-screen).

---

## 7. Metrics & targets

**Activation event (define + instrument):** first task `guess → timer start → completed` (the first real calibration). This is the number the whole redesign optimizes.

**Funnel events to add/keep:** `welcome_shown` → `quiz_started` → `quiz_completed` → `reveal_shown` → `categories_committed` → `onboarding_completed` → `first_task_started` → `first_task_completed` (= activation) → `notif_softask_shown`/`_accepted`/`_declined` (fires post-calibration, rev b).

**Targets (Productivity benchmarks, retention-optimization skill):**
| Metric | Benchmark "good" | Our target |
|---|---|---|
| Onboarding completion | B2C 30–50% | ≥ 60% (no paywall, short flow) |
| First-task activation (D0) | activation median ~25% | ≥ 35% reach first completed calibration |
| D1 retention | > 25% | ≥ 30% |
| D7 retention | > 8% | ≥ 12% |
| D30 retention | > 8% | ≥ 10% |

Validate with **realized behavior**, not vanity completion — a finished onboarding that doesn't reach a first calibration is a fail.

---

## 8. Build plan (after founder approves flow + visuals)

Logic-first, TDD where it's logic (per project discipline). Suggested ordering:
1. **Reorder routes** in `(onboarding)/_layout` + nav calls: welcome → quiz → reveal → categories → ready. Update `onboardingFlow.ts` progress mapping (5 segments; quiz = 1 segment with internal 4-step fill).
2. **Quiz Q3 `sink`** — add the question + extend `engine/archetypeSeed.ts` to weight the matching category prior (pure, TDD). Keep Q4 `focus` cosmetic.
3. **Reveal answer-echo** — derive the echo string from `quizAnswers` (incl. `sink`) in `usePersonalize`/`ArchetypeReveal`; pure, unit-testable.
4. **Categories reframe** copy + headline.
5. **Ready:** trail legend + fold the optional name field in. **No soft-ask here.**
6. **First-run Today state** — the empty/guided state funnelling to first task (this touches the Today feature, not just onboarding).
7. **Post-calibration soft-ask** — after the first `first_task_completed`, show the notification soft-ask card wired to a guarded `notifications` service (soft-ask state in KV; fire native prompt only on accept; re-offerable on decline).
8. **Analytics** — add the funnel events above; define activation.
9. Lint + typecheck + test; device-verify the flow on the sim per the CLAUDE.md deep-link recipe.

Each is a small PR on its own branch (ask before branching, per project rule). Drop the standalone `name.tsx` route only after the folded field ships.

---

## 9. Sources

Retention/onboarding pass: Amplitude (time-to-value); Chameleon & Mode & benchhacks & Mixpanel (aha/activation); userguiding & Appcues/goodux (Duolingo); uxcam (Headspace/Calm); screensdesign & Superwall & TechCrunch (Cal AI); web2appworld & RevenueCat (Noom); Medium/Bootcamp & Page Flows (Finch); The Behavioral Scientist (Fabulous); Mobbin (Opal); First Round & howtheygrow (Superhuman); Appcues & OneSignal & Apple Developer & MoEngage (permission priming); RevenueCat *State of Subscription Apps 2025*, hard-vs-soft-paywall, post-purchase-screen, "why your onboarding might be too short", paywall-redesigns; ScienceDirect/HBS (IKEA effect — Norton/Mochon/Ariely 2012); Yu-kai Chou & DelightPath (Fogg/Hook); Userpilot & Plotline (benchmarks); vmobify & decode.agency & reteno & designerup (anti-patterns); UXmatters (cognitive biases); Digia (completion stats); Adapty (24h-delete, permission overload); UserOnboard/Samuel Hulick (empty states); retention.blog (chat onboarding, longest-onboarding); Tiimo, Llama Life (Focus Bear review), Sunsama docs, Routinery/r/adhdwomen, How We Feel (Mobbin/Yale/Marc Brackett), Reflectly (Medium reviews), Bend/Stoic/Structured/Reflectly (screensdesign teardowns).

Internal: code audit of `src/app/(onboarding)/*`, `src/features/onboarding/*`, `src/stores/onboardingStore.ts`, `src/engine/archetypeSeed.ts`, `src/theme/tokens.ts` (this session).
</content>
