# 12 — Name + Greeting Personalization ("Whenbee knows you")

**Status:** Research + recommendation (not yet built)
**Created:** 2026-06-21
**Author:** research-driven (Reddit sentiment + competitor teardown + personalization psychology)
**Honors invariants:** No guilt, no streaks. Name is **optional**. Greeting is warmth-only — never a behavioral callback, never pressure.

---

## 1. The idea (as proposed)

Let the user tell Whenbee their name (or what to be called), then:

1. **Whenbee uses the name** when it speaks / writes — so the companion feels like it knows you.
2. **The Today/home page shows a time-of-day greeting** — "Good morning, Ali" / "Good afternoon, Ali" / "Good evening, Ali".

The goal is emotional: make the app feel personal and warm, like it knows you — not like a tool.

---

## 2. What the research actually says

Three independent research passes were run: (A) real user sentiment on Reddit, (B) how successful apps implement this in 2025–26, (C) the psychology / retention evidence. They **converge on one clear answer**, which is *not* the naive version of the idea.

### A. Reddit / real-user sentiment — MIXED, and overuse is the killer

- Sentiment is roughly **~35% positive / ~45% wary-to-negative / ~20% conditional**. The split is **not** "name = good vs bad". It's **"name used sparingly = warm" vs "name used constantly = fake / robotic / sales-y"**.
- The single most repeated complaint, across 6+ unrelated communities, is **overuse**. r/replika threads literally beg the bot to *stop* saying their name "EVERY SINGLE reply" — it reads as broken, not intimate. The loved state is rare use: one user joked their companion "used my name 4 times yesterday… guess I've used up my quota for the year."
- A real natural-language truth surfaced: **people who are close rarely use each other's name.** Intimacy *lowers* name frequency. A companion that constantly names you signals *distance*, not closeness.
- Repeated name use is widely recognized as **a sales technique** ("ego stroking," "manipulation script") — recognizing the tactic destroys the warmth.
- A **scheduled, automatic greeting decays into "empty… routine"** noise if it never varies.
- **Neurodivergent discomfort is real and relevant.** Whenbee targets ADHD / "time-optimist" users; a non-trivial slice (e.g. r/AutismInWomen) finds direct name-address — explicitly including "Good morning, [NAME]" — *actively* uncomfortable.
- **Getting the name wrong is worse than no name** — "Katherine" vs "Katie", wrong capitalization. People hate "that's not my name."
- **Onboarding interrogation is hated.** "I hate apps that do the whole onboarding with a bunch of questions." Name must not gate the app.
- **The greeting itself is genuinely wanted** — people *ask* for "good morning/evening when I pick up my phone." It's the **name** that's the risky seasoning, not the greeting.

### B. Competitor teardown — the winners ask, but greet without the name

| App | Asks *your* name? | Required? | Time-of-day greeting on home? | Character uses name? |
|---|---|---|---|---|
| **Fabulous** (coach) | Yes, early | effectively expected | Yes, name-personalized | Yes — coach voice |
| **Duolingo** | Yes (account) | required | Duo addresses you by first name early | Yes, playful |
| **Replika** (companion) | Yes + pronouns | required | conversational | Yes — *frequently* (the #1 complaint) |
| **Finch** (self-care pet) | **No — you name the *pet***, not yourself | pet name required | Yes — daily message each open | speaks to "you" generically |
| **Spotify** | account name | — | **"Good morning / afternoon / evening" — usually NO name** | n/a |
| **Headspace / Calm** | (from account) | — | Yes — time-of-day greeting + time-aware feed | n/a |
| **Structured / Things / Sunsama** (planners) | mostly no | — | mostly none | n/a |

Patterns across the winners:
1. **The apps that ask your name are companion/coach apps** — exactly Whenbee's category. So *asking fits*.
2. **The name is asked in the character's voice** ("What should I call you?"), framed as relationship-building, not a cold form field.
3. **The home greeting often OMITS the name** (Spotify shows "Good morning" alone). The name appears where it feels *personal* (a coach moment), not stamped on every surface.
4. **Companion apps split identity** — Finch/Replika let you customize/name the *companion*. That is often a **stronger** personalization hook than your own name.
5. **A fresh daily greeting/message is a retention ritual** — a small reason to open the app each day.

### C. Psychology / retention evidence — strong mechanism, real backfire threshold

Load-bearing, peer-reviewed pillars (cite these, not folklore):

- **Cocktail-party effect** (replicated): ~29–33% of people detect their *own name* even in an ignored channel; random words don't capture attention the same way. The name is genuinely special.
- **Self-reference effect:** self-relevant info gets an attention + memory boost (mPFC/hippocampus). A message that names the user is more likely to be **noticed and remembered** — useful for Whenbee's prompts.
- **CASA — Computers Are Social Actors** (Reeves & Nass): people unconsciously apply social rules (politeness, reciprocity) to machines. This is the **strongest support for a greeting building a parasocial bond with Whenbee** — but it depends on Whenbee feeling like a *character*, and a 2023 study shows the effect has weakened for plain, character-less UIs. **Invest in Whenbee's voice, not data targeting.**
- **Hooked / trigger:** a consistent at-open greeting is a legitimate habit *trigger* that anchors the daily loop — **but keep it a gentle "friend saying hi," never a guilt trigger** (reconcile with no-streaks/amber-never-red).

The risks, equally evidenced:
- **Creepiness is a documented threshold effect**, not hypothetical. Gartner: 75% of consumers will disengage from personalization they find invasive by 2026; Twilio Segment: 42% find personalized messages "irrelevant or creepy." **A name the user typed sits safely below this line — but layering behavioral callbacks ("you've been slow again") crosses it AND violates the no-guilt invariant.**
- **Over-personalization harms UX / trust** (NN/g) — users want *control* (edit/remove).
- **Optional/progressive name capture wins on completion:** each added signup field cuts completion ~3–5%; making one field optional moved completion 43%→80% (ClickTale). Don't gate.
- **Debunk before citing:** the Dale Carnegie "sweetest sound in any language" quote is **motivational folklore, not evidence**, and the "your name shapes who you marry / where you live" implicit-egotism claims are **confounded/debunked** (Simonsohn 2011). Don't justify the feature with these internally. The cocktail-party + self-reference + CASA findings are the defensible ones.

---

## 3. VERDICT

**Ship it — but ship the disciplined version, not the naive one. The greeting is the safe, wanted part; the name is a seasoning, not a sauce.**

Evidence-based verdict, point by point:

- ✅ **Time-of-day greeting on home: YES.** Genuinely wanted, every winner in the category does it, low risk. Ship for everyone.
- ✅ **Ask the name: YES, but OPTIONAL + skippable + nickname-style + editable.** Asking fits the companion category; gating or demanding a "legal name" does not.
- ⚠️ **Whenbee uses the name: YES, but RARELY.** This is the highest-leverage rule in all the research. Model a *close friend's* density — a name at meaningful moments (first open of the day, a genuine win, a warm comeback), **not** in every line and **not** on every screen. Overuse is the one mistake every negative thread shares; it reads as a malfunction or a sales script and quietly erodes the bond.
- ❌ **Never** attach the name to anything that could read as pressure, surveillance, or a behavioral callback. Warmth only. (Both a creepiness backfire *and* an invariant violation.)

Net: this is a **low-effort, high-warmth win** that fits Whenbee's companion identity — *provided* it's optional, sparing, editable, and warmth-only. Done the naive way (required name, name on every screen, name in every Whenbee line) it actively backfires.

---

## 4. Design rules (the spec)

1. **Greeting, always; name, optional.** Home shows "Good morning/afternoon/evening". If a name exists, append it — *selectively*, not on every render (see rule 6). With no name, fall back cleanly to the bare greeting (never "Good morning, undefined").
2. **Ask in Whenbee's voice, after first value, never as a gate.** Not in the first onboarding breath. A quiet "What should I call you?" with a prominent **Skip**, framed by Whenbee. Also reachable/editable in Settings.
3. **Nickname, not legal name.** Free-text "what should Whenbee call you?", default **no name**, fully editable. This dodges every "that's not my name" / capitalization complaint.
4. **Time boundaries (Momentum convention, US/English default):**
   - Morning: 05:00–11:59
   - Afternoon: 12:00–16:59
   - Evening: 17:00–04:59
   - Optional 4th bucket if wanted: Night 22:00–04:59. **Never** use "Good night" as a *greeting* — it's a farewell.
5. **Whenbee uses the name like a close friend — sparingly.** Reserve it for emphasis / genuine moments (a milestone, an honest result, a return after a gap). If a Whenbee line could appear verbatim in a cold email's "Hi {{first_name}}", cut the name.
6. **Vary it so it never ossifies.** Rotate greeting phrasing; append the name only a fraction of the time so it never reads as a script. The greeting is daily; the *name* is occasional.
7. **Respect name-averse users.** Default-off + easy "don't use my name" protects the neurodivergent slice most likely to bounce on discomfort.
8. **Warmth only — never guilt.** The greeting says hi like a friend; it never demands a return, never references slipping, never pressures. Amber never red.

### Copy direction (conversion-psychology + humanizer, no guilt)
- Ask screen (Whenbee's voice): something warm + low-stakes with a real Skip, e.g. *"What should I call you?"* / subtext *"Totally optional — Whenbee's happy with no name too."* (Final copy to pass through `conversion-psychology` + `humanizer` before shipping.)
- Greeting: plain "Good morning, Ali." Keep it quiet. No exclamation-mark over-eagerness; warmth reads as calm, not peppy.

---

## 5. How to make it BETTER than competitors (expansion / 10x)

The research points at a clear gap: **competitors ask for the *user's* name; the strongest companion apps (Finch, Replika) make you bond with the *companion*.** Whenbee already has Whenbee — so the differentiated move is to lean on the *relationship*, not just a name label.

**Do now (quick wins):**
- Greeting on home (everyone) + optional sparing name. (This spec.)

**Do next (high leverage, still cheap):**
- **Let the name appear at *earned* moments, not on a timer.** The Reddit "feels earned, not scripted" signal: surface the name when Whenbee has something genuinely personal to say (an honest-number reveal, a first calibration in a category), so it reads as *recognition*. This is the difference between Whenbee and a mail-merge — and it's mostly copy + a usage-density rule, not new infra.
- **"What should I call Whenbee?"** — borrow the Finch/Replika companion-identity hook. Letting the user name/keep their companion is a *stronger* personalization bond than their own name, and it's perfectly on-brand (Whenbee is already a character). Optional, of course.

**Explore (strategic, later):**
- **Time-aware tone, not just time-aware label.** Evening greeting can carry a calmer line than morning — the warmth shifts with the day. Headspace/Calm do time-aware *content*; Whenbee could do time-aware *companion mood* (still no-guilt). Compounds the parasocial bond CASA predicts.

All of these honor the invariants: optional, warmth-only, no streaks, no guilt.

---

## 6. Implementation placement (where this lands in the code)

Grounded in the current tree (nothing here is built yet):

- **Name storage:** add an optional `displayName?: string` (nickname) to **`src/stores/settingsStore.ts`** (persisted via `kv`). No name = feature is simply off.
- **Greeting logic:** pure helper in the engine layer (it's clock-derived, but the *bucket mapping* is pure given an hour) — compute the time bucket + greeting string. Keep the `Date.now()` read in a hook/selector, pass the hour into a pure `greetingFor(hour, name?)` so it stays unit-testable (engine purity rule).
- **Home wiring:** consume in **`src/features/today/useToday.ts`** → rendered at the top of **`src/app/(tabs)/index.tsx`**.
- **Ask screen:** new optional step *after* first value — not in `(onboarding)/welcome`. Better as a gentle Settings-reachable prompt or a post-first-task moment, in Whenbee's voice. Editable in **`src/app/settings.tsx`**.
- **Whenbee copy:** the sparing name-injection rule lives wherever Whenbee's lines are composed (**`src/features/whenbee/`**). Add a "name density" guard so the name can't appear on every line.
- **Tokens:** any new spacing/size/color for the greeting comes from `src/theme/tokens.ts` (add tokens, don't inline).
- **TDD:** `greetingFor()` and the name-density guard are logic-layer → test-first.
- **Mandatory skills before building:** `react-native-expert`, `typescript-expert`, `ui-design:*` + `emil-design-eng` for the greeting's visual treatment, `conversion-psychology` + `humanizer` for every string, `retention-optimization` for the ritual framing.

---

## 7. Sources (selected)

**Reddit sentiment:** r/replika "stop saying my name EVERY reply"; r/ReplikaOfficial name-in-every-exchange; r/DAE & r/NoStupidQuestions name-as-sales-tactic; r/AutismInWomen name-address discomfort; r/starbucks "Good morning [NAME]" creepy; r/iphone wants ambient greeting; r/iOSProgramming & r/AppDevelopers onboarding-friction; r/AppleWatch "Katherine vs Katie".

**Competitors / boundaries:** Appcues (Duolingo onboarding, ask-name best practice), Fabulous onboarding teardowns, Finch teardown (names the pet), Spotify time-of-day greeting (newsroom/TechCrunch), Momentum greeting time-boundaries, arXiv 1805.09055 (cultural variation).

**Psychology:** PMC8908911 (cocktail-party replication), Frontiers (self-reference), Wikipedia/CASA (Reeves & Nass), Nature s41598-023-46527-9 (CASA weakening), PMC12561546 (personalization backfire threshold), NN/g over-personalization, CXL/VentureHarbour (optional-field completion), Simonsohn "Spurious?" (debunks implicit-egotism life claims).

> Note: exact in-app greeting wording for some apps (Fabulous, Stoic) and name behavior for utility apps (Oura, Things, Streaks) could not be confirmed from public sources and are marked uncertain in the underlying research.
