# Category hero — the range band as hero (design)

**Status:** design · approved direction (2026-06-21) · **Surface:** Category detail (`src/app/category/[category].tsx` → `HonestCard.tsx`)
**Mockup:** `docs/superpowers/mockups/category-hero-band.html` (real dark-mode tokens, rendered)
**Skills applied:** ui-design:visual-design-foundations, ui-design:react-native-design, ui-design:mobile-ios-design, emil-design-eng, motion-design, svg-animations, conversion-psychology, humanizer, ux-principles

> Builds on `docs/product/specs/03-confidence-band.md` (the Pro confidence-band). This doc redesigns the **hero block** that band lives in; it does not change the engine math in spec 03.

---

## 1. What we're changing & why

The category hero today is flat text: a tier pill ("Setting · 6 to Ripening"), an eyebrow, the range as a static string ("20–40 min"), and a learning line. Three problems (founder, 2026-06-21):

1. **Flat / boring** — the most important screen on the category is just text on black.
2. **Jargon isn't legible** — "Setting", "6 to Ripening" carry no meaning to the user.
3. **The range should be the hero** — the learning state (a range tightening to one number) is the product story and it's invisible.

**The move:** make the **range a living band** the hero of the screen. The range numbers stay; below them a real amber band draws the spread, a caret callout marks where it's converging, and a honey-cell meter reframes the tier progress into plain language. The band visibly narrows as the user logs — the literal animation of "it's learning me."

## 2. Gating — what's free vs Pro (decision)

This preserves the spec 03 Pro gate; it does not give the confidence-band away.

| Element | Tier | Rationale |
|---|---|---|
| Range **numbers** ("20–40 min") | **Free** | The honest number in its pre-collapse form. Calibration is the free wedge — already shown free today. |
| Range **band segment** (draws [low, high]) + end labels | **Free** | Visualizes numbers the free user already sees. No new information leaked. |
| Honey-cell **maturity meter** + plain tier meaning | **Free** | Maturity is free (per honey-maturity gating decision). |
| **Precise convergence tick** ("~30 · where tasks land") | **Pro** | This is the spec 03 point estimate — the P25–P75 band's point. Free sees it as a locked teaser. |
| **Narrowing proof** ("Tightened from 10–55") | **Pro** | Needs `firstHonestRange` history; the compounding-value payoff. |

> **Open decision (13.1):** free shows the precise tick as a *locked* teaser on the band (indigo + `Pro`, mockup V5) vs omitting it entirely and teasing Pro lower on the screen. Spec recommends the **locked teaser on the band** (V5) — it makes the upgrade legible exactly where the value is, and the founder approved V1+state-matrix which includes V5. Confirm on the rendered screenshot.

## 3. The state matrix (one hero, four states)

The hero is one component (`HonestCard`) that renders by `(isPro, confidence, hasHistory)`:

| State | Band | Marker | Meter / caption |
|---|---|---|---|
| **Free · learning** (`!isPro`, raw/setting) | amber segment + end labels | `~30` as **locked Pro teaser** (indigo, `Pro` chip) | honey pips + "6 more runs sharpen this to one number" |
| **Pro · learning** (`isPro`, setting) | amber segment + end labels | live **amber `~30` tick** (the point) | honey pips + same caption |
| **Pro · has history** (`isPro`, `firstHonestRange` narrower) | amber segment over a **ghost** of the old wide range | amber `~30` tick | caption "Tightened from {wasLow}–{wasHigh} as you logged." |
| **Honest** (`confidence === 'honest'`, n≥6) | band collapses to the single point | — | "Now an honest number" affirmation (existing) |

Mockup references: Free=V5, Pro·learning=V1, Pro·history=V4, in-context=V6.

## 4. Anatomy (top → bottom)

All values are tokens from `src/theme/tokens.ts` via `useTheme()`; roles from `src/theme/typography.ts`. No raw hex/number — add a token if one is missing.

1. **Tier row** — `tierrow`: an amber pill with a small honey-hex glyph + one-word tier ("Setting"), then a plain-language meaning in `inkSoft` ("still sharpening your pace"). Replaces "Setting · 6 to Ripening". `alignItems: center` so the chip optically centers to the meaning's cap-height.
2. **Eyebrow** — "Your honest range" (`type.eyebrow`, `inkFaint`). ("range", not "number", while a band shows.)
3. **Range number** — `HonestNumber` size xl, tone ink: "20–40" + "min". Tabular nums, the existing component.
4. **The band** (`bandwrap`, `marginTop ≈ space[8]+` so the caret callout clears the number):
   - **Track** — full width, `height ≈ progress.gapTrack` (8) or a new `progress.bandTrack` (16) for a more deliberate hero strip; `surfaceSunken`, `radii.full`, subtle inset shadow.
   - **Segment** — absolute `[left%, width%]` from the display-domain map (spec 03 §8.4). Fill: honey gradient (`brand.honeyFill` → `accent`) at honest/pro; `accentSoft` while soft/raw.
   - **Caret callout** — a small honey pill ("~30") with a downward caret, centered on the point%, floating above the band. Locked variant = `primarySoft` + `Pro`.
   - **Point tick** — `progress.tickW` notch at the point%, dark core + amber halo ring. Pro only.
   - **End labels** — low/high numerals under the segment edges (`ends`, absolute, `translateX(-50%)`), tabular.
   - **Ghost (Pro history)** — a faint amber band + end-caps + faint labels behind the live segment, showing the prior wider range.
5. **Maturity meter** (`mat`, **two rows**, per founder): a row of honey-hex pips (filled = logged in tier, ghost = remaining) **above**, the caption on its **own line below** ("6 more runs sharpen this to one number"). Not side-by-side. (Honest state hides the meter, shows the affirmation.)

## 5. Motion

Owner skills: `motion-design` + `creating-reanimated-animations` + `svg-animations`. Honor `ReduceMotion.System`; honey/sharpness stays monotonic; no guilt motion.

- **Band reveal (on mount):** segment animates from full-track width **inward** to [low, high] — reuse the exact gesture already in `HonestBand.tsx` (`withTiming(target, { duration: motion.base, easing: motion.easing.out })`, shared value via `.get()/.set()`). Every visit feels the band tighten.
- **Tick / callout:** fade + tiny rise after the segment settles (`withDelay(motion.fast, …)`), so the eye reads spread → point.
- **Pips:** left→right stagger on mount (`motion.stagger` 40ms), entering-only (no exit anim — see the Reanimated exiting-crash gotcha).
- **Reduced motion:** segment at final width immediately, tick/pips at full opacity, no wipe.

## 6. Copy (humanizer + conversion-psychology checked — no guilt, no streaks)

| Context | String |
|---|---|
| Tier meaning · raw | `just getting to know your pace` |
| Tier meaning · setting | `still sharpening your pace` |
| Eyebrow | `Your honest range` |
| Maturity caption | `{k} more runs sharpen this to one number` |
| Pro tick teaser (free) | `See exactly where tasks land inside your range, and watch it tighten.` + `Pro` |
| Narrowing proof (Pro) | `Tightened from {wasLow}–{wasHigh} as you logged.` |
| No narrowing yet | `Log a few more and watch this tighten.` |
| Honest affirmation | `Now an honest number` (existing) |

No "wrong", "off by", "should have", no red, no deficit framing. The band is descriptive ("usually lands"), never corrective.

## 7. Components & files

- **Edit `src/features/category-detail/HonestCard.tsx`** — rework the hero shell: tier-meaning pill, "Your honest range" eyebrow, range number, band slot, two-row maturity meter. The hero shell is the only genuinely new craft.
- **Reuse `src/components/HonestBand.tsx`** — already does segment + tick + inward-narrowing. Extend for: (a) free range-only mode (segment + end labels, no tick), (b) the caret callout, (c) the Pro ghost-history layer. Keep it `View`-based (no SVG) per spec 03 §6.
- **Reuse `src/features/shared/HonestBandLockedTeaser.tsx`** — the free locked state; fold its teaser into the band's locked-tick callout, or keep as the secondary tease.
- **`src/theme/tokens.ts`** — add any missing tokens (e.g. `progress.bandTrack`, honey-hex pip size if not reusing `honeycomb.pip`, caret geometry). Add the matching `useTheme` line (per the token-enumeration gotcha).
- **Engine:** no change. `range`, `confidence`, `firstHonestRange` already exist (spec 03 §7).

## 8. Constraints honored

- On-device-only core loop · no network in guess→timer→learn.
- No guilt, no streaks, amber never red. Honey/sharpness monotonic.
- Pricing/entitlement read from RevenueCat; gating is a render branch on `isPro`, engine math ungated.
- Every spacing/size/font/color from a token; sibling rows share vertical structure; one spacing source per axis (the flex `gap`, no per-child margins beyond the single band offset).

## 9. Open questions

1. **9.1** Free precise-tick: locked teaser on the band (V5, recommended) vs omit + tease lower? Confirm on screenshot.
2. **9.2** Band track height: reuse `progress.gapTrack` (8) or add `progress.bandTrack` (16) for a bolder hero strip? Mockup uses 16.
3. **9.3** Does `ProHonestWeekTease` stay on the screen for free users now that the band itself teases Pro, or is that double-selling? (Likely: keep one Pro anchor, not two.)
4. **9.4** Band treatment: V1 caret-callout (recommended) vs V3 honey-premium minimal — locked as V1, revisit only if the callout feels busy on device.
