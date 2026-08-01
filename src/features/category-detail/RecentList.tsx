import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { RecentLog } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// RecentList — the receipts. Each completed log, newest first:
//
//   guessed 15 · took 30                 2.0×
//   ▓▓▓▓▓▓▓▓░░░░░░░░  (amber actual track over grey estimate track)
//
// Over-runs read AMBER (never red — no guilt). On-time / under reads indigo.
// ──────────────────────────────────────────────────────────────────────────────

const MAX_ROWS = 8;
const BAR_H = 6;

interface RecentListProps {
  recent: RecentLog[];
}

export function RecentList({ recent }: RecentListProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('categoryDetail');

  const header: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const empty: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  if (recent.length === 0) {
    return (
      <View style={{ gap: t.space[3] }}>
        <Text style={header}>{tr('recentList.header')}</Text>
        <Text style={empty}>{tr('recentList.empty')}</Text>
      </View>
    );
  }

  const rows = recent.slice(0, MAX_ROWS);

  return (
    <View style={{ gap: t.space[3] }}>
      <Text style={header}>{tr('recentList.header')}</Text>
      {rows.map((row, i) => (
        <RecentRow key={`${row.createdAt}-${i}`} row={row} />
      ))}
    </View>
  );
}

function RecentRow({ row }: { row: RecentLog }) {
  const t = useTheme();
  const { t: tr } = useTranslation('categoryDetail');
  const over = row.actualMin > row.estimateMin;
  const ratioColor = over ? t.colors.accent : t.colors.primary;

  // Dual-track: grey estimate track full width; coloured actual track scaled to
  // the ratio (capped so a 6× over-run doesn't overflow the row).
  const actualFraction = Math.min(1, row.estimateMin / Math.max(row.actualMin, 1));

  // One spacing source per axis: the row owns vertical rhythm via `gap`, so neither
  // the label row nor the track carries a margin (mixing the two drifts alignment).
  const labelRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  // Guess → actual reads as a direction (what you thought vs. what it took).
  const guessRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] };
  const label: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink };
  const ratio: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.bodySm,
    color: ratioColor,
    fontVariant: ['tabular-nums'],
  };
  const trackBg: ViewStyle = {
    height: BAR_H,
    borderRadius: BAR_H / 2,
    backgroundColor: t.colors.hairline,
    overflow: 'hidden',
  };
  const trackFill: ViewStyle = {
    height: BAR_H,
    borderRadius: BAR_H / 2,
    backgroundColor: ratioColor,
    width: `${Math.round(actualFraction * 100)}%`,
  };

  return (
    <View style={{ gap: t.space[1.5] }}>
      <View style={labelRow}>
        <View style={guessRow}>
          <Text style={label}>{tr('recentList.guessed', { estimate: row.estimateMin })}</Text>
          <Ionicons name="arrow-forward" size={t.iconSize.xs} color={t.colors.inkFaint} />
          <Text style={label}>{tr('recentList.took', { actual: row.actualMin })}</Text>
        </View>
        <Text style={ratio}>{row.ratio.toFixed(1)}×</Text>
      </View>
      <View style={trackBg} accessibilityRole="progressbar">
        <View style={trackFill} />
      </View>
    </View>
  );
}
