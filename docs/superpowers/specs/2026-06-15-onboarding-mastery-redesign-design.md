# Onboarding + Mastery Redesign — Design Spec

Date: 2026-06-15
Status: approved in brainstorm (visual mockups), ready for planning

## Goal

Refresh the three onboarding screens and unify the "mastery" surface app-wide. Kill
the dead space, replace the grey-padlock tier ladder with a warm honey-drop trail,
make `+ New` an obvious action, lead onboarding with a visual "guess → honest"
payoff, swap the honey-jar emoji for the real bee, de-AI the copy, and add a
branded animated privacy lock.

## HARD CONSTRAINT — tokens only

Every size, space, radius, colour, border, opacity, and duration **must** come from
`src/theme/tokens.ts` or a `src/theme/typography.ts` role. **No literal px/hex in
screens or components.** The mockup pixel values are illustrative; the table below
is the binding mapping. If a value isn't in `tokens.ts`, add it there first and
consume the token — never inline a one-off.

### Binding token map (mockup → token)

| Element | Token (use this, not a literal) |
|---|---|
| Hero headline (Welcome) | `fontSize['2xl']` (30), `fontWeight.bold`, lh `['2xl']*1.1`, ls −0.75 — unchanged from current `welcome.tsx` |
| Screen title (Categories, Ready) | `fontSize.xl` (24), `fontWeight.bold`, ls −0.6 — unchanged from current screens |
| Body copy | `AppText variant="body"` (`type.body` = 14, Jakarta-Regular), color `colors.inkSoft`, lh `fontSize.base*1.5` |
| Eyebrow / section label | `AppText variant="label"` / `type.eyebrow` (`fontSize.xs`=10, ls 2, uppercase) |
| Caption (under-bar, helper) | `AppText variant="caption"` (`type.caption` = 12) |
| Honest number "24m" (overflow bar) | `type.bigNumber` (Inter-Bold, `fontSize.lg`=20, tabular) |
| Guess number "15m" (muted) | Inter at `fontSize.caption` (12), `colors.inkSoft` |
| Per-category multiplier (hub) | `type.multiplier` |
| Screen side padding | `space[6]` (24) — via `Screen` |
| Vertical group gap | `space[4]` (16) |
| Title → body gap | `space[3]` (12) |
| Card padding (compact bottom card) | `space[3]` (12) |
| Chip padding | `paddingHorizontal space[4]`, `paddingVertical space[2]` (current Chip) |
| Card / button radius | `radii.card` (16) |
| Chip / pill / bar radius | `radii.full` |
| Primary button height | `size.control.lg` (52) via `AppButton fullWidth` |
| Bar (overflow + honey) track height | `space[3]` (12) — identical to `HoneyBar` |
| Guess fill colour | `colors.primary` (indigo) |
| Honey fill / honest / cap | `colors.accentEdge` → `colors.accent` gradient; cap `colors.accent` |
| Track background | `colors.accentSoft` (honey context) / hairline (neutral) |
| Trail done node | `colors.accent` fill |
| Trail current ring | `colors.accent` stroke + `BeeMascot` |
| Trail ahead node | `colors.hairline` / `colors.inkFaint` outline |
| Lock body | `colors.primarySoft` fill + `colors.primary` stroke, SW 1.6 (matches `ReasonGlyph`) |
| Lock keyhole accent | `colors.accent` |
| Motion: bar fill | `motion.honeyFill` (900) |
| Motion: lock shut, chip pops | `motion.press` (110) + `motion.spring` ({damping 13, stiffness 340}) |
| Reduced motion | honor `useReducedMotion()` — render final/still state |

Any genuinely new value (e.g. the backdrop gradient alphas) is added to `tokens.ts`
as a named entry and referenced — not hardcoded in a screen.

## Product invariants (do not violate)

- No guilt. Trail "ahead" nodes are a quiet preview, never a locked gate. No red,
  no streaks, no shame.
- Honey/sharpness monotonic — a done trail node never reverts.
- Honey/gold appears **once** per onboarding screen (the payoff moment). The hub is
  the honey home, so gold may recur there (trail, reclaim, multipliers).
- Core loop stays on-device. These are presentational changes only.

## Components

### 1. `OnboardingBackdrop` (new)
Full-bleed indigo "aurora" behind the onboarding `Screen` content. Layered
`react-native-svg` `RadialGradient`s over `colors.bg`:
- top-centre glow from `colors.primary` (low alpha)
- bottom-corner glow from `colors.primaryEdge` (low alpha)
Alpha stops live as named constants in the component file (e.g. `BACKDROP_ALPHAS`),
derived from token colours — not magic numbers in screens. Absolutely positioned,
`zIndex` behind content, `pointerEvents="none"`.

### 2. `HoneyTrail` (replaces the padlock `TierTrail` look)
Horizontal trail. Node states carry meaning by **shape + colour** (a11y rule kept):
- `done` → filled honey drop (`colors.accent`) + small gloss highlight
- `now` → honey ring (`colors.accent` stroke) with a `BeeMascot` marker centered
- `ahead` → hairline outline circle (`colors.hairline`), no fill (replaces 🔒)
Connector: solid `colors.accent` up to the current node, dotted `colors.hairline`
after. Labels below in `type.eyebrow`: current = `colors.accent`, done =
`colors.inkSoft`, ahead = `colors.inkFaint`. `accessibilityLabel` per node
(`"<label>: done | now | ahead"`). Props: `nodes: {label, state}[]`.
- Onboarding Ready: 5 nodes, Raw = `now`, rest `ahead`.
- Hub (`TierTrailHub`): 6 nodes (Raw…Keeper), mapped from `companionStage` —
  `< stage` → done, `= stage` → now, `> stage` → ahead. Monotonic by construction.
Retire the padlock glyph + the old `done/now/lock` visual; keep the existing
`TierTrail` prop surface where practical to limit churn.

### 3. `OverflowBar` (new, Welcome payoff)
One continuous track (height `space[3]`, `radii.full`) with two **flush** fills:
guess (`colors.primary`, width = guess/honest ratio, true ratio e.g. 15/24) → honey
(`accentEdge→accent` gradient). Honey end-cap (`colors.accent` circle). Dashed
hairline tick at the seam. Labels: `24m` (`type.bigNumber`, `colors.accent`, right),
`15m` (Inter 12, `inkSoft`, at tick), `you guessed` (caption, left under guess),
`+9 MIN REALITY` (eyebrow, `colors.accent`, right under honey). Mount animation:
guess fills, then honey pours to cap over `motion.honeyFill`, ease-out; `+N min`
fades last. Reduced-motion → final state. Numbers are an **illustrative example**,
copy must say so ("an example — yours come from your own timers").

### 4. `LockGlyph` (new, `ReasonGlyph` sibling)
24-box, SW 1.6, rounded joins. Indigo padlock body (`primarySoft` fill +
`primary` stroke) + amber keyhole (`colors.accent`). Shackle path animates **shut**
on mount via reanimated (`withSequence` timing → `withSpring(spring)`), one-shot,
matching the reason-glyph motion vocabulary. `useReducedMotion()` → shut + still.
**No glow.**

### 5. `OnboardingFooterCard` (compact bottom card pattern)
Raised surface (`colors.surfaceRaised`/`raised`), `radii.card`, padding `space[3]`,
row: glyph (≈`iconSize.lg`) + `variant="bodySm"`/`caption` text. Pinned just above
the `AppButton`. Three uses:
- Welcome → `LockGlyph` + privacy line
- Categories → `BeeMascot` + live pick-count nudge
- Ready → door-exit glyph (reuse `ReasonGlyph 'pulled'` style) + empty-days promise

### 6. `Chip` variant `add` (restyle existing)
Dashed `colors.primary` outline (use `borderWidth.thin` + `borderStyle:'dashed'`),
`colors.primary` text, leading `+` icon, label **"Add your own"**. Distinct from
selectable chips (which gain a leading ✓ when `selected`).

### 7. `BrandLockup` (update)
Replace the 🍯 emoji tile with `BeeMascot` (size ≈ `space[10]`=40) + the "Whenbee"
wordmark. Drop the indigo tile, or keep a subtle one — bee is the mark.

## Screens

Order top→bottom; gaps from `space` tokens; button = `AppButton fullWidth` pinned
bottom with `useSafeAreaInsets().bottom`.

**Welcome** (`welcome.tsx`): StepProgress(0) → `BrandLockup` (bee) → hero headline →
body → flex spacer → `OverflowBar` (eyebrow + bar) → `OnboardingFooterCard`
(privacy + `LockGlyph`) → "Get started →".

**Categories** (`categories.tsx`): StepProgress(1) → title → body → chip wrap (seed
chips + custom picks + dashed "Add your own") → flex spacer →
`OnboardingFooterCard` (bee + "N picked. One more and I'll have plenty to learn
from.") → "Continue →". Tapping outside the inline add-input still dismisses the
keyboard (unchanged).

**Ready** (`ready.tsx`): StepProgress(2) → title → body → `Card` with eyebrow
"Where you're headed" + `HoneyTrail` (Raw=now) + caption "It only ripens. There's
no streak to break." → flex spacer → `OnboardingFooterCard` (door glyph + empty-days
promise) → "Open my day →".

**Hub** (`WhenbeeHub` / `TierTrailHub`): swap the padlock trail for `HoneyTrail`
mid-journey. No layout change beyond the trail component; honey already lives here.

## Copy (final — de-AI'd, no guilt)

- Welcome H1: **"You're not lazy. You're a time optimist."** ("time optimist" in `colors.primary`)
- Welcome body: **"I learn how long things really take you, then show you the honest number — before you plan around a guess."**
- Overflow bar eyebrow: **"How long it really takes"**; labels "you guessed", "+9 MIN REALITY"; helper "An example — yours come from your own timers."
- Privacy: **"No account, no email. Everything stays on this phone."**
- Categories title: **"What makes you run late?"**; body **"Pick a few, or add your own. These are what I'll learn first."**; nudge **"{n} picked. One more and I'll have plenty to learn from."**
- Ready title: **"One tap to start. One tap to ripen."**; body **"From your first guess, I'll show honest times. Every task you log ripens your comb — I'll never scold you for a gap."**; trail caption **"It only ripens. There's no streak to break."**; promise **"Empty days are fine. Forgot to time something? Add it in one tap."**

## Motion (token-bound)

- Overflow bar fill: `motion.honeyFill`, ease-out, mount once.
- Lock shut: `motion.press` + `motion.spring`, mount once.
- Trail current node: gentle `BeeMascot` float (existing `motion.float`), reduced-motion off.
- Chip select: existing `scale.pressIn` press feedback + ✓ fade.
- All guarded by `useReducedMotion()`.

## Out of scope

- The full `Honeycomb` SVG progress object (deferred).
- Discoveries gallery, feedback board, native presence (deferred per CLAUDE.md).
- Any change to the calibration engine, db, or core loop.

## Testing

- `HoneyTrail`: snapshot per state set (onboarding 5-node Raw=now; hub 6-node each
  stage); assert no `done`→`ahead` regression for increasing stage; a11y labels present.
- `OverflowBar`: renders final widths under reduced motion; ratio = guess/honest.
- `LockGlyph`: reduced-motion renders shut/still.
- Screen tests (`categoriesScreen`, etc.): "Add your own" is a button (role/label),
  footer card present, copy strings present.
- Lint + typecheck + jest green before commit (CI parity).
```
