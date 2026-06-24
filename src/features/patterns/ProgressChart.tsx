import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { niceAxis } from '@/src/lib/chartAxis';
import { AxisLineChart } from '@/src/components/AxisLineChart';
import type { AccuracyTrend } from '@/src/engine';
import type { YouVsPastCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// ProgressChart — "you, then vs now": accuracy over time as a real labelled line
// chart on a discrete 5%-stepped y-axis (0–100 clamped, generous span so a flat
// series reads as a calm line in context, not a slab). The endpoint pops amber.
// The delta reads GREEN when up, neutral when flat/steady — never red, no loss
// state. Falls back to a 2-point early-vs-recent line.
// ──────────────────────────────────────────────────────────────────────────────

export function ProgressChart({ trend, fallback }: { trend: AccuracyTrend | null; fallback: YouVsPastCard | null }) {
  const t = useTheme();

  const points = trend?.points ?? (fallback ? [fallback.earlyAccuracy, fallback.recentAccuracy] : null);
  const deltaPts = trend?.deltaPts ?? fallback?.delta ?? 0;
  if (!points) return null;
  const up = deltaPts > 0;

  const axis = niceAxis(points, { step: 5, clampMin: 0, clampMax: 100, minSpanSteps: 4 });
  const xLabels = points.length > 2 ? ['early', 'midway', 'now'] : ['early', 'now'];

  const cardStyle: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[2],
  };
  const top: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const titleStyle: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, marginTop: t.space[1] };
  const pill: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    backgroundColor: up ? t.colors.successSoft : t.colors.surfaceSunken,
    paddingHorizontal: t.space[2.5],
    paddingVertical: t.space[1],
    borderRadius: t.radii.full,
  };
  const pillText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: up ? t.colors.success : t.colors.inkSoft };
  const contextLine: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint, marginTop: t.space[1] };

  return (
    <View style={cardStyle}>
      <View style={top}>
        <Text style={eyebrow}>ACCURACY OVER TIME</Text>
        <View style={pill}>
          <Text style={pillText}>{up ? `+${deltaPts}% accuracy` : 'steady'}</Text>
        </View>
      </View>
      <Text style={titleStyle}>{up ? 'Getting more accurate' : 'Holding steady'}</Text>

      <AxisLineChart
        values={points}
        axis={axis}
        formatY={(v) => `${v}%`}
        xLabels={xLabels}
        valueSuffix="%"
      />

      <Text style={contextLine}>
        {up ? 'Your guesses and actual time are aligning.' : 'Your reads are consistent.'}
      </Text>
    </View>
  );
}
