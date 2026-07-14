# Focus window — reveal-early + coarse-first (A+B)

**Date:** 2026-07-12
**Status:** Approved design (mock v1), ready to plan
**Mock:** `docs/product/specs/mocks/focus-window-reveal-early.html`
**Area:** `src/engine/`, `src/domain/`, `src/features/patterns/`, `src/features/planner/`
**Supersedes:** the 3-gate unlock ladder in `2026-06-30-focus-patterns-redesign.md` §gate-ladder and `src/engine/focusWindowLearn.ts` `buildGates`.

---

## 1. Problem

The learned focus window ("When you're sharp", Pro) stays fully **locked** behind a 3-gate ladder. The third gate, **"A clear peak"**, is the killer:

- Its `have/need` is `strongestCoveredBinEvents / FW_BIN_MIN_EVENTS` = events in the single strongest **30-min clock slot**, needs **6**, plus ≥4 distinct days, plus a permutation significance test, plus non-flat, plus non-bimodal (`focusWindowLearn.ts:115-158,197-205`).
- Translated: **6 timed tasks that all start within the same 30-min window of the clock, on 4 separate days.** A light user with scattered start times never clusters → stalls at `2/6` after a week.
- It is **not actionable**: the user can't see which slot is "strongest", and the sub-copy "…around your usual hours" is circular (learning your hours is the whole point).
- The `2/6` fraction renders next to the `N of 3 unlocked` tag → two denominators on one card → read as "2 of 6 gates". Anticlimax + confusion. (Founder: used the app ~1 week, got `2/6`, felt like a dead-end.)

## 2. Goal

Kill the dead-end. Deliver value the moment there's *any* signal, and let precision **visibly earn itself** instead of gating everything behind statistical certainty. Honor invariants: no guilt, honey/sharpness monotonic, core loop on-device, pricing from RevenueCat.

## 3. Decisions (locked from brainstorm + mock approval)

**A — reveal-early.** Unlock at **2 gates** (15 timed sessions + 5 distinct days). The old "clear peak" lock is **deleted as a gate** and becomes a **confidence meter**. Once the 2 gates clear, the card **always shows a window** — even a weak, coarse one — and the statistical strength drives a `Still learning → Building → Steady` confidence label + meter, never a lock.

**B — coarse-first.** The first reveal is a **coarse block** ("Mornings, around 8:00–11:30"), which sharpens to a precise window ("9:00–10:30") as data clusters. Scattered sessions cluster into a coarse read far sooner than into a 30-min slot.

**Result — one card, four moments of its life** (the mock filmstrip):

| # | State | basis | Shows |
|---|---|---|---|
| 1 | Logging | `forming` | 2-rung ladder + frosted preview with a faint coarse hint ("leaning toward mornings") |
| 2 | First reveal | `revealed`, conf Low | Coarse block name + "around 8:00–11:30" + wide dashed band + meter Low |
| 3 | Sharpening | `revealed`, conf Building | Tightened 2-h range + why-line + `2.1×` contrast + meter Building |
| 4 | Steady | `revealed`, conf High | Precise range + `2.6×` + meter full + "Steady" |

## 4. Engine changes (`src/engine/`)

### 4.1 Coarser clustering (B)

`FW_BIN_MIN 30 → 60`. **Constraint:** `FW_BIN_COUNT = (FW_WAKING_END_MIN − FW_WAKING_START_MIN) / FW_BIN_MIN` must stay integer. Waking span = `1440 − 300 = 1140`. `1140 / 60 = 19` ✓ (30→38 bins today). 60-min bins ≈ double the clustering rate without breaking the count. *(90 → 12.67, non-integer — rejected. If a coarser learning bin is wanted later, use 76→15 or 95→12, but 60 is the ship value.)*

The **coarse block** for the early reveal is derived independently of the learning bins, from the peak time via the existing `whyNarrative` buckets (before-11:00 / 11:00–13:00 / 13:00–17:00 / after-17:00 → "Mornings / Midday / Afternoons / Evenings"). Add `coarseBlockLabel(peakMin): string` beside `whyNarrative` in `focusCopy.ts`.

### 4.2 Two gates, not three (A)

`buildGates` (`focusWindowLearn.ts:209-218`) returns **only** `{ sessions, days }`. Delete the `peak` gate and `confirming` field. `FW_BIN_MIN_EVENTS` / `FW_BIN_MIN_DAYS` stay — they still gate `selectWindow`'s per-bin eligibility, they are just no longer surfaced as a user gate.

`FocusGates` type (`domain/types.ts:308-331`) drops `peak`. `strongestCoveredBinEvents` is no longer needed for gates (keep only if used elsewhere; audit + remove if dead).

### 4.3 Reveal-early basis + confidence

`LearnedFocusWindow.basis` widens from `'prior' | 'personal'` to **`'forming' | 'revealed'`** (rename for clarity; `revealed` replaces `personal`). Add:

```ts
confidenceTier: 'low' | 'building' | 'steady';   // drives label + band precision
coarseBlockLabel: string;                         // "Mornings" etc. (empty when forming & no signal)
```

New `learnFocusWindow` flow:

1. `signals.length < FW_GATE_MIN_COMPLETED || distinctDays < FW_GATE_MIN_DISTINCT_DAYS` → `basis: 'forming'` (the 2-gate ladder). Frosted preview may still show the coarse hint if a peak bin exists (a soft "leaning toward …"), else no hint.
2. Both gates met → **`basis: 'revealed'`, always.** A statistically clear peak (`selectWindow` candidate: sd ≥ `FW_SD_MIN`, a covered eligible bin, not bimodal) yields the precise window. When `selectWindow` has no candidate — flat, spread-out, or bimodal data — the engine **falls back to a coarse candidate**: a `FW_WINDOW_MAX_LEN` block centred on the strongest covered bin, **pinned to `confidenceTier: 'low'`** (precision is earned by a real candidate, never by elapsed days). *(Amended 2026-07-13: the original "if truly flat, stay `forming`" carve-out re-created the invisible dead-end this spec exists to kill — the founder hit it at 26 sessions / 14 days with "2 of 2 unlocked". Real-world sessions spread across hours are the common case, not rare; `forming` after both gates is a broken promise.)*
3. **Confidence tier** (replaces the permutation *lock* with a permutation-informed *label*):
   - `low` — revealed but weak: not significant (`permStrength < FW_PERM_PCTL`) **or** low confidence. Show **coarse block** + wide band.
   - `building` — significant **and** `confidence ≥ FW_CONF_BUILDING (0.5)`. Show the selected window range (≈2 h).
   - `steady` — `confidence ≥ FW_CONF_HIGH (0.75)`. Show the tightened peak window.
   - **`confidence` = a BLEND of day-progress and significance strength (decision Q1=B):**
     `confidence = clamp(FW_CONF_DAY_WEIGHT · clamp(distinctDays/14, 0, 1) + (1 − FW_CONF_DAY_WEIGHT) · permStrength, 0.3, 1)`, where `permStrength ∈ [0,1]` = the fraction of the permutation null maxes strictly below the observed max (i.e. `1 − p`). So the meter climbs faster when the peak is *clearly real*, not just when the calendar has advanced. `FW_CONF_DAY_WEIGHT = 0.55`. Meter fill = `confidence`.
4. Hysteresis (dwell/overlap, `:239-246`) unchanged — still prevents the window from jittering.

Replace the boolean `passesPermutationGate` with `permutationStrength(signals, seed): number` (returns `permStrength`); `significant = permStrength >= FW_PERM_PCTL` reproduces the old gate. `permStrength` feeds both the tier boundary and the meter fill; it no longer returns `prior()`.

### 4.4 New/renamed constants (`constants.ts`)

```
FW_BIN_MIN = 60                    // was 30
FW_REVEAL_STEADY_DAYS  (derive from FW_CONF_HIGH)      // or reuse FW_CONF_* directly
FW_REVEAL_BUILDING_DAYS(derive from FW_CONF_BUILDING)
```
Prefer reusing `FW_CONF_HIGH` / `FW_CONF_BUILDING` over new day constants. Delete nothing that `selectWindow` still needs (`FW_BIN_MIN_EVENTS`, `FW_BIN_MIN_DAYS`, `FW_SD_MIN`, bimodal, permutation).

## 5. Copy (`src/features/patterns/focusCopy.ts`)

| Delete / change | New |
|---|---|
| `peakGateCopy`, `peakUpcomingCopy`, `FOCUS_GATE_LABELS.peak` | removed |
| `focusUnlockedTag` → `${n} of 3 unlocked` | `${n} of 2 unlocked` |
| — | `coarseHintCopy()` → "Leaning toward **mornings** — keep timing and I'll sharpen it." (forming, peak bucket known) |
| — | `confidenceLabel(tier)` → `low`: "Still learning · sharpening" · `building`: "Building · getting sharper" · `steady`: "Steady · locked to your rhythm" |
| — | `coarseBlockLabel(peakMin)` → "Mornings / Midday / Afternoons / Evenings" |
| `focusRewardCaption` | keep, retune to name the block when known |

Voice: no guilt, "I'll sharpen it" framing (my job, not the user's chore). Run new strings through `conversion-psychology` + `humanizer` at build.

## 6. UI (`src/features/patterns/FocusPeakCard.tsx` + `src/features/planner/`)

- **Header (all states):** eyebrow `WHEN YOU'RE SHARP` (+ `ProCoinPill` when not Pro) **only**. The `N of 2 unlocked` tag moves **onto the ladder** — right-aligned `.ladderHead` directly above the two rungs (mock v1, stage 1). It is the ladder's progress, not a card-header chip.
- **forming:** frosted `FocusRewardPreview` + optional coarse hint line + 2-rung `FocusGateRow` ladder + `Set my hours myself` ghost. (Was 3 rungs.)
- **revealed:**
  - conf `low` → coarse block name (`type.subtitle`) + "around H:MM–H:MM" muted subline + `FocusCurve` with a **wide dashed band** + `FocusConfidenceMeter` (Low).
  - conf `building`/`steady` → window range hero (`type.honestNumberMd`) + `FocusCurve` **solid band**, tightening with tier + why-line + contrast + meter. Footer `Open ›` → detail sheet (unchanged route `/(modals)/focus-window`).
- **New `FocusConfidenceMeter`** (`src/features/planner/`): honey-fill track. Reuse `t.progress.track` (6pt), `radii.full`, `colors.accent` fill on `colors.surfaceSunken`. Label above via `confidenceLabel(tier)`; `steady` label in `colors.amberText`.
- **`FocusCurve`** gains a `bandVariant: 'coarse' | 'precise'` prop: coarse = wider band + dashed amber edges; precise = current solid band.
- Locked (free, non-Pro) teaser path unchanged except it now triggers at `basis === 'revealed'`.

## 7. Motion (creating-reanimated-animations + motion-design)

- **Confidence fill** — amber, ease-out, `motion.honeyFill` (900ms). Grows only, never retreats (honey monotonic). Reduced-motion → final width.
- **Band tightening** — width via layout/opacity, ease-in-out; edges fade dashed→solid across tiers. **No slide, no bounce** (animation HARD RULE).
- **Curve draw** — `strokeDashoffset` once on mount (overestimate `strokeDasharray`, per the `pathLength` gotcha). Reduced-motion → drawn state.
- **Reveal (forming→revealed):** frost lifts via **opacity + subtle blur mask** (no translate). Settles, doesn't wobble.

## 8. Invariants / guardrails

- No guilt, no streaks: labels are qualitative energy, meter only rises.
- Honey/sharpness monotonic: confidence meter never decreases within a session; window held by hysteresis.
- Core loop on-device: pure engine change, zero network.
- Pricing from RevenueCat: Pro gate untouched — reveal-early changes *when the value shows*, not *what's free*. Free path still frosted + `Unlock ›`.
- Pro-gate leak audit: when locked (free), hide the range **and** the band position/peak tick, same as today (`pro-gate-leak-audit` memory).

## 9. Test plan (TDD — engine first)

- `focusWindowLearn.test.ts`: `FW_BIN_COUNT` integer at `FW_BIN_MIN=60`; 2-gate `buildGates`; `basis:'revealed'` at 2 gates with a weak signal; `confidenceTier` boundaries at `FW_CONF_BUILDING`/`FW_CONF_HIGH`; flat data → stays `forming`; hysteresis still holds a shown window.
- `focusCopy.test.ts`: `${n} of 2 unlocked`; `confidenceLabel` per tier; `coarseBlockLabel` bucket boundaries (660/780/1020); coarse hint plural/empty guards; **no** `2/6`-style peak copy remains.
- `FocusPeakCard` render tests: forming shows 2 rows + ladderHead tag, header has no unlocked-tag; revealed-low shows coarse block + meter; revealed-steady shows range + `Open ›`; free path frosted at revealed.
- Full suite (`npm test`) + `npm run lint` + `npm run typecheck` green before commit.

## 10. Files touched

```
src/engine/constants.ts                         (FW_BIN_MIN; confidence reuse)
src/engine/focusWindowLearn.ts                  (2-gate, reveal-early, confidenceTier, coarse)
src/domain/types.ts                             (FocusGates drop peak; basis rename; new fields)
src/features/patterns/focusCopy.ts              (copy swap, confidence + coarse helpers)
src/features/patterns/FocusPeakCard.tsx         (header, ladderHead, revealed states, meter)
src/features/planner/FocusCurve.tsx             (bandVariant)
src/features/planner/FocusConfidenceMeter.tsx   (NEW)
src/features/planner/FocusGateRow.tsx           (2-rung; drop peak pip path if peak-specific)
src/features/planner/useLearnedFocusWindow.ts   (pass-through new fields)
+ tests for engine, copy, card
```

## 11. Open decisions to confirm before build

1. ~~Confidence source~~ **DECIDED (Q1=B):** blend day-progress with permutation strength (`FW_CONF_DAY_WEIGHT=0.55`) so the meter reflects how *trustworthy* the window is, not just elapsed days. See §4.3.
2. ~~`basis` rename~~ **DECIDED (Q2):** rename `personal→revealed`; grep + migrate every reader (`focusWindowLearn`, `useLearnedFocusWindow`, `FocusPeakCard`). Contained refactor.
