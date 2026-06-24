import { useEffect, useState } from 'react';
import { View, TextInput, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  interpolate,
  Extrapolation,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import type { NiceAxis } from '@/src/lib/chartAxis';

// ──────────────────────────────────────────────────────────────────────────────
// AxisLineChart — a small but REAL line chart: a labelled, discrete y-axis with
// gridline rules, x-axis labels, a smooth line + soft area, and an emphasised
// endpoint node. Renders at the measured pixel width (no preserveAspectRatio
// stretching), so the stroke stays an even weight and dots stay round.
//
// Live: the endpoint breathes a soft amber halo (ambient, no overshoot), and you
// can press-drag across the plot to scrub — a crosshair + dot track your finger
// and a bubble reads the exact value at that point. All motion runs on the UI
// thread; horizontal drags scrub while vertical drags still scroll the page.
//
// The line draws on left→right on appear (path stroke-dash, reduced-motion safe);
// nothing slides or bounces. The visible caption beside each use is the text
// alternative, so the SVG is hidden from the a11y tree.
// ──────────────────────────────────────────────────────────────────────────────

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

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
  /** Endpoint node colour. Defaults to the amber accent. */
  endpointColor?: string;
  /** Decimals for the scrub bubble value (0 → "68", 1 → "1.2"). */
  valueDecimals?: number;
  /** Suffix for the scrub bubble value ("%", "×"). */
  valueSuffix?: string;
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

const BUBBLE_W = 56;

export function AxisLineChart({
  values,
  axis,
  formatY,
  xLabels,
  referenceLine,
  endpointColor,
  valueDecimals = 0,
  valueSuffix = '',
  height,
}: AxisLineChartProps) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);

  const H = height ?? t.chart.height;
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));

  // Plot frame (in measured pixels — 1:1, no viewBox distortion).
  const x0 = t.chart.gutter;
  const x1 = Math.max(x0 + 1, w - t.chart.rightPad);
  const yTop = t.chart.topPad;
  const yBot = H - t.chart.xLabelH;
  const span = Math.max(1e-6, axis.max - axis.min);
  const aMin = axis.min;
  const yFor = (v: number) => {
    const c = Math.min(axis.max, Math.max(aMin, v));
    return yTop + (1 - (c - aMin) / span) * (yBot - yTop);
  };
  const n = values.length;
  const xFor = (i: number) => (n <= 1 ? (x0 + x1) / 2 : x0 + (i / (n - 1)) * (x1 - x0));
  const pts = values.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const last = pts[pts.length - 1];
  const showDots = n > 1 && n <= 8;
  const labelGap = t.chart.axisFont * 0.36; // optical vertical centring for SVG text

  const line = smoothPath(pts);
  const area = pts.length > 1 && last ? `${line} L${last.x},${yBot} L${pts[0]!.x},${yBot} Z` : '';
  const endColor = endpointColor ?? t.colors.accent;

  // ── line draw-on ──────────────────────────────────────────────────────────
  const dash = useSharedValue(reduced ? 0 : t.chart.strokeDash);
  useEffect(() => {
    if (reduced) return;
    dash.set(withTiming(0, { duration: t.motion.draw }));
  }, [dash, reduced, t.motion.draw]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: dash.get() }));

  // ── ambient endpoint pulse (breathing halo; no overshoot) ───────────────────
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced || w === 0) return;
    pulse.set(0);
    pulse.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, false));
  }, [pulse, reduced, w]);
  const haloProps = useAnimatedProps(() => ({
    r: t.chart.endDot + interpolate(pulse.get(), [0, 1], [0, t.chart.pulseR], Extrapolation.CLAMP),
    opacity: interpolate(pulse.get(), [0, 0.15, 1], [0, t.chart.pulseOpacity, 0], Extrapolation.CLAMP),
  }));

  // ── press-drag scrub ────────────────────────────────────────────────────────
  // Worklet helpers close over the plot primitives; horizontal drags scrub, so a
  // vertical drag is left to the surrounding ScrollView (activeOffsetX).
  const vals = values;
  const aMax = axis.max;
  const yAtPx = (sx: number) => {
    'worklet';
    if (n <= 1) return (yTop + yBot) / 2;
    const f = ((sx - x0) / (x1 - x0)) * (n - 1);
    const i = Math.max(0, Math.min(n - 2, Math.floor(f)));
    const frac = f - i;
    const v = vals[i]! * (1 - frac) + vals[i + 1]! * frac;
    const c = Math.min(aMax, Math.max(aMin, v));
    return yTop + (1 - (c - aMin) / span) * (yBot - yTop);
  };
  const vAtPx = (sx: number) => {
    'worklet';
    if (n === 0) return 0;
    if (n === 1) return vals[0]!;
    const f = ((sx - x0) / (x1 - x0)) * (n - 1);
    const i = Math.max(0, Math.min(n - 2, Math.floor(f)));
    const frac = f - i;
    return vals[i]! * (1 - frac) + vals[i + 1]! * frac;
  };

  const scrubX = useSharedValue(0);
  const active = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      scrubX.set(Math.min(x1, Math.max(x0, e.x)));
    })
    .onUpdate((e) => {
      scrubX.set(Math.min(x1, Math.max(x0, e.x)));
      active.set(withTiming(1, { duration: 120 }));
    })
    .onFinalize(() => {
      active.set(withTiming(0, { duration: 220 }));
    });

  const crosshairProps = useAnimatedProps(() => ({ x1: scrubX.get(), x2: scrubX.get(), opacity: active.get() }));
  const scrubDotProps = useAnimatedProps(() => ({ cx: scrubX.get(), cy: yAtPx(scrubX.get()), opacity: active.get() }));
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: active.get(),
    transform: [{ translateX: Math.min(w - BUBBLE_W, Math.max(0, scrubX.get() - BUBBLE_W / 2)) }],
  }));
  const bubbleTextProps = useAnimatedProps(() => {
    const txt = `${vAtPx(scrubX.get()).toFixed(valueDecimals)}${valueSuffix}`;
    return { text: txt, defaultValue: txt } as never;
  });

  return (
    <View
      onLayout={onLayout}
      style={{ height: H }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w > 0 && (
        <GestureDetector gesture={pan}>
          <View style={{ width: w, height: H }}>
            {/* scrub value bubble (above the plot, follows the finger) */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: BUBBLE_W,
                  alignItems: 'center',
                  zIndex: 2,
                },
                bubbleStyle,
              ]}
            >
              <AnimatedTextInput
                editable={false}
                pointerEvents="none"
                underlineColorAndroid="transparent"
                animatedProps={bubbleTextProps}
                style={{
                  minWidth: BUBBLE_W,
                  textAlign: 'center',
                  color: t.colors.ink,
                  backgroundColor: t.colors.surfaceRaised,
                  borderRadius: t.radii.sm,
                  borderCurve: 'continuous',
                  paddingVertical: t.space[0.5],
                  paddingHorizontal: t.space[2],
                  fontSize: t.chart.axisFont + 2,
                  fontWeight: '700',
                  overflow: 'hidden',
                }}
              />
            </Animated.View>

            <Svg width={w} height={H}>
              <Defs>
                <LinearGradient id="axisLineFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={t.colors.primary} stopOpacity={t.chart.areaOpacity} />
                  <Stop offset="1" stopColor={t.colors.primary} stopOpacity={0} />
                </LinearGradient>
              </Defs>

              {/* gridline rules + y-axis labels */}
              {axis.ticks.map((tick) => (
                <Line
                  key={`grid-${tick}`}
                  x1={x0}
                  y1={yFor(tick)}
                  x2={x1}
                  y2={yFor(tick)}
                  stroke={t.colors.hairline}
                  strokeWidth={t.chart.gridW}
                />
              ))}
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

              {/* emphasised endpoint node + breathing amber halo */}
              {last && (
                <>
                  <AnimatedCircle cx={last.x} cy={last.y} fill={endColor} animatedProps={haloProps} />
                  <Circle
                    cx={last.x}
                    cy={last.y}
                    r={t.chart.endDot}
                    fill={endColor}
                    stroke={t.colors.surface}
                    strokeWidth={t.chart.endRing}
                  />
                </>
              )}

              {/* scrub crosshair + active dot */}
              <AnimatedLine
                y1={yTop}
                y2={yBot}
                stroke={t.colors.inkSoft}
                strokeWidth={t.chart.crosshairW}
                strokeDasharray="2 3"
                animatedProps={crosshairProps}
              />
              <AnimatedCircle
                r={t.chart.endDot}
                fill={endColor}
                stroke={t.colors.surface}
                strokeWidth={t.chart.endRing}
                animatedProps={scrubDotProps}
              />

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
          </View>
        </GestureDetector>
      )}
    </View>
  );
}
