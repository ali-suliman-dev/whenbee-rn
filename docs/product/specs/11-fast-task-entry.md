# 11 · Fast task entry

**Status:** design approved 2026-06-20 · not yet planned
**Visual mock:** `docs/brand/tap-entry-mockups.html` (six explored variants, real tokens)

## Goal

Shrink the distance from *intent* to *recording a task*. The full add-task drawer stays, but
two faster paths sit in front of it, and the existing drawer's commit reach gets shortened. No
hidden-gesture learning curve — every path is visible the moment the user looks.

Honors the product invariants: core loop stays on-device, no guilt/streak mechanics, honey
monotonic, pricing untouched.

## The system

Three composed pieces. Two new surfaces (arc, chips) plus one improvement to the existing drawer.

```
Tap +  →  Quick-action arc:   🎙 Voice    ▶ Timer    ⌨ Type
                                 │           │          └→ thumb-zone drawer
                                 │           └→ quick-start a timer, name it after
                                 └→ existing on-device listening sheet
Today  →  Quick-task chips:   [▶ Emails ~50m] [▶ Gym ~1h 5m] [▶ Standup ~18m]   one-tap re-fire
```

### A. Quick-action arc (replaces the tap-target behaviour of +)

- Tapping the center `+` no longer pushes the drawer route directly. It opens a three-bubble
  fan that rises into the thumb arc above the button: **Voice**, **Timer**, **Type**.
- Bubbles are coin discs (radius `full`, `surface` fill, `border` hairline, View-based bottom
  edge — no `boxShadow`). Center bubble (Timer) is `primary`-filled as the visual default.
- Branches:
  - **Type** → opens the thumb-zone drawer (piece C below) — the current full add flow.
  - **Timer** → quick-start a timer immediately with no fields; name + category are captured
    **at stop** (piece D below), while context is fresh.
  - **Voice** → opens the existing `ListeningSheet` / `useVoiceCapture` flow unchanged.
- Tapping the scrim or the `+` again dismisses the arc.
- The `+` keeps its press animation (sink + squash) and `haptics.light()` on open.

### B. Quick-task chips on Today (new, no drawer)

- A horizontal row of the user's most-repeated tasks, shown on Today under a quiet "Tap to start
  again" label. Each chip: a small play disc + task title + the learned honest estimate
  (e.g. `~50m honest`).
- One tap → starts a timer immediately for that task with its learned honest guess. No fields,
  no drawer, no gesture.
- Data comes from existing repositories (`categoryStatsRepo` / `taskEventsRepo` frequency) — no
  new persistence, no network.
- **Count: at most 4 chips, one non-scrolling row.** (Researched: iOS Siri suggestions surface
  3–4, Android launcher rows 4–5, Hick's-law guidance for quick-action sets is 3–5. 6+ breaks
  single-glance scanning.) If 4 don't fit a narrow screen, drop to 3 — never scroll, never wrap.
- **Threshold to earn a chip: ≥3 completed runs** of that task. Enough to prove a genuine repeat,
  not a one-off, and it keeps the row stable rather than churning every session.
- **Sort: frequency-weighted with recency decay** — completion count × a recency half-life
  multiplier; tie-break by most-recent completion. True habits lead, but a task touched today can
  still surface. Fully on-device.
- Empty state: until ≥1 task clears the threshold, the row (and its label) is simply absent. No nag.

### C. Thumb-zone drawer (improvement to the existing add-task sheet)

- Same fields and logic as today (title + mic, category chips, guess, honest suggestion card).
- The primary commit button (**Add & start timer**) is pinned in the natural thumb arc — the
  lower third of the sheet — rather than below scrollable content, so the final action needs no
  stretch to the top of the screen. **Add to today** remains as the quiet secondary.
- Footer respects `useSafeAreaInsets().bottom`.

### D. Quick-start timer — capture at stop (new flow on an existing path)

The **Timer** branch starts tracking with zero fields. The model can only learn from a task that
has a category, and recall decays fast (researched: same-day categorisation ≈ 66% accurate vs
≈ 47% when deferred). So we capture **at stop, while context is fresh** — never defer to a later
clean-up queue.

- On stop, slide up a **non-blocking sheet** (action-sheet shape, not a blocking alert — HIG:
  "use an action sheet, not an alert" for choices tied to an intentional action). It is pre-focused
  on category chips with an optional name field.
- **Pre-select the most-likely category** (from the title if voiced/typed, else the user's most
  frequent), so the happy path is a single confirming tap.
- Two paths only: **Save** (writes a `completed` event → trains the model, matures honey like any
  task) and **Skip**.
- **Skip keeps the entry**, marked neutrally as *Unsorted*, and editable later from history. It is
  not discarded, not badged red, not re-prompted. An accidental discard is reversible via **Undo**,
  not guarded by a confirm dialog (HIG: don't alert for common, undoable actions).
- This is the honest incentive, no artificial reward: Save is what feeds learning; Skip is a calm
  exit. Honours the no-guilt / no-shame invariant.

**Microcopy (build-time `humanizer` + `conversion-psychology` pass required before ship).**
Current direction — benefit on the primary, neutral exit on the secondary, consequence stated plainly:

- Primary: **Save — teaches your real pace**
- Secondary: **Skip for now**
- If skipped, a single quiet line on the kept entry: *Unsorted · won't sharpen your estimates until
  you sort it.* (Neutral, non-accusatory — no "you forgot", no red.)

## Reuse / what already exists

- Voice: `MicButton`, `useVoiceCapture`, `ListeningSheet`, on-device STT + Apple-LLM structurer.
- Timer + post-hoc naming: existing timer modal and store.
- Frequency data: `categoryStatsRepo`, `taskEventsRepo`.
- The drawer itself: `src/app/(modals)/add-task.tsx`, `useAddTask`.

The arc and chips are the only genuinely new UI. The drawer change is a layout move.

## Interaction & motion

- Arc open: bubbles stagger up (`enterStagger` 70ms) on `out` easing, spring settle
  (`{damping:13, stiffness:340}`). Reduced-motion: fade only.
- No `exiting` layout animations on conditionally-unmounted views (Fabric SIGABRT — entering-only).
- All sizing/spacing/color from `tokens.ts` via `useTheme()`; add tokens if a value is missing
  rather than inlining.

## Out of scope (parked, not cut)

- **Long-press +** (variant 1) and **hold-to-talk** (variant 4): hidden gestures; revisit only
  if the arc proves too slow for power users.
- **Always-ready capture bar** (variant 6): spends permanent Today space; not now.

## Decisions (researched 2026-06-20)

- **Chip count = 4 max**, one non-scrolling row. Sources: iOS Siri suggestions (3–4), Android
  launcher rows (4–5), Hick's-law quick-action guidance (3–5).
- **Chip threshold = ≥3 completed runs**; **sort = frequency × recency-decay**, tie-break recency.
  (Norm-based: no vendor publishes an exact count; this mirrors launcher "frequent + recent" blends.)
- **Quick-start Timer ships**, with capture **at stop** (not deferred): non-blocking sheet,
  pre-selected category, Save / Skip, kept-as-Unsorted on skip, Undo over confirm. Backed by the
  Toggl / Timery / RescueTime "track-first, detail-after" pattern + recall-decay accuracy data.
- **Accessibility:** the three arc bubbles read left→right — Voice, Timer, Type — each with an
  explicit `accessibilityLabel`; this is a build detail, not an open decision.

## Open questions

- None blocking. Final microcopy strings get a `humanizer` + `conversion-psychology` pass at build.
