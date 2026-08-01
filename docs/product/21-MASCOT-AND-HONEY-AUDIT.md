# 21 — The bee, the honey, and whether either earns its place

Audit date: 2026-08-01. Scope: every surface where Whenbee uses the bee mascot or the honey/hive
vocabulary. Question asked by the founder: *"I don't pay them any mind when I use the app. Is that
a flaw, or just me?"*

**Short answer: it's not just you, and it's not the bee's fault. The bee is fine. The honey
vocabulary is the problem — it renamed the app's most important number into a word that carries no
meaning.**

---

## 1. What's actually in the app

### 1a. The bee (visual mascot)

`BeeMascot.tsx` is rendered in 9 places:

| Surface | File | Verdict |
|---|---|---|
| App/brand lockup | `features/onboarding/BrandLockup.tsx:13` | Keep. Identity. |
| Onboarding quiz companion | `features/onboarding/QuizStepScreen.tsx:80` | Keep. Carries an otherwise dry quiz. |
| Archetype crest (reveal) | `features/onboarding/ArchetypeCrest.tsx:146` | Keep. Peak moment. |
| Reward burst after a log | `features/reward/RewardBee.tsx` → `bee/BeeBurst.tsx:95` | Keep. The one earned celebration. |
| Pro welcome burst | `features/paywall/ProWelcome.tsx:261` | Keep. |
| Today header ring | `features/today/TodayHeaderRing.tsx:85` | Keep, but see §4c. |
| Whenbee-tab hero avatar | `features/whenbee/WhenbeeAvatar.tsx:229` | Demote. |
| Companion modal | `app/(modals)/companion.tsx:80` | Cut or fold in. |
| What's-new empty state | `features/feedback/WhatsNewEmpty.tsx:72` | Keep. Free charm. |

Supporting art: `BeeCoin`, `BeeGlyph`, `HoneyTrail`, `HoneyPips`, `Honeycomb`, `HoneycombStrip`,
`HoneyBar`, `RitualSeal`.

The bee never blocks, never interrupts, never talks. It has none of Clippy's failure modes
(intrusive, unrequested, undismissable). As pure decoration it costs the user nothing.

### 1b. The honey vocabulary (the real subject)

87 of 1,629 English strings touch bee/honey language. Strip out the ones that are just the product
name "Whenbee" (fine — that's a brand name, not a metaphor) and about **27 strings use honey as a
unit of meaning**. Those are the ones that matter, because honey isn't decoration — it's the name of
a load-bearing number.

`honeyMaturity()` in `src/engine/honeyMaturity.ts` produces a 0–100 calibration-maturity score.
That score:

- drives the tier ladder `Raw → Setting → Ripening → Thickening → Honest` (`engine/sharpness.ts`)
- **gates real features** through `engine/companion.ts:28-33`: live finish-time, done-time on
  Today, the reverse start-by anchor, Honest-Day on the widget, drift re-check
- is the headline payoff on the reward screen (`reward.tsx:236` — the label literally reads `HONEY`)
- is the Today header ring, the honeycomb strip, the ritual seal, the whole Whenbee tab hero

So the most consequential progress signal in the product — "how much can you trust your honest
number yet, and what does it unlock" — is displayed to the user under the word **honey**, on a
five-rung ladder named after stages of jam-making.

---

## 2. Why you scroll past it

Four separate causes. Only one is a taste question.

**a) The metaphor is a synonym, not a mechanic.** This is the big one, and it's what separates
Whenbee from the apps people cite as mascot successes. In Forest, the tree *is* the timer — leave
the app and the tree dies, so the metaphor carries the consequence and you can't ignore it without
ignoring the feature. In Duolingo, Duo *is* the teacher and the notification voice. In Whenbee, the
honey doesn't do anything the number underneath it doesn't already do. It's a costume on a metric.
Costumes are skippable; mechanics aren't. Your eyes are correctly routing around a decoration.

**b) Honey hides the payoff instead of naming it.** `Ripening` doesn't tell you that the start-by
anchor unlocks two logs from now. `62% honey` doesn't tell you your honest number is nearly
trustworthy. This is textbook system-defined jargon — NN/g's second heuristic is "speak the users'
language," and a word only your product uses is the definition of a word your user doesn't. The
unlock ladder in `companion.ts` is genuinely good, motivating, non-shaming design. It's wearing a
disguise.

**c) Two vocabularies for two different axes, sharing three words.** The honey tier ladder is
`Raw / Setting / Ripening / Thickening / Honest`. The confidence enum in `domain/types.ts` is
`raw / setting / honest`. Same three words, different axes, both user-facing. `confidence.ts:2`
even documents the collision in a comment ("A readiness axis SEPARATE from the monotonic honey
Tier"). If the engine needs a comment to keep them apart, the user has no chance. This is a real
defect, not a preference.

**d) It contradicts your own brand doc.** `06-BRAND-VOICE.md:49-51` says the bee lexicon is
"flavor, not message. Use lightly, never cutesy. **Always lead with the pain, never with bees.**"
The build leads with bees: an app tab named after the mascot, the reward screen's payoff labelled
HONEY, and a destructive-action confirm (`categoryDetail.json → manageArea.resetSub`) that reads
"Clears the guess history, keeps your honey" — metaphor where the user needs a fact.

---

## 3. What the evidence says

**Mascots work when the character is a role, not a sticker.** Duo appears in notifications, error
states, and achievement moments as the voice of the product; Duolingo credits mascot-led
interaction changes with meaningful DAU movement. Forest's tree carries the session outcome. Both
are load-bearing. Clippy failed on execution — intrusive, unrequested, condescending — not on the
idea of a character. Whenbee's bee is closer to Duo's good half (celebrates, never scolds) but is
currently doing zero jobs beyond looking nice.

**Named progress currencies degrade into vanity metrics when the unlock isn't visible.** The
recurring finding in gamification critique: points aren't progress unless the user can see what they
unlock and why. Honey does unlock things — you built the ladder — but the ladder is on a different
screen from the number.

**Anthropomorphism raises expectations you then have to meet.** The chatbot research generalizes:
once you frame something as a creature with a name, a mismatch between the persona and what it
actually does reads as a letdown. "Name your Whenbee, e.g. Buzz" promises a relationship the app
doesn't have. That's a liability with no measured upside.

**Your own product's honesty positioning cuts against cute abstraction.** Whenbee's pitch is "here
are your real numbers." A whimsical private vocabulary is the opposite gesture. Warmth is fine —
Whenbee should stay warm, never clinical — but warmth should come from the tone of the sentences,
not from renaming the metric.

---

## 4. Recommendation

Not "get rid of the bee." **Keep the character, retire the currency.**

### 4a. Keep, unchanged

The bee itself: icon, brand lockup, onboarding companion, archetype crest, the reward burst, the
Pro-welcome burst, the empty-state bee. All are momentary, none blocks anything, and they're what
stops the app feeling like a spreadsheet. The honeycomb *shape* is a good visual system for
per-category cells — keep the geometry, drop the vocabulary. Amber stays the accent.

### 4b. Rename the metric into plain language

| Now | Proposed |
|---|---|
| `HONEY` (reward screen payoff label) | `CALIBRATION` |
| `62% honey` | `62% calibrated` |
| Tier `Raw` | `Just started` |
| Tier `Setting` | `Learning` |
| Tier `Ripening` | `Getting closer` |
| Tier `Thickening` | `Nearly there` |
| Tier `Honest` | `Honest` — keep. It's your core word, not a bee word. |
| `Fully ripened` | `Honest` |
| `Honeycomb sealed ✦` | `Calibrated ✦` |
| `Your honeycomb` (Today strip title) | `How well I know you` |
| `+1 nectar · ripens your honey a little` | `Logged. Your numbers get a little sharper.` |
| `Log something and the honey will ripen here.` | `Log one task and your first real number shows up here.` |
| `Clears the guess history, keeps your honey` | `Clears the guess history. Your progress and tier stay.` |
| `Your honey and tier stay. Only the guess history resets.` | `Your progress stays. Only the guess history resets.` |
| `It just won't count toward your honey.` | `It just won't count toward your calibration.` |
| `Honest-day planning unlocks once your honey sets.` | `Honest-day planning unlocks after your first few logs.` |

Renaming `Setting`/`Ripening` also kills the collision with the confidence enum in §2c for free.

### 4c. Attach the unlock to the number

The single highest-value change in this document. Wherever the calibration % or tier shows —
`TodayHeaderRing`, `HoneycombStrip`, the reward payoff card — put the *next unlock* next to it,
in the user's language:

> `Getting closer · 62% — 2 more logs and your start-by anchor turns on`

That's `companion.ts`'s ladder, surfaced. It converts an ignorable number into a reason to log.

### 4d. Cut

- **Companion naming** (`settings.yourWhenbee.nameCompanion`, `companion.namePlaceholder: "e.g.
  Buzz"`, `app/(modals)/companion.tsx`). It's unmeasured — no analytics event fires on it at all —
  and it's the one place the app promises a relationship it doesn't deliver. Supporting signal:
  of users who reach the *personal* name step in onboarding, **31 skipped and 2 entered a name**
  (94% skip). Appetite for naming things in this app is close to zero.
- **`accessibility` strings built from honey nouns.** `common.a11y.honeycombCell` currently reads
  "Work cell, 62% honey, tier Ripening" to a screen-reader user. Rewrite these as facts:
  "Work, 62% calibrated, 2 logs to Honest."
- **The bee as the Whenbee-tab hero.** The tab's real content is Discoveries, drift, areas, and the
  Pro ladder. Demote `WhenbeeAvatar` from full hero to a small header element and lead with
  Discoveries. Also consider renaming the tab — a tab named after the app tells the user nothing;
  `Progress` or `You` does.

### 4e. Give the bee one job

If it's going to stay, make it earn a role rather than sit in a corner. The safe, on-brand job:
**the bee only appears when something honest just happened.** Reward burst, tier-up, drift
re-check, a discovery landing. Never idle, never scolding, never a companion demanding upkeep.
Rarity is what makes a mascot land.

---

## 5. What the data supports and what it doesn't

Last 90 days, PostHog (closed testing, small n — directional only):

| Event | Count | Users |
|---|---|---|
| `app_open` | 184 | 34 |
| `task_logged` | 63 | 7 |
| `honey_ripened` | 50 | 7 |
| `name_skipped` | 31 | 29 |
| `tier_up` | 10 | 4 |
| `cell_capped` | 10 | 4 |
| `name_set` | 2 | 2 |

Honest reading: the honey events fire proportionally to logging, which tells you the mechanic works
mechanically. It tells you nothing about whether anyone *reads* the honey. There is no
`screen_view`/`$screen` data and no instrumentation on the companion screen at all — so the mascot
surfaces are currently unmeasurable. The one real behavioral signal is the 29-to-2 skip rate on
naming, which argues against personalization features generally.

**Instrument before and after the rename:** add `screen_view` for the Whenbee tab and companion
modal, and a tap event on the Today header ring. Then you'll know whether §4c moved anything.

---

## 6. Answering the question directly

Ignoring the honey is a correct read of a real design flaw, not a personal quirk. You're the user
with the most context in the world about what that number means, and you still skip it — that's
about as clean a signal as you'll get. But the fix isn't deleting the bee. Delete the *vocabulary*,
keep the *character*, and staple the unlock to the number so the progress signal says something a
first-time user can act on.

Rough sizing: the copy rename is a locale-file change plus tier-label constants (small, mostly
mechanical, both `en` and `sv`). §4c is a genuine UI change on three surfaces. §4d is deletions.
None of it touches the engine — `honeyMaturity()` can keep its name in code.
