import { View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { TIMER_RANGE_ARC_ENABLED } from '@/src/engine';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';
import { AnimatedNumeral } from './AnimatedNumeral';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ──────────────────────────────────────────────────────────────────────────────
// TimerRing — the 258px focus ring stage.
//
// The animated layer reads `elapsedSec` / `overProgress` shared values on the UI
// thread (driven by useTimer's frame callback):
//   • progress ring  — strokeDashoffset fills toward the honest estimate; amber on overrun
//   • center numeral — m:ss (1h05 past an hour), driven by the shared value
//     (AnimatedNumeral, no setState)
//
// Behind the progress fill sits an OPTIONAL faint amber range arc straddling the
// finish — it shows the honest [low, high] spread the task tends to land in while
// the model is still learning (Pro). The whole arc is gated behind
// TIMER_RANGE_ARC_ENABLED so it removes cleanly in one place. There is no static
// guess tick — it read as a notch cut into the track.
// ──────────────────────────────────────────────────────────────────────────────

const SIZE = 258;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function TimerRing({
  elapsedSec,
  overProgress,
  estimateSec,
  range = null,
  confidence,
  isPro = false,
}: {
  elapsedSec: SharedValue<number>;
  overProgress: SharedValue<number>;
  estimateSec: number;
  /** Honest finish spread for the running category; null = no usable range. */
  range?: HonestRange | null;
  /** Earned-Readiness of the running category. Settled ('honest') → no arc. */
  confidence?: CalibrationConfidence;
  /** Pro gates the range arc; free users see the bare ring. */
  isPro?: boolean;
}) {
  const t = useTheme();
  const indigo = t.colors.primary;
  const amber = t.colors.accent;

  // 0→1 fraction of the estimate elapsed, clamped at full ring on overrun.
  const fraction = useDerivedValue(() => {
    if (estimateSec <= 0) return 1;
    const f = elapsedSec.value / estimateSec;
    return f > 1 ? 1 : f;
  }, [estimateSec]);

  // Centre clock — M:SS under an hour, "1h05" past one (the `h` separator so it
  // can't be misread as minutes:seconds, and long sessions never overflow to
  // "200:00"). Formatted on the UI thread (worklet) and written straight to the
  // native text, so there is still zero per-second React re-render. Kept inline
  // and self-contained — see `formatTimerClock` in lib/time for the tested mirror
  // (a helper called inside a worklet needs a 'worklet' directive and can crash).
  const clock = useDerivedValue(() => {
    const total = elapsedSec.value;
    if (total >= 3600) {
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      return `${h}h${m < 10 ? '0' : ''}${m}`;
    }
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }, []);

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - fraction.value),
    stroke: overProgress.value === 1 ? amber : indigo,
  }));

  // ── Amber honest-range arc (isolated so flipping the constant removes it) ──────
  // A static arc straddling the finish (top, where the fill completes at 100%),
  // spanning the honest [low, high] fractions of the estimate. Drawn UNDER the
  // progress fill so the indigo overlays it as the session advances.
  const showRangeArc =
    TIMER_RANGE_ARC_ENABLED &&
    isPro &&
    range != null &&
    confidence !== 'honest' &&
    estimateSec > 0;
  const rangeArc = showRangeArc && range != null
    ? (() => {
        const lowFrac = (range.lowMinutes * 60) / estimateSec;
        const highFrac = (range.highMinutes * 60) / estimateSec;
        const arcLen = Math.max(0, highFrac - lowFrac) * CIRCUMFERENCE;
        return { lowFrac, arcLen };
      })()
    : null;

  const stage: ViewStyle = {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  };

  const center: ViewStyle = {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const numeralStyle: TextStyle = {
    ...(type.timerClock as unknown as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
    // AnimatedNumeral colour flips to amber on overrun internally.
  };

  const targetMin = Math.max(1, Math.round(estimateSec / 60));

  return (
    <View
      style={stage}
      accessibilityRole="timer"
      accessibilityLabel={`Timer running. Honest target about ${targetMin} ${targetMin === 1 ? 'minute' : 'minutes'}. Elapsed time is shown in the center.`}
    >
      <Svg width={SIZE} height={SIZE} accessible={false}>
        {/* Track ring (hairline) */}
        <Circle
          cx={CX}
          cy={CY}
          r={R}
          stroke={t.colors.hairline}
          strokeWidth={STROKE}
          fill="none"
        />

        {/* Honest-range straddle arc — behind the progress fill (Pro, learning). */}
        {rangeArc ? (
          <Circle
            cx={CX}
            cy={CY}
            r={R}
            stroke={amber}
            strokeOpacity={t.opacity.rangeArc}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="butt"
            strokeDasharray={`${rangeArc.arcLen} ${CIRCUMFERENCE}`}
            originX={CX}
            originY={CY}
            rotation={-90 + rangeArc.lowFrac * 360}
          />
        ) : null}

        {/* Progress ring — fills toward the estimate; amber on overrun.
            Rotated -90° so it starts at 12 o'clock. */}
        <AnimatedCircle
          cx={CX}
          cy={CY}
          r={R}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          originX={CX}
          originY={CY}
          rotation={-90}
          animatedProps={progressProps}
        />
      </Svg>

      {/* Center label — numeral driven by the shared value, no setState. */}
      <View style={center} pointerEvents="none">
        <AnimatedNumeral
          text={clock}
          overProgress={overProgress}
          style={numeralStyle}
          amberColor={amber}
          inkColor={t.colors.ink}
          defaultText="0:00"
        />
      </View>
    </View>
  );
}
