# Today header — honey ring + greeting eyebrow

**Date:** 2026-06-22
**Status:** approved (founder approved the rendered mocks; this is the build spec)
**Scope:** visual/interaction + a small token + one pure helper. No engine model,
db, or calibration-data changes. Distinct from `2026-06-22-today-calm-design.md`
(that one touches `FocusCard` + Done list; this one touches the header block
above them — they do not overlap).

Mock (real dark-mode tokens, founder-reviewed):
`docs/superpowers/mockups/today-header-ring.html` — see panels **A — refined**
and **A — ring label: A2**.

## Problem

The top of Today is heavy and unfocused:

1. **"Good morning"** renders as a full `type.subtitle` (22px) line at the very
   top — a shouting greeting that competes with the `Today` display title (26px)
   right below it and eats a whole row of vertical space.
2. The **honey HUD** (`TodayHud`) is a full-width card (~80pt tall): bee coin +
   tier word ("Ripening") + amber progress bar + chevron. It dominates the
   screen before any actual task is visible, and reads as "messy" — a big status
   card sitting between the header and the thing the screen is for (today's
   tasks).

Net: two stacked attention-grabbers (greeting line + status card) push the focus
card and task list down and dilute the "what do I do now" purpose of the screen.

## Decision (locked)

Replace the greeting line **and** the honey HUD card with a single compact
header. Layout **A** (founder pick):

```
Good morning, Ali                          ⚙   ◌  ← honey ring (bee inside,
Today                                            amber tier arc, soft glow)
Mon · Jun 22                                  Ripening   ← tier caption
─────────────────────────────────────────────────────
[ focus card starts immediately here ]
```

- **Greeting → eyebrow (g1).** Move `useGreeting()` output from a 22px subtitle
  at the top into a quiet **eyebrow** sitting directly above the `Today` title.
  Rendered **mixed-case** (the `caption` role + `colors.inkSoft`) — NOT the
  `type.eyebrow` role, which force-uppercases ("GOOD MORNING, ALI") and does not
  match the founder-approved mock. The mock shows "Good morning, **Ali**" with
  the name (the personalization payoff) bold-weighted; bolding the name is a
  known follow-up (it needs `useGreeting` to expose the name separately) and is
  not yet implemented — flagged for the founder. No behavior change to
  `useGreeting` — it already returns time-based greeting + sparing-density name
  from `settingsStore.displayName`, falling back to the bare greeting when no
  name is set.
- **Honey HUD card → header honey ring (A2).** A compact circular ring replaces
  the whole card:
  - SVG ring: track `colors.ringTrack`, amber arc `colors.accent` filled to the
    lead category's tier-band progress (`fillPct`), `round` line cap.
  - `BeeMascot` (current `companionStage` variant + `seed`) centered inside.
  - Soft amber glow **only from Ripening tier up** — reuse the
    `companion.glow[stage-1]` radius (0 at stages 1–2), keeping the existing
    "warmth blooms as the comb seals" rule.
  - **A2 caption:** the tier word (e.g. "Ripening") in `tierCapMute`
    (`type.tierCap`-mute / `inkSoft`, ~10.5pt) directly under the ring. Teaches
    the honey concept to new users at near-zero cost (honey tiers are novel,
    unlike ubiquitous activity rings).
  - Whole ring is the tap target → routes to the Whenbee hub
    (`/(tabs)/whenbee`), exactly as `TodayHud`'s top pressable did. Press feedback
    = the existing `scale → 0.98` spring.
- **Settings gear** sits **inboard** (to the left of the ring) in the header's
  trailing cluster, unchanged target (`/settings`). _(Founder accepted the ring
  occupying the trailing edge; the convention-preserving "gear far-right, ring
  left" variant R1 was shown and not chosen.)_

### Daily RitualSeal — keep it, give it a home

`RitualSeal` is currently rendered **only** inside `TodayHud`'s footer (gated by
`dailyRitualEnabled`). Removing the card orphans it. Decision: render `RitualSeal`
**standalone** in `index.tsx`, in the same slot the HUD card occupied, **only
when `dailyRitualEnabled`** — no card chrome around it (it already carries its own
hairline/seal styling). Props unchanged (`done={ritualDone}`,
`onLog={() => router.push('/(modals)/retro')}`). When the ritual is off, the slot
renders nothing (the bottom `RetroLogChip` remains the always-on log entry).

## Components & data

### REUSE + parameterize the hub ring `src/features/whenbee/HoneyRing.tsx`

Do **not** build a new ring. The hub's `HoneyRing` (bee inside, amber tier arc)
is the canonical ring; reuse it so there is one ring identity app-wide and the
small header ring is visibly "the same ring, smaller" as the big hub ring you tap
through to. Today it is **not reusable as-is** — two blockers, fixed by
parameterizing:

1. **Hardcoded size.** It reads `t.ring.size` (200) / `t.ring.stroke` (9)
   directly. Add optional `size?: number` / `stroke?: number` props that default
   to those tokens (hub call unchanged). All internal geometry (`r`, `cx`,
   `circumference`, head-dot radius, ripple/seal sizes) derives from the prop.
2. **Ceremony geometry is hardwired to the 200px ring.** Founder decision: keep
   **all** the motion in the header — the fill arc animating on return to Today,
   the head-dot riding the arc, the stroke-pop, the bee micro-life (blink /
   look-around), and the seal celebration at Honest. The component's existing
   focus-aware logic already prevents nag (intro fill plays once; growth earned
   off-screen lands snapped; only growth the user is present for replays) — so
   keeping motion is tasteful, not noisy. The only real work is **making the
   sub-element geometry derive from the `size` prop** so the ceremony stays
   proportionate at 58px instead of spilling into the header:
   - head-dot ø, ripple ø, **mote travel distance**, and the wax-seal hex must
     scale from `size` (e.g. as fractions of `size`, matching today's ratios at
     `size = 200`), not the fixed `ring.headDot` / `ring.size * 0.72` /
     `mote.distance` / `seal.size` literals. Add the fractions as tokens (e.g.
     under `ring`) so nothing is inlined.
   - keep `reduced` (reduced-motion) gating exactly as-is — it still snaps and
     suppresses head-dot/ripples/motes for users who opt out.

   No `animate` flag is needed — the header gets the same animated component the
   hub does, just smaller.

Header usage:

```tsx
<Pressable onPress={() => router.push('/(tabs)/whenbee')} /* + scale 0.98 */>
  <HoneyRing
    sharpness={lead.sharpness}
    sealed={lead.tier === 'Honest'}   // milestone seal celebration plays here too (scaled)
    size={t.headerRing.size}
    stroke={t.headerRing.stroke}
  >
    <BeeMascot size={t.headerRing.bee} variant={`stage-${companionStage}`} seed={companionSeed} animated />
  </HoneyRing>
  {/* A2 caption */}
  <Text style={caption}>{lead.tier}</Text>
</Pressable>
```

Verify on the simulator that the scaled seal motes/ripples stay inside the header
band and don't collide with the title/date — dial the mote distance fraction down
if they read busy (founder approves from the rendered result).

Soft amber glow from Ripening up: apply the `companion.glow[stage-1]` radius as a
view-shadow on the `Pressable` wrapper (NOT inside `HoneyRing`, which stays
flat-tactical for the hub). 0 at stages 1–2.

**Fill semantics — unified.** The hub ring fills by **absolute sharpness 0–100**
(with the `endowedPct` floor so Raw is never empty); the old honey pipe filled by
*tier-band* progress. Reusing the ring means the header now shows **absolute
sharpness of the lead category** — the same quantity the hub ring shows. This is
the intended unification (small ring ≡ big ring), not a regression.

### New pure helper: `leadHoney` (`src/features/today/leadHoney.ts`)

Extract the "pick the most-ripened cell" logic from `TodayHud` into a pure,
unit-testable function (TDD — logic-layer). It now returns the lead's absolute
sharpness + tier (the ring fills by `sharpness`; the caption shows `tier`):

```ts
// leadHoney(cells): the most-ripened cell's sharpness (0..100) + tier.
// Empty cells → { sharpness: 0, tier: 'Raw' }.
export function leadHoney(cells: HoneycombCell[]): { sharpness: number; tier: SharpnessTier }
```

`index.tsx` calls it with the existing `shownCells` and feeds the result to the
reused `HoneyRing`. (`engine.tierBandProgress` is no longer needed by the header,
since the ring fills by absolute sharpness.)

### `ScreenHeader` — add optional `eyebrow`

Add an optional `eyebrow?: string` prop rendered as a mixed-case `caption` line above
the title (only when present). Every other screen passes no eyebrow → unchanged.
The trailing `right` cluster (gear + `HoneyRing`) vertically centers to the
eyebrow+title block.

### `index.tsx` changes

- Delete the top `<Text>{greeting}</Text>` subtitle block.
- Pass `eyebrow={greeting}` to `ScreenHeader`; `right` becomes a row:
  `[gear Pressable] [HoneyRing …]` with `space[3]`–`space[4]` gap.
- Delete the `TodayHud` import + its wrapping `View` (with the negative top
  margin). Keep the `honeyCells`/`shownCells` computation; feed `leadHoney(...)`
  to `HoneyRing` and `companionStage`/`companionSeed` to it.
- When `dailyRitualEnabled`, render standalone `<RitualSeal …>` where the HUD
  card was.

### Tokens (`src/theme/tokens.ts`)

Add a `headerRing` group (mode-independent geometry, like `ring`/`burst`):

```ts
headerRing: { size: 58, stroke: 4.5, bee: 31, caption: 10.5 }
```

Per the useTheme-enumeration gotcha, add the matching `headerRing` line to
`resolveTheme` in `useTheme` so `t.headerRing` resolves. The glow radius reuses
the existing `companion.glow` scale (no new token).

## Out of scope / non-goals

- No change to `TodayHud`'s honey math, the Whenbee hub, or the companion stages.
- `RunningFocusCard`, `FocusCard`, Done list — untouched here (owned by
  `today-calm`).
- **No bee name, no `RingBadge` in the header.** The bee name is an optional
  overlay on `WhenbeeAvatar`; the header passes `BeeMascot` (nameless) as the ring
  child, so the name never shows — too much at this size (founder call). The hub's
  `RingBadge` (tier + % + per-stage copy) is **not** rendered here either; the A2
  caption is just the single tier word.
- Header ring keeps the hub's **full motion** (fill replay on focus, head-dot,
  stroke-pop, bee micro-life, and the size-scaled seal celebration). It is not
  made static — only its sub-geometry is parameterized to the smaller size.
  Honors reduced-motion + monotonic honey (the existing `reduced` + `introDone`
  gating is preserved).
- No light-mode-specific work beyond token-sourced colors (both modes derive
  from existing tokens).

## Invariants honored

- **No guilt:** amber arc only ever fills toward the next tier; never red, never
  drains, no streak/shame.
- **Monotonic honey:** ring shows current tier/fill; no backward motion.
- **On-device only:** no network; pure local stores + engine.
- **Tokens only:** every size/color from `tokens.ts` (new `headerRing` group
  added rather than inlined).

## Testing

- `leadHoney` — unit tests: empty cells → `{ sharpness: 0, tier: 'Raw' }`; single
  cell; picks the max-sharpness lead among several; capped (Honest) cell reads its
  high sharpness + `tier: 'Honest'`.
- `HoneyRing` — extend existing tests: `size`/`stroke` props override the token
  defaults and the sub-geometry (head-dot, ripple, mote distance, seal hex) scales
  from `size`; the hub call with no props is byte-for-byte unchanged (all existing
  hub-ceremony + animation tests still pass); reduced-motion still snaps.
- Header (todayScreen test) — ring is wrapped in a Pressable that routes to the
  hub; the child is a nameless `BeeMascot` (no name overlay, no `RingBadge`);
  accessibility label mirrors `TodayHud`'s ("Whenbee, honey tier {tier}. Tap to
  open your honeycomb.").
- `index.tsx` (todayScreen test) — greeting renders in the eyebrow, no standalone
  "Good morning" subtitle; `RitualSeal` shows only when `dailyRitualEnabled`.
- Update/retire `TodayHud` tests as the component is removed. Sole real consumer
  is `index.tsx` (verified); `TodayEmptyState.tsx` only has a **stale comment**
  ("The companion presence lives in TodayHud above") — update that line to point
  at the header ring.
