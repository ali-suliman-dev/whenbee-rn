import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Card } from '@/src/components/Card';
import { HonestNumber } from '@/src/components/HonestNumber';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatReclaim } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// ReclaimHeroCard — the felt payoff. Mirrors FocusCard's structure: an eyebrow,
// a single hero number, a quiet provenance line, one focal card. The Reclaim
// total is the hero (Inter tabular, neutral `ink` — it's an honest count, not
// decoration); amber is the identity accent, carried by ONE small marker beside
// the eyebrow (formatReclaim bundles units inline — "14h 20m" — so there's no
// clean trailing unit to color-split; the marker keeps amber tasteful + scarce).
//
//   ● RECLAIMED                 (eyebrow + amber identity dot)
//   14h 20m                     (hero — the time saved, the whole point)
//   from 23 honest logs · learned on-device   (provenance)
//   ─────────────────────
//   biggest area · Deep Work   6h 40m          (optional)
//
// Empty state (lifetimeMin === 0): no number at all — just the calm, no-rush
// line, so a fresh user feels invited, not measured.
// ──────────────────────────────────────────────────────────────────────────────

interface ReclaimHeroCardProps {
  lifetimeMin: number;
  honestLogCount: number;
  biggestArea: { name: string; reclaimedMinutes: number } | null;
}

export function ReclaimHeroCard({ lifetimeMin, honestLogCount, biggestArea }: ReclaimHeroCardProps) {
  const t = useTheme();

  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const dot: ViewStyle = {
    width: 7,
    height: 7,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const provenance: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const emptyLine: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };

  const divider: ViewStyle = {
    height: t.borderWidth.hairline,
    backgroundColor: t.colors.hairline,
    marginTop: t.space[1],
  };
  const areaRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: t.space[3],
  };
  const areaLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft, flexShrink: 1 };
  const areaValue: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.bodyLg,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };

  // Reclaim is DERIVED from honest logs — it cannot exist without them. Gate the
  // empty state on the log count too, so a stale companion bank (minutes that
  // survived a stats reset) can never show "Xm from 0 honest logs".
  const empty = lifetimeMin === 0 || honestLogCount === 0;

  return (
    <Card tone="focal" style={{ gap: t.space[3] }}>
      <View style={eyebrowRow}>
        <View style={dot} />
        <Text style={eyebrow}>RECLAIMED</Text>
      </View>

      {empty ? (
        <Text style={emptyLine}>Log a task and the time you win back starts adding up here. No rush.</Text>
      ) : (
        <>
          <HonestNumber size="xl" tone="ink" value={formatReclaim(lifetimeMin)} />
          <Text style={provenance}>
            from {honestLogCount} honest {honestLogCount === 1 ? 'log' : 'logs'} · learned on-device
          </Text>

          {biggestArea ? (
            <>
              <View style={divider} />
              <View style={areaRow}>
                <Text style={areaLabel}>biggest area · {biggestArea.name}</Text>
                <Text style={areaValue}>{formatReclaim(biggestArea.reclaimedMinutes)}</Text>
              </View>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}
