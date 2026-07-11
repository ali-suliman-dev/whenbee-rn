import { View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
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
// A single STATIC faint tick marks where the user's GUESS falls on the ring (so the
// gap between "what I guessed" and "the honest target the ring fills toward" is
// visible). No orbiting dot — it read as a notch in the track. (An amber honest-range
// straddle arc was tried here but pulled: the [low,high] band always crosses the
// 12-o'clock start seam, so it wrapped over the ring's start and read as broken. The
// finish spread still shows precisely in the ledger's finish row.)
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
  guessMin,
}: {
  elapsedSec: SharedValue<number>;
  overProgress: SharedValue<number>;
  estimateSec: number;
  /** The original guess (minutes) — marked as a static tick on the ring so the gap
   *  to the honest target the ring fills toward is visible. */
  guessMin: number;
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

  // Static guess tick — where the original guess sits relative to the honest target
  // the ring fills toward. Angle measured clockwise from 12 o'clock. Hidden when the
  // guess equals the target (frac→1) or is unknown (no useful position to mark).
  const guessFrac =
    estimateSec > 0 ? Math.min(1, Math.max(0, (guessMin * 60) / estimateSec)) : 0;
  const showTick = guessFrac > 0.02 && guessFrac < 0.98;
  const ang = guessFrac * 2 * Math.PI;
  const rIn = R - STROKE / 2 - 1;
  const rOut = R + STROKE / 2 + 1;
  const tx1 = CX + rIn * Math.sin(ang);
  const ty1 = CY - rIn * Math.cos(ang);
  const tx2 = CX + rOut * Math.sin(ang);
  const ty2 = CY - rOut * Math.cos(ang);

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

        {/* Static guess tick across the stroke band. */}
        {showTick && (
          <Line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke={t.colors.inkFaint} strokeWidth={2} />
        )}
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
