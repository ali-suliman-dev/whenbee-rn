import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { ProCoinPill } from '@/src/components/ProCoinPill';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { capabilityFor, COMPANION_KEEPER_QUOTA } from '@/src/engine';
import type { CompanionStage } from '@/src/engine';
import { useNextUnlock } from './useNextUnlock';
import { capabilityLabel } from './capabilityCopy';
import { isCapabilityPro, isCapabilityStageGated } from './capabilityGating';

// ──────────────────────────────────────────────────────────────────────────────
// UnlockLadder — the Progress tab's "what your logs sharpen" card (Task 6,
// plain-calibration-copy plan; reworded F1, 2026-08-02). Lists all six
// companion stages top to bottom: reached stages get a filled amber marker +
// full-ink label, the CURRENT stage (the one being chased) gets an amber-haloed
// marker, an amber label, AND the away-count line, and every later stage stays
// a faint, unreached dot with a faint label. Mock reference: docs/product/mocks/
// mascot-honey-fix.html, screen 3 — geometry/coloring transcribed from there;
// copy comes from the capability ladder's own locked strings
// (`capabilityCopy.ts`, `ladder.*`), not the mock's placeholder tier-name labels.
//
// F1: only ONE of the six rungs (`drift-recalibration`) is a real feature gate
// — `CAPABILITY_STAGE_GATED` in `capabilityGating.ts` has the trace. The other
// five don't reveal anything new when their tier is crossed; they only measure
// that category's own accuracy getting sharper. So:
//   - a REACHED, non-gated, non-Keeper rung shows `stateSharp` ("sharp enough
//     to trust") — a fact about calibration, not a claim of newly-granted access.
//   - the GATED rung (drift-recalibration), while unreached AND not the rung
//     currently being chased, previews `stateGated` ("unlocks at Honest") —
//     so it reads differently from the five sharpen-only rungs even before the
//     user is climbing toward it (this repo bans ambiguous locked states).
//   - the CURRENT rung (whichever is next, gated or not) keeps the away-count
//     line it already had — that number is real regardless of framing.
//   - Keeper (rung 6) is a standing, not a tier-ladder capability at all — it
//     never gets `stateSharp`; reached, it shows nothing (case below).
//
// Reads `useNextUnlock()` for the SAME tier/pct/logsToNext this card's Today
// counterpart (`CalibrationCard`) shows — one source of truth for "how far
// along am I" across screens. The header also carries the tier WORD, not just
// the percentage (review fix round 1).
//
// Which rungs are LIT comes from the monotonic companion stage, never from the
// live tier: sharpness is a rolling window that falls after sloppy estimates, and
// an earned capability must never un-light (see `useNextUnlock`). The tier/pct in
// the header is the progress read, and that one may legitimately move both ways.
//
// Two of the six rungs are Pro (`capabilityGating.ts`). A free user sees the
// app's standard `ProCoinPill` on those, so the ladder never sells a paywalled
// feature as something logging alone will buy. A Pro subscriber sees no pill —
// for them the rung simply is what it says.
//
// Rung 6 (Keeper) sits outside the tier ladder — `capabilityFor(6).tier` is
// null; it's gated by `keeperReached`'s "every tracked category capped, at
// least COMPANION_KEEPER_QUOTA of them" quota instead. Rather than leaving it
// an unexplained faint dead end (this repo bans ambiguous locked states — see
// the focus-unlock-ladder precedent), it carries its own countable "N of M
// areas sealed" milestone, derived live from the already-subscribed
// categories + statsByCategory (mirrors the exact cappedCellCount/trackedCount
// math `calibrationStore` uses to set the keeper flag, review fix round 1,
// branch (a)).
//
// F5: that live count is a ROLLING read (`statsByCategory[id].tier`), so a
// category that drifted back off Honest after being counted would make this
// milestone count DOWN — a guilt-shaped failure this project explicitly bans
// (milestones are monotonic). There's no per-category "ever reached Honest"
// persisted anywhere to build a true all-time high-water mark from without
// adding new persistence (out of scope per the fix ruling), so instead the
// live count is floored by `keeperCappedHighWater`, a monotonic in-memory
// mirror the store raises alongside the very same cappedCellCount inside
// `applyLog()` (and seeds from persisted stats at `hydrate()`). That keeps the
// number non-decreasing for the lifetime of the app session; it can still
// start over on a cold relaunch, since nothing about a per-category peak is
// durable — see the store field's doc comment for the exact limit.
//
// No motion — every rung renders at its final state from mount (hard rule).
// ──────────────────────────────────────────────────────────────────────────────

const STAGES: CompanionStage[] = [1, 2, 3, 4, 5, 6];
const KEEPER_STAGE: CompanionStage = 6;

export function UnlockLadder({ keeper }: { keeper: boolean }) {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const { tierLabel, pct, logsToNext, stage, sealed } = useNextUnlock();
  const categories = useCategoriesStore((s) => s.categories);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const keeperCappedHighWater = useCalibrationStore((s) => s.keeperCappedHighWater);
  const isPro = useEntitlement((s) => s.isPro);

  // Ground truth for "how many rungs are lit" — the MONOTONIC companion stage,
  // which covers 1..5 off the tier ladder; stage 6 (Keeper) sits outside it
  // entirely (its own all-categories-capped quota), so it only lights up once
  // `keeper` says so, never merely because the tier capped.
  const reachedStage = keeper ? 6 : stage;
  const effectiveSealed = sealed || keeper;
  const currentStage = effectiveSealed ? null : reachedStage + 1;

  // Keeper's countable milestone: same shape as `keeperReached` (engine/companion.ts)
  // — cap EVERY tracked category, with at least COMPANION_KEEPER_QUOTA tracked.
  // `total` grows with either requirement so the fraction never overstates
  // progress: a lone capped category with only 1 tracked still reads "1 of 3",
  // never "1 of 1" (which would misleadingly look done).
  const trackedCount = categories.length;
  const liveCappedCellCount = categories.filter(
    (c) => statsByCategory[c.id]?.tier === 'Honest',
  ).length;
  // Never below the session high-water mark (F5) — see the header comment.
  const cappedCellCount = Math.max(liveCappedCellCount, keeperCappedHighWater);
  const keeperTotal = Math.max(trackedCount, COMPANION_KEEPER_QUOTA);
  const keeperDone = Math.min(cappedCellCount, keeperTotal);

  const card: ViewStyle = { gap: t.space[4] };
  const headRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space[2],
  };
  // F12: the title shrinks (and ellipsises) first — the status block on the
  // right carries the tier word AND the percentage in one string, and Swedish
  // tier words run long enough to break this row, so it stays fixed-width
  // and never truncates.
  const titleStyle: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
    flexShrink: 1,
  };
  const statusStyle: TextStyle = {
    ...(type.numLedger as unknown as TextStyle),
    color: t.colors.amberText,
    flexShrink: 0,
  };
  const rungs: ViewStyle = { gap: t.space[3] };

  return (
    <Card style={card}>
      <View style={headRow}>
        <Text style={titleStyle} numberOfLines={1}>
          {tr('ladder.title')}
        </Text>
        <Text style={statusStyle}>{tr('ladder.headerStatus', { tier: tierLabel, pct })}</Text>
      </View>
      <View style={rungs}>
        {STAGES.map((rungStage) => {
          const id = capabilityFor(rungStage).id;
          const label = capabilityLabel(id, tr);
          const isReached = rungStage <= reachedStage;
          const isCurrent = rungStage === currentStage;
          const isKeeperStage = rungStage === KEEPER_STAGE;
          const keeperProgress =
            isKeeperStage && !isReached
              ? tr('ladder.keeperProgress', { done: keeperDone, total: keeperTotal })
              : null;
          return (
            <Rung
              key={rungStage}
              label={label}
              awayCount={isCurrent ? logsToNext : null}
              keeperProgress={keeperProgress}
              reached={isReached}
              current={isCurrent}
              gated={isCapabilityStageGated(id)}
              isKeeperStage={isKeeperStage}
              pro={!isPro && isCapabilityPro(id)}
            />
          );
        })}
      </View>
    </Card>
  );
}

function Rung({
  label,
  awayCount,
  keeperProgress,
  reached,
  current,
  gated,
  isKeeperStage,
  pro,
}: {
  label: string;
  /** Set only on the current (tier-ladder) rung — null everywhere else. */
  awayCount: number | null;
  /** Set only on the unreached Keeper rung — the "N of M areas sealed" line. */
  keeperProgress: string | null;
  reached: boolean;
  current: boolean;
  /** True only for the one capability a stage crossing genuinely gates
   *  (`drift-recalibration` — see `capabilityGating.ts`). */
  gated: boolean;
  /** True for rung 6 (Keeper) — a standing, not a tier-ladder capability;
   *  never gets `stateSharp`, and reached shows nothing extra (see below). */
  isKeeperStage: boolean;
  /** True when this capability is Pro-gated AND the viewer isn't Pro. */
  pro: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const { dot, halo, gutter } = t.unlockLadder;
  const away = awayCount !== null ? tr('ladder.away', { count: awayCount }) : null;
  // A reached, non-Keeper rung states a fact about calibration ("sharp enough
  // to trust") — never a claim of newly-granted access, since crossing this
  // tier didn't grant any (F1). The one genuinely gated rung previews
  // `stateGated` while it's still unreached AND not yet the one being chased
  // — so it reads differently from an ordinary sharpen-only rung even before
  // the user is climbing toward it.
  const stateSharp = reached && !isKeeperStage ? tr('ladder.stateSharp') : null;
  const stateGated = !reached && !current && gated ? tr('ladder.stateGated') : null;
  // Exactly one of these is ever set for a given rung.
  const subText = away ?? keeperProgress ?? stateSharp ?? stateGated;
  const subTone = away ? t.colors.amberText : t.colors.inkSoft;

  const row: ViewStyle = { flexDirection: 'row', gap: t.space[3], alignItems: 'flex-start' };
  const gutterCol: ViewStyle = {
    width: gutter,
    alignItems: 'center',
    justifyContent: 'center',
    // Nudge the marker down to the label's cap-height rather than the row's
    // full (possibly two-line) height. Sourced from the SAME token as the
    // halo circle so the two can never drift apart (review fix round 1).
    height: halo,
  };
  // F11: an unreached marker used `surfaceSunken` (1.14:1 on `surface` in light,
  // 1.13:1 in dark — effectively invisible, well under the 3:1 WCAG floor for
  // non-text UI components). `inkSoft` clears it comfortably in both modes
  // (see `labelStyle` below for the measured ratios) while still reading
  // clearly quieter than the reached/current marker's solid `accent`.
  const markerColor = reached || current ? t.colors.accent : t.colors.inkSoft;
  const marker: ViewStyle = {
    width: dot,
    height: dot,
    borderRadius: t.radii.full,
    backgroundColor: markerColor,
  };
  const haloStyle: ViewStyle = {
    width: halo,
    height: halo,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const content: ViewStyle = { flex: 1, gap: t.space[1] };
  // F11: an unreached rung is essential information (the thing the user is
  // working toward), not decoration — `inkFaint` measured 2.69:1 on `surface`
  // in light and 3.44:1 in dark, both below the 4.5:1 AA floor for body text.
  // `inkSoft` clears AA in both modes (6.29:1 light, 6.92:1 dark on `surface`)
  // while staying a visible step below the reached rung's full `ink`.
  const labelStyle: TextStyle = {
    ...(type.bodySmSemibold as unknown as TextStyle),
    color: current ? t.colors.amberText : reached ? t.colors.ink : t.colors.inkSoft,
  };
  const subStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: subTone };

  // One whole sentence per state — never a base label with a "Pro" fragment
  // appended, so the translator owns word order in both branches. Says the
  // SAME thing the visible subtext says (F1): "unlocked" only for the one
  // genuinely gated rung (or Keeper, a standing) reached; "sharp enough to
  // trust" for every other reached rung; "unlocks at Honest" for the gated
  // rung while it's still a preview; a bare "not yet reached" everywhere else,
  // since there's nothing else honest to claim about an ordinary sharpen-only
  // rung the user hasn't started climbing toward yet.
  const a11yLabel =
    current && awayCount !== null
      ? tr(pro ? 'ladder.rungCurrentProA11y' : 'ladder.rungCurrentA11y', {
          capability: label,
          count: awayCount,
        })
      : keeperProgress !== null
        ? tr('ladder.rungKeeperProgressA11y', { capability: label, progress: keeperProgress })
        : reached
          ? gated || isKeeperStage
            ? tr('ladder.rungReachedA11y', { capability: label })
            : tr(pro ? 'ladder.rungSharpProA11y' : 'ladder.rungSharpA11y', { capability: label })
          : gated
            ? tr('ladder.rungGatedA11y', { capability: label })
            : tr(pro ? 'ladder.rungUpcomingProA11y' : 'ladder.rungUpcomingA11y', { capability: label });

  // F13: the Pro pill's own coin-edge makes it render ~6pt taller than the
  // label's single line — `alignItems:'center'` used to vertically center the
  // (unchanged-height) label inside that taller row, sliding it ~3pt away
  // from the marker it must stay cap-aligned to on every rung, pill or not.
  // `flex-start` pins both children to the row's top instead, so the label's
  // position — and the marker's alignment to it — never depends on whether a
  // pill is present; only the pill (which sits beside, not below, the label)
  // grows the row.
  const labelRow: ViewStyle = { flexDirection: 'row', alignItems: 'flex-start', gap: t.space[2] };

  return (
    <View style={row} accessible accessibilityLabel={a11yLabel}>
      <View style={gutterCol}>
        {current ? (
          <View style={haloStyle}>
            <View style={marker} />
          </View>
        ) : (
          <View style={marker} />
        )}
      </View>
      <View style={content}>
        <View style={labelRow} testID="unlock-ladder-label-row">
          <Text style={[labelStyle, { flexShrink: 1 }]}>{label}</Text>
          {pro ? <ProCoinPill /> : null}
        </View>
        {subText ? <Text style={subStyle}>{subText}</Text> : null}
      </View>
    </View>
  );
}
