import { View, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
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
}

const FW_WAKING_START_MIN = 300;  // 05:00
const FW_WAKING_END_MIN = 1440;  // 24:00
const FW_WAKING_RANGE = FW_WAKING_END_MIN - FW_WAKING_START_MIN; // 1140 min
const BIN_COUNT = 38;

// Time-axis labels: 6a/9a/12p/3p/6p/9p at hours 6,9,12,15,18,21
const AXIS_HOURS = [6, 9, 12, 15, 18, 21];
const AXIS_LABELS = ['6a', '9a', '12p', '3p', '6p', '9p'];

const ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

export function FocusCurve({ scoreByBin, variant, windowStartMin, windowEndMin }: FocusCurveProps) {
  const t = useTheme();
  const { viewH, viewW, strokeW, dotR, bandOpacity, areaOpacity, yPad, yBase, dash, axisH, axisGap, axisLabelW } = t.focusCurve;

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

  // Peak dot position (argmax)
  let peakIdx = 0;
  let peakScore = -1;
  for (let i = 0; i < scores.length; i++) {
    if ((scores[i] ?? 0) > peakScore) {
      peakScore = scores[i] ?? 0;
      peakIdx = i;
    }
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

  return (
    <Animated.View entering={ENTER} style={containerStyle}>
      <Svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width="100%"
        height={viewH}
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
    </Animated.View>
  );
}
