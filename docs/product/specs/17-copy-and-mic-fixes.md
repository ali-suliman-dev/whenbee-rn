# 17 · Ready-screen name, cross-platform mic, landing-card bottom lines

Status: **approved 2026-07-29** (founder picks recorded inline). Not built.

Three unrelated fixes batched because they're all small and all touch user-facing
copy. Mocks reviewed and approved:

- `scratchpad/copy-mock.html` — nickname link, mic, landing card
- `scratchpad/icon-mock.html` — calendar-line icon at true 12pt

---

## 1 · Ready screen — "Give me a nickname"

### The problem

`src/app/(onboarding)/ready.tsx` speaks in **two first-person voices on one
screen**:

- body copy is the app — "**I** read them from your time-style"
- the CTA is the user — "Time **my** first thing →"

So "Give **me** a nickname" has no fixed referent. Worse: the app ships a real
companion-naming screen (`src/app/(modals)/companion.tsx`, placeholder
"e.g. Buzz"), so a fair share of readers will read the link as *name the bee*.

Second, smaller problem: the screen says **nickname**, Settings says **name**
(`settings.tsx:341` — "Tell Whenbee your name"). Two words for one stored value
(`settingsStore` already keys it `name`).

### Decision

| Surface | Before | After |
|---|---|---|
| Link label + a11y label | `Give me a nickname` | `What should I call you?` |
| Placeholder | `Your nickname` | `Anything you answer to` |
| Input a11y label | `Your nickname` | `Your name` |
| Trailing hint | `optional` | `optional` (unchanged) |

The link is the **app asking the user** — matching the body copy's voice, and the
only reading where the referent can't slip.

`Anything you answer to` deliberately avoids "first name" — too specific, and
excludes the nickname/handle the field is happy to take.

**Rename `nickname` → `name` app-wide**: `ready.tsx` (state, labels), the tests
in `src/features/onboarding/__tests__/readyScreen.test.tsx`, and the
`settingsStore.ts:70` doc comment. No data migration — the stored key is already
`name`.

Nothing else on the screen changes. The mixed-voice CTA ("Time my first thing")
stays as-is; it isn't ambiguous on its own.

---

## 2 · The mic on "What are you working on?"

### The problem

It's already built and it's **invisible on Android**.

`src/components/TaskTitleField.tsx:115` renders a `MicButton` beside the input on
add-task, retro, routines and the planner composer. `MicButton.tsx:39` draws its
glyph with `SymbolView` (`expo-symbols` = SF Symbols, **iOS only**) and passes no
`fallback`. On Android it renders an empty 34pt box — tappable dead space with
nothing in it. Everything underneath (`useVoiceCapture` → `expo-speech-recognition`,
on-device, live partials, the Tier-1 parser) works on Android already.

### Decision

**a. Make the glyph cross-platform.** Keep the SF Symbol on iOS for the native
feel; fall back to the Ionicons `mic` / `mic-outline` on Android — the icon set
the rest of the app already uses. `t.iconSize.md`, `t.colors.inkSoft` idle /
`t.colors.primary` listening, so the two platforms match in weight and colour.
Contained entirely in `MicButton.tsx`; no caller changes.

**b. Add voice to the post-stop capture sheet.** `PostStopCaptureSheet.tsx:191`
asks the same question ("What did you work on?") with a bare `TextInput` and no
mic. Replace it with `TaskTitleField`, passing the sheet's sunken look through
`containerStyle` (`surfaceSunken` bg + hairline border + `radii.md`) and
`textStyle` (`fontSize.base`, `colors.ink`) so it renders identically apart from
the new mic. The declared-but-unused `inputRef` (`:62`, `:193`) goes with it.

The voice draft's title flows through `onChangeText`; the sheet's own category
chips stay in charge of category. No change to what gets logged.

---

## 3 · Landing card — the two bottom lines

### 3a. Delete the nothing-logged footer

`honestLandingCopy.ts:169-171` returns `{ text: 'Nothing logged yet', action:
'Add a task' }` when `doneCount === 0`. It's the weakest row on the card: it
states an absence and offers a path Today already has three of.

**Return no row at all** in that branch — no text, no action. Every other footer
state keeps its line, because each one carries a fact the user can act on:

- `past` → `3 done · 1h 20m logged` + `Move N to tomorrow`
- `over` with a tail → `Invoice chase lands after 9` + `Move it`
- booked time ahead → `2h already booked today` + `Pad calendar`
- `doneCount > 0` → `3 done · 1h 20m logged` + `Add a task`

`FooterCopy` needs to express "nothing to say" — return `null` from
`landingFooter` and have `HonestLandingCard` skip the divider + row entirely when
it's null (the divider belongs to whichever row renders first).

### 3b. The calendar line

| | |
|---|---|
| Text | `Assumes an empty calendar` |
| Action | `Add mine` |
| Icon | Ionicons `calendar-outline`, `iconSize.xs` (12), `colors.accent` |

Replaces `Optimistic — your calendar isn't in it` / `Add it` / `lock-closed`.

Shorter so it survives `numberOfLines={1}` next to the action on a narrow Android
screen. Keeps the same claim — the number is missing a layer — and names *which*
layer, which is the honest-number thesis stated plainly.

The icon changes from a padlock to the object the sentence is about. Amber stays:
amber is the honest layer app-wide, so the row reads as part of the number's
story rather than a store ad. It's the same `calendar-outline` glyph already
shipping at 12pt in `DayRecapCard.tsx:250`, so no new icon vocabulary. The tap
still opens the Pro path (`onAction('connect-calendar')`) — the paywall is
discovered, not advertised.

### 3c. When the line shows

Gate becomes `!isPro && eventMinAhead === 0 && landing.kind !== 'past'` — i.e.
**persistent for as long as no calendar time is in the number**, not tied to any
other state. Two deliberate exclusions:

- **Calendar is in → nothing renders.** The legend under the bar already prints
  `1h 20m booked` against its own colour dot; that IS the proof the calendar is
  counted. A second line saying so would be noise.
- **`past` days stay suppressed.** The day is over; adding a calendar can't move
  a landing that already happened, so the offer would be dead.

The card body only renders when expanded, so "persistent" means *whenever the
card is open* — unchanged behaviour.

---

## Test impact

- `src/features/today/__tests__/honestLandingCopy.test.ts` — the `Nothing logged
  yet` assertion (`:148`) becomes a null-footer assertion; the upsell text
  assertion (`:316`) takes the new string.
- `src/features/onboarding/__tests__/readyScreen.test.tsx` — label lookups at
  `:44`, `:46`, `:59`, `:72`, `:80` take the new strings.
- `HonestLandingCard` tests need a case for "footer null → no divider, no row".
- New: `MicButton` renders a glyph on both platforms; `PostStopCaptureSheet`
  renders a mic and a voice draft fills the title field. The capture-sheet test
  will need the expo-router `useNavigation` mock `TaskTitleField` requires
  (`isFocused` + `addListener`) — see CLAUDE.md.

## Out of scope

The mixed first-person voice across onboarding (app "I" vs user "my") is real but
bigger than this batch. Not touched here.
