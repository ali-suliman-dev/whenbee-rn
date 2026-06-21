import { useEffect } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { AccuracyTrend } from '@/src/engine';
import type { YouVsPastCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// ProgressChart — "You, then vs now". An accuracy sparkline over time: the line
// draws left→right on appear, area fades beneath it, the endpoint pops amber. The
// delta reads GREEN when up, neutral when flat/steady — never red, no loss state
// (honey/sharpness is monotonic in spirit here). Falls back to a 2-point line.
// ──────────────────────────────────────────────────────────────────────────────

const AnimatedPath = Animated.createAnimatedComponent(Path);
const W = 320;

/** Catmull-Rom-ish smooth path through evenly-spaced points (y already in px). */
function smoothPath(points: number[], height: number): string {
  if (points.length < 2) return '';
  const max = 100;
  const min = Math.min(...points, 50);
  const span = Math.max(1, max - min);
  const stepX = W / (points.length - 1);
  const xy = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / span) * (height - 8) - 4; // 4px top/bottom inset
    return [x, y] as const;
  });
  let d = `M${xy[0]![0]},${xy[0]![1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const [x0, y0] = xy[i]!;
    const [x1, y1] = xy[i + 1]!;
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

export function ProgressChart({ trend, fallback }: { trend: AccuracyTrend | null; fallback: YouVsPastCard | null }) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const points = trend?.points ?? (fallback ? [fallback.earlyAccuracy, fallback.recentAccuracy] : null);
  const deltaPts = trend?.deltaPts ?? fallback?.delta ?? 0;

  const dash = useSharedValue(reduced ? 0 : t.chart.strokeDash);
  useEffect(() => {
    if (reduced) return;
    dash.set(withTiming(0, { duration: t.motion.draw }));
  }, [dash, reduced, t.motion.draw]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: dash.get() }));

  if (!points) return null;

  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const h = t.chart.height;
  const d = smoothPath(points, h);
  const stepX = W / (points.length - 1);
  const endX = (points.length - 1) * stepX;
  const max = 100;
  const min = Math.min(...points, 50);
  const span = Math.max(1, max - min);
  const endY = h - ((last - min) / span) * (h - 8) - 4;
  const up = deltaPts > 0;

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
    flexDirection: 'row', alignItems: 'center', gap: t.space[1],
    backgroundColor: up ? t.colors.successSoft : t.colors.surfaceSunken,
    paddingHorizontal: t.space[2.5], paddingVertical: t.space[1], borderRadius: t.radii.full,
  };
  const pillText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: up ? t.colors.success : t.colors.inkSoft };
  const axis: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', marginTop: t.space[1] };
  const axisText: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };

  return (
    <View style={cardStyle}>
      <View style={top}>
        <Text style={eyebrow}>ACCURACY OVER TIME</Text>
        <View style={pill}>
          <Text style={pillText}>{up ? `+${deltaPts} pts` : 'steady'}</Text>
        </View>
      </View>
      <Text style={titleStyle}>You, then vs now</Text>

      <Svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="prog" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.colors.primary} stopOpacity={t.chart.areaOpacity} />
            <Stop offset="1" stopColor={t.colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={`${d} L${endX},${h} L0,${h} Z`} fill="url(#prog)" />
        <AnimatedPath
          d={d}
          fill="none"
          stroke={t.colors.primary}
          strokeWidth={t.chart.stroke}
          strokeLinecap="round"
          strokeDasharray={t.chart.strokeDash}
          animatedProps={lineProps}
        />
        <Circle cx={endX} cy={endY} r={t.chart.dot} fill={t.colors.accent} />
      </Svg>

      <View style={axis}>
        <Text style={axisText}>At first · {first}%</Text>
        <Text style={axisText}>Lately · {last}%</Text>
      </View>
    </View>
  );
}
