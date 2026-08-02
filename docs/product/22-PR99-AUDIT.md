# 22 — Adversarial audit of PR #99, and what it changed

Audit run 2026-08-01/02 against branch `worktree-plain-calibration-copy` (PR #99), which implements
[`21-MASCOT-AND-HONEY-AUDIT.md`](21-MASCOT-AND-HONEY-AUDIT.md) §4.

Ten independent auditors swept the branch — one each for stage/unlock logic, i18n, accessibility,
the project's hard visual and motion rules, dead code, test quality, end-to-end user journeys,
architecture and layering, React Native re-render cost, and data/analytics continuity. Every
non-minor finding then faced a separate skeptic instructed to refute it and to default to refuted
when uncertain. 52 findings filed, 10 killed by refutation, 42 survived. After de-duplicating the
overlaps (four dimensions independently found the same away-count bug), the real list was 19.

All 19 are fixed on the branch. This document is the record of what was wrong.

## The one that mattered most

**The ladder was promising things logging does not buy.**

`src/engine/companion.ts` marks stages 1–5 `gatesNewFeature: true`. Only one of those capabilities
is actually gated on companion stage anywhere in the app — `drift-recalibration`, via
`DRIFT_RECHECK_MIN_STAGE = 5` in `hubGates.ts`. Live finish-time and done-time render for everyone
from day one. Start-by and Honest-Day are gated by **Pro**, not by logs.

The engine has carried that claim since long before this branch. What the branch did was render it
for the first time — so a day-one user was told "10 more logs and Done-time on Today and Add task"
while Add task was already showing them a done-time.

Three ways out were put to the founder: reword it, make the gates real, or drop the framing.
**Decision (2026-08-02): reword.** Nothing gets hidden from anyone. The ladder now describes what
logs *sharpen*, with `unlocks at Honest` reserved for the one rung where it is literally true, and
the two Pro rungs marked as Pro. A second exhaustive record, `CAPABILITY_STAGE_GATED` in
`capabilityGating.ts`, keeps that classification in one place next to the Pro one, with the
evidence and the date written down.

## Fixed: correctness

- **The away-count measured the wrong rung.** `logsToNext` counted logs to the next *tier band* off
  live sharpness, while the capability beside it came from the *monotonic stage*. When the stage ran
  ahead — reset your leading category and it does — the number and the promise described different
  rungs. Now derived from the tier the next stage actually requires; where no honest count exists,
  the line is suppressed rather than fabricated.
- **The reward screen re-announced capabilities you already owned.** The guard compared the stage
  after the log with the stage the log crossed, both already advanced, so a second category crossing
  the same boundary weeks later announced the same unlock again. Now compares before with after.
- **The Keeper milestone counted backward.** "N of M areas sealed" was computed from live rolling
  sharpness, so a sealed area that drifted made the counter go *down* — a milestone turned into a
  scold, which this product does not do. Now non-decreasing.
- **"Calibrated ✦" could sit above a falling tier word.** The sealed line followed the monotonic
  stage while the tier word followed live sharpness, so deleting the calibrated area produced
  "Just started, 0%" with a completion line underneath. The two reads now agree.
- **Cold boot un-lit earned rungs.** The monotonic stage mirror defaulted to 1 and was only filled
  by a summary load. `hydrate()` now seeds it from the companion row it was already reading.

## Fixed: what the user reads

- The reward screen printed the raw engine tier word — untranslated English, and the old honey
  vocabulary this branch removed.
- "Across everything you track" labelled a count that only moved with the lead category.
- Two percentages appeared under the word "Calibration" — the logged category's on the reward
  screen, the lead category's on Today — with neither naming its scope.
- The reward CTA still pointed at "your bee" on a tab now called Progress.
- English said "sealed" where Swedish said "calibrated"; the Keeper rung used different vocabulary
  from the milestone counting toward it; rung 4 named a widget that does not exist on iOS.
- Swedish carried a särskrivning ("Live sluttid"), invented a term for the start-by anchor that the
  Swedish UI does not use, and dropped the space before `%` that the rest of the bundle keeps.
- Today rendered the same tier word twice, ~10pt apart.

## Fixed: accessibility

- Unreached ladder rungs used `inkFaint` — measured **2.69:1 in light, 3.44:1 in dark**, under the
  4.5:1 AA floor, for text describing the thing the user is working toward. Moved to `inkSoft`
  (**6.29:1 light, 6.92:1 dark**), keeping the quieter-than-reached hierarchy.
- The decorative `✦` was piped into spoken labels on Today and the reward screen.
- The demoted bee header mark was still announced as an image next to a heading that said the same
  thing.
- The visible percentage glued its `%` in JSX, so it could never be localised.

## Fixed: layout

- Neither `Text` in the ladder header nor on Today's card could shrink, so a long tier word pushed
  the percentage out of the card. Swedish breaks on almost every tier word.
- Pro rungs were ~6pt taller than free rungs, so their markers drifted off the gutter.
- Today's ring floors its fill at 6% so it never reads empty; the card's bar started at a true 0%
  directly beneath it — two visual claims about one number.

## Fixed: rigour and cost

- Every "plain" (non-Pro) unlock-sentence assertion was made with `isPro: true`, so the free user
  with a free capability — the most common state in the app — was pinned by nothing.
- The store's monotonic-mirror test was satisfied by the repository's own clamping, not by the store
  guard it named.
- No test rendered a singular plural form, though the suite constructed the `count === 1` state.
- `useNextUnlock` subscribed to `logs`, discarded it, and kept it as a memo dependency, so every
  abandoned timer invalidated the memo in every mounted instance for an identical result. It ran
  three times in one card subtree; it now resolves once and passes down.
- Dead on arrival and now deleted: seven companion geometry tokens orphaned with `WhenbeeAvatar`,
  the engine's six hardcoded English capability labels, `HoneycombStripPlaceholder` (unmounted since
  before this branch, still being translated), `useWhenbeeHub`'s unread `cells` and `honeyPct`, and
  the companion-name chain. The database column stays — an unused column is cheaper than a migration
  on a live device.
- Two analytics events added (`unlock_sentence_shown`, `unlock_ladder_viewed`), because the branch's
  entire hypothesis — that naming the next unlock makes people log more — was unmeasurable without
  them. Ids and numbers only; once per state, not per render. No existing event was touched.

## Not fixed, deliberately

- **The reward hero's fade-and-rise entrance** (`reward.tsx`) is a translate-in on content, which
  the project's motion rule bans. It is byte-identical on `main` and predates this branch, so it is
  out of scope here — but it is a real rule violation and worth a decision.
- **`companionRepo.setName` / the companion-name database column** stay in the schema. Nothing can
  write a name any more, but removing a column means a migration on a device with real data.

## Still needs a human on a device

No simulator or device run happened on this branch. Static analysis cannot settle:

1. Today at zero logs — does the card read as a demand on an otherwise empty screen?
2. The header ring's caption removal — the gear icon is centred to the ring circle, verify it did
   not move.
3. The Progress tab with the hero gone — does the compact header read as intentional?
4. The backward case: cap a category, log several bad estimates, watch all three surfaces. Use a
   throwaway category and abandon via "Skip for now".
5. Free account at a Pro rung — tap through and confirm the paywall is what you expect.
6. Reward screen with two categories at different calibration, VoiceOver on.
7. Swedish on all three surfaces — the ladder rows are the longest new strings.
