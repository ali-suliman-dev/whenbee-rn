# 12 — Onboarding audit (2026-07-15)

**Verdict: NOT production-ready.** Three silent blockers. The craft is ahead of the wiring — the screens are well-written and well-drawn; the flow collects four answers, shows a personalized multiplier, and then the engine uses a population average anyway.

Method: flow mapped from source; all 7 screens captured on the iOS simulator (deep-link + `simctl io screenshot`); every claim below carries a `file:line` and was confirmed by reading the code, not inferred.

Scope: `src/app/(onboarding)/*`, `src/features/onboarding/*`, and the stores/engine paths they touch.

Visual companion: [`12-ONBOARDING-AUDIT.html`](./12-ONBOARDING-AUDIT.html) — every finding and fix, drawn with the real dark-mode tokens.

---

## The flow as built

```
index.tsx (boot gate: completed ? tabs : welcome)
  └─ welcome            1/7
     └─ quiz/0 pace     2/7   ─┐
        └─ quiz/1 mid   3/7    │  "Skip to my type" ──────┐
           └─ quiz/2 sink 4/7  │  (from any step)         │
              └─ quiz/3 focus 5/7                          │
                 └─ reveal    (no bar — celebration)       │
                    └─ categories 6/7                      │
                       └─ ready  7/7  ←────────────────────┘  ⚠ skips reveal AND categories
                          └─ router.replace('/(tabs)')
```

No central router. Each screen hardcodes its own `router.push` (`welcome.tsx:91`, `QuizStepScreen.tsx:63-71`, `reveal.tsx:52`, `categories.tsx:169-170`, `ready.tsx:37-41`).

---

## 🔴 Blocker 1 — The quiz result never reaches the honest number

**The single most important finding.** The quiz is theater.

`archetypeSeed = { m0, source: 'quiz', tookAt }` is written at `usePersonalize.ts:39-46`. It has **exactly two readers in the entire codebase**:

- `src/features/patterns/usePatterns.ts:406` — `const archetypeSeed = useSettingsStore((s) => s.archetypeSeed)`
- `src/features/patterns/usePatterns.ts:416` — `derivePatterns(data, now, { m0 })` → `provisionalArchetypeMultiplier` → **the Patterns tab archetype card label**

Every honest-number path instead resolves `priorFor(category)` — a fixed population constant from `src/engine/priors.ts:8-19`:

| Call site | Line |
|---|---|
| `useAddTask.ts` — **the add-task decision moment** | `:168` |
| `useToday.ts` | `:102` |
| `useDayPlan.ts` | `:98` |
| `useDayCapacity.ts` | `:66` |
| `resolveHonestTasks.ts` | `:69` |
| `useQuickTasks.ts` | `:36` |
| `categoryStatsRepo.ts` — seeds the row's `priorMult` | `:18` |

`blendWithPrior(n, logEwma, prior)` (`multiplier.ts:10-14`) takes `prior` as an argument. **`m0` is never passed as that argument anywhere.**

### Impact

A **Dreamer** (m0 ≈ 3.0) and a **Steady Reader** (m0 ≈ 1.15) who both guess 15 min on `admin` receive the **identical** first honest number: 15 × 2.2 = 35 min. The reveal says "Now you know by how much." The app does not know by how much. It knows the population average, with the user's label printed on top.

This is a truth problem, not just a feature gap: the reveal makes a claim the engine doesn't honor.

### Fix

Wire `m0` into cold-start prior resolution. The seed should anchor the prior while `n` is low, then decay out as real logs arrive — which is exactly what `coldStartAnchor` already does for global bias (`calibrationStore.ts:572`).

```ts
// src/engine/priors.ts — new
/** Population prior, personalized by the quiz seed while the category is cold.
 *  m0 is a whole-person read; the category prior carries the shape. Blend, don't replace. */
export function seededPriorFor(categoryId: string, m0: number | undefined): number {
  const prior = priorFor(categoryId);
  if (m0 === undefined) return prior;
  return clampRatio(prior * (m0 / POPULATION_MEAN_M));  // POPULATION_MEAN_M ≈ 1.8
}
```

Then thread `archetypeSeed?.m0` from `settingsStore` through the honest-number call sites (start with `useAddTask.ts:168` — the decision moment — and `useToday.ts:102`).

**TDD required** (engine + store are logic layer). Tests to write first:
- Dreamer vs Steady Reader produce **different** first honest numbers for the same guess+category.
- Seed influence decays as `n` grows; at `n ≥ SHARPNESS_WINDOW` the seed is irrelevant.
- No seed (skip path) → falls back to exactly today's `priorFor` behavior.
- Honey/sharpness stays monotonic (invariant).

---

## 🔴 Blocker 2 — Two of the four questions are dead

| Answer | Question | Where it actually goes |
|---|---|---|
| `pace` | "When you plan your day, things usually take…" | **Live.** `ARCHETYPE_SEED_PACE[a.pace]` (`archetypeSeed.ts:15`). The only gate: `quizComplete()` checks `pace` alone (`onboardingStore.ts:38-40`). |
| `mid` | "Mid-task, you usually…" | **Live, binary.** Only `'rabbit'` acts: `m *= ARCHETYPE_SEED_RABBIT_BUMP` (`archetypeSeed.ts:16`). `'track'` is a no-op. |
| `sink` | "Where does time run away from you most?" | **Dead beyond copy.** Every read builds a string: `buildRevealEcho` (`archetypeSeed.ts:44,51-53`). Not in `seedMultiplierFor`. Not in `archetypeTraits`. Never reaches engine, db, or category weighting. |
| `focus` | "You focus best…" | **Dead — and misleading.** One Patterns row (`archetypeTraits.ts:38-40`). **Does NOT feed the focus-window planner:** `focusWindowLearn.ts` / `focusWindowInsights.ts` / `focusOrder.ts` derive the window purely from logged `startLocalMinute` events. The user declares "mornings" and the planner relearns it from scratch, ignoring the answer. |

Two of four questions cost the user friction and return nothing. `focus` is the worst offender because a planner that *could* honor it exists and doesn't.

### Fix — wire them, don't cut them (founder decision, 2026-07-15)

Both questions stay and both start doing real work. This is strictly better than cutting: it makes two archetypes diverge *per category*, not just globally.

- **`sink` → a per-category seed bump.** The named area maps to a real category (`chores`→`cleaning`, `errands`→`errands`, `deep work`→`creative`, `meetings`→`calls`, with the option relabelled "Calls & meetings" to match the existing prior rather than invent one). That category gets extra weight inside `seededPriorFor`, and it preselects on the categories screen — which also resolves Finding 6's duplicate question.
- **`focus` → a stated pre-data block, never evidence.** `focusWindowLearn.ts` earns its confidence from logged `startLocalMinute` events and permutation strength; injecting a self-report as evidence would let it claim confidence it hasn't earned. Instead the answer renders as a clearly-labelled coarse block on day 1 ("You said mornings — I'll check that against your timers"), which the learned window **replaces** the moment it clears its gates. This matches the approved `focus-window reveal-early` direction.

Plan: [`docs/superpowers/plans/2026-07-15-onboarding-fixes.md`](../superpowers/plans/2026-07-15-onboarding-fixes.md) Tasks 5, 8.

---

## 🔴 Blocker 3 — "Skip to my type" leaves the app permanently broken

`QuizStepScreen.tsx:68-71`:

```ts
const skip = () => {
  trackQuizSkipped();
  router.push('/(onboarding)/ready');   // ⚠ bypasses reveal AND categories
};
```

Chain of consequence:

1. `categories` is never visited → `picked` stays `[]`.
2. `ready.tsx:37-41` → `complete()` → `useOnboarding.ts:36` → `setCategories([])`.
3. `categoriesStore.ts:41` defaults to `categories: []` and **nothing else ever seeds it**. `addCategory` is only called from the explicit "+ New" affordance (`add-task.tsx:118`, `categories.tsx:118`) — **picking a chip does not track a category, and logging does not track one either.**
4. `calibrationStore.hydrate` iterates **only** `tracked` (`:567-570`) → `statsByCategory` stays `{}` **forever**.

### Impact — it is not a hard block, it is silent permanent rot

The user *can* still work: `usePickerCategories` unions a hardcoded `SEED` six into the picker regardless of the store (`CategoryChips.tsx:35-48`), so tasks and timers function, and `applyLog` writes stats to the DB correctly (`calibrationStore.ts:600-617`).

But **every UI read iterates `tracked`** — `hydrate` (`:1063`), `loadPatternsData` (`:1136`), the honeycomb strip (`index.tsx:240-251`). With `picked = []`:

- `useAddTask.ts:168` always falls back to `priorFor(category)` → **the honest number never reflects the user's own logs**
- honeycomb: empty
- Patterns: empty

The user logs into a void, forever. The only escape is manually adding a category in Settings — which nothing tells them to do. This is the worst failure mode available: no error, no empty state, just an app that quietly never learns.

Compounding: `saveQuiz()` only runs in `reveal.tsx:38`, so skipping also means `setArchetypeSeed` is never called, and any answers already given on steps 0–2 are silently discarded.

`categoriesStore.ts:22-24` explicitly documents *"Refuses to remove the last one (the app needs at least one)"*. The skip path walks straight past that floor, which makes `categories.tsx:38`'s `canContinue = picked.length >= 1` gate theater.

### Fix — remove skip entirely; keep a floor anyway (founder decision, 2026-07-15)

**The quiz becomes mandatory.** The old skip was *rational precisely because the quiz did nothing* — once the answers drive the honest number (Blocker 1), skipping only costs the user their own accuracy. It is 4 taps, no typing, no account. Removing it deletes this blocker at the root rather than routing around it.

```ts
// 1. QuizStepScreen.tsx — the skip button and its handler are deleted outright.

// 2. useOnboarding.ts — complete() can never write an empty list, regardless of path
const complete = () => {
  const ids = picked.length > 0 ? picked : [...DEFAULT_CATEGORY_IDS];   // floor, not a gate
  setCategories(ids.map((id) => ({ id, name: nameFor(id), adaptSpeed: 'balanced' })));
  ...
};
```

The floor stays as belt-and-braces: with skip gone nothing *should* reach `complete()` empty, but an empty tracked list is unrecoverable in the UI, so the invariant deserves a hard guarantee rather than a routing assumption.

**Watch after ship:** `quiz_started → quiz_completed`. A mandatory quiz trades a small bounce risk for a calibrated user; if the bounce shows up, revisit.

**Regression test required:** `complete()` with nothing picked → assert `categoriesStore.categories.length >= 1` and that a logged event surfaces in `statsByCategory`.

Plan: [`docs/superpowers/plans/2026-07-15-onboarding-fixes.md`](../superpowers/plans/2026-07-15-onboarding-fixes.md) Task 9.

---

## 🟠 Finding 4 — The disabled CTA is unreadable and doesn't look disabled

`AppButton.tsx:200-220`. By deliberate design (comment at `:171-175`) the pill **face and coin edge stay 100% opaque** when disabled; only the inner content View dims: `opacity: disabled ? t.opacity.disabled : 1` (`:207`), where `tokens.ts:62` → `opacity.disabled = 0.4`.

Measured label-on-fill contrast:

| Mode | fill | label | enabled | **disabled** |
|---|---|---|---|---|
| **dark (shipped)** | `primary #8275F0` | `onIndigo #14151D` | 4.98:1 | **1.92:1** ❌ |
| light | `primary #6B5BE6` | `onIndigo #FFFFFF` | 4.92:1 | **2.04:1** ❌ |

Dark is the worse case *because* `onIndigo` is a **dark** ink — fading a dark label toward a bright indigo makes it **sink into** the fill instead of greying out. The screenshots show exactly this: a full-strength indigo slab with a murky half-legible "Next →".

VoiceOver is fine (`accessibilityState={{disabled:true}}` at `:189`). This is purely visual — which means it only hurts sighted users, silently.

**Worse: there is no reason given anywhere.** On `categories.tsx:152` the helper card renders only when `picked.length > 0` — so the one state where the CTA is disabled is the one state with zero on-screen guidance. Quiz steps have no "Pick one to continue" line either.

### Fix

Give disabled its own token pair — mute the **face**, not the label:

```ts
// AppButton.tsx — disabled is a visibly inert pill, not a dimmed live one
const faceColor = disabled ? t.colors.surfaceRaised : t.colors.primary;
const labelColor = disabled ? t.colors.inkFaint : t.colors.onIndigo;
// drop the blanket opacity on the content view
```

`surfaceRaised #292B3C` + `inkFaint rgba(244,241,234,0.40)` = **3.28:1** — reads as inert, stays legible, and is unmistakably not the live indigo. Add a one-line reason above the CTA when disabled ("Pick one to continue").

---

## 🟠 Finding 5 — Every CTA is double-tap-pushable; the funnel over-counts

No in-flight guard on any nav CTA: `welcome.tsx:91`, `QuizStepScreen.tsx:64-65`, `categories.tsx:168-171`, `reveal.tsx:52`, `ready.tsx:37-41`. `router.push` does not dedupe → a double-tap stacks two identical screens and swipe-back then appears to do nothing.

`ready.tsx` is worse: `complete()` runs twice → **`onboarding_completed` fires twice**, plus a duplicate `name_set`/`name_skipped`.

Separately, back-swiping `reveal → quiz/3 → reveal` re-runs `reveal.tsx`'s `useEffect([])` → re-fires `trackRevealShown()` (`:40`) **and** `saveQuiz`'s internal `quiz_completed` capture (`usePersonalize.ts:45`). Every round-trip inflates both.

**The archetype itself recomputes correctly** on that round-trip (fresh mount → fresh `saveQuiz` → new `m0`) — that part is right. It's only the analytics that double-count.

### Fix
A shared `busyRef` guard in the CTA handlers, and move the `quiz_completed` capture out of `saveQuiz` (or guard it with a fired-once ref keyed on the answers hash). Until then **treat `onboarding_completed` and `quiz_completed` as inflated** — they are not a trustworthy activation baseline.

---

## 🟠 Finding 6 — You ask the same question twice, in two vocabularies

| Screen | Question | Options |
|---|---|---|
| quiz/2 (`sink`) | "Where does time **run away** from you most?" | Meetings · Chores · Errands · Deep work |
| categories | "Where does time **slip** most?" | Getting ready · Cleaning · Admin & email · Errands · Cooking · Out the door |

Same question, two screens apart, with sets that barely overlap (only "Errands" appears in both). The `sink` answer does not preselect anything on the categories screen. A user who says "Deep work" isn't even offered it as a category.

**Fix:** delete quiz/2 and let categories carry it (see Blocker 2), or map `sink` → preselected category chips and reword categories to "Anywhere else?".

---

## 🟠 Finding 7 — "Time my first thing →" doesn't time anything

`ready.tsx:37-41` → `router.replace('/(tabs)')`. No add-task push, no params, no first-run coach mark. The only first-run coach is `today.seenLongPressHintV1` (`index.tsx:119-123`) which needs an existing queued row and so can never fire on a fresh install.

Taps from that CTA to a **running timer**:

- **Fastest — 2 taps:** FAB (`WhenbeeTabBar.tsx:290`) → arc's Timer button (`:200-202` → `quickStart()`). **But this is a naked timer: `category: null, guessMin: 0, estimateMin: 0`** (`timerStore.ts:169-185`). No guess → no calibration ratio at start; the category and guess get retrofitted through the post-stop capture sheet. **The fastest path bypasses the one input the entire wedge depends on.**
- **Intended — 3 taps + typing:** "Start now" (`index.tsx:412-415`) → add-task → type title → tap a category chip if auto-guess returns null → "Add & start timer".

The user never sees the loop close during onboarding. They never make a guess, never see a real honest number, never feel the payoff. `TodayEmptyState.tsx:35` literally repeats the ready CTA's copy ("Time your first thing") — the handoff exists as copy continuity, not navigation.

### Fix
Hand off for real: `router.replace('/(tabs)')` then `router.push('/(modals)/add-task')`, or pass a first-run param that opens the sheet. The aha moment is **guess → start → honest number** and it should happen in the first session, not be described and deferred.

---



## 🟡 Finding 10 — No scroll anywhere; fixed heights clip at large type

Not one onboarding screen uses a `ScrollView`, and `AppText` never sets `allowFontScaling={false}` — so all text scales into fixed boxes:

- `QuizOption.tsx:58` — `H = isTile ? t.size.control.lg * 2 : t.size.control.lg + t.space[3]` → **104 / 64pt fixed**. The coin-edge `edgeBase` (`:99-108`) hardcodes the same `H`, so a height fix must be made in two places or the edge detaches.
- `ready.tsx:135` — `height: t.size.control.md` (44) on the nickname input
- `AppButton.tsx:96` — fixed `PILL_H`

At accessibility text sizes the spacer collapses first (fine), then content clips and the CTA gets squeezed off — with no scroll, that's unrecoverable.

**Fix:** wrap each content column in `ScrollView` with `contentContainerStyle: { flexGrow: 1 }` — keeps today's spacer behavior at default sizes, gains scroll at large ones. `QuizOption` → `minHeight`.

---

## 🟡 Finding 11 — Accessibility gaps

| Item | file:line | Issue |
|---|---|---|
| Quiz options not radio | `QuizOption.tsx:139-140` | `role="button"` + `state={{selected}}`. A single-select group should be `role="radio"` in a `radiogroup` (`QuizStepScreen.tsx:104-139`) so VoiceOver announces "selected, radio button, 2 of 4". |
| Progress bar has no value | `StepProgress.tsx:20-22` | `role="progressbar"` with **no `accessibilityValue={{min,max,now}}`** — the role's contract is unfulfilled. |
| Skip target below 44pt | `QuizStepScreen.tsx:79` | `size="xs"` → **32pt** (`tokens.ts:38`), no `hitSlop`. `ghost` uses `borderWidth.hairline` = 0, so it's a bare 32pt text target. Under the HIG floor `AppButton.tsx:27` claims to enforce. |
| Decorative bee | `QuizStepScreen.tsx:84` | Verify `BeeMascot` is `accessibilityElementsHidden`, else VoiceOver stops on it before the prompt. |
| Reduced motion | ✅ | Honored correctly throughout (`ArchetypeReveal.tsx:72-110,226`, `Reveal.tsx:34`, `QuizOption.tsx:70-75`, `StepProgress.tsx:37-44`, `OverflowBar.tsx:34-38`). |

---

## 🟡 Finding 12 — Custom category silently swallows input

`categories.tsx:48-56`, `commitCustom` requires `name.length > 0 && id.length > 0 && !isPicked(id)`:

| Input | Result |
|---|---|
| `"   "` | `trim()` → `''` → no-op. Input closes, **no feedback**. |
| `"🎉"` | `slugify` (`categories.ts:18-23`) strips non-`[a-z0-9]` → `id === ''` → **silent swallow**. User typed something; it vanished. |
| `"Cleaning"` (dupe of seed, unpicked) | Toggles the existing seed chip. Accidentally correct — but the typed name is discarded in favour of the seed label. |
| `"Cleaning"` (already picked) | `!isPicked` false → **total silent no-op**. |
| `"Deep work"` / `"Deep-work"` | Same slug `deep_work` → second silently swallowed. |

`onSubmitEditing` **and** `onBlur` both call `commitCustom` (`:131-132`) and both fire on submit. Double-add is prevented only incidentally by the `!isPicked(id)` guard reading zustand's synchronous state — **load-bearing by accident**.

Nickname (`ready.tsx:38`): spaces-only handled correctly; **emoji-only survives** and becomes the display name → greetings render "Hey 🎉".

**Fix:** inline error for empty/unslugifiable/duplicate ("Already tracking that one"), keep the input open on failure, pick one commit trigger.

---

## Stale comments (docs lying about the code)

- `StepProgress.tsx:13` — *"**Three** hairline pills"*, `total = 3` default. Actual `ONBOARDING_TOTAL` = **7**.
- `ArchetypeReveal.tsx:224-225` — *"…and **never loops**"*. It loops forever: `withRepeat(..., -1, false)` at `:109`.
- `useOnboarding.ts:8` — *"the cross-store wiring for the **3-step** flow"*. It's 7.
- `onboardingStore.ts` — doc calls `hasOnboarded` the "public alias" of `completed`; no such alias exists.

---

## Token violations

| file:line | Value | Should be |
|---|---|---|
| `welcome.tsx:44,54`, `categories.tsx:93`, `ready.tsx:57` | `letterSpacing: -0.75 / -0.6` | `t.letterSpacing.tight` (-0.5) |
| `welcome.tsx:41,51,64`, `ready.tsx:66` | `fontSize * 1.1` / `* 1.5` | `t.lineHeight.tight` / `.relaxed` |
| `StepProgress.tsx:51` | `height: 4` | token |
| `categories.tsx:71` | `minWidth: 120` | token |
| `QuizStepScreen.tsx:115` | `width: '47%'` | grid token |
| `AppButton.tsx:110` | `danger: '#FFFFFF'` | token |
| `ArchetypeReveal.tsx:36-37` | `SWEEP_DUR = 1150`, `SWEEP_GAP = 4800` | `t.motion.*` |
| `ArchetypeReveal.tsx:121-247` | dense magic-number cluster (0.96, 0.04, 0.7, 2.1, 0.2, 0.8, 0.85, 0.82, 0.3, 1.5, 0.25) | tokens |
| `Chip.tsx:200` | `hitSlop={6}` | `t.size.hitSlop` (8) |

---

## Answering the three questions asked

**Are they enough?** In count, yes — 7 screens is right, and cutting the two dead questions takes it to 5. In payoff, no: the flow asks four questions and delivers a label.

**Do they convey how to use the app?** No. The flow *describes* the loop and never *demonstrates* it. The user never makes a guess, never starts a timer, never sees a real honest number before landing on Today.

**Is it production-ready?** No. Blockers 1–3 ship a promise the engine doesn't keep and a skip path that silently bricks calibration.

---

## Recommended order

Full task-by-task plan: [`docs/superpowers/plans/2026-07-15-onboarding-fixes.md`](../superpowers/plans/2026-07-15-onboarding-fixes.md).

| # | Fix | Plan task | Why here |
|---|---|---|---|
| 1 | **Finding 4** — disabled button tokens | 1–3 | One file, fixes every disabled button in the **whole app**, not just onboarding |
| 2 | **Blocker 1** — wire `m0` into the prior | 4, 7 | Makes the reveal's claim true; TDD, engine-layer |
| 3 | **Blocker 2** — wire `sink` + `focus` | 5, 6, 8 | Two archetypes now diverge per-category; kills Finding 6's duplicate question too |
| 4 | **Blocker 3** — remove skip, floor `complete()` | 9, 10 | Deletes the blocker at the root |
| 5 | **Finding 5** — double-tap guard | 11 | Restores funnel trust *before* measuring anything on it |
| 6 | **Finding 7** — real first-run handoff | 12 | The activation moment |
| 7 | **Findings 11–12** + cleanup | 13–15 | Polish sweep |

Finding 5's analytics inflation means **any activation baseline measured today is wrong**. Fix it before instrumenting decisions on it.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-15 | **Wire `sink`/`focus`, don't cut them** | Founder: use the answers instead of deleting them. Makes archetypes diverge per-category. |
| 2026-07-15 | **Quiz is mandatory — skip removed** | Founder. Skip was rational only while the quiz did nothing; now it costs the user accuracy. Watch `quiz_started → quiz_completed`. |
| 2026-07-15 | **Disabled-button fix applies app-wide** | Founder. `AppButton` is the shared primitive — one fix covers every screen. |
| 2026-07-15 | **Categories screen names the Settings path** | Founder. The path is real (`src/app/categories.tsx`, `addCategory` at `:118`). |
| 2026-07-15 | **Dead-space finding dropped** | Founder: the CTA stays pinned at the bottom, near the thumb. *Note: the proposed `space-between` fix would not have moved it — it only redistributed the gap above. Available to revisit if the objection was placement.* |
| 2026-07-15 | **`FadeInDown` entrance kept** | Founder. *Open: this contradicts the CLAUDE.md hard rule "never animate buttons in/out/up/down on entrance" — the rule needs a carve-out or future agents will re-flag it.* |
