import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
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

  const header: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const empty: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  if (recent.length === 0) {
    return (
      <View style={{ gap: t.space[3] }}>
        <Text style={header}>Recent tasks</Text>
        <Text style={empty}>No completed tasks here yet — they&apos;ll show up as you log them.</Text>
      </View>
    );
  }

  const rows = recent.slice(0, MAX_ROWS);

  return (
    <View style={{ gap: t.space[3] }}>
      <Text style={header}>Recent tasks</Text>
      {rows.map((row, i) => (
        <RecentRow key={`${row.createdAt}-${i}`} row={row} />
      ))}
    </View>
  );
}

function RecentRow({ row }: { row: RecentLog }) {
  const t = useTheme();
  const over = row.actualMin > row.estimateMin;
  const ratioColor = over ? t.colors.accent : t.colors.primary;

  // Dual-track: grey estimate track full width; coloured actual track scaled to
  // the ratio (capped so a 6× over-run doesn't overflow the row).
  const actualFraction = Math.min(1, row.estimateMin / Math.max(row.actualMin, 1));

  const labelRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: t.space[1],
  };
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
    <View>
      <View style={labelRow}>
        <Text style={label}>
          guessed {row.estimateMin} · took {row.actualMin}
        </Text>
        <Text style={ratio}>{row.ratio.toFixed(1)}×</Text>
      </View>
      <View style={trackBg} accessibilityRole="progressbar">
        <View style={trackFill} />
      </View>
    </View>
  );
}
