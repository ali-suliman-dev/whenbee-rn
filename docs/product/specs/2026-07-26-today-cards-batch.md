# Today cards batch — recap stats, collapsible landing, honey amber, calendar legend + upsell

**Date:** 2026-07-26
**Status:** approved (founder, visual mocks)
**Mocks:** `recap-landing-brainstorm.html` → `recap-landing-brainstorm-v2.html` → `calendar-upsell-oneline.html` (session scratchpad)

Five changes across three cards. They ship together because three of them are the same
idea: the Today surfaces each invented their own dialect, and this puts them on one.

---

## 0 · AreaRow multiplier size — DONE

`src/features/whenbee/AreaRow.tsx` — the indigo `2.1×` was `fontSize.sm` (12) beside a
`fontSize.base` (14) category name, so the learned multiplier read as a footnote to the
label instead of the row's payload.

- `multText.fontSize`: `t.fontSize.sm` → `t.fontSize.base`
- `multText.minWidth`: 34 → 40 (`2.1×` at 14 bold clips at 34)

Applied and verified: lint clean, `tsc` clean, 57 whenbee tests pass.

---

## 1 · DayRecapCard — hybrid H1

`src/features/today/DayRecapCard.tsx`

### Why

The past-day recap and `DaySoFarCard` describe the same thing in two languages.
Recap says `165m`, sentence-case labels, no column rules, and a `+35m vs your guess`
delta that reads like a grade. The sibling says `2h 45m`, small-caps labels with
colour-coded dots, hairline column rules, and a sentence.

### Anatomy (top to bottom)

```
SAT · JUL 25                         ← eyebrow, type.eyebrowSm / inkFaint
Ran 35m over the day you pictured.   ← headline, type.bodyLg / ink, delta span in accent
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒                    ← gap bar: guessed = primary, overhang = accent
guessed 2h 10m          real 2h 45m  ← scale row, type.micro / inkFaint
──────────────────────────────────
4 tasks  │ 2h 10m       │ 2h 45m     ← StatColumn ×3, lifted from DaySoFarCard
LOGGED   │ ● GUESSED    │ ● HONEST
──────────────────────────────────
ALL TASKS · SAT                    ⌄ ← existing disclosure, unchanged
```

No amber footline. The headline already states the gap; repeating it two elements
later as `+35m over your guess` is the same sentence twice.

### Rules

- **Stat columns are `DaySoFarCard`'s, not a copy.** Extract its `StatColumn` to a
  shared module (`src/features/today/StatColumn.tsx`) and import from both. Two
  near-identical implementations is how the dialects drifted in the first place.
- **`4 of 5` splits.** `4` + unit `tasks` in the column; the planned count is dropped —
  a past day's plan count is not a fact worth a third of the stat row. (If it must
  survive, it belongs in the eyebrow, not the stats.)
- **Every duration goes through `fmtHm()`** (`src/lib/time.ts`) — `45m` · `1h` · `2h 45m`.
- **The delta is worded, not signed.** `35m over` / `20m under`, never `+35m` / `−35m`.
  A sign reads as a score; a word reads as a fact. Thin helper over `fmtHm`, which stays
  untouched.

### States

| Day | Headline | Bar | Stats |
|---|---|---|---|
| Ran over | `Ran 35m over the day you pictured.` — `35m over` in `colors.accent` | guessed segment + amber overhang | shown |
| Ran under | `Came in 20m under the day you pictured.` — `20m under` in `inkSoft`, never amber | guessed segment, no overhang | shown |
| Dead on | `Landed right on the day you pictured.` | full guessed segment | shown |
| Nothing logged | `Nothing logged that day.` | **none** | **none** — and no disclosure row |

Running under is not a win and running over is not a loss. Under gets `inkSoft`, not a
success colour; over gets amber, never red. An empty day renders headline only — a
zero-length bar is worse than no bar.

---

## 2 · HonestLandingCard — collapsible (Direction D)

`src/features/today/HonestLandingCard.tsx`

Collapsed = the ⚡ disc, the headline, and a chevron. That single row is the whole
point of the card, so it never hides. Expanded adds bar, scale, divider, footer —
i.e. everything the card renders today.

- Header row is the hit target; the chevron is the affordance, not the button.
- Chevron rotates 180° over `t.motion.base` with an ease-out curve.
- Body enters with `FadeIn` — **no slide, no spring** (project animation rule).
  Plain unmount on collapse; no `exiting` (Fabric SIGABRT).
- **Persist open/closed in `kv`.** Default **open** on first run so the card teaches
  itself once; after that it remembers what the user left it as.
- `landing.kind === 'past'` already renders no bar. Collapsed 'past' is headline +
  footer only, so the chevron is pointless there — render no chevron and no toggle.

---

## 3 · Honey amber

`src/theme/tokens.ts` + `src/features/shared/HonestSuggestionCard.tsx`

`colors.amberText` is `#8A5A12` — the only amber passing AA (4.5:1) at 16px regular on
white, and it reads brown rather than honey.

- **New token** `colors.honeyText` = `#B87A16` (light). Dark mode = `#EEAE4D`, same as
  `amberText` there.
- `#B87A16` is **3.6:1** on white — AA-large only. **The value must be bold and ≥18px
  wherever `honeyText` is used.** In `HonestSuggestionCard`, `sentenceValue` goes
  `fontSize.md`/semibold → `fontSize.titleSm` (18)/bold. This also makes the value the
  first thing the eye lands on, which suits a card whose entire job is one number.
- **Do not blanket-replace `amberText`.** It has ~a dozen small-text uses (overrun
  clock, footer bold spans, the ⚡ glyph); swapping those silently breaks AA. `honeyText`
  is only for values already bold at 18px+.

---

## 4 · Calendar — legend + free upsell

`src/features/today/HonestLandingCard.tsx`, `honestLandingCopy.ts`

### What's already true

`useHonestLanding` takes `eventMinAhead` and `index.tsx` passes it. It is zeroed unless
**Pro AND Settings → Calendar → "Show events" AND permission granted**. When live,
calendar time renders as a `primaryEdge` slice inside the bar and the footer action
flips to "Pad calendar". Two things are wrong with that: the second colour is never
explained, and there is no way to turn calendar on from the card.

### 4a · Legend

Rendered **whenever calendar minutes exist** (not on hover, not on tap), directly under
the now/day-end scale row — under, not replacing it, so the bar keeps its anchor in time.

```
now · 09:45                              21:00
● 1h 35m tasks   ● 2h booked   ● 40m over
```

Dot colours mirror the segments exactly: `primary` = tasks, `primaryEdge` = booked,
`accent` = over. The `over` entry only appears when there is overhang. Absent entirely
when there is no calendar time, so a solo day stays a one-colour bar with no dead legend.

### 4b · The word is "booked"

Not "meetings" — wrong for a dentist appointment, a train, a class, a school pickup.
Not "scheduled" or "commitments" (calendar-app corporate), not "events" (what the API
calls them, not what a person calls their afternoon).

- Legend: `2h booked`
- Footer: `4h 15m already booked today`

### 4c · Free upsell — one line

Previous thinking hid this from free users on the Pro-gate rule. That was
over-applying it. The rule protects the gated **value** — the landing time with
calendar folded in, and the bar position it implies. It never said hide that the
capability exists. An offer is not a leak.

```
🔒 Optimistic — your calendar isn't in it            Add it
```

- Small `accent` lock glyph, `inkSoft` text, `primary` text action. Quiet text link,
  never a filled button — the screen's one primary CTA stays the FAB.
- Fits on one line at true width (38 chars + lock ≈ 231pt of 329pt usable).
- Tapping routes to the calendar settings section / paywall as entitlement dictates.
  New `LandingAction` kind.

**Why this line:** the user installed Whenbee because they are an optimist about time.
Being told this reading is *still* the optimistic one is the most persuasive true
sentence available, and it names a real limit of the number they are looking at at the
exact moment they are looking at it. No manufactured urgency, no implication they did
something wrong.

**Shown when:** free **AND** calendar off **AND** ≥1 queued task.
**Never when:** `landing.kind === 'past'` (no room, and nudging at 10pm is the guilt
line), or the day is empty (nothing to be optimistic about).

**Hold the line:** the free card must keep showing the landing time it can justify from
tasks alone. Never a ghost segment, a greyed-out slice, or a `+ your calendar`
placeholder in the bar — that invents data, and the number underneath would be wrong
until they paid.

---

## Testing

Logic first (TDD), per project discipline:

- `fmtHm` delta wrapper — over / under / dead-on / hours-crossing (`+1h 5m` → `1h 5m over`).
- Recap headline copy per state incl. empty day.
- Landing collapse state round-trips through `kv`; defaults open on a fresh install.
- Legend entries derive from the same segment maths as the bar (no independently
  computed numbers — one source or they can disagree).
- Free-upsell visibility: the full predicate, plus explicit cases proving it is absent
  for Pro, absent on 'past', absent on an empty day.
- `honestLandingCopy` gains the upsell + legend strings; existing tests stay green.

Full suite before commit. Device-verify on Android before the PR is merged.
