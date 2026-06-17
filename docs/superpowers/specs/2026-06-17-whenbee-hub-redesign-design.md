# Whenbee tab (companion hub) — redesign

**Date:** 2026-06-17
**Status:** approved (design); ready for implementation plan
**Surface:** `src/app/(tabs)/whenbee.tsx` → `src/features/whenbee/WhenbeeHub.tsx`
**Validated visually** in the brainstorm companion (`.superpowers/brainstorm/.../content/`): `directions-v4`, `ring-hybrid`, `assembled-de-v2`, `empty-de`, `motion-demo-v5`.

---

## 1. Problem

The current Whenbee tab reads cluttered and "tacky":

- The `RayBurst` sunburst glow is **clipped** by its fixed `avatarBurst` box and is near-invisible on dark — reads as noise.
- The 6-node tier trail (`Raw → … → Keeper`) is **jargon-heavy** and competes with the bee + honey for the same idea.
- **Duplicated per-category surfaces:** the honeycomb cells (sharpness per category) AND the "In the background" rows (multiplier per category) show the same entities twice. The bee's stage, the trail, and the honey all encode the same "ripeness," up to 3×.
- The screen leads with the cold/empty state and gives no warmth or clear hierarchy.

## 2. Goals / non-goals

**Goals**
- One clear hierarchy; every section self-explains (no jargon a stranger trips on).
- Collapse the duplicated per-category + tier surfaces.
- A warm, flat-tactical 2D look — **no glow** anywhere.
- Empty state that feels inviting (endowed, no cold zeros), growing into the populated state with no re-shuffle.
- Motion that is calm, premium, monotonic, no-guilt; epic-but-calm on the cap.

**Non-goals (unchanged / deferred)**
- No engine/math changes. Pure read of existing engine values.
- Discoveries **gallery** stays deferred (only the preview card is shown). Widget/Live-Activity out of scope.
- No new product mechanics; honey/sharpness stays monotonic; amber-never-red; on-device only.

## 3. Doc grounding (what each thing actually is)

From `build-plan-final/05b-HONEY-SYSTEM.md`, `05-RETENTION.md`, `05c-RECLAIM-AND-DISCOVERIES.md`:

- **Honeycomb cell = one category.** Fill height = that category's **honey % = `sharpness`** (0–100 calibration accuracy). `sharpness ≥ 93` = sealed (the `Honest` tier / wax cap).
- **"In the background" rows** = per-category drill-down; each shows the learned **multiplier** (`mEffective`, e.g. `1.9×`) and taps to the category page. The label is replaced (see §5).
- **Tiers** `[0,40,64,82,93]` → `Raw / Setting / Ripening / Thickening / Honest` (+ `Keeper` prestige). The bee's stage maps 1:1 to tier (`companion.maxTier`).
- **Reclaim** = `companion.reclaimedMinutesLifetime` (monotonic). **Discoveries** = `companion.discoveryCount` + banked insight headlines.

**De-duplication decisions:**
1. **The bee carries the tier.** The 6-node `TierTrailHub` is **removed**. Overall honey % + tier word live in a ring around the bee.
2. **Comb + rows merge into one "Your areas" list.** Each row = category name + inline honey-fill bar (sharpness) + multiplier (`mEffective`) + chevron → category page. The standalone hub `Honeycomb` grid is removed from this surface.

## 4. Layout — "D-ring + E-body"

Vertical order (scroll):

1. **Header** — `Whenbee` title + subtitle `What you've learned about your time.` (populated) / `Log a task — your honey starts to set.` (empty).
2. **Hero — honey ring + bee.** A circular progress ring (overall `sharpness`) drawn around the centered `BeeMascot`. **No glow / no RayBurst.** Below the bee, a compact 2-line badge (§5).
3. **Labeled zones (E-body)** — each zone = uppercase `klabel` + one-line plain-English `explain` + content:
   - **Reclaimed** — "time your honest numbers spared you" → focal card with the big `Reclaim` number + provenance (`from N logs · learned on-device`).
   - **Discoveries** — "surprising truths about how long things take" → preview card (banked insight headlines). Hidden when count = 0 (empty copy instead).
   - **Your areas** — "fill = how honest your guesses are · tap to tune" → one **AreaRow** per category (name · inline honey bar · multiplier · chevron). Tappable → `/category/[category]`.
4. **CTA** — `Make my whole day honest` (Pro → paywall/honest-day). Empty state swaps this for `Log your first task` with a quiet sub-line.

Conditional cards (blind-spot / life-drift re-check) keep their existing logic, placed after Discoveries, styled to the new flat vocabulary.

## 5. The ring badge

Two lines, compact (`b1` ~13px, `b2` 10px, one line, no wrap):

- **Line 1:** current tier word + overall % — e.g. `Setting 46%` (amber).
- **Line 2:** per-stage human line + soft goal-gradient with the real next-stage name — e.g. `Getting sharper · ~3 logs to Ripening →`.

Per-stage copy (first pass, tunable):

| Tier | Line | Next |
|---|---|---|
| Raw | Just getting started | ~N to Setting |
| Setting | Getting sharper | ~N to Ripening |
| Ripening | Landing closer | ~N to Thickening |
| Thickening | You know your timing | ~N to Honest |
| Honest | Plans match reality | **Honeycomb sealed ✦** (hold state, no next) |

- "logs to next" uses **soft** language (`~`, "about") — never a contract (doc §1.3.1); count comes from `logsToNextTier`.
- **Empty/Raw:** line 1 = `Raw` (no cold `0%`); line 2 = `Your first logs set the honey →`.

## 6. Empty state (cold first-run)

- Ring shows a **tiny endowed sliver** (≈6%), never a cold 0% arc (doc §1.3.1 "already on your way").
- **Reclaimed / Discoveries** = dashed "waiting" cards with the doc's no-rush copy (05c §9): `Starts with your first honest log. No rush.` / `…usually after about 5 logs in an area.` — no big zeros.
- **Your areas** = the onboarding-picked categories with empty bars + `—`, still tappable.
- **Primary CTA** = `Log your first task`; Pro CTA demoted to a quiet sub-line.

## 7. Motion (flat-tactical, no glow, amber-only, monotonic)

Personality: calm/premium with a touch of playful on the bee + cap. Drive with **size, stroke-weight, path, position** — never glow/box-shadow halos. Map to **Reanimated** (worklets; `react-native-svg` `useAnimatedProps` for the ring) + the existing `motion` tokens.

- **Entrance:** top→bottom reveal cascade, ~70ms stagger (`motion.enterStagger`), <500ms total, translateY 10→0 + opacity, ease-out.
- **Bee ambient:** calm sine float (`motion.float`), per-stage amplitude (`companion.floatLift`). Mount lift spring (`motion.spring`).
- **Log a task (~1.6s, calm, decelerating):**
  - ring `strokeDashoffset` grows old%→new% (`motion.honeyFill`-family, slow ease-out); **monotonic**.
  - a **flat amber head-dot** rides the arc to the new head, then a thin **outline ripple** at the landing point.
  - ring **stroke-width pop** 9→11→9 (tactile "snap into place"); the % does a small **scale-pop**.
  - Reclaim **count-up** (~1.6s, ease-out); the relevant area bar fills; bee does a small dip→rise→settle hop (~1.05s).
- **Cap / seal (~1.9–2s, sequenced, ceremonial-calm):** ring completes → stroke **breathes wide** (9→13) → **wax-seal hex stamps** over the bee (the doc's cap visual) → **3 thin outline ripples** (staggered) → a few **flat square motes** flick outward → badge **slides + fades** to `Honest · Honeycomb sealed ✦`. Bee: slow lift with a tiny rotation settle. Fires only when `sharpness` crosses ≥93 this log (existing tier-up branch).
- **Reduce-motion:** all collapse to fades; fills snap; no travel/scale/stroke-pulse; seal just fades in.

## 8. Components & files

**Remove / replace**
- `RayBurst` usage on this surface — removed (glow gone). Keep the file if used elsewhere; otherwise delete.
- `TierTrailHub` — removed from the hub (tier now in the ring). Delete if unused elsewhere.
- Standalone hub `Honeycomb` grid usage in `WhenbeeHub` — removed (merged into AreaRows).

**New components (`src/components/` or `src/features/whenbee/`)**
- `HoneyRing` — SVG ring (track + gradient fill) + centered `BeeMascot` slot + animated head-dot/ripple/seal/motes; reduce-motion aware.
- `RingBadge` — the 2-line tier/%/next badge; per-stage copy map.
- `AreaRow` — name · inline honey bar (sharpness) · multiplier (`mEffective`) · chevron; pressable → category page.

**Reworked**
- `WhenbeeHub` — new vertical order + labeled zones; reads overall sharpness + per-category sharpness/multiplier + reclaim + discoveries from existing stores/`useWhenbeeHub`.
- `WhenbeeAvatar` — keep the stage-driven `BeeMascot`; its float/curious logic feeds `HoneyRing`. The animated cap/log beats target a `<g>`-style transform wrapper around the mascot.
- `ReclaimHeroCard`, `DiscoveriesPreviewCard`, `BlindSpotCard`, `LifeDriftCard` — restyle to the flat labeled-zone vocabulary; no logic change.

**Data (read-only, existing):** overall + per-category `sharpness`, `mEffective`, `reclaimedMinutesLifetime`, `discoveryCount`/discoveries, `companion.stage`/tier, `logsToNextTier`. No engine changes.

## 9. Theming (tokens, never hardcode)

Every value via `useTheme()` from `src/theme/tokens.ts`. Add tokens where missing:
- Ring geometry: radius, stroke width (track/fill), stroke-width "pop" peak, gradient stops (reuse `brand`/`accent`).
- Motion: reuse `honeyFill`, `float`, `enterStagger`, `spring`, `halo`, `easing.*`; add log/cap durations + the calm easing curve if not present.
- Seal hex size, mote size/count/distance, ripple sizes — as tokens.
- **Remove** the screen/avatar glow tokens' use on this surface (keep `rayFill` etc. if used elsewhere). Amber stays the identity/honey accent; one indigo accent max per screen (chevrons).

## 10. Accessibility

- State carried by **color AND text/icon** (ring %/word + per-stage line; chevron affordance on rows).
- Honor `useReducedMotion()` (the reduce-motion branch above).
- 44pt min tap targets on rows + CTA. Ring/decorative layers `accessibilityElementsHidden`.

## 11. Invariants honored

No guilt / amber-never-red; honey/sharpness monotonic (ring only grows; tier never regresses); on-device only; pricing from RevenueCat (CTA → paywall reads RC). Discoveries gallery + widget remain deferred.

## 12. Execution constraints (for the plan)

- Build in a **git worktree** (isolated branch off `main`).
- TDD for any logic-layer helper (per-stage copy map, logs-to-next formatting); UI components get interaction/snapshot tests where useful.
- Run lint + typecheck + test before finishing.
- When done: **clean up the worktree**, then **push and open a live PR** — **do not merge** (founder merges).
- Conventional Commits; no AI/co-author attribution.

## 13. Open questions / tunables

- Final per-stage copy wording (table §5 is a first pass).
- Exact endowed-sliver % for Raw.
- Whether `Keeper` gets its own ring treatment (full-amber + seal) vs. just "Honest sealed".
