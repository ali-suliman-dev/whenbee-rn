# Honest landing — replacing the day-capacity band

**Status:** design approved 2026-07-25 (founder). Not built.
**Mocks:** [`docs/product/mocks/day-capacity-2026-07-25.html`](../../product/mocks/day-capacity-2026-07-25.html) (survey),
[`docs/product/mocks/day-capacity-v2-2026-07-25.html`](../../product/mocks/day-capacity-v2-2026-07-25.html) (A / B / **D** — the chosen shape).

---

## The problem

`CapacityChip`'s free path divides today's queued honest minutes by `WAKING_WINDOW_MIN = 840`
— a hardcoded 08:00–22:00 window that never moves (`src/engine/constants.ts:241`, its only
consumer is `useDayCapacity.ts:238`).

The thresholds in `honestDayLoad` therefore sit where no real day reaches them:

| verdict | requires |
|---|---|
| `over` | more than **14 h** of queued honest work |
| `snug` | more than **11 h 12 m** (`0.8 × 840`) |
| `comfortable` | everything else |

So the free chip reads `· fits` essentially always. Three compounding faults:

1. **The denominator ignores the clock.** At 7:10 PM with 2 h 40 m queued, the day is
   already lost and the chip says it fits.
2. **The numerator shrinks as the day burns.** Only `status === 'queued'` tasks count
   (`useDayCapacity.ts:110`), so finishing work makes the read *more* optimistic.
3. **`dayEndMin` is ignored.** The user's own end-of-day already exists in
   `settingsStore.ts:78` and is already consumed by the Start-By planner. Capacity never
   reads it.

The component can only ever reassure. That is the opposite of what the app is for.

Two things are NOT wrong and must not be "fixed": the free path never touches the
calendar (`useDayCapacity.ts:139` short-circuits for non-Pro, so no permission is
involved), and the amber-never-red verdict is correct and stays.

## What we're building

Replace the free capacity verdict with an **honest landing time**: given now, the queued
tasks' honest minutes, and the user's end of day, say what time they actually finish.

`Done ~9:50 PM · 50m past your day`

No fraction, no window to divide by, nothing to interpret. The card keeps the current
chip's anatomy — icon disc, one-line headline, bar, hairline, footer action — so it sits
in the Today card rhythm instead of becoming the loudest thing on the screen.

### Why a landing time and not a better denominator

Direction A in the mock fixed the denominator (`now → dayEndMin`) and kept the fraction.
It works, but it breaks at the end of the day: at 8:55 PM the window is five minutes, so
every remaining task reads "over" forever. A landing time has no denominator to collapse.

Directions B (landing time as a 32 px hero number) and C (merging with `DaySoFarCard`)
were both rejected — B makes the card shout every day, C produces the densest card on
Today for a card that usually has little to say.

---

## Scope

### In

- A new pure engine function computing the landing time and its tail task.
- `useDayCapacity` reads `dayEndMin` and a ticking `nowMs`.
- `CapacityChip`'s free path rebuilt as the landing card (four states below).
- Per-row honest end times on the Up Next task rows.
- Pro path keeps meetings, gains the same headline (meetings become a third bar segment).

### Out

- `honestDayLoad` and `WAKING_WINDOW_MIN` are NOT deleted in this change. The Pro
  expanded bar and `useCapacityWidgetPublisher` still consume `DayLoadResult`; unwiring
  them is separate work.
- `DaySoFarCard` stays exactly as it is (direction C rejected).
- No calendar changes. No new permission. No paywall change.

---

## Engine: `honestLanding`

New file `src/engine/honestLanding.ts`, pure, clock-free, exported through
`src/engine/index.ts`. TDD — tests first, per the repo's testing discipline.

```ts
export interface LandingTask {
  id: string;
  label: string;
  /** Honest minutes for this task (guess × M_eff, already rounded). */
  honestMin: number;
}

export interface LandingInput {
  nowMs: number;
  /** Epoch ms of the user's end of day (from dayEndEpochFor). */
  dayEndMs: number;
  /** Queued tasks in execution order. */
  tasks: readonly LandingTask[];
  /** Timed calendar minutes ahead of now. Pro only; 0 for free users. */
  eventMinAhead?: number;
}

export type LandingKind =
  | 'clear'      // lands before dayEnd
  | 'over'       // lands after dayEnd
  | 'past'       // now is already past dayEnd
  | 'empty';     // nothing queued

export interface LandingResult {
  kind: LandingKind;
  /** Epoch ms the last task finishes. null when kind === 'empty'. */
  landingMs: number | null;
  /** Minutes past dayEnd (0 when clear). */
  overMin: number;
  /** Minutes between landing and dayEnd when clear (0 otherwise). */
  openMin: number;
  /** Total honest minutes still queued. */
  remainingMin: number;
  /** First task whose block CROSSES dayEnd, in execution order. null when clear. */
  tail: LandingTask | null;
}
```

Behaviour:

- `landingMs = nowMs + (remainingMin + eventMinAhead) × 60_000`.
- `tail` is found by walking tasks **in execution order** and returning the first whose
  cumulative end passes `dayEndMs`. This is deliberately NOT `cutLadder`'s largest-first
  drop: the footer's claim is "this is the one that lands after 9", which is an ordering
  fact, not an optimisation.
- **No buffer.** `planBackward` adds `DEFAULT_BUFFER_MIN = 5` per task; the landing does
  not. The honest minutes already carry the personal multiplier — adding a buffer on top
  would double-count the very bias the multiplier exists to correct.
- `kind: 'past'` when `nowMs >= dayEndMs`, regardless of what's queued.
- `kind: 'empty'` when `tasks` is empty and `eventMinAhead` is 0 — the card renders
  nothing, matching today's "empty day says nothing" rule (`CapacityChip.tsx:66`).

Rounding: minutes round to the nearest 5 for display, matching `resolveSuggestion`.
The engine returns exact minutes; the component formats.

### The clock dependency

The engine stays clock-free — `nowMs` is passed in. But the card's output changes every
minute, which nothing in `useDayCapacity` currently does (it takes a `_nowMs` parameter
and ignores it, `useDayCapacity.ts:82`).

Add a minute heartbeat in the hook, following the existing `CALENDAR_AGE_TICK_MS`
pattern: a `setInterval` that re-renders on the minute boundary, cleared on unmount, and
skipped entirely when the card isn't visible (`kind: 'empty'`).

---

## The four states

Copy is final — audited against the humanizer patterns and the repo's existing register.
Every string below is the shipped string.

**1 · Over** (the common evening case)

```
⚡  Done ~9:50 PM · 50m past your day
    [ ████████████ ▓▓▓▓▓ ]
    now · 7:10 PM      9:00 PM      9:50 PM
    ─────────────────────────────────────
    Draft the deck lands after 9      Move it →
```

Bar spans `now → landing`. Indigo up to `dayEndMs`, amber past it — so the amber segment
literally is the overflow, not a fraction of a window. Footer names the tail task.

**2 · Clear**

```
⚡  Done ~10:55 AM · 10h still open
    [ ███░░░░░░░░░░░░░░░░ ]
    now · 8:40 AM              9:00 PM
    ─────────────────────────────────────
    Nothing logged yet             Add a task →
```

No amber. Bar spans `now → dayEnd`. `open` reuses the vocabulary already in the Pro
footer (`CapacityChip.tsx:389`).

**3 · Cold start** (`n < CONFIDENCE_HONEST_MIN_LOGS` for the categories in play)

```
⚡  Roughly done 4:20 – 5:40 PM
    [ ██████▒▒▒░░░░░░░░░░ ]
    now · 1:00 PM              9:00 PM
    ─────────────────────────────────────
    4 more logs and this tightens    Start one →
```

A single clock time on a seeded prior is false precision. The range comes from summing
each task's existing `honestRangeFor` band (`src/engine/confidence.ts:91`); the soft bar
segment is its upper edge. The log count is the real remaining count to
`CONFIDENCE_HONEST_MIN_LOGS`, not a decorative number.

**4 · Past end of day**

```
⚡  Your day ended 1h 30m ago · 1h 55m still queued
    ─────────────────────────────────────
    2 done · 1h 15m logged    Move 2 to tomorrow →
```

**No bar in this state.** A bar here can only be 100% amber, which makes the calmest
state the loudest thing on the screen — a guilt signal by accident, and the no-guilt
invariant outranks visual consistency. The offer is tomorrow, one tap, using the existing
`moveToTomorrow` action.

### Per-row end times

Up Next rows gain `· ends ~7:55` in the existing subtitle slot, and the tail row renders
that clause in `t.colors.amberText`. This makes the list one continuous forecast and is
what actually makes the headline checkable. It reads from the same cumulative walk the
engine already does for `tail` — the hook exposes the per-task end times alongside the
result rather than recomputing in the component.

### Pro

Identical component. `eventMinAhead` becomes non-zero, the headline gains no new clause,
and the bar gains a third segment (`primaryEdge`) for meetings between now and landing.
The footer keeps `Pad calendar →`. The Pro delta is data, not a different card — which
also means a Pro user who denies calendar permission degrades to exactly the free card
instead of to a broken one.

---

## Copy decisions worth keeping

| Rejected | Shipped | Reason |
|---|---|---|
| `Done by 9:50 PM` | `Done ~9:50 PM` | "by" is a promise; this is a forecast. `~` is the app's existing estimate marker |
| `50m past your 9:00` | `50m past your day` | Two clock readings in one line means parsing twice. They set the time; "your day" is enough |
| `Draft the deck is the tail` | `Draft the deck lands after 9` | "Tail" is internal jargon |
| `Room for about 3 more like these` | `Nothing logged yet` | Fabricated — assumes an average task size the model doesn't carry |
| `Based on people who plan like you` | *(cut)* | Vague attribution; it's a seeded archetype prior, not a citable cohort |
| `4 more logs and this narrows` | `…and this tightens` | "Narrows" is the Pro confidence-band verb; don't leak it into the free card |
| `1h 15m banked` | `1h 15m logged` | "Banked" is Reclaim vocabulary, and Reclaim was cut as off-thesis |

A second headline form (`~9:50 PM. That's 50m past your day.`) is approved as **D-alt** and
kept behind the same component — it is a string swap, not a layout change, so it can ship
as a Settings → Developer toggle for founder comparison on device, the same way the paywall
variants did.

---

## Invariants this must not break

- **No guilt.** Amber never becomes red. State 4 in particular gets no bar and no scold.
- **Core loop stays on-device.** Nothing here is a network call.
- **Free path never touches the calendar.** `eventMinAhead` is 0 for non-Pro and the
  calendar is never read — the existing short-circuit stays exactly as is.
- **Pro-gate leak rule.** Routine minutes stay out of the free landing
  (`useDayCapacity.ts:121` already gates them); the free card must not reveal a gated
  value *or its position*.
- **Tokens only.** New bar segment colors and the tail-row amber come from
  `tokens.ts`; no inline values.

## Testing

- `honestLanding` gets exhaustive unit tests — it's pure, so this is cheap: empty, single
  task, exact-fit-at-dayEnd boundary, tail selection with a large task early vs late,
  `past` when `now === dayEnd`, and `eventMinAhead` folding in.
- A regression test that the free path computes `eventMinAhead === 0` and never calls
  `getCalendar()`.
- `CapacityChip` render tests per state, asserting state 4 renders no bar.
- The minute heartbeat gets a fake-timer test: the card's rendered landing text changes
  when the clock advances past a minute boundary, and the interval is cleared on unmount.

## Open

**The `honestDayLoad` / `WAKING_WINDOW_MIN` retirement.** After this ships, the fixed
window survives only in the Pro expanded bar and `useCapacityWidgetPublisher`. Both should
move to the landing model, but that touches the presence widget — which is under an
add-only constraint — so it is deliberately left out of scope here and needs its own pass.
</content>
