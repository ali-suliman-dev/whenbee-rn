import { useCallback } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Path, Rect, G } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';

// ──────────────────────────────────────────────────────────────────────────────
// RayBurst — the soft radiating sunburst behind the Whenbee (brand reference:
// website 2.0 reward art). N alternating-opacity wedges fan from the centre; a
// radial-gradient vignette in the page-bg colour dissolves them outward, so the
// rays melt into the surface instead of ending in a hard ring. One ambient layer:
// the wedges drift one slow revolution (motion.drift) — alive, never spinning.
//
// Theme-adapted with ZERO mode branching: the wedge fill is `colors.rayFill` and
// the vignette is `colors.bg`, so the burst always matches the surface it sits on.
// Reduce-motion → static.
//
// This component owns NO header-avoidance logic. It is meant to render as the
// BACKMOST layer of a screen — page chrome (header, grabber, text) is z-ordered
// above it, so the rays can rotate fully and freely without ever covering text.
// (A top mask was tried and rejected: it blanked text and made the rotation
// flicker as wedges vanished into the masked band.)
// ──────────────────────────────────────────────────────────────────────────────

const VIEWBOX = 100;
const C = VIEWBOX / 2;
// Wedge radius overshoots the box so the corners fill; the View clips the rest.
const R = VIEWBOX;

/** Alternating-opacity sunburst wedges as SVG <Path>es, generated once per count. */
function wedges(count: number, fill: string, opacity: number, opacityAlt: number) {
  const step = (Math.PI * 2) / count;
  const paths = [];
  for (let i = 0; i < count; i++) {
    const a0 = i * step;
    const a1 = a0 + step;
    const x0 = C + R * Math.cos(a0);
    const y0 = C + R * Math.sin(a0);
    const x1 = C + R * Math.cos(a1);
    const y1 = C + R * Math.sin(a1);
    paths.push(
      <Path
        key={i}
        d={`M${C} ${C} L${x0} ${y0} L${x1} ${y1} Z`}
        fill={fill}
        fillOpacity={i % 2 === 0 ? opacity : opacityAlt}
      />,
    );
  }
  return paths;
}

export function RayBurst({ size }: { size: number }) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const { count, opacity, opacityAlt } = t.burst.ray;

  const spin = useSharedValue(0);

  useAmbientMotion(
    !reducedMotion,
    useCallback(() => {
      spin.set(withRepeat(withTiming(360, { duration: t.motion.drift, easing: Easing.linear }), -1, false));
      return () => {
        cancelAnimation(spin);
        spin.set(0);
      };
    }, [spin, t.motion.drift]),
  );

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));

  const wrap: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <View style={wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={spinStyle}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <Defs>
            <RadialGradient id="rayFade" cx="50%" cy="50%" r="50%">
              {/* Transparent at the core (rays show) → page bg at the rim (rays melt). */}
              <Stop offset="0.12" stopColor={t.colors.bg} stopOpacity={0} />
              <Stop offset="1" stopColor={t.colors.bg} stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <G>{wedges(count, t.colors.rayFill, opacity, opacityAlt)}</G>
          <Rect x={0} y={0} width={VIEWBOX} height={VIEWBOX} fill="url(#rayFade)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
