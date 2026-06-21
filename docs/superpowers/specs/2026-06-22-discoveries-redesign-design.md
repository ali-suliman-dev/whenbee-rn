# Discoveries redesign — design spec

**Date:** 2026-06-22
**Status:** approved (design) — ready for implementation plan
**Surfaces:** Whenbee hub (`DiscoveriesPreviewCard`) + the full-list sheet (`DiscoveriesGallery` in `/(modals)/discoveries`)
**Mocks (rendered, real tokens):** `docs/product/specs/mocks/13-discoveries-redesign.html` · `docs/product/specs/mocks/13b-discoveries-fullcontext.html`

---

## 1. Problem

The Discoveries surfaces read as plain log rows and bury their own payoff.

1. **Double label** — the hub zone header already says "DISCOVERIES / surprising truths about how long things take", then the card repeated "DISCOVERIES" + a lonely giant count number.
2. **Buried lede** — the revelation is the *multiplier* (`1.6×`), but it sat mid-sentence in a run-on headline (`~24m vs your 15m guess · runs 1.6×`) at the same weight as everything else.
3. **Generic indigo** — discoveries used the interactive/primary indigo and an indigo left-border, so they looked like every other tappable card instead of a distinct reward object.
4. **Flat modal** — identical stacked cards, multiplier not the hero, no sense of direction (over- vs under-guessing).

## 2. What a Discovery is (and why it matters)

A Discovery is a **banked, never-expiring truth** the calibration engine found: for one category, how far the user's guess is off and which way. After ≥5 logs in a category, when `|M − 1| ≥ 0.4` and the recent variance has stabilized, the engine banks one (`src/engine/insight.ts` + `discovery.ts`). The count is **monotonic** — it only ever grows.

Purpose: it is the **payoff of calibration** — the "the app learned something true about me" moment. It's the guilt-free variable reward that drives retention with no streaks and no shame. The redesign makes that payoff legible: **the multiplier is the hero, and discoveries read as honey** (amber is the app's licensed reward/optimism accent).

## 3. Locked design decisions

- **Hub card = B · Featured nugget.** One discovery in focus (the newest), plus the running count.
- **Full list = A · Honey cards.** Multiplier is the hero on the right; category + plain-English proof on the left; honey hex marker on the left.
- **Direction is colour + sign coded, consistently:**
  - **Runs longer** (`M > 1`) → **amber**, hex sign **`+`**, dir label **LONGER**.
  - **Runs faster** (`M < 1`) → **green** (`success`), hex sign **`−`**, dir label **FASTER**.
- **Surfaces are flat:** card background = **`surface`** token (matches the Your-areas + Pro cards directly below on the hub). No glow, no border, no shadow, no indigo left-edge.
- **Top placement on the hub is kept** — only the treatment changes.
- The hub zone keeps its single outer eyebrow ("Discoveries" + "surprising truths…"); the **inner duplicate label is removed**.

## 4. Component changes

### 4.1 `DiscoveriesPreviewCard` (hub) → Featured nugget

Layout (top → bottom), background `surface`, radius `card`, padding `space[4]`-ish, **no glow / no border**:

- **Eyebrow row:** `LATEST DISCOVERY` (left, `eyebrow`/`inkSoft`) · `{count} banked` pill (right, amber tabular pill on `accentSoft`).
- **Hero multiplier:** `{M.toFixed(1)}×` — big tabular number. **Amber if longer, green if faster.** The `×` is a smaller, lower-opacity suffix (`<small>` ≈ 0.6em).
- **Category:** the category label, bold.
- **Proof sentence:** one line, `inkSoft` (see §5 copy).
- **Footer row** (hairline top divider): newest-first indicator on the left (a small "+N more" when `count > 1`, omitted when `count === 1`) and `See all {count} ›` on the right (`primary`) — the whole card is the tap target into the sheet.

"Latest" = `discoveries[0]` (repo returns newest-first). Tapping the card routes to `/(modals)/discoveries` (unchanged).

### 4.2 `DiscoveriesGallery` → Honey cards

Each `DiscoveryCard`: background `surface`, radius `card`, **no left border**, horizontal row:

- **Left:** honey **hex glyph** — amber outline + amber `+` when longer; `success` outline + green `−` when faster.
- **Middle (flex):** category label (bold, `heading`/`ink`) + proof line (`bodySm`/`inkSoft`).
- **Right:** multiplier `{M.toFixed(1)}×` (amber/green, hero weight) with a small dir label beneath (`LONGER`/`FASTER`, `eyebrow`-scale, `inkFaint`).

Newest first (unchanged). Separator + empty state copy unchanged in intent (empty state stays an invitation; refresh its wording per §5 if it reads stale).

Sheet header: `Things you've learned` (`subtitle`/`ink`) + sub `{count} truths Whenbee found in your tracking` (`bodySm`/`inkSoft`).

### 4.3 New shared piece: `DiscoveryHex`

A small presentational SVG (react-native-svg) rendering the honey hexagon + sign. Props: `direction: 'longer' | 'faster'`, `size`. Used by the gallery cards. The hub featured card uses **no** hex (it leads with the big number); a **neutral honey-cell** hex may optionally mark the sheet only. Keep the section emblem (if any) neutral — never `+`/`−` on a non-directional element.

## 5. Copy (conversion-psychology + humanizer pass)

Baseline is the engine's canonical **15-minute guess** (`honestForFifteen = round(15 × M)`), so every proof speaks the same baseline regardless of category.

- **Proof line (gallery), longer:** `You plan 15m · really runs ~{h}m`
- **Proof line (gallery), faster:** `You plan 15m · really only ~{h}m`
- **Featured sentence (hub), longer:** `You plan 15 minutes — it really takes about {h}.`
- **Featured sentence (hub), faster:** `You plan 15 minutes — it really takes only about {h}.`
- **Dir labels:** `LONGER` / `FASTER`. **Count pill:** `{count} banked`. **Sheet sub:** `{count} truths Whenbee found in your tracking`.

No guilt language anywhere — "faster" is framed as good news, never "you over-planned". `{h}` = `honestForFifteen`.

> Note: the mock illustratively showed Writing as `30m → 18m`; the real proof uses the 15m baseline (`0.6× → ~9m`). Standardize on 15m.

## 6. Data / derivation

No engine or DB change required. Everything derives from the existing `Discovery` fields (`categoryId`, `multiplier`, `honestForFifteen`):

- `direction = multiplier >= 1 ? 'longer' : 'faster'`
- multiplier display = `multiplier.toFixed(1) + '×'`
- proof / sentence from `honestForFifteen` + direction (§5)
- category label via existing `categoryLabel()` / `CATEGORY_NAMES`

The banked `headline` string stays on the row for backward-compat but is **no longer rendered**; the UI composes its own display. (A follow-up may drop the field once nothing reads it — out of scope here.)

## 7. Tokens

Reuse existing tokens — **no inline hex/number**:

- Surfaces: `colors.surface`, `radii.card`, `space[*]`.
- Direction colours: longer = `colors.accent` (+ `accentSoft` for the hex fill / pill); faster = `colors.success` (+ `successSoft`). Honey detail = `brand.honeyFill`.
- Type roles (`typography.ts`): `eyebrow`, `heading`, `bodySm`, `subtitle`. Multiplier numbers reuse a numeric role (`honestNumberMd` for the featured hero ≈ 28, `multiplier`/`bigNumber` for the gallery right-hand number) — pick during the plan; **add a fontSize step only if no existing role fits**, never inline.
- Hex sizes: reuse `iconSize` where possible; if a dedicated size is needed, add a minimal `tokens.discovery` group rather than inlining.

Any genuinely new value goes into `tokens.ts` (and `useTheme` resolve, per the token-enumeration gotcha), consumed via `useTheme()`.

## 8. Motion (creating-reanimated-animations + motion-design)

Light touch — discoveries are seen occasionally, not 100×/day.

- Keep the existing per-section `FadeInDown` entrance/stagger on the hub; respect `useReducedMotion`.
- Tap feedback: `scale.pressIn` on an **inner View** (Pressable stays a bare touch wrapper — the reactCompiler/nativewind gotcha), `motion.press` (~110ms), `easing.out`.
- No glow, no looping motion, no guilt motion. Honey/sharpness stays monotonic.
- Entering-only (no `exiting`) per the Fabric SIGABRT gotcha.

## 9. Accessibility

- Direction must not rely on colour alone — the **sign (`+`/`−`)** and the **dir word (LONGER/FASTER)** carry it too.
- Card `accessibilityRole="button"`, label e.g. `Admin & email runs 1.6 times longer — you plan 15 minutes, it really takes about 24`.
- Touch targets ≥44pt; tabular-nums on every multiplier so columns align.
- Honour Dynamic Type via the role scale.

## 10. Out of scope

- Engine/insight thresholds, banking logic, the monotonic count.
- Dropping the `headline` field from the schema.
- Any new discovery *types* or per-category goals.
- Calendar / Honest-Day, Pro gating changes.

## 11. Testing

- UI-only components: snapshot + interaction (tap → route) tests welcome, not TDD-required.
- Pure helper (`direction`, proof/sentence builders): unit-test both branches (`M>1`, `M<1`, and the `M===1` boundary → treat as `longer`/neutral) since it's logic.
- Verify on the sim in **both** light and dark, with 1 discovery (count pill `1 banked`, no "+N more") and many (footer "+N more").
