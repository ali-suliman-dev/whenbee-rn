import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { TIERS, capabilityFor, COMPANION_KEEPER_QUOTA } from '@/src/engine';
import type { CompanionStage } from '@/src/engine';
import { useNextUnlock } from './useNextUnlock';
import { capabilityLabel } from './capabilityCopy';

// ──────────────────────────────────────────────────────────────────────────────
// UnlockLadder — the Progress tab's "what your logs unlock" card (Task 6,
// plain-calibration-copy plan). Lists all six companion stages top to bottom:
// reached stages get a filled amber marker + full-ink label, the CURRENT stage
// (the one being chased) gets an amber-haloed marker, an amber label, AND the
// away-count line, and every later stage stays a faint, unreached dot with a
// faint label. Mock reference: docs/product/mocks/mascot-honey-fix.html,
// screen 3 — geometry/coloring transcribed from there; copy comes from the
// capability ladder's own locked strings (`capabilityCopy.ts`, `ladder.*`),
// not the mock's placeholder tier-name labels.
//
// Reads `useNextUnlock()` for the SAME tier/pct/logsToNext this card's Today
// counterpart (`CalibrationCard`) shows — one source of truth for "how far
// along am I" across screens. The header also carries the tier WORD, not just
// the percentage (review fix round 1) — `RingBadge` used to be the only place
// that said it, and it no longer renders on this tab.
//
// Rung 6 (Keeper) sits outside the tier ladder — `capabilityFor(6).tier` is
// null; it's gated by `keeperReached`'s "every tracked category capped, at
// least COMPANION_KEEPER_QUOTA of them" quota instead. Rather than leaving it
// an unexplained faint dead end (this repo bans ambiguous locked states — see
// the focus-unlock-ladder precedent), it carries its own countable "N of M
// areas sealed" milestone, derived live from the already-subscribed
// categories + statsByCategory (no new persistence — mirrors the exact
// cappedCellCount/trackedCount math `calibrationStore` uses to set the
// keeper flag, review fix round 1, branch (a)).
//
// No motion — every rung renders at its final state from mount (hard rule).
// ──────────────────────────────────────────────────────────────────────────────

const STAGES: CompanionStage[] = [1, 2, 3, 4, 5, 6];
const KEEPER_STAGE: CompanionStage = 6;

export function UnlockLadder({ keeper }: { keeper: boolean }) {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const { tier, tierLabel, pct, logsToNext, sealed } = useNextUnlock();
  const categories = useCategoriesStore((s) => s.categories);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  // Ground truth for "how many rungs are lit" — the tier ladder covers stages
  // 1..5 (companionStageFor(maxTier) = tierIdx + 1); stage 6 (Keeper) sits
  // outside the tier ladder entirely (its own all-categories-capped quota), so
  // it only lights up once `keeper` says so, never merely because tier capped.
  const tierReachedStage = TIERS.indexOf(tier) + 1;
  const reachedStage = keeper ? 6 : tierReachedStage;
  const effectiveSealed = sealed || keeper;
  const currentStage = effectiveSealed ? null : reachedStage + 1;

  // Keeper's countable milestone: same shape as `keeperReached` (engine/companion.ts)
  // — cap EVERY tracked category, with at least COMPANION_KEEPER_QUOTA tracked.
  // `total` grows with either requirement so the fraction never overstates
  // progress: a lone capped category with only 1 tracked still reads "1 of 3",
  // never "1 of 1" (which would misleadingly look done).
  const trackedCount = categories.length;
  const cappedCellCount = categories.filter(
    (c) => statsByCategory[c.id]?.tier === 'Honest',
  ).length;
  const keeperTotal = Math.max(trackedCount, COMPANION_KEEPER_QUOTA);
  const keeperDone = Math.min(cappedCellCount, keeperTotal);

  const card: ViewStyle = { gap: t.space[4] };
  const headRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space[2],
  };
  const titleStyle: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const statusStyle: TextStyle = {
    ...(type.numLedger as unknown as TextStyle),
    color: t.colors.amberText,
  };
  const rungs: ViewStyle = { gap: t.space[3] };

  return (
    <Card style={card}>
      <View style={headRow}>
        <Text style={titleStyle}>{tr('ladder.title')}</Text>
        <Text style={statusStyle}>{tr('ladder.headerStatus', { tier: tierLabel, pct })}</Text>
      </View>
      <View style={rungs}>
        {STAGES.map((stage) => {
          const id = capabilityFor(stage).id;
          const label = capabilityLabel(id, tr);
          const isReached = stage <= reachedStage;
          const isCurrent = stage === currentStage;
          const isKeeperStage = stage === KEEPER_STAGE;
          const keeperProgress =
            isKeeperStage && !isReached
              ? tr('ladder.keeperProgress', { done: keeperDone, total: keeperTotal })
              : null;
          return (
            <Rung
              key={stage}
              label={label}
              awayCount={isCurrent ? logsToNext : null}
              keeperProgress={keeperProgress}
              reached={isReached}
              current={isCurrent}
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
}: {
  label: string;
  /** Set only on the current (tier-ladder) rung — null everywhere else. */
  awayCount: number | null;
  /** Set only on the unreached Keeper rung — the "N of M areas sealed" line. */
  keeperProgress: string | null;
  reached: boolean;
  current: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const { dot, halo, gutter } = t.unlockLadder;
  const away = awayCount !== null ? tr('ladder.away', { count: awayCount }) : null;
  // Exactly one of these is ever set for a given rung — the tier-ladder away
  // line (amber, urgent-adjacent) or the Keeper progress line (neutral, no
  // "hurry" framing — it isn't next in the queue, just not yet earned).
  const subText = away ?? keeperProgress;
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
  const markerColor = reached || current ? t.colors.accent : t.colors.surfaceSunken;
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
  const labelStyle: TextStyle = {
    ...(type.bodySmSemibold as unknown as TextStyle),
    color: current ? t.colors.amberText : reached ? t.colors.ink : t.colors.inkFaint,
  };
  const subStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: subTone };

  const a11yLabel =
    current && awayCount !== null
      ? tr('ladder.rungCurrentA11y', { capability: label, count: awayCount })
      : keeperProgress !== null
        ? tr('ladder.rungKeeperProgressA11y', { capability: label, progress: keeperProgress })
        : reached
          ? tr('ladder.rungReachedA11y', { capability: label })
          : tr('ladder.rungUpcomingA11y', { capability: label });

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
        <Text style={labelStyle}>{label}</Text>
        {subText ? <Text style={subStyle}>{subText}</Text> : null}
      </View>
    </View>
  );
}
