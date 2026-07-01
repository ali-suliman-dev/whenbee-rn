import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import type { ReviewSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// WeekReadCard — the opening synthesis: a verbal verdict on how tight the week
// was, plus a small sparkline showing which days you logged the most.
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  summary: ReviewSummary;
}

export function WeekReadCard({ summary }: Props) {
  const t = useTheme();
  const wr = summary.weekRead;
  if (!wr) return null;

  const maxCount = Math.max(...wr.dailyLogCounts, 1);

  // Weekday vs weekend caption
  const weekdayCounts = wr.dailyLogCounts.slice(0, 5);
  const weekendCounts = wr.dailyLogCounts.slice(5, 7);
  const weekdayTotal = weekdayCounts.reduce((a, b) => a + b, 0);
  const weekendTotal = weekendCounts.reduce((a, b) => a + b, 0);
  const weekdayAvg = weekdayTotal / 5;
  const weekendAvg = weekendTotal / 2;
  const hasVariance = weekdayAvg > weekendAvg * 1.5 && weekendAvg < weekdayAvg * 0.7;
  const caption = hasVariance ? 'Weekdays sharpest · weekend light' : null;

  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

  const styles = StyleSheet.create({
    // One gap-based rhythm per axis (no mixed gap + margin): a clearly bigger
    // gap separates the verdict block from the chart block; each block groups
    // its own two lines/rows with a small, tight gap.
    container: { gap: t.space[5] },
    verdictGroup: { gap: t.space[1.5] },
    chartGroup: { gap: t.space[2] },
    verdict: { fontSize: 26, fontWeight: '700', color: t.colors.ink },
    subtitle: { fontSize: 14, color: t.colors.inkSoft },
    logCount: { fontWeight: '700', color: t.colors.amberText },
    sparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    barWrapper: { flex: 1, alignItems: 'center', gap: 4 },
    bar: { width: '100%', borderRadius: 3 },
    dayLabel: { fontSize: 8, color: t.colors.inkFaint, fontWeight: '600' },
    caption: { fontSize: 11, color: t.colors.inkFaint },
  });

  return (
    <Card tone="flat">
      <View style={styles.container}>
        <View style={styles.verdictGroup}>
          <Text style={styles.verdict}>{wr.verdict}</Text>
          <Text style={styles.subtitle}>
            {wr.areasClose} of {wr.areasTotal} areas landed close.{' '}
            <Text style={styles.logCount}>{summary.loggedCount}</Text> logs.
          </Text>
        </View>
        <View style={styles.chartGroup}>
          <View style={styles.sparkline}>
            {wr.dailyLogCounts.map((count, i) => {
              const height = count > 0 ? Math.max(8, Math.round((count / maxCount) * 44)) : 4;
              const barColor = count > 0 ? t.colors.accent : 'rgba(255,255,255,0.10)';
              return (
                <View key={i} style={styles.barWrapper}>
                  <View style={[styles.bar, { height, backgroundColor: barColor }]} />
                  <Text style={styles.dayLabel}>{days[i]}</Text>
                </View>
              );
            })}
          </View>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
      </View>
    </Card>
  );
}
