import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { TrendSeries } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// TrendChart — a small static SVG line of the rolling multiplier over time.
//
//   Calibration trend            [Last 30 days]
//   ┌───────────────────────┐
//   │     ·──·         1× ─ ─│  (dashed 1× target, indigo line, last point dot)
//   └───────────────────────┘
//   {caption}
//
// Static line — reduce-motion safe by construction (no animation). With < 3
// completed logs there isn't a meaningful trend yet, so we show a friendly
// "not enough logs yet" placeholder instead of a misleading near-flat line.
// ──────────────────────────────────────────────────────────────────────────────

const MIN_POINTS = 3;
const CHART_H = 96;
const PAD = 8;

interface TrendChartProps {
  trend: TrendSeries;
}

export function TrendChart({ trend }: TrendChartProps) {
  const t = useTheme();

  const header: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const pill: ViewStyle = {
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
  };
  const pillText: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkSoft };
  const caption: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  const points = trend.points;
  const captionText =
    trend.caption === 'stabilizing'
      ? 'Your multiplier is stabilizing — good self-awareness.'
      : 'Steady and consistent — your pace is predictable here.';

  let body: React.ReactNode;
  if (points.length < MIN_POINTS) {
    const empty: ViewStyle = {
      height: CHART_H,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surfaceSunken,
      borderRadius: t.radii.md,
    };
    body = (
      <View style={empty}>
        <Text style={[caption, { textAlign: 'center' }]}>
          Not enough logs yet — your trend appears after a few more.
        </Text>
      </View>
    );
  } else {
    // Layout in an abstract 100×CHART_H box; the SVG scales to its parent width.
    const W = 100;
    const usableW = W - PAD * 2;
    const usableH = CHART_H - PAD * 2;
    const mults = points.map((p) => p.multiplier);
    const max = Math.max(...mults, 1);
    const min = Math.min(...mults, 1);
    const span = max - min || 1;

    const xy = points.map((p, i) => {
      const x = PAD + (points.length === 1 ? usableW / 2 : (i / (points.length - 1)) * usableW);
      const y = PAD + (1 - (p.multiplier - min) / span) * usableH;
      return { x, y };
    });
    const polyline = xy.map((p) => `${p.x},${p.y}`).join(' ');
    const targetY = PAD + (1 - (1 - min) / span) * usableH; // the 1× honest line
    const last = xy[xy.length - 1];

    body = (
      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} preserveAspectRatio="none">
        {/* dashed 1× target line (only when in range) */}
        {1 >= min && 1 <= max && (
          <Line
            x1={PAD}
            y1={targetY}
            x2={W - PAD}
            y2={targetY}
            stroke={t.colors.hairline}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        <Polyline
          points={polyline}
          fill="none"
          stroke={t.colors.primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {last && <Circle cx={last.x} cy={last.y} r={3} fill={t.colors.primary} />}
      </Svg>
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
      <Text style={caption}>{captionText}</Text>
    </View>
  );
}
