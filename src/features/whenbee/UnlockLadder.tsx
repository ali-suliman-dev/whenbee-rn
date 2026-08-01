import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { TIERS, capabilityFor } from '@/src/engine';
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
// along am I" across screens. `keeper` (the companion's stage-6 standing, an
// orthogonal quota — see `engine/companion.ts`'s `keeperReached`) is passed in
// because it isn't derived from tier and would otherwise never surface here.
//
// No motion — every rung renders at its final state from mount (hard rule).
// ──────────────────────────────────────────────────────────────────────────────

const STAGES: CompanionStage[] = [1, 2, 3, 4, 5, 6];

export function UnlockLadder({ keeper }: { keeper: boolean }) {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const { tier, pct, logsToNext, sealed } = useNextUnlock();

  // Ground truth for "how many rungs are lit" — the tier ladder covers stages
  // 1..5 (companionStageFor(maxTier) = tierIdx + 1); stage 6 (Keeper) sits
  // outside the tier ladder entirely (its own all-categories-capped quota), so
  // it only lights up once `keeper` says so, never merely because tier capped.
  const tierReachedStage = TIERS.indexOf(tier) + 1;
  const reachedStage = keeper ? 6 : tierReachedStage;
  const effectiveSealed = sealed || keeper;
  const currentStage = effectiveSealed ? null : reachedStage + 1;

  const card: ViewStyle = { gap: t.space[4] };
  const headRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space[2],
  };
  const titleStyle: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const pctStyle: TextStyle = {
    ...(type.numLedger as unknown as TextStyle),
    color: t.colors.amberText,
  };
  const rungs: ViewStyle = { gap: t.space[3] };

  return (
    <Card style={card}>
      <View style={headRow}>
        <Text style={titleStyle}>{tr('ladder.title')}</Text>
        <Text style={pctStyle}>{`${pct}%`}</Text>
      </View>
      <View style={rungs}>
        {STAGES.map((stage) => {
          const id = capabilityFor(stage).id;
          const label = capabilityLabel(id, tr);
          const isReached = stage <= reachedStage;
          const isCurrent = stage === currentStage;
          return (
            <Rung
              key={stage}
              label={label}
              awayCount={isCurrent ? logsToNext : null}
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
  reached,
  current,
}: {
  label: string;
  /** Set only on the current rung — null everywhere else. */
  awayCount: number | null;
  reached: boolean;
  current: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const { dot, halo, gutter } = t.unlockLadder;
  const away = awayCount !== null ? tr('ladder.away', { count: awayCount }) : null;

  const row: ViewStyle = { flexDirection: 'row', gap: t.space[3], alignItems: 'flex-start' };
  const gutterCol: ViewStyle = {
    width: gutter,
    alignItems: 'center',
    justifyContent: 'center',
    // Nudge the marker down to the label's cap-height rather than the row's
    // full (possibly two-line) height.
    height: t.space[5],
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
  const awayStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.amberText };

  const a11yLabel =
    current && awayCount !== null
      ? tr('ladder.rungCurrentA11y', { capability: label, count: awayCount })
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
        {away ? <Text style={awayStyle}>{away}</Text> : null}
      </View>
    </View>
  );
}
