# Honest Week — Elevation Audit + Research + Redesign

**Date:** 2026-06-27
**Scope:** Why the Honest Week (Review Ritual, Pro) reads as an insignificant footnote, whether it deserves to be the flagship Pro feature, and a concrete content + placement redesign to make it feel important, smart, and unmistakably *about you*.
**Status:** Research + spec. No code written. Implementation gated on founder approval of direction + the visual mock.
**Skills applied:** retention-optimization, conversion-psychology, ux-principles, emil-design-eng, ui-design:visual-design-foundations, ui-design:mobile-ios-design, ui-design:react-native-design, ui-design:interaction-design, motion-design, svg-animations, humanizer.

> Read order: §0 TL;DR → §1 what ships today → §2 why it feels small → §3 is it flagship-worthy → §4 the redesign → §5 copy → §6 motion → §7 metrics → §8 build delta. Source of the feature: [`specs/02-review-ritual.md`](../specs/02-review-ritual.md). Mock: [`specs/mocks/honest-week-elevation-v1.html`](../specs/mocks/honest-week-elevation-v1.html).

---

## 0. TL;DR

The Honest Week is the **right** flagship. It is the only Pro feature with a *cadence* — the only one that regenerates weekly and gives a reason to re-open. That is precisely what a self-insight subscription has to buy (§3). The problem is not the gate; it is that a flagship is being **presented like a footnote** and **says nothing definitive**.

Three root causes, three fixes:

1. **Weight is inverted.** Free users get a full card with a big amber CTA; Pro users get a one-line settings row. → **Placement:** make it a substantial hero card under the Archetype that never collapses to a row (§4.1).
2. **No point of view.** No-guilt was over-applied into no-stance — the copy reads like a horoscope and the one genuinely smart card (accuracy by time-of-day, 137 logs) is buried last. → **Content:** lead with a computed *headline read of the week* + one *forward action*, demote the soft reflection, and make every stat carry a number + sample size + comparison (§4.2–4.4). No-guilt constrains **tone**, not **definitiveness**.
3. **Nothing lives only here.** The modal reuses the exact same components as the Insights/Correlations tabs, so a Pro user has already seen all of it. → **Distinctness:** add a *synthesis layer* (week's verdict, forward action, archetype tie) that exists nowhere else in the app (§4.5).

The redesign changes **content, ordering, framing, and one card's placement** — not the engine. It is a refinement, not a rebuild.

---

## 1. Current-state audit (what ships)

**The feature is the Review Ritual** — a Monday recap, Pro-gated, surfaced three ways:

| Surface | File | What renders |
|---|---|---|
| Patterns tab card | `src/app/(tabs)/patterns.tsx:174-179` | `ReviewRitualCard` (Pro) / `ReviewRitualLocked` (free), pinned at position 2 — between the Archetype hero and the segment control |
| Full recap modal | `src/features/review/ReviewModal.tsx` | 7-card scroll: cover → accuracy read → tightened → biggest surprise → steals-your-time → when-sharpest → reflection |
| Category-detail tease | `src/features/category-detail/ProHonestWeekTease.tsx` | blurred ghost preview for non-Pro |

**Pro state (the one that paid):** the card has two states (`spec §5a/5b`). Fresh/unseen = an amber "envelope" card. Once opened this period it **collapses to a quiet one-line row** — `Your honest week ›` — at `Card` height `~control.md`, caption ink, a chevron. Visually identical to a settings row.

**Free state:** `ReviewRitualLocked` — full card, eyebrow, real date label, lead line behind a soft scrim, **"Unlock with Pro"** amber button. This is the strong card in the founder's screenshot 1.

**The modal content (screenshot 3):** opens on `CoverCard` — `16 tasks · 12h 31m logged` + "Seven days are in. Here is where your time actually went." Then `AccuracyReadCard` — "Estimates ran a bit looser. That is just data, not a verdict." Then the surprise, then "73% afternoons vs 61% mornings · 137 logs."

**Where the content comes from:** `ReviewModal.tsx:13-15` imports `BiggestSurprise`, `StealsYourTime`, `AccuracyCorrelations` — **the same components the Insights and Correlations tabs render** (`patterns.tsx:130, 141, 145`). The modal is a re-skin of existing tab cards with a date label.

---

## 2. Why it feels insignificant (audit × evidence)

**2.1 The weight is inverted — the payoff shrinks when you own it.**
A flagship should be the most present element for the people who paid for it. Today the opposite is true: the locked teaser is a full card; the owned feature is a one-line row buried below the identity hero and a Share button. In visual-hierarchy terms the most valuable recurring object on the screen is given the *least* weight (emil-design-eng: weight should track value; ux-principles: the primary object of a screen must read as primary). The "quiet row" was designed as no-nag restraint — correct instinct, wrong target: restraint should mute *urgency*, not *stature*.

**2.2 No stance — no-guilt collapsed into no-point-of-view.**
The strings — "that is just data, not a verdict," "worth a mental note for next time," "here is where your time actually went" — are reassuring and *say nothing you couldn't have guessed*. This is the exact "beautiful charts, zero actionable wisdom" failure the spec itself cites ([Medium, 5.5 years of mood tracking](https://medium.com/@k4m1tsuki/5-5-years-of-mood-tracking-why-data-doesnt-equal-insight-67b624050b8b)). A self-insight product earns its keep by telling you something you didn't already know about yourself and giving you something to *do*. The current recap does neither; it narrates a vibe. The no-guilt invariant was meant to remove *shame*, not *conclusions* — and the two got conflated.

**2.3 The smartest content is buried; the weakest leads.**
The card that actually feels Pro — "≈73% accurate in the afternoons vs 61% in the mornings · based on 137 logs" — carries a real number, a comparison, and a sample size. It is card **6 of 7**. The opener is a task **count** (the least insightful number available). Peak-end and primacy both say the first card sets the felt value of the whole sequence; we open on the weakest beat.

**2.4 Nothing is exclusive to the ritual.**
Because the modal reuses `BiggestSurprise` / `StealsYourTime` / `AccuracyCorrelations` verbatim, a Pro user who browses the Correlations tab has *already seen the entire recap*. The weekly "packaging" is not felt as distinct because the parts are byte-identical to always-on surfaces. A flagship needs at least one thing that can be gotten *only* here, *only* this week.

**2.5 The locked card sells a datum, not the subscription.**
"See where your time went, what tightened, and what steals your time" sells a one-time look. But the thing being sold is a *recurring moment* (§3). The teaser undersells its own product by pitching a single week instead of the weekly cadence.

---

## 3. Is a weekly ritual flagship-worthy? (the evidence says yes)

**3.1 Self-insight subscriptions churn when insight resolves to a fact.** "I learned my multiplier, I'm done." What retains is a **cadenced ritual** whose value *regenerates* with new data, so the cadence itself is the reason to re-open ([spec §2]; [07-PRO-VALUE-IDEAS §1.2]). The recurring moment — not any single datum — is what the subscription buys.

**3.2 Every durable self-tracking subscription proves it.** Sunsama's weekly review and Bearable's reports are *the* retention mechanism, not a side feature. Exist users: *"insights and trend info is the best part."* The pattern is universal: the report ritual is the product's spine.

**3.3 Among Whenbee's Pro bundle, only the ritual has a cadence.** Calendar / Honest-Day is a utility you reach for when you need it. Share is one-shot. Confidence band, day-capacity, correlations, long-range history all **resolve** — you learn them and you're done, exactly the churn trap in 3.1. The Review Ritual is the **only** Pro surface that produces a *new reason to open the app on a schedule*. By the retention math, that makes it the natural flagship — the feature whose weekly cohort return-rate (`review_opened`) is the single metric that validates the whole subscription (spec §2, §12).

**3.4 Therefore:** keep it Pro, make it flagship, and let the paywall lead with it (§4.7). But "flagship" is a presentation promise, not an org-chart label — §4 is how we make the surface earn the title.

**Retention benchmark context (retention-optimization skill, Productivity):** good D7 > 8%, good D30 > 8%. The ritual is a D7/D30 instrument specifically — it has near-zero effect on D0/D1 (that is onboarding's job, see the onboarding redesign) and maximal effect on *whether a paying user comes back next Monday*. Instrument and judge it as a returning-cohort feature, not a first-session one.

---

## 4. The redesign

**Design principle:** *one synthesized read of the week, told once, that feels computed-from-you and ends in a single thing to try — surfaced as the most present recurring object on Patterns.*

### 4.1 Placement — a hero card that never becomes a row

- The review stays on Patterns, pinned directly under the Archetype hero (its identity neighbour), but is a **substantial card in both states** — it never collapses to the one-line settings row.
  - **Fresh / unseen:** amber-edged "envelope" hero — eyebrow `YOUR HONEST WEEK`, date, the week's **headline read** (one line, §4.2), and an `Open your week` amber CTA. The single amber focal element on the tab.
  - **Seen / quiet:** a calm but full card — neutral (no amber), showing the **same headline read** the user already saw plus a quiet `View the full week ›`. It has done its job, so it drops urgency (no amber, no button-as-CTA theatre) but **keeps its stature** (full card, the week's verdict still legible). This is the fix for 2.1: restraint mutes urgency, not weight.
- Archetype stays top (identity is the anchor); the review sits immediately beneath as the recurring chapter. We do **not** swap them — but the review card's vertical weight should clearly out-rank the segment control beneath it.
- **No new surface, no Today-loop intrusion.** (Considered promoting it to its own destination; rejected — it would compete with the core tabs and dilute Patterns. Considered a Monday tease on Today; deferred to a later pass to keep the core loop clean.)

### 4.2 Content — lead with synthesis, not a count

New card order (the synthesis layer first, the soft beat last):

| # | Card | What it says | New / changed |
|---|---|---|---|
| ① | **The week's read** (NEW) | One computed verdict line + the headline calibration number with sample size. *"A tight week. 3 of 4 areas landed within ~12% of your guess — across 137 logs."* | **NEW synthesis layer** |
| ② | **One thing to try** (NEW) | A single forward action derived from the biggest drift. *"Give Admin & email ~1.8× next week and your day stops slipping."* | **NEW synthesis layer** |
| ③ | **Your biggest surprise** | Reuse `BiggestSurprise`, but always show the triad: guess → actual → ratio. *"Admin & email: 18m guessed, 33m real (1.8×)."* | reframed |
| ④ | **What tightened** | `TightenedCard` + an explicit comparison: *"Getting ready 1.9× → 1.6× — sharper than last week."* | add comparison |
| ⑤ | **When you're sharpest** | `AccuracyCorrelations`, **promoted up** from last. The hardest, most "Pro" number, no longer buried. | reordered |
| ⑥ | **What steals your time** | `StealsYourTime` (Pro). | unchanged |
| ⑦ | **This week, as a {Archetype}** (NEW) | Tie the week to the time-personality. *"Sprint Optimist weeks usually run ~2.1×. Yours ran 1.8× — you're tightening."* | **NEW, identity tie** |
| ⑧ | **One question** | `ReflectionCard`, kept, but now the *closer* after the substance, not competing with it. | unchanged |

Cards still self-omit when unearned (never a blank/fake chart) — but ① and ② are computed from data the app already has whenever there is *any* week to read, so the recap always opens on substance, not a count.

### 4.3 Every stat carries weight — the triad

No bare number ships. Each figure carries **(number) + (sample size) + (comparison)**:
- number: the value (`33m`, `1.8×`, `73%`).
- sample size: *"across 137 logs"* / *"based on 28 timed tasks"* — this is what makes it feel *earned*, not asserted. Keep the existing "based on N logs" footnote and extend it to every card.
- comparison: *vs last week* / *vs your baseline* / *vs your archetype*. A number without a reference point is trivia; with one it is insight.
- **Surface the confidence band here** (it is already in the Pro bundle): *"your real Admin time now reads 28–38m (80% of the time)."* That single phrase does more "this is smart" work than any chart.

### 4.4 Make it "about you" — identity, not metrics

The highest-converting move in every top onboarding (Rise, Opal, Noom — see the onboarding research §2.2) is *reflecting the user's own inputs back as a built-for-me artifact*. Apply it weekly: card ⑦ ties the week's behaviour to the archetype the user already identifies with, so the recap reads as the **next chapter of an ongoing story about them**, not a disconnected report. That continuity — week N relating to week N-1 and to "who I am" — is what a static dashboard can never give and what makes the cadence feel alive.

### 4.5 The reframe the founder must hold: no-guilt ≠ no-stance

No-guilt is an invariant and stays absolute: no streaks, no shame, no "you missed," amber never goes red, a looser week is *data not a verdict*. But that governs **tone**, not **definitiveness**. The current copy withholds *conclusions* to feel safe, and that is the direct cause of "this feels insignificant." The redesign is **bold + kind**: it states a clear weekly read and one action, framed as calibration and growth, never as a grade or a pass/fail.
- "A tight week — 3 of 4 areas landed within ~12%" is a *read*, not a score (it has no ceiling to fail against, no streak to break).
- "Give Admin ~1.8× next week" is an *offer*, not a command.
- A looser week is still framed as data ("looser week — that is information, and here is the one number to carry into next week"), but it is no longer *empty* of stance.

### 4.6 The locked card sells the cadence

Rewrite `ReviewRitualLocked` to pitch the *recurring moment*, not one week:
- Lead: *"Every Monday, a straight read on your week — and it sharpens every time you log."*
- Keep the real date label (the shape of the value is honest), keep the amber `Unlock with Pro`. The single screen-CTA rule still holds (one amber primary; the archetype Share is not a primary).

### 4.7 Flagship implication for the paywall

If the ritual is the flagship, the paywall's adaptive top (see the paywall-redesign-v1 work) should **lead with the Review Ritual** as the hero pitch on the `review_ritual` trigger, and it is the strongest default hero for cold opens too — because it is the only bundle item that answers "why keep paying every month." The bundle stack stays; the headline pitch leads with the cadence.

---

## 5. Copy (humanizer-checked, no-guilt, no em-dash in shipped strings)

| Card | Element | Copy |
|---|---|---|
| Hero (fresh) | Eyebrow | YOUR HONEST WEEK |
| Hero (fresh) | Headline read | A tight week. Most of your guesses landed close. |
| Hero (fresh) | CTA | Open your week |
| Hero (seen) | Headline read (echo) | A tight week. Most of your guesses landed close. |
| Hero (seen) | Affordance | View the full week › |
| ① Week's read | Body | 3 of 4 areas landed within about 12% of your guess, across 137 logs. |
| ① (looser week) | Body | A looser week. Two areas ran past your guess. Here is the one number to carry forward. |
| ② One thing to try | Header | ONE THING TO TRY |
| ② One thing to try | Body | Give Admin and email about 1.8× next week and your day stops slipping. |
| ③ Surprise | Body | Admin and email: 18m guessed, 33m real. About 1.8× your read. |
| ④ Tightened | Row | Getting ready 1.9× → 1.6×. Sharper than last week. |
| ⑤ Sharpest | Body | You read time best in the afternoons: about 73% there, 61% in the mornings. Based on 137 logs. |
| ⑦ Archetype tie | Header | THIS WEEK, AS A SPRINT OPTIMIST |
| ⑦ Archetype tie | Body | Sprint Optimist weeks usually run about 2.1×. Yours ran 1.8×. You are tightening. |
| ⑧ Reflection | Body | Which area is quietly getting sharper? |
| Locked | Lead | Every Monday, a straight read on your week. It sharpens every time you log. |
| Locked | CTA | Unlock with Pro |

Voice: one calm, honest person who is not afraid to tell you what the data says. No "unlock your potential," no rule-of-three padding, no fake urgency, no guilt.

---

## 6. Motion (within the app's hard rules)

No slide-up, no bounce/overshoot on content; fade / opacity / subtle scale / SVG-path only; durations ≤ motion tokens; reduced-motion → final state; entering-only on Fabric (no `exiting`).
- **Modal card cascade:** keep the existing `FadeInDown` + `enterStagger` (70ms) top→bottom, < ~700ms total.
- **The week's read — headline number:** the single celebratory beat. The calibration figure counts up once from 0 over `motion.honeyFill` (900ms), `easing.honey`, amber. Skipped under reduced motion (renders final). Exactly one such beat per modal — amber scarcity holds.
- **Hero card (fresh):** the envelope icon does one soft `beeBlink`-scale settle on mount, no loop, no pulsing badge (no-nag).
- **No new motion classes** — reuses tokens already defined.

---

## 7. Metrics

**The validating metric:** weekly returning-cohort rate on `review_opened` (do paying users come back next Monday?). This is the flagship's whole job.

Keep the spec's events (`review_card_shown`, `review_opened`, `review_completed`) and add:
- `review_action_tapped: { kind: 'forward_action' }` — did the "one thing to try" get engaged? (the wisdom-is-actionable test).
- `review_completed` already carries `cards_seen` / `scroll_depth` — watch whether the new ① and ② lift scroll depth and completion vs the count-first opener.

Targets (Productivity, returning-cohort feature): `review_opened` week-over-week return ≥ 35% of Pro; review→D30 retention of the review cohort ≥ 25% (the D7≥25% gate the bundle is keyed to).

---

## 8. Build delta (after founder approves direction + mock)

This is a **content/ordering/framing** change on top of the existing engine — small, logic-first, TDD where it is logic.

**Engine (pure, TDD first):**
- `src/engine/review.ts` — add `deriveWeekRead()` (the ① verdict + headline calibration number from the period's logs: share of areas landing within a tolerance band + sample size) and `deriveForwardAction()` (② — the single largest kind-direction adjustment to suggest). Both pure, `nowMs`-injected, omit cleanly when unearned. Extend `ReviewSummary` with `weekRead`, `forwardAction`, `archetypeTie`.
- Reuse existing drift / correlation math; do **not** add a new data source or a `reviews` table (spec §7 still holds — recompute live).

**Feature:**
- `src/features/review/cards/` — add `WeekReadCard`, `ForwardActionCard`, `ArchetypeTieCard`; reorder `ReviewModal.tsx` to ①→⑧; extend `BiggestSurprise`/`TightenedCard` strings to carry the triad + comparison.
- `src/features/review/ReviewRitualCard.tsx` — make the seen state a full card with the headline read (kill the one-line-row branch); fresh state shows the read above the CTA.
- `src/features/review/ReviewRitualLocked.tsx` — cadence-selling copy (§4.6).

**Paywall (separate, coordinate with paywall-redesign-v1):**
- Make the Review Ritual the hero of the adaptive top on `trigger: 'review_ritual'`.

**Analytics:** add `review_action_tapped`.

**Effort:** **M** (≈2 days). The only genuinely new math is `deriveWeekRead` + `deriveForwardAction`; everything else is composition + copy + one card-state change. No new deps, no network, no calendar.

---

## 9. Open questions

1. **Tolerance band for the ① "landed within X%" read** — fixed (±15%?) or scaled to the user's own variance? Recommend fixed for v1, revisit with data.
2. **Forward action when the week was clean** (nothing meaningfully drifted) — what does ② say? Recommend a "hold steady, your reads are landing" affirmation rather than omitting the card, so the recap never feels empty for a sharp user.
3. **Archetype tie when the user skipped the quiz** (no archetype) — omit card ⑦ cleanly (it self-gates).
4. **Confidence band exposure** — is the band already computed per category, or new engine work? (Check `src/engine` before committing ④/① to it.)

---

## 10. Sources

Retention/subscription: retention-optimization skill (Productivity benchmarks, returning-cohort framing); spec `02-review-ritual.md` §2 citations — Sunsama weekly review, Bearable reports, Exist user research, RevenueCat *State of Subscription Apps 2025*, [Medium "5.5 years of mood tracking"](https://medium.com/@k4m1tsuki/5-5-years-of-mood-tracking-why-data-doesnt-equal-insight-67b624050b8b) (the data≠insight gap). Reflect-back/personalization pattern: the onboarding research doc §2.2 (Rise, Opal, Noom; IKEA effect / labor illusion). Design: emil-design-eng (weight tracks value), ux-principles (primary object must read primary), visual-design-foundations (type/space hierarchy). Internal: code audit of `src/app/(tabs)/patterns.tsx`, `src/features/review/*`, `src/features/patterns/*`, `src/engine/review.ts`, `src/theme/tokens.ts` (this session).
