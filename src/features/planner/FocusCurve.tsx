import { View, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { tokens } from '@/src/theme/tokens';

// ──────────────────────────────────────────────────────────────────────────────
// FocusCurve — SVG illustration of the user's learned focus window.
//
// Variants:
//   forming  — dashed primarySoft2 stroke, time-axis labels, NO band/peak dot.
//              Shown while data accumulates (basis === 'prior').
//   learned  — solid primary stroke + area gradient + window band + peak dot.
//              Shown when the engine has a personal window.
//   locked   — solid primarySoft2 stroke, no band or axis labels.
//              Parent overlays a frost scrim. Shown when learned but user is free.
//
// 38 bins span the waking range 05:00–24:00 (300–1440 min) at 30-min resolution.
// ──────────────────────────────────────────────────────────────────────────────

export interface FocusCurveProps {
  scoreByBin: number[];
  variant: 'forming' | 'learned' | 'locked';
  windowStartMin?: number;
  windowEndMin?: number;
  yAxis?: boolean;
  peakLabel?: string;
  /** Rendered SVG height (pt). Defaults to t.focusCurve.viewH. The internal
   *  viewBox stays viewW×viewH so path math is unchanged — the SVG scales. */
  height?: number;
  /** When provided, positions the peak dot + label at this minute instead of
   *  the curve's internal normalized argmax (e.g. the engine's eligible-bin peak). */
  peakMin?: number;
}

const FW_WAKING_START_MIN = 300;  // 05:00
const FW_WAKING_END_MIN = 1440;  // 24:00
const FW_WAKING_RANGE = FW_WAKING_END_MIN - FW_WAKING_START_MIN; // 1140 min
const BIN_COUNT = 38;

// Time-axis labels: 6a/9a/12p/3p/6p/9p at hours 6,9,12,15,18,21
const AXIS_HOURS = [6, 9, 12, 15, 18, 21];
const AXIS_LABELS = ['6a', '9a', '12p', '3p', '6p', '9p'];

const ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

export function FocusCurve({
  scoreByBin,
  variant,
  windowStartMin,
  windowEndMin,
  yAxis = false,
  peakLabel,
  height,
  peakMin,
}: FocusCurveProps) {
  const t = useTheme();
  const {
    viewH,
    viewW,
    strokeW,
    dotR,
    bandOpacity,
    areaOpacity,
    yPad,
    yBase,
    dash,
    axisH,
    axisGap,
    axisLabelW,
    gridW,
    gridTop,
    yLabelW,
    peakLabelGap,
    peakLabelMinY,
  } = t.focusCurve;
  const svgHeight = height ?? viewH;

  // x maps bin index → SVG x coordinate
  const x = (i: number) => (i / (BIN_COUNT - 1)) * viewW;
  // y maps score [0,1] → SVG y coordinate (high score = low y = tall bar)
  const y = (v: number) => viewH - v * (viewH - yBase) - yPad;

  // Guard: pad or trim scoreByBin to BIN_COUNT
  const scores = Array.from({ length: BIN_COUNT }, (_, i) => scoreByBin[i] ?? 0);

  // Build the curve path
  const firstX = x(0);
  const lastX = x(BIN_COUNT - 1);
  const curvePath = scores.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  const areaPath = `${curvePath} L${lastX},${viewH} L${firstX},${viewH} Z`;

  // Peak dot position: use the explicit peakMin (engine's eligible-bin peak)
  // when provided, otherwise fall back to the curve's own argmax.
  let peakIdx = 0;
  let peakScore = -1;
  for (let i = 0; i < scores.length; i++) {
    if ((scores[i] ?? 0) > peakScore) {
      peakScore = scores[i] ?? 0;
      peakIdx = i;
    }
  }
  if (peakMin !== undefined) {
    const bin = Math.round((peakMin - FW_WAKING_START_MIN) / 30);
    peakIdx = Math.min(BIN_COUNT - 1, Math.max(0, bin));
    peakScore = scores[peakIdx] ?? 0;
  }
  const peakX = x(peakIdx);
  const peakY = y(peakScore);

  // Window band x coordinates (learned variant)
  let bandX1 = 0;
  let bandX2 = 0;
  if (windowStartMin !== undefined && windowEndMin !== undefined) {
    const startBin = (windowStartMin - FW_WAKING_START_MIN) / 30;
    const endBin = (windowEndMin - FW_WAKING_START_MIN) / 30;
    bandX1 = x(Math.max(0, startBin));
    bandX2 = x(Math.min(BIN_COUNT - 1, endBin));
  }

  // Stroke color + style per variant
  const strokeColor =
    variant === 'learned' ? t.colors.primary : t.colors.primarySoft2;
  const strokeDasharray = variant === 'forming' ? dash : undefined;

  const showBand = variant === 'learned' && windowStartMin !== undefined && windowEndMin !== undefined;
  const showArea = variant === 'learned';
  const showPeak = variant === 'learned';
  const showAxis = variant !== 'locked';

  const containerStyle: ViewStyle = { width: '100%' };

  const axisRowStyle: ViewStyle = {
    flexDirection: 'row',
    position: 'relative',
    height: axisH,
    marginTop: axisGap,
  };

  const axisLabelStyle: TextStyle = {
    position: 'absolute',
    fontSize: t.fontSize.micro,
    color: t.colors.inkFaint,
    textAlign: 'center',
    width: axisLabelW,
  };

  const plot = (
    <>
      <Svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width="100%"
        height={svgHeight}
        accessibilityRole="image"
        accessibilityLabel="Focus window curve"
      >
        <Defs>
          {showArea && (
            <LinearGradient id="focusCurveArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.colors.primary} stopOpacity={areaOpacity} />
              <Stop offset="1" stopColor={t.colors.primary} stopOpacity={0} />
            </LinearGradient>
          )}
        </Defs>

        {/* Gridlines (opt-in via yAxis): 4 evenly-spaced lines from the top
            headroom band down to the baseline, so the peak sits framed below the
            top line with room for its label above the dot. */}
        {yAxis && [0, 1, 2, 3].map((i) => {
          const gy = gridTop + ((viewH - yPad - gridTop) * i) / 3;
          return <Path key={`grid-${i}`} d={`M0 ${gy} L${viewW} ${gy}`} stroke={t.colors.hairline} strokeWidth={gridW} />;
        })}

        {/* Window band (learned only) */}
        {showBand && (
          <Rect
            x={bandX1}
            y={0}
            width={bandX2 - bandX1}
            height={viewH}
            fill={t.colors.primaryWash}
            fillOpacity={bandOpacity}
          />
        )}

        {/* Area gradient fill (learned only) */}
        {showArea && (
          <Path
            d={areaPath}
            fill="url(#focusCurveArea)"
          />
        )}

        {/* Curve line */}
        <Path
          d={curvePath}
          stroke={strokeColor}
          strokeWidth={strokeW}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Peak dot (learned only) */}
        {showPeak && (
          <Circle
            cx={peakX}
            cy={peakY}
            r={dotR}
            fill={t.colors.primary}
          />
        )}

        {/* Peak label (opt-in via peakLabel) */}
        {showPeak && peakLabel ? (
          <SvgText
            x={peakX}
            y={Math.max(peakLabelMinY, peakY - dotR - peakLabelGap)}
            fill={t.colors.primary}
            fontSize={t.fontSize.micro}
            fontWeight="700"
            textAnchor="middle"
          >
            {peakLabel}
          </SvgText>
        ) : null}
      </Svg>

      {/* Time-axis labels */}
      {showAxis && (
        <View style={axisRowStyle}>
          {AXIS_HOURS.map((hour, idx) => {
            const fracPct = ((hour * 60 - FW_WAKING_START_MIN) / FW_WAKING_RANGE) * 100;
            return (
              <AppText
                key={hour}
                style={[axisLabelStyle, { left: `${fracPct}%` }]}
              >
                {AXIS_LABELS[idx]}
              </AppText>
            );
          })}
        </View>
      )}
    </>
  );

  return (
    <Animated.View entering={ENTER} style={containerStyle}>
      {yAxis ? (
        <View style={{ flexDirection: 'row', gap: t.space[2] }}>
          <View style={{ width: yLabelW, height: svgHeight, justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <AppText style={{ fontSize: t.fontSize.micro, color: t.colors.inkFaint }}>Hi</AppText>
            <AppText style={{ fontSize: t.fontSize.micro, color: t.colors.inkFaint }}>Low</AppText>
          </View>
          <View style={{ flex: 1 }}>{plot}</View>
        </View>
      ) : (
        plot
      )}
    </Animated.View>
  );
}
