# Reward screen redesign — design

Date: 2026-06-17
Surface: `src/app/(modals)/reward.tsx` (Screen 4 — the post-log "dopamine payoff").

## Goal

Make the Reward modal easier to scan and less cluttered **without changing which
elements appear** — only their placement, size, weight, spacing, and wording. Three
problems drive the work, all confirmed against the product docs:

1. **No spatial hierarchy.** Every zone is separated by the same `space[4]` scroll
   gap, so nothing groups — headline, hero number, and payoff card all breathe
   identically and compete.
2. **Two big numbers fight.** The honest number (`35 min`) and the reclaim total
   (`20m`, amber bold) read at near-equal weight, so the payoff is ambiguous.
3. **Bee eats the top third.** `burst.bee 168` on a `burst.stage 240` is a hero-sized
   illustration where the doc only calls for an emotional intro crest.

## Documented hierarchy (the source of truth)

This is not a taste call. The read path is specified in `reward.tsx`'s own header
(transcribed from `04-DESIGN §2.6`):

> feel it (bee + headline) → see the payoff (**hero number + honey**) → optionally
> tag a reason → one clear way out.

- The **honest number is the hero** + the product wedge ("shows an honest number
  wherever they plan", CLAUDE.md). It stays the largest element.
- **Honey is the secondary payoff**, grouped under the number.
- **Reclaim is a supporting *beat***, added later "between honey + cap"
  (`ReclaimDeposit.tsx:18`). It is the **Pro** tie-in (paywall thesis), so it must
  not outrank the free core on the core-loop screen → it gets demoted in weight.
- **Bee + headline are the emotional intro only** (step 1, "feel it") → shrink.
- **Reason + energy chips are the optional tail** → kept, de-emphasised so they
  stop reading as a form.

Product invariants honored throughout: no guilt/shame/streak language; honey is
monotonic; on-device-only loop untouched (no logic changes, presentation only).

## Layout — Option A (free-standing hero number)

Chosen over the "merge number into the card" alternative: keep the big `35 min`
floating on the background above the payoff card (current structure), and fix it
with rhythm + demotion rather than restructuring. Lower risk, same hierarchy win.

Top → bottom, with the new three-tier gap system replacing the uniform `space[4]`:

```
   ── intro cluster (within-gap space[2]) ──
        HONEST CELL SEALED           ← capEyebrow, seal only
              (bee 120, coin tight to shoulder)  +1 nectar
        That's one more, logged.     ← headline
   ───────────── wide gap space[6] ─────────────
   ── hero block (within-gap space[1.5]) ──
           IT REALLY TOOK
              35 min                 ← HERO (HonestNumber xl), unchanged size
          20 min over your guess     ← delta chip
   ───────────── wide gap space[6] ─────────────
   ── payoff card (internal gap space[3]) ──
  ┌──────────────────────────────┐
  │ HONEY                    43%  │
  │ ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░    │
  │ Admin & email runs at 2.0×    │
  │ +20m reclaimed   20m          │   ← reclaim total demoted in size
  │ Your honest number was 20 min closer. │
  └──────────────────────────────┘
   ───────────── wide gap space[6] ─────────────
   ── optional tail (between-groups gap space[3]) ──
        Where did the time go?
     [⏰ Interrupted] [⬚ Bigger] [➜ Pulled away]
        Energy this session?
            [Low] [OK] [High]
   ──────── ctaBlock (marginTop auto, unchanged) ────────
        One honest log a day. No streak to keep.
      [           See my Reclaim            ]
                Back to today
```

### Gap system

Replace the single `scrollContent.gap: space[4]` with three deliberate tiers:

| Tier | Token | Applied between |
|---|---|---|
| Tight (within a group) | `space[1.5]`–`space[2]` | eyebrow↔bee↔headline · number↔delta · honey bar↔caption |
| Medium (sub-blocks) | `space[3]` | payoff-card internals · reason-group ↔ energy-group |
| Wide (major zone breaks) | `space[6]` | intro → hero → payoff → tail → CTA |

Implementation note: drop the container `gap` and set explicit `space[6]` zone
spacers (or per-zone `marginTop`), so the within-zone tight gaps are not overridden
by a single container gap. One spacing source per axis per zone — no mixing a
container gap with child margins inside the same zone.

## Bee scale-down — reward-scoped (critical)

`burst.stage` / `burst.bee` are **shared** tokens: the same BeeBurst illustration is
used on reward, the Whenbee hub, the paywall, and insight surfaces (bee-burst spec
§"adopted across…"). Editing the global tokens would shrink **every** burst. So the
scale-down must be reward-only:

- **`tokens.ts`** — add a reward-scoped pair to the `burst` group:
  `stageReward: 190`, `beeReward: 120`. Leave `stage: 240` / `bee: 168` unchanged.
- **`BeeBurst.tsx`** — add an optional `stageSize?: number` prop (default
  `t.burst.stage`). Compute the `coinSlot` position **relative to the stage size**
  (currently the `top: space[10] / right: space[6]` literals are tuned for 240) so
  the `+1 nectar` coin sits on the bee's shoulder at any stage and stops floating /
  clipping a ray. `beeSize` already exists.
- **`RewardBee.tsx`** — pass `stageSize={t.burst.stageReward}` and
  `beeSize={t.burst.beeReward}` through to BeeBurst.
- Verify hub / paywall / insight bursts render unchanged (they pass no override).

## Reclaim demotion

`ReclaimDeposit.tsx` renders an amber `+Nm reclaimed` chip plus the lifetime reclaim
**total** count-up styled at `type.multiplier` (subtitle-sized, bold) — that total is
the `20m` competing with the `35 min` hero. Demote it:

- `totalStyle`: `type.multiplier` → a smaller numeric role (`type.bodyLg`), keep
  `amberText`. The element, the count-up animation, and the chip all stay; only its
  size drops so the size ladder reads `35 min` > `43%` > reclaim total.
- Everything else in the component (motion, a11y label, guards) is untouched.

## Copy rewrites (all five — em-dashes / twee out, brand words kept)

| Location | Now | New |
|---|---|---|
| `headline.ts` TIMED_HEADLINES[3] | `One more drop of nectar — thanks.` | `That's one more, logged.` |
| `useReward.ts:162` capEyebrow | `Honey ripened · this cell's now ${tierAfter}` | `${tierAfter} cell sealed` |
| `reward.tsx` multiplier line | `{category} now reads {m}×` | `{category} runs at {m}×` |
| `reward.tsx` reclaim line | `Whenbee was {n} min closer than your guess.` | `Your honest number was {n} min closer.` |
| `useReward.ts:58` RITUAL_DEFAULT | `One honest thing a day — no streak to break.` | `One honest log a day. No streak to keep.` |
| `useReward.ts:59` RITUAL_SEAL | `New honest cell — and there's no streak to lose it.` | `New honest cell. Nothing to keep up.` |

Notes:
- capEyebrow renders through `type.eyebrow` (uppercase, letter-spaced), so the new
  string shows as `HONEST CELL SEALED` — keeps the climbed tier name, drops the
  double "ripened · setting" metaphor, and avoids an a/an article mismatch since
  tier names vary.
- "runs at" matches the HonestCard copy ("runs 1.9×") for consistency across
  surfaces.
- Both ritual lines honor the no-streak / no-shame invariant; the rewrites only
  remove the em-dash and the negative-parallelism cadence.

## Files touched

- `src/theme/tokens.ts` — add `burst.stageReward`, `burst.beeReward`.
- `src/components/bee/BeeBurst.tsx` — `stageSize?` prop + stage-relative coin slot.
- `src/features/reward/RewardBee.tsx` — pass reward-scoped sizes.
- `src/app/(modals)/reward.tsx` — gap tiers, zone spacers, optional-tail grouping,
  two inline copy strings (multiplier, reclaim).
- `src/features/reward/headline.ts` — one headline string.
- `src/features/reward/useReward.ts` — capEyebrow + two ritual strings.
- `src/features/reward/ReclaimDeposit.tsx` — `totalStyle` size demotion.

## Out of scope / non-goals

- No element added or removed; no logic, store, engine, or db change.
- No change to global burst tokens or to hub / paywall / insight bursts.
- No animation timing/choreography change (only the reclaim total's static size).
- The "merge hero number into the payoff card" (Option B) is explicitly not done.

## Testing

- `src/features/reward/__tests__/rewardScreen.test.tsx` — update any asserted copy
  strings (headline, ritual, multiplier, reclaim line) to the new wording.
- Verify on the simulator: bee compact, coin on shoulder (no ray clip), strict
  size ladder `35 min` > `43%` > reclaim, three-tier rhythm reads as grouped, tail
  reads as optional tags. Screenshot-verify alignment before calling it done.
- `npm run lint` + `npm run typecheck` + `npx jest src/features/reward` green.
```
