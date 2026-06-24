import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { niceAxis } from '@/src/lib/chartAxis';
import { AxisLineChart } from '@/src/components/AxisLineChart';
import type { TrendSeries } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// TrendChart — the rolling personal multiplier over the last ~30 days, as a real
// labelled line chart: a 0.1×-stepped y-axis anchored at the 1.0× ideal baseline,
// gridline rules, and x-axis time labels. With < 3 completed logs there isn't a
// meaningful trend yet, so we show a friendly placeholder instead of a misleading
// near-flat line.
// ──────────────────────────────────────────────────────────────────────────────

const MIN_POINTS = 3;
const EMPTY_H = 96;
const PAD = 8;
const DAY = 86_400; // loggedAt is in seconds

export function TrendChart({ trend }: { trend: TrendSeries }) {
  const t = useTheme();

  const header: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const headerRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const pill: ViewStyle = {
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
  };
  const pillText: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkSoft };
  const caption: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  const points = trend.points;
  const hasTrend = points.length >= MIN_POINTS;
  const captionText =
    trend.caption === 'stabilizing'
      ? 'Your multiplier is stabilizing — good self-awareness.'
      : 'Steady and consistent — your pace is predictable here.';

  let body: React.ReactNode;
  if (!hasTrend) {
    const empty: ViewStyle = {
      height: EMPTY_H,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: t.space[5],
      backgroundColor: t.colors.surfaceSunken,
      borderRadius: t.radii.md,
      borderCurve: 'continuous',
      overflow: 'hidden',
    };
    const fill: ViewStyle = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 };
    body = (
      <View style={empty}>
        <View style={fill} pointerEvents="none">
          <Svg width="100%" height={EMPTY_H} viewBox={`0 0 100 ${EMPTY_H}`} preserveAspectRatio="none">
            <Line
              x1={PAD}
              y1={EMPTY_H / 2}
              x2={100 - PAD}
              y2={EMPTY_H / 2}
              stroke={t.colors.hairline}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </Svg>
        </View>
        <Text style={[caption, { textAlign: 'center' }]}>
          Not enough logs yet — your trend appears after a few more.
        </Text>
      </View>
    );
  } else {
    const values = points.map((p) => p.multiplier);
    const axis = niceAxis(values, { step: 0.1, anchorValue: 1, minSpanSteps: 3 });
    const firstTs = points[0]!.loggedAt;
    const lastTs = points[points.length - 1]!.loggedAt;
    const days = Math.max(1, Math.round((lastTs - firstTs) / DAY));
    body = (
      <AxisLineChart
        values={values}
        axis={axis}
        formatY={(v) => `${v.toFixed(1)}×`}
        xLabels={[`${days}d ago`, `${Math.round(days / 2)}d`, 'now']}
        referenceLine={{ value: 1, label: 'ideal' }}
        valueDecimals={2}
        valueSuffix="×"
      />
    );
  }

  return (
    <View style={{ gap: t.space[3] }}>
      <View style={headerRow}>
        <Text style={header}>Calibration trend</Text>
        <View style={pill}>
          <Text style={pillText}>Last 30 days</Text>
        </View>
      </View>
      {body}
      {hasTrend ? <Text style={caption}>{captionText}</Text> : null}
    </View>
  );
}
