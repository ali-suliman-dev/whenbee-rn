import { View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AnimatedNumeral } from './AnimatedNumeral';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

// ──────────────────────────────────────────────────────────────────────────────
// TimerRing — the 258px focus ring stage.
//
// Everything animated reads `elapsedSec` / `overProgress` / `milestoneLatch`
// shared values on the UI thread (driven by useTimer's frame callback):
//   • progress ring  — strokeDashoffset fills toward the estimate; flips amber on overrun
//   • pace dot       — an orbiting dot, rotation = elapsed/estimate; amber on overrun
//   • milestone ring — a single amber ripple latched on at the guess
//   • center numeral — minutes, bumps each minute (AnimatedNumeral, no setState)
// Reduced motion: the pace dot + ripple are dropped; the ring/colour/number
// still update (they're driven by the same shared value, just no orbit/ripple).
// ──────────────────────────────────────────────────────────────────────────────

const SIZE = 258;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const DOT_R = 7;

export function TimerRing({
  elapsedSec,
  overProgress,
  milestoneLatch,
  estimateSec,
  guessMin,
}: {
  elapsedSec: SharedValue<number>;
  overProgress: SharedValue<number>;
  milestoneLatch: SharedValue<number>;
  estimateSec: number;
  guessMin: number;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const indigo = t.colors.primary;
  const amber = t.colors.accent;

  // 0→1 fraction of the estimate elapsed, clamped at full ring on overrun.
  const fraction = useDerivedValue(() => {
    if (estimateSec <= 0) return 1;
    const f = elapsedSec.value / estimateSec;
    return f > 1 ? 1 : f;
  }, [estimateSec]);

  // Whole elapsed minutes for the center numeral.
  const minutes = useDerivedValue(() => Math.floor(elapsedSec.value / 60), []);

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - fraction.value),
    stroke: overProgress.value === 1 ? amber : indigo,
  }));

  // Pace dot orbits from 12 o'clock; rotation in degrees = fraction * 360.
  const dotGroupProps = useAnimatedProps(() => ({
    // SVG rotate(deg, cx, cy)
    transform: `rotate(${fraction.value * 360} ${CX} ${CY})`,
  }));

  const dotProps = useAnimatedProps(() => ({
    fill: overProgress.value === 1 ? amber : indigo,
  }));

  // Milestone ripple — a faint amber ring that appears once latched at the guess.
  const milestoneProps = useAnimatedProps(() => ({
    opacity: milestoneLatch.value === 1 ? 0.5 : 0,
    r: R + 10,
  }));

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
    ...(type.timerNumeral as unknown as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
    // AnimatedNumeral colour flips to amber on overrun internally.
  };

  const unitStyle: TextStyle = {
    ...(type.eyebrow as TextStyle),
    color: t.colors.inkSoft,
    marginTop: 2,
  };

  const guessStyle: TextStyle = {
    ...(type.caption as TextStyle),
    color: t.colors.inkSoft,
    marginTop: 6,
  };

  return (
    <View style={stage}>
      <Svg width={SIZE} height={SIZE}>
        {/* Track ring (hairline) */}
        <Circle
          cx={CX}
          cy={CY}
          r={R}
          stroke={t.colors.hairline}
          strokeWidth={STROKE}
          fill="none"
        />

        {/* Milestone ripple — drawn under the progress ring, amber, latched */}
        {!reducedMotion && (
          <AnimatedCircle
            cx={CX}
            cy={CY}
            stroke={amber}
            strokeWidth={2}
            fill="none"
            animatedProps={milestoneProps}
          />
        )}

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

        {/* Orbiting pace dot (dropped under reduced motion). */}
        {!reducedMotion && (
          <AnimatedG animatedProps={dotGroupProps}>
            <AnimatedCircle cx={CX} cy={CY - R} r={DOT_R} animatedProps={dotProps} />
          </AnimatedG>
        )}
      </Svg>

      {/* Center label — numeral driven by the shared value, no setState. */}
      <View style={center} pointerEvents="none">
        <AnimatedNumeral
          minutes={minutes}
          overProgress={overProgress}
          style={numeralStyle}
          amberColor={amber}
          inkColor={t.colors.ink}
        />
        <Animated.Text style={unitStyle}>MINUTES</Animated.Text>
        <Animated.Text style={guessStyle}>you guessed {guessMin}</Animated.Text>
      </View>
    </View>
  );
}
