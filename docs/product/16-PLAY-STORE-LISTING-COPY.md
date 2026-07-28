# 16 — Play Store listing copy (Android)

Paste-ready copy for **Play Console → Grow → Store presence → Main store listing**.

Built from scraped competitor data (14 live Play listings, 2026-07-27) plus current third-party
Play ASO guidance, then shaped by `06-BRAND-VOICE.md` and passed through `humanizer`.

**Positioning decision (founder, 2026-07-27):** target **"time blindness"**, do **not** name ADHD.
Time blindness is held by only 1 of 14 competitors scraped (Engross), is the most on-thesis phrase
for what Whenbee actually measures, and names a symptom rather than a condition — so it does not
contradict the "no health features" declaration the way "ADHD time tracker" would.

---

## Field 1 — App name (29 / 30)

```
Whenbee: Time Blindness Timer
```

The app name is the **highest-weight ranking field in Play** and was 7/30 characters before this.
No competitor scraped wastes it on brand alone: `Toggl Track - Time Tracking` (27),
`Engross: ADHD Focus Timer` (25), `Structured - Daily Planner` (26),
`Forest: Focus for Productivity` (30). Keyword goes immediately after the brand and separator,
because position inside the title carries weight.

"Timer" in the title also supports the `USE_EXACT_ALARM` declaration, which claims the app's core
functionality is an alarm clock / timer. A reviewer comparing the two must land on "yes, timer app."

---

## Field 2 — Short description (80 / 80)

```
Beat time blindness. A time tracker that predicts how long you'll actually take.
```

Uses the full 80. Two head keywords (`time blindness`, `time tracker`); `task timer` is dropped
here because it still gets indexed from the app name, and repeating the "task" root inside 80
characters would burn a slot no ranking competitor wastes.

**"Predicts" is the differentiator and it has to be in this field.** Toggl, Clockify, aTimeLogger
and Boosted all *track* time and all have 1M+ installs. Nothing in the scraped set claims to
predict how long the user will take. A short description that only promises tracking is competing
head-on with incumbents on their own ground.

It also matches natural-language phrasing ("how long will this actually take me"), which is what
gets a listing surfaced by AI assistants — the answer-engine channel flagged in
`14-MONETIZATION-AND-DISTRIBUTION-PLAYBOOK`.

Alternates held in reserve for a store-listing experiment:

```
Stop guessing. A task timer that learns your pace and predicts your real time.   (78, zero condition language)
Beat time blindness. Guess, time it, and find out how wrong you actually are.    (77, strongest hook, weakest ASO)
```

Superseded first draft (73/80): `Beat time blindness. A task timer that learns how long tasks
really take.` — repeated the "task" root and promised tracking rather than prediction.

Structure is the "hook + keyword clause" pattern, the newest of the three that rank — pain word
first, keywords second. Same shape as Engross (`Beat time blindness. An ADHD focus timer, to-do &
app blocker to stay in flow.`) and Forest (`Pomodoro study timer to beat phone addiction, manage
ADHD & stay focused.`). Targets: `time blindness`, `time tracker`.

Three rules this obeys, all confirmed across the 14 scraped listings:

1. **Never open with the brand.** Zero of fourteen do. The 80 characters are category vocabulary;
   the brand already lives in the app-name field.
2. **Use 70–80 of the 80.** Median usage was 73. Only Toggl (43) and Boosted (52) leave space, and
   they have brand strength to spend instead.
3. **Chain keyword variants, never repeat one.** Not one listing repeats its primary keyword inside
   the 80 chars. Repetition belongs in the full description.

---

## Field 3 — Full description (2,574 / 4,000)

Only about 5% of visitors tap "Read more", so the first two lines carry the conversion load. The
rest carries the keyword load at roughly 1–2% density, which is the current guidance — the older
"repeat it 3 to 5 times" advice now trips stuffing detection.

Same sentences as the first draft, restructured for scanning: section headers, bulleted feature
blocks, one idea per line, and air between blocks. Play renders the full description as plain text
with line breaks preserved, so bullets are the literal `•` character and headers carry an emoji
marker.

```
You think it'll take 20 minutes. It takes 50. Then you're late again, and you still don't know why.

That gap has a name. Time blindness is the reason your plans keep lying to you, and it isn't a character flaw.

You're not wrong about time randomly. You're wrong by roughly the same amount every time. That's a number, and a number can be fixed with arithmetic instead of willpower.

Whenbee is a task timer and time tracker that finds your number.


⏱️ HOW IT WORKS

1. Guess how long the task will take.
2. Tap start. Do the thing.
3. Tap stop.

That's the whole loop. Nothing to fill in, nothing to maintain.

After a handful of sessions, the time tracker knows you run about 1.8x over on admin work and land dead-on for workouts. From then on it shows you the honest number instead of your guess.

No advice about estimating better, because that's the one thing your brain won't do. Time blindness doesn't go away. But once you can see the size of it, you can plan around it.


✅ WHAT YOU GET FREE

• One-tap task timer, with a live countdown in your notification shade
• Home screen widget, so the timer is one glance away
• Lock screen timer on Android 16, no unlocking needed
• Your personal multiplier, learned per category from your own sessions
• Admin, deep work, errands, workouts, whatever you actually do
• The honest number, shown wherever you plan something
• Your full time tracking history and patterns, with no streak attached to any of it


🐝 WHENBEE PRO

• Honest Day reads today's calendar and tells you whether the day actually fits, before you commit to it
• Honest Week and Honest Month reviews, for the wider view
• Focus window planner for time blocking, built from when you actually do your best work rather than when you think you do
• Confidence band on every estimate, so you know how far to trust it yet
• Routines and per-category goals
• Long-range history and a PDF report
• Correlations: what quietly steals your time, and when you're sharpest


💛 NO GUILT, EVER

• No streaks to break
• Nothing dies if you skip a day
• Progress only climbs and never falls back
• The warning color is amber, and it never turns red

You're not the problem. Your estimate was.


🔒 PRIVATE BY DESIGN

• Everything runs on your phone
• Your tasks and your times never leave the device
• No account, no cloud sync, no AI reading your task list

It's about forty lines of arithmetic, and it's yours.


Fair warning: this is new, and it needs a few real sessions before the numbers mean anything. Give it a week of actual tasks and see what it says about you.
```

### On the emoji headers

Emoji in the full description are allowed and normal — Sectograph (5M+) opens with 🎯, and most
top-ranking listings use them as section markers. What Play's metadata policy actually bans is
**emoji that imply performance, ranking, or awards**: ★, 🏆, 🥇, "Editors' Choice" lookalikes, or
anything mimicking a store badge. Forest's `★ Google Play Best App of the Year ★` is precisely the
risky pattern, and it survives on brand weight rather than compliance.

The five used here are neutral category markers. If you'd rather carry zero risk, delete the emoji
and keep the caps headers — nothing else needs to change.

### Keyword density check

| Term | Mentions | Note |
|---|---|---|
| task timer | 2 | primary (4 across all fields, with name + short description) |
| time blindness | 2 | 4 across all fields |
| time tracker / time tracking | 2 | |
| time blocking | 1 | Pro focus-window line |
| focus | 2 | "deep work", "focus window planner" |
| routines, goals, history, report | 1 each | long-tail surface |

No term exceeds 2% density. No keyword repeats inside a single sentence.

---

## Field 4 — Release notes / "What's new" (max 500)

Lives on the release itself, not the listing: Test and release → Testing → Closed testing.

```
First closed test build. The whole loop is here: guess how long it'll take, run the timer, and watch Whenbee learn how far off you usually are. The live timer sits in your notification shade and on your home screen.

If something breaks or reads wrong, tell me through Settings, Send feedback. I read all of it.
```

---

## Play metadata policy — what this copy deliberately avoids

Violations here get the listing rejected or the app suspended, and several are easy to trip:

- **No performance or ranking claims.** No "Top 10", "#1", "best", no award or trophy emoji.
- **No "free" as a promotional hook.** Used only as a plan descriptor ("What you get free"), the
  same way Clockify's live listing says "with a free plan". Never in the title or as a claim.
- **No all-caps headers.** Caps are only allowed if the brand itself is capitalized.
- **No emoji** anywhere in the copy.
- **No health, ADHD, medical, or wellbeing framing** — cross-checked against the "My app does not
  have any health features" declaration. "Time blindness" describes a symptom of ordinary time
  perception and makes no treatment claim.
- **No invented aggregate stats.** The 1.8x is framed as an example of what the app would show a
  given user, never as a claim about users in general.

Brand-voice bans also cleared: no em dashes, no "unlock" / "elevate" / "delve" / "seamless" /
"vibrant", no rule-of-three cadence, no guilt or streak language. One negative parallelism
("You're not the problem, your estimate was") is intentional and is the anti-shame thesis.

---

## Where each field lives in Play Console

| Field | Location |
|---|---|
| App name, short description, full description | Grow → Store presence → **Main store listing** |
| Feature graphic (1024x500), phone screenshots (min 2), icon (512x512) | Same page, Graphics section |
| What's new / release notes | Test and release → Testing → **Closed testing** → the release |
| Tester list | Closed testing → **Testers** tab |

---

## After it's live

- **Re-indexing is slow.** Roughly 5–10 days for Google to crawl new metadata, 2–3 weeks for
  visible ranking movement, 4–8 weeks to stabilize. Do not judge the copy before then.
- **The short description is A/B-testable in Play Console** (Apple's subtitle is not). Store
  listing experiments want 14+ days and 250+ installs per variant, changing one element at a time.
  This is the field to test first.
- **Ranking weight has shifted toward post-install signals** — retention, conversion rate, crash
  and ANR rates now matter more than raw install volume. Keep crash under 1.2% and ANR under 0.5%.
- **Replying to reviews is a confirmed direct ranking signal on Play.** It is not on iOS. Reply to
  every closed-test review.

---

## Sources

Competitor listings scraped from Google Play 2026-07-27 (short descriptions read from the listing
`og:description` meta field, which is the literal 80-char store field). ASO guidance: App Radar
(ranking-factor weights), AppFollow (short description ranks second behind title), yellowHEAD
(30-char title limit since Sept 2021; metadata bans), AppTweak (title keyword placement; crash/ANR
thresholds), ASOMobile (Play rewards repetition where Apple does not; listing-as-single-context).

Note: no Google-official source was located for the ranking-weight ordering. It is unanimous across
five independent vendors but remains third-party. AppTweak dissents on emphasis, arguing the short
description's main job is conversion rather than keywords.

---

## Graphics — feature graphic + screenshots

### Feature graphic (required, 1024x500)

Not a screenshot. A designed banner: logo, one short line, solid or gradient background. Shown at
the top of the listing, in Play browse/promo surfaces, and as the video thumbnail if a video is
added. PNG or JPEG, max 15 MB.

- Keep all text **centered and well inside the frame** — Play crops the edges on some surfaces.
- Banned content: store badges, star ratings, "Editors' Choice" lookalikes, price or promo text,
  any performance/ranking claim.
- Suggested line (matches the short description): **"Beat time blindness."** or
  **"Find out how long it really takes."**

### Screenshots

Minimum 2, maximum 8. **Shoot 8.** Play needs at least 4 at 1080px or wider (16:9 / 9:16) for the
listing to be eligible for promotional surfaces, and more screenshots is strictly better for
conversion. PNG or JPG, no transparency, no borders.

The first three carry almost all the weight — most visitors never swipe past them.

| # | Screen | Why it earns the slot |
|---|---|---|
| 1 | **Today** with the honest number / landing time | The payoff. This is the thing no competitor shows. |
| 2 | **Timer running** (the ring) | Proves it's a real timer. Backs the alarm-clock declaration. |
| 3 | **Reward / capture screen** right after stop, showing guess vs actual | The emotional beat. The gap made concrete. |
| 4 | **Lock screen + home screen widget** with a live timer | Strongest Android-native differentiator. Shoot the real lock screen. |
| 5 | **Add task** showing the honest suggestion card | Shows the learning applied at the moment of planning. |
| 6 | **Patterns** with per-category multipliers | The "here is your number" proof. |
| 7 | **Honest Day** / day-capacity verdict | Lead Pro feature. |
| 8 | **Discoveries** or the focus-window planner | Depth, and a reason to keep opening the app. |

### Before shooting

- **Check every screen for private data.** These become permanent public marketing. Honest Day
  renders real calendar event titles, and Patterns renders real task titles and category names.
- Clean the status bar: full battery, no notification clutter, neutral time.
- Keep the same task titles and the same numbers across every screenshot. Inconsistent numbers
  between shots read as fake.
- Raw screenshots convert worse than captioned ones. Consider a caption band above each image.

### Demo tasks to seed

Universally underestimated, instantly relatable, and no personal information. Use these exact
titles and numbers across all eight shots so the set tells one coherent story.

| Task | Category | Guess | Actual | Multiplier |
|---|---|---|---|---|
| Reply to emails | Admin | 15 min | 41 min | 2.7x |
| Tidy the kitchen | Home | 10 min | 26 min | 2.6x |
| Get ready and leave | Personal | 20 min | 35 min | 1.8x |
| Weekly grocery run | Errands | 30 min | 52 min | 1.7x |
| Write the report | Deep work | 60 min | 95 min | 1.6x |
| Do the expenses | Admin | 25 min | 60 min | 2.4x |
| Gym session | Health | 45 min | 47 min | 1.0x |
| Meal prep | Home | 30 min | 48 min | 1.6x |

Keep **Gym session at roughly 1.0x**. A set where every task overruns looks rigged. One accurate
category proves the app measures rather than assumes, and it makes the overruns credible.

Admin is the worst category in this set (2.7x) — make it the one the Patterns screenshot leads on.
