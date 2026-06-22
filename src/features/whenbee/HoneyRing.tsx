import { useEffect, useMemo, useRef } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  useReducedMotion,
  type EasingFunctionFactory,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { useIsScreenFocused } from '@/src/hooks/useIsScreenFocused';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── pure helper: flat-top hexagon vertices within a 0..size box (clockwise) ──
function hexPoints(size: number): string {
  const w = size;
  const h = size * 1.1;
  return [
    [w * 0.5, 0],
    [w, h * 0.25],
    [w, h * 0.75],
    [w * 0.5, h],
    [0, h * 0.75],
    [0, h * 0.25],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

// Honey ring around the bee. Track + amber fill arc to `sharpness%` (clamped,
// with the endowed-sliver floor so Raw is never a cold empty circle). Centered
// children (the bee slot). When sealed, a flat wax-seal hex overlays the bee.
// No glow — flat-tactical only.
//
// Animation: the intro fill arc animates from endowedPct to the target over
// motion.ringFill with easing.honey. Afterward the arc only *animates* growth the
// user can actually see — while the screen is focused. Sharpness earned while the
// hub is off-screen lands already-full on arrival (snap, no replay), so honey is
// never spent celebrating to an empty room. A flat amber head-dot rides the arc to
// the landing point; on landing the stroke "pops" (thicken → restore). Both the
// head-dot and the stroke pop are skipped under useReducedMotion(). Monotonic:
// the shared value only ever moves upward (never animates down).
//
// Seal ceremony: when `sealed` becomes true (or on first mount already sealed),
// the hex stamps in (scale 2.2→1, opacity 0→0.95), three thin concentric ripple
// rings expand staggered, and `mote.count` flat squares flick outward. Under
// reduced motion: hex just fades in; no ripples, no motes.
export function HoneyRing({
  sharpness,
  sealed,
  children,
  size,
  stroke: strokeProp,
}: {
  sharpness: number;
  sealed: boolean;
  children: React.ReactNode;
  size?: number;
  stroke?: number;
}) {
  const t = useTheme();
  const S = size ?? t.ring.size;
  // Widen to `number` so the shared value accepts the full popStroke range.
  const sw: number = strokeProp ?? t.ring.stroke;
  const r = (S - sw) / 2;
  const cx = S / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(t.ring.endowedPct, Math.min(100, sharpness));

  const reduced = useReducedMotion();
  const focused = useIsScreenFocused();
  // The intro fill (endowedPct → first real value) always plays — it's the one
  // beloved "honey pours in" moment. After that, only growth earned while the
  // user is *watching* animates; growth earned off-screen is already-full on
  // arrival (snap, no replay).
  const introDone = useRef(false);

  // Monotonic: start at endowedPct (or pct if reduced) — never animate down.
  const progress = useSharedValue(reduced ? pct : t.ring.endowedPct);
  const stroke = useSharedValue(sw);
  // Pop target scales with the active stroke (= t.ring.popStroke at the default).
  const popStroke = sw * (t.ring.popStroke / t.ring.stroke);

  useEffect(() => {
    if (reduced) {
      progress.set(pct);
      introDone.current = true;
      return;
    }
    // Only ever move forward (monotonic guarantee).
    if (pct <= progress.get()) return;

    if (!introDone.current || focused) {
      // Intro fill, or live growth the user can see → animate.
      progress.set(withTiming(pct, { duration: t.motion.ringFill, easing: t.motion.easing.honey }));
    } else {
      // Grew while off-screen → land already-full, no celebratory replay.
      progress.set(pct);
    }
    introDone.current = true;
  }, [pct, focused, reduced, progress, t.motion.ringFill, t.motion.easing.honey]);

  useEffect(() => {
    if (reduced) return;
    // Pop the stroke once, timed to land with the fill.
    const delay = t.motion.ringFill - t.motion.strokePop / 2;
    const id = setTimeout(() => {
      stroke.set(
        withSequence(
          withTiming(popStroke, { duration: t.motion.strokePop / 2, easing: t.motion.easing.honey }),
          withTiming(sw, { duration: t.motion.strokePop / 2, easing: t.motion.easing.honey }),
        ),
      );
    }, delay);
    return () => clearTimeout(id);
  }, [reduced, stroke, sw, popStroke, t.motion.strokePop, t.motion.ringFill, t.motion.easing.honey]);

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

  // ── Seal hex entrance animation ──────────────────────────────────────────────
  // On mount (or when sealed flips true): stamp in from scale 2.2→1.
  // Reduced motion: instant fade-in only (no scale change).
  const sealScale = useSharedValue(sealed && reduced ? 1 : sealed ? 2.2 : 1);
  const sealOpacity = useSharedValue(sealed && reduced ? 0.95 : 0);

  useEffect(() => {
    if (!sealed) return;
    if (reduced) {
      sealOpacity.set(0.95);
      sealScale.set(1);
      return;
    }
    sealOpacity.set(withTiming(0.95, { duration: t.motion.sealSeq * 0.4, easing: t.motion.easing.honey }));
    sealScale.set(withTiming(1, { duration: t.motion.sealSeq * 0.5, easing: t.motion.easing.honey }));
  }, [sealed, reduced, sealOpacity, sealScale, t.motion.sealSeq, t.motion.easing.honey]);

  const sealStyle = useAnimatedStyle(() => ({
    opacity: sealOpacity.get(),
    transform: [{ scale: sealScale.get() }],
  }));

  // ── Motes: flat solid squares flick outward (only when sealed && !reduced) ──
  const moteIndices = useMemo(() => Array.from({ length: t.mote.count }, (_, i) => i), [t.mote.count]);

  const wrap: ViewStyle = {
    width: S,
    height: S,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const svgAbsolute: ViewStyle = { position: 'absolute' };

  const dotSize = S * (t.ring.headDot / t.ring.size);
  const sealW = S * (t.seal.size / t.ring.size);
  const sealH = sealW * 1.1;

  return (
    <View style={wrap}>
      {/* ── SVG layer: track + fill arc ── */}
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
      {/* Ripples: three thin outline rings expanding outward (skipped under reduced motion) */}
      {sealed && !reduced ? (
        <>
          <Ripple delay={0} ringSize={S} t={t} />
          <Ripple delay={t.motion.sealSeq * 0.15} ringSize={S} t={t} />
          <Ripple delay={t.motion.sealSeq * 0.3} ringSize={S} t={t} />
        </>
      ) : null}
      {/* Motes: flat solid squares flick outward (skipped under reduced motion) */}
      {sealed && !reduced
        ? moteIndices.map((i) => (
            <Mote
              key={i}
              index={i}
              count={t.mote.count}
              distance={S * (t.mote.distance / t.ring.size)}
              size={S * (t.mote.size / t.ring.size)}
              color={t.colors.accent}
              sealSeq={t.motion.sealSeq}
              easing={t.motion.easing.honey}
            />
          ))
        : null}
      {/* Seal hex overlay: Animated.View so it transforms independently of the SVG */}
      {sealed ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute' }, sealStyle]}
        >
          <Svg width={sealW} height={sealH}>
            <Polygon points={hexPoints(sealW)} fill={t.colors.accent} />
          </Svg>
        </Animated.View>
      ) : null}
      {children}
    </View>
  );
}

// ── Ripple sub-component ─────────────────────────────────────────────────────
// A single thin concentric outline ring that expands from 0.5× to 1.5× the
// ring diameter and fades to transparent. Stagger via `delay`.
function Ripple({ delay, ringSize, t }: { delay: number; ringSize: number; t: ReturnType<typeof useTheme> }) {
  const s = useSharedValue(0.5);
  const o = useSharedValue(0.5);

  useEffect(() => {
    s.set(withDelay(delay, withTiming(1.5, { duration: t.motion.sealSeq, easing: t.motion.easing.honey })));
    o.set(withDelay(delay, withTiming(0, { duration: t.motion.sealSeq, easing: t.motion.easing.honey })));
  }, [delay, s, o, t.motion.sealSeq, t.motion.easing.honey]);

  const st = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [{ scale: s.get() }],
  }));

  const size = ringSize * 0.72;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: t.borderWidth.thick,
          borderColor: t.colors.accent,
        },
        st,
      ]}
    />
  );
}

// ── Mote sub-component ───────────────────────────────────────────────────────
// A single flat solid square that flicks outward along a radial angle.
// angle = -90 + index × (360 / count) so motes distribute evenly from 12-o'clock.
// NO glow, NO boxShadow — flat-tactical only.
function Mote({
  index,
  count,
  distance,
  size,
  color,
  sealSeq,
  easing,
}: {
  index: number;
  count: number;
  distance: number;
  size: number;
  color: string;
  sealSeq: number;
  easing: EasingFunctionFactory | ((t: number) => number);
}) {
  const angleDeg = -90 + index * (360 / count);
  const angleRad = (angleDeg * Math.PI) / 180;
  const targetX = Math.cos(angleRad) * distance;
  const targetY = Math.sin(angleRad) * distance;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const o = useSharedValue(0);

  useEffect(() => {
    const motDelay = 300 + index * 40;
    tx.set(withDelay(motDelay, withTiming(targetX, { duration: sealSeq * 0.5, easing })));
    ty.set(withDelay(motDelay, withTiming(targetY, { duration: sealSeq * 0.5, easing })));
    o.set(withDelay(motDelay, withTiming(1, { duration: sealSeq * 0.2, easing })));
  }, [index, targetX, targetY, tx, ty, o, sealSeq, easing]);

  const st = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          backgroundColor: color,
        },
        st,
      ]}
    />
  );
}
