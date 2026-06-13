# Bee-Burst Illustration + Coin Badge — Design

Date: 2026-06-13
Branch: feature/resesign

## Problem

The reward illustration is a brown rounded **box** holding the BeeMascot with a static
`+1 nectar` pill above it. The brand reference (website 2.0) is boxless: a soft radiating
**sunburst** behind a floating bee, plus a small **coin pill with a button-like edge** whose
content swaps per moment (`+1 nectar`, `▲`, `aha`). The Whenbee hub hero has a flat empty
background and should carry the same subtle pattern.

## Goal

A reusable, theme-adapted, gently animated bee-burst illustration + floating coin badge,
adopted across the reward, hub, paywall, and insight surfaces.

## Components (new) — `src/components/bee/`

Three small, independently testable units:

### `RayBurst`
Animated sunburst background, hand-authored `react-native-svg` (same approach as `BeeMascot`).
- Long thin triangular rays fanning from center, two alternating fill opacities.
- A radial-gradient vignette overlay (transparent center → page bg color at the edge) so rays
  dissolve outward (matches the reference). Chosen over per-ray linear gradients — less code,
  robust on RN 0.81 / Fabric.
- Theme: light = pale indigo rays on cream; dark = low-alpha indigo on deep bg. Ray fill is
  token-sourced (`colors.primary` / `primarySoft`); per-ray opacity from `burst` tokens.
- Motion: very slow continuous rotation (~one turn / `motion.drift`) + faint opacity breathe.
  Reduce-motion → static.
- Props: `size: number`, `intensity: 'hero' | 'soft'`, `animate?: boolean`.
  `soft` = fewer/fainter rays for the hub background.

### `CoinBadge`
Display-only floating pill with the `AppButton` coin-edge structure (solid darker edge `View`
behind + surface on top). Not pressable.
- Props: `tone: 'amber' | 'indigo'`, and one of `label?: string` / `icon?: ReactNode`.
- Motion: mount pop-in (opacity + lift), then slow bob (±`burst.coinBob`, calm sin), phase-
  offset from the bee. Reduce-motion → static final state.

### `BeeBurst`
Composes `RayBurst` (absolute bg) + `BeeMascot` (center, gentle float ±`burst.beeFloat`) +
`CoinBadge` (upper-right). Props: `beeSize?: number`, `badge: CoinBadgeSpec | null`,
`intensity?: 'hero' | 'soft'`.

## Pill content per moment

| Moment                        | tone   | content      |
|-------------------------------|--------|--------------|
| Reward — normal log           | amber  | `+1 nectar`  |
| Reward — tier seal (`sealed`) | amber  | `▲` (icon)   |
| Paywall / upgrade             | amber  | `▲` (icon)   |
| Aha / insight                 | indigo | `aha`        |

## Surfaces wired

1. **Reward modal** (`RewardBee`): rebuilt on `BeeBurst`. Drops the box → sunburst behind a
   floating bee; `+1 nectar` amber coin, swapping to `▲` when `sealed`. `sealed` prop preserved.
2. **Whenbee hub** (`WhenbeeHub`): `RayBurst intensity="soft"` placed behind the avatar +
   honeycomb hero zone. **No coin** (hub stays calm).
3. **Paywall** (`paywall.tsx`): `BeeBurst` hero with the amber `▲` coin above the "Go Pro"
   heading.
4. **AhaCard** (`AhaCard.tsx`): stays the compact dark "night" callout. Only swaps in the
   indigo `aha` `CoinBadge` in the header row (replacing/with the sparkles eyebrow). **No full
   burst** — keep the compact footprint.

## Tokens (add to `tokens.ts`)

`burst` group — ray count, ray opacities (hero/soft × base/alt), `beeFloat`, `coinBob`,
`coinEdge` depth, stage/bee default sizes. `motion.drift` — slow ray-rotation duration.
No raw numbers or hex in any component; everything routes through `useTheme()`.

## Invariants honored

- No guilt motion; amber stays amber. Honey/sharpness monotonic (untouched here).
- Core loop stays on-device (pure UI).
- All values token-sourced.

## Out of scope

- Procedural per-tier bee artwork (BeeMascot stays one static art).
- Confetti/bloom choreography beyond the float/breathe/bob described.
