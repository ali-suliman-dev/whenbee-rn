# Accessibility, motion & performance — pre-beta status

This is the last quality pass before beta. It splits cleanly into **what was
audited and fixed in code** (verifiable headless) and **what only a device /
simulator with a human can confirm**. Do not treat the device checks as done
until someone runs them — they cannot be automated here.

## Durable guardrail: the no-guilt copy audit

`src/lib/__tests__/copyAudit.test.ts` runs on every `npm test` / CI push and is
the long-lived regression net for the **"no guilt, ever"** and
**amber-never-red** invariants. It will fail the build if future copy reintroduces
a banned mechanic, so it protects the invariant without anyone having to remember
it.

**What it scans:** every `src/**/*.ts(x)` (via `git ls-files`, fallback to a
walk), excluding `.test.`/`.spec.` files and anything under `__tests__/`. It
strips whole-line `//` comments, block-comment body lines (`* …`), and inline
`// …` trailers before matching, so prose in comments never trips it.

**What it fails on:**

- Guilt/shame mechanics in copy: `streak`, `missed`, `don't lose`,
  `days in a row`, `saved you` (unqualified), `keep going` (as a trap), and shame
  words aimed at the user (`lazy`, `failure`, `you failed`).
- **Reframing is allowed.** A banned token preceded by a negation within a short
  window ("no streak to break", "you're not lazy") is the invariant being
  *stated*, not violated, and passes. This is intentional — Whenbee's voice leans
  on those reframings.
- **RED-as-state:** a `colors.danger` / `colors.error` token used outside an
  explicit allow-list of genuine system-error sites (currently only
  `src/features/paywall/Paywall.tsx`, for purchase/restore failures). A second
  rule hard-fails any `danger`/`error` token on the protected
  honey/honeycomb/reward/today/whenbee/patterns/timer surfaces, even if it were
  added to the allow-list.

If it fails, **fix the copy** (humanizer + conversion-psychology), not the test.
Only loosen a matcher for a provable false positive. To legitimately add a new
error site, add its path to `DANGER_ALLOW` in the test — and only for real error
UI.

## Code-audited and fixed (✅ verifiable headless)

- **Copy audit** — no real violations existed; the only `streak`/`lazy` mentions
  are negated reframings, which the matcher allows by design.
- **Tap targets** — Planner reorder up/down arrows were 44×22pt; added vertical
  `hitSlop` so the effective target is ≥44pt. Audited every other interactive
  control across Today, Timer, Reward, Whenbee, Honeycomb, Category-detail,
  Planner, Paywall, Patterns, Honest-Day — all already ≥44pt.
- **Missing labels** — added `accessibilityLabel` to the category "Keep it"
  cancel button; gave Paywall plan rows a composed label + `radio` role with
  `checked` state.
- **Decorative SVG** — `TrendChart`'s line chart is now hidden from the a11y tree
  (`accessibilityElementsHidden`); its visible caption is the text alternative.
  Honeycomb cells deliberately **keep** their per-cell `image` labels (meaningful,
  not noise).
- **Adjustable wheel** — `TimeField` minute wheel now exposes
  `accessibilityRole="adjustable"` with `accessibilityValue` and
  increment/decrement actions, so VoiceOver users can read and change the value
  without the drag gesture.
- **Reduce-motion parity** — `ReasonChips` entry animations now guard
  `useReducedMotion()`. Confirmed the other animated surfaces already guard it:
  Honeycomb fill, FocusCard/RunningFocusCard, TimerRing-adjacent beats,
  ReasonGlyph, ReclaimDeposit, BeeBurst/CoinBadge/RayBurst.
- **Dynamic Type** — critical copy uses the type roles; `numberOfLines={1}` is
  confined to short labels (titles, eyebrows, category names) where wrapping would
  break layout, not to body copy that could truncate meaning.

## Performance (audited)

- **No genuinely long variable lists** exist. Today (~20), Plan (~15),
  CalibrationMap (~20), CategoryChips (~30 horizontal), RecentList (capped at 8)
  are all short bounded `.map()`s with stable `key`s — correct as-is; the task
  says not to micro-optimize short fixed lists.
- **`@shopify/flash-list` is NOT a dependency.** Per task constraints it was not
  added. **Follow-up:** if any of these lists grows unbounded (e.g. a user with
  hundreds of categories), migrate that one to `FlashList` (or at minimum
  `FlatList` with `keyExtractor`).
- **`TimeField` renders all 180 wheel rows** by design — each row's opacity/scale
  is a `useAnimatedStyle` worklet keyed off a shared `translateY`, so the curved
  drum effect can't survive virtualization. Rows are `memo`'d. Left as-is
  intentionally; revisit only if the wheel measures janky on a low-end device.
- No egregious inline-prop churn found on the hot timer/reward path.

## Device-only — MUST be run by a human before beta (⚠️ NOT verifiable here)

VoiceOver flow, live 60fps, and on-device Dynamic Type cannot be checked headless.
Run these on a real device / simulator and confirm visually:

- [ ] **VoiceOver completes the core loop** end to end: guess → start timer →
      stop & log → reward (incl. deposit + reason chips) → hub. Every step is
      reachable, labels read sensibly, focus order is logical, no traps.
- [ ] **Dynamic Type at XXL / Accessibility sizes** shows no clipping or overlap
      on Today, Timer, Reward, Whenbee hub, Category-detail, Planner, Paywall.
- [ ] **Reduce Motion ON** (Settings → Accessibility → Motion): honeycomb fill,
      reward beats, and the timer ring settle without animating; nothing feels
      broken or invisible. Confirm parity visually.
- [ ] **60fps** on the timer ring and honeycomb fill (Perf monitor / Instruments).
- [ ] **Cold start < 2s** to first interactive frame.
- [ ] **Wheel (`TimeField`) with VoiceOver**: the new `adjustable` role reads the
      current minutes and increment/decrement work (the drag gesture is not
      VoiceOver-operable).
- [ ] **Contrast** of `inkSoft`/muted text on `surface`/`surfaceSunken` at
      ≥4.5:1 (the token audit checked usage, not measured ratios).

Reset onboarding + capture per the simulator notes in `CLAUDE.md` (delete the
SQLite container, relaunch, `xcrun simctl io booted screenshot`).
