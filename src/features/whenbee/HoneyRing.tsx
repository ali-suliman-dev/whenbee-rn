import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSequence,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Honey ring around the bee. Track + amber fill arc to `sharpness%` (clamped,
// with the endowed-sliver floor so Raw is never a cold empty circle). Centered
// children (the bee slot). When sealed, a flat wax-seal hex overlays the bee.
// No glow — flat-tactical only.
//
// Animation: on mount the fill arc animates from endowedPct to the target over
// motion.ringFill with easing.honey. A flat amber head-dot rides the arc to the
// landing point; on landing the stroke "pops" (thicken → restore). Both the
// head-dot and the stroke pop are skipped under useReducedMotion(). Monotonic:
// the shared value only ever moves upward (never animates down).
export function HoneyRing({
  sharpness,
  sealed,
  children,
}: {
  sharpness: number;
  sealed: boolean;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const S = t.ring.size;
  // Widen to `number` so the shared value accepts the full popStroke range.
  const sw: number = t.ring.stroke;
  const r = (S - sw) / 2;
  const cx = S / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(t.ring.endowedPct, Math.min(100, sharpness));

  const reduced = useReducedMotion();

  // Monotonic: start at endowedPct (or pct if reduced) — never animate down.
  const progress = useSharedValue(reduced ? pct : t.ring.endowedPct);
  const stroke = useSharedValue(sw);

  useEffect(() => {
    if (reduced) {
      progress.set(pct);
      return;
    }
    // Only animate forward (monotonic guarantee).
    if (pct > progress.get()) {
      progress.set(withTiming(pct, { duration: t.motion.ringFill, easing: t.motion.easing.honey }));
    }
  }, [pct, reduced, progress, t.motion.ringFill, t.motion.easing.honey]);

  useEffect(() => {
    if (reduced) return;
    // Pop the stroke once, timed to land with the fill.
    const delay = t.motion.ringFill - t.motion.strokePop / 2;
    const id = setTimeout(() => {
      stroke.set(
        withSequence(
          withTiming(t.ring.popStroke, { duration: t.motion.strokePop / 2, easing: t.motion.easing.honey }),
          withTiming(sw, { duration: t.motion.strokePop / 2, easing: t.motion.easing.honey }),
        ),
      );
    }, delay);
    return () => clearTimeout(id);
  }, [reduced, stroke, sw, t.ring.popStroke, t.motion.strokePop, t.motion.ringFill, t.motion.easing.honey]);

  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.get() / 100),
    strokeWidth: stroke.get(),
  }));

  // Head-dot position: translate from the wrap centre onto the arc.
  // angle = -90° + progress% × 3.6° (0% = 12-o'clock). Invisible under reduced motion.
  const headStyle = useAnimatedStyle(() => {
    const ang = ((-90 + (progress.get() / 100) * 360) * Math.PI) / 180;
    return {
      opacity: reduced ? 0 : 1,
      transform: [
        { translateX: r * Math.cos(ang) },
        { translateY: r * Math.sin(ang) },
      ],
    };
  });

  const wrap: ViewStyle = {
    width: S,
    height: S,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const svgAbsolute: ViewStyle = { position: 'absolute' };

  const dotSize = t.ring.headDot;

  return (
    <View style={wrap}>
      <View style={svgAbsolute} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={S} height={S}>
          <Defs>
            <LinearGradient id="honeyGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={t.brand.bee.stripe} />
              <Stop offset="1" stopColor={t.colors.accent} />
            </LinearGradient>
          </Defs>
          {/* rotate -90° so the fill arc starts at 12 o'clock */}
          <G rotation={-90} origin={`${cx}, ${cx}`}>
            <Circle
              cx={cx}
              cy={cx}
              r={r}
              stroke={t.colors.ringTrack}
              strokeWidth={sw}
              fill="none"
            />
            <AnimatedCircle
              cx={cx}
              cy={cx}
              r={r}
              stroke="url(#honeyGrad)"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={fillProps}
            />
          </G>
          {sealed ? <SealHex cx={cx} size={t.seal.size} color={t.colors.accent} /> : null}
        </Svg>
      </View>
      {/* Head-dot: flat solid amber circle riding the arc tip — no glow, no shadow */}
      {!reduced ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: dotSize,
              height: dotSize,
              borderRadius: t.radii.full,
              backgroundColor: t.colors.accentEdge,
            },
            headStyle,
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

// Flat-top hexagon stamped over the bee centre when the cap is sealed.
// Rendered as an SVG Polygon — no RN View, no glow, flat-tactical.
function SealHex({ cx, size, color }: { cx: number; size: number; color: string }) {
  const w = size;
  const h = size * 1.1;
  const x = cx - w / 2;
  const y = cx - h / 2;
  // Flat-top hexagon vertices (clockwise from top-left shoulder):
  const points = [
    [x + w * 0.5, y],
    [x + w, y + h * 0.25],
    [x + w, y + h * 0.75],
    [x + w * 0.5, y + h],
    [x, y + h * 0.75],
    [x, y + h * 0.25],
  ]
    .map((p) => p.join(','))
    .join(' ');

  return <Polygon points={points} fill={color} opacity={0.95} />;
}
