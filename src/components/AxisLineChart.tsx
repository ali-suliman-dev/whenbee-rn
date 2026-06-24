import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import type { NiceAxis } from '@/src/lib/chartAxis';

// ──────────────────────────────────────────────────────────────────────────────
// AxisLineChart — a small but REAL line chart: a labelled, discrete y-axis with
// gridline rules, x-axis labels, a smooth line + soft area, and an emphasised
// endpoint node. Renders at the measured pixel width (no preserveAspectRatio
// stretching), so the stroke stays an even weight and dots stay round.
//
// The line draws on left→right on appear (path stroke-dash, reduced-motion safe);
// nothing slides or bounces. The visible caption beside each use is the text
// alternative, so the SVG is hidden from the a11y tree.
// ──────────────────────────────────────────────────────────────────────────────

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface AxisLineChartProps {
  /** y-values, oldest → newest. */
  values: number[];
  /** Discrete axis from `niceAxis`. */
  axis: NiceAxis;
  /** Render a tick value as its label, e.g. `(v) => `${v}%``. */
  formatY: (v: number) => string;
  /** A few labels spread across the x range (first start-aligned, last end-aligned). */
  xLabels: string[];
  /** Optional dashed reference line (e.g. the 1.0× ideal). */
  referenceLine?: { value: number; label: string };
  /** Endpoint node colour. Defaults to the primary line colour. */
  endpointColor?: string;
  /** Total height incl. the x-label row. Defaults to the chart token height. */
  height?: number;
}

/** Smooth cubic path through points (midpoint control handles — calm, no overshoot). */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0]!.x},${pts[0]!.y}`;
  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const cx = (a.x + b.x) / 2;
    d += ` C${cx},${a.y} ${cx},${b.y} ${b.x},${b.y}`;
  }
  return d;
}

export function AxisLineChart({
  values,
  axis,
  formatY,
  xLabels,
  referenceLine,
  endpointColor,
  height,
}: AxisLineChartProps) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);

  const dash = useSharedValue(reduced ? 0 : t.chart.strokeDash);
  useEffect(() => {
    if (reduced) return;
    dash.set(withTiming(0, { duration: t.motion.draw }));
  }, [dash, reduced, t.motion.draw]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: dash.get() }));

  const H = height ?? t.chart.height;
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));

  // Plot frame (in measured pixels — 1:1, no viewBox distortion).
  const x0 = t.chart.gutter;
  const x1 = Math.max(x0 + 1, w - t.chart.rightPad);
  const yTop = t.chart.topPad;
  const yBot = H - t.chart.xLabelH;
  const span = Math.max(1e-6, axis.max - axis.min);
  const yFor = (v: number) => {
    const c = Math.min(axis.max, Math.max(axis.min, v));
    return yTop + (1 - (c - axis.min) / span) * (yBot - yTop);
  };
  const n = values.length;
  const xFor = (i: number) => (n <= 1 ? (x0 + x1) / 2 : x0 + (i / (n - 1)) * (x1 - x0));
  const pts = values.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const last = pts[pts.length - 1];
  const showDots = n > 1 && n <= 8;
  const labelGap = t.chart.axisFont * 0.36; // optical vertical centring for SVG text

  const line = smoothPath(pts);
  const area = pts.length > 1 && last ? `${line} L${last.x},${yBot} L${pts[0]!.x},${yBot} Z` : '';
  const endColor = endpointColor ?? t.colors.primary;

  return (
    <View
      onLayout={onLayout}
      style={{ height: H }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w > 0 && (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id="axisLineFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.colors.primary} stopOpacity={t.chart.areaOpacity} />
              <Stop offset="1" stopColor={t.colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* gridline rules + y-axis labels */}
          {axis.ticks.map((tick) => {
            const y = yFor(tick);
            return (
              <Line
                key={`grid-${tick}`}
                x1={x0}
                y1={y}
                x2={x1}
                y2={y}
                stroke={t.colors.hairline}
                strokeWidth={t.chart.gridW}
              />
            );
          })}
          {axis.ticks.map((tick) => (
            <SvgText
              key={`ylab-${tick}`}
              x={x0 - 6}
              y={yFor(tick) + labelGap}
              fill={t.colors.inkFaint}
              fontSize={t.chart.axisFont}
              fontWeight="600"
              textAnchor="end"
            >
              {formatY(tick)}
            </SvgText>
          ))}

          {/* dashed reference line (e.g. 1.0× ideal) */}
          {referenceLine && referenceLine.value >= axis.min && referenceLine.value <= axis.max && (
            <>
              <Line
                x1={x0}
                y1={yFor(referenceLine.value)}
                x2={x1}
                y2={yFor(referenceLine.value)}
                stroke={t.colors.primary}
                strokeOpacity={t.chart.refOpacity}
                strokeWidth={t.chart.gridW}
                strokeDasharray="3 4"
              />
              <SvgText
                x={x1}
                y={yFor(referenceLine.value) - 5}
                fill={t.colors.primary}
                fontSize={t.chart.axisFont}
                fontWeight="700"
                textAnchor="end"
              >
                {referenceLine.label}
              </SvgText>
            </>
          )}

          {/* area + line */}
          {area ? <Path d={area} fill="url(#axisLineFill)" /> : null}
          {pts.length > 1 ? (
            <AnimatedPath
              d={line}
              fill="none"
              stroke={t.colors.primary}
              strokeWidth={t.chart.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={t.chart.strokeDash}
              animatedProps={lineProps}
            />
          ) : null}

          {/* interior data dots (only when sparse enough to read) */}
          {showDots &&
            pts.slice(0, -1).map((p, i) => (
              <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={t.chart.dot} fill={t.colors.primary} />
            ))}

          {/* emphasised endpoint node */}
          {last && (
            <Circle
              cx={last.x}
              cy={last.y}
              r={t.chart.endDot}
              fill={endColor}
              stroke={t.colors.surface}
              strokeWidth={t.chart.endRing}
            />
          )}

          {/* x-axis labels */}
          {xLabels.map((lab, i) => {
            const lastIdx = xLabels.length - 1;
            const frac = lastIdx === 0 ? 0 : i / lastIdx;
            const x = x0 + frac * (x1 - x0);
            const anchor = i === 0 ? 'start' : i === lastIdx ? 'end' : 'middle';
            return (
              <SvgText
                key={`xlab-${i}`}
                x={x}
                y={H - 4}
                fill={t.colors.inkFaint}
                fontSize={t.chart.axisFont}
                fontWeight="500"
                textAnchor={anchor}
              >
                {lab}
              </SvgText>
            );
          })}
        </Svg>
      )}
    </View>
  );
}
