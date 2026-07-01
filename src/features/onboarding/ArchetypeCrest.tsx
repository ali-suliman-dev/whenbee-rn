import { useCallback } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Defs, RadialGradient, Stop, Path, G } from 'react-native-svg';
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
import { BeeMascot } from '@/src/components/BeeMascot';
import { CoinHex } from '@/src/components/bee/CoinHex';

// ──────────────────────────────────────────────────────────────────────────────
// ArchetypeCrest — the hero "collectible crest" for the onboarding reveal. A soft
// amber SUNBURST radiates behind the brand `BeeMascot`, turning one slow revolution
// so the crest feels alive (cf. the reward-screen RayBurst). The rays fade to FULLY
// TRANSPARENT at the rim — NOT to a bg colour — so they melt cleanly into the card's
// gradient instead of leaving a solid-colour halo (the failure mode on a gradient
// surface). The `CoinHex` seal sits up by the bee's head. Reduce-motion → static.
// ──────────────────────────────────────────────────────────────────────────────

/** Regular flat-top hexagon ratio — height = width × √3/2 (sets the crest box). */
const HEX_RATIO = Math.sqrt(3) / 2;

const RAY_VB = 100;
const RAY_C = RAY_VB / 2;
const RAY_R = RAY_VB; // overshoot so wedges fill the box; the radial fades the rim

/** Alternating-opacity sunburst wedges, each filled by the fade-to-transparent radial. */
function rayWedges(count: number, fill: string, opacity: number, opacityAlt: number) {
  const step = (Math.PI * 2) / count;
  const paths = [];
  for (let i = 0; i < count; i++) {
    const a0 = i * step;
    const a1 = a0 + step;
    const x0 = RAY_C + RAY_R * Math.cos(a0);
    const y0 = RAY_C + RAY_R * Math.sin(a0);
    const x1 = RAY_C + RAY_R * Math.cos(a1);
    const y1 = RAY_C + RAY_R * Math.sin(a1);
    paths.push(
      <Path
        key={i}
        d={`M${RAY_C} ${RAY_C} L${x0} ${y0} L${x1} ${y1} Z`}
        fill={fill}
        fillOpacity={i % 2 === 0 ? opacity : opacityAlt}
      />,
    );
  }
  return paths;
}

export function ArchetypeCrest({ beeSize }: { beeSize?: number }) {
  const t = useTheme();
  const { t: tr } = useTranslation('onboarding');
  const reduced = useReducedMotion();

  const w = t.reveal.crestW;
  const h = w * HEX_RATIO;
  const bee = beeSize ?? t.reveal.bee;
  const coin = t.reveal.coinHex;
  const raySize = w * 1.3;

  // Coin-hex seal sits UP at the bee's head — just above and a little to the right
  // of the head/antennae, mirroring the crest like a small collectible stamp.
  const coinRight = w * 0.16;
  const coinTop = h * 0.05;

  // One slow continuous revolution — alive, never spinning fast. Paused off-screen
  // by useAmbientMotion; static under reduce-motion.
  const spin = useSharedValue(0);
  useAmbientMotion(
    !reduced,
    useCallback(() => {
      spin.set(withRepeat(withTiming(360, { duration: t.motion.drift, easing: Easing.linear }), -1, false));
      return () => {
        cancelAnimation(spin);
        spin.set(0);
      };
    }, [spin, t.motion.drift]),
  );
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));

  // The coin floats — a calm, slow vertical drift (sine-smooth ease-in-out, small
  // amplitude, no bounce). Ambient life, paused off-screen; static under reduce-motion.
  const bob = useSharedValue(0);
  useAmbientMotion(
    !reduced,
    useCallback(() => {
      bob.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, true));
      return () => {
        cancelAnimation(bob);
        bob.set(0);
      };
    }, [bob]),
  );
  const coinBobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (bob.get() - 0.5) * 2 * t.burst.coinBob }] }));

  const container: ViewStyle = {
    width: w,
    height: h,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const rayWrap: ViewStyle = {
    position: 'absolute',
    width: raySize,
    height: raySize,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const coinSlot: ViewStyle = { position: 'absolute', top: coinTop, right: coinRight };

  return (
    <View style={container} accessibilityRole="image" accessibilityLabel={tr('archetypeCrest.accessibilityLabel')}>
      {/* (1) Amber sunburst behind the bee — warm radiance, slow turn. The radial
          keeps the core clear (bee not washed) and fades to transparent at the rim,
          so it dissolves into the card gradient with no halo. */}
      <Animated.View style={[rayWrap, spinStyle]} pointerEvents="none">
        <Svg width={raySize} height={raySize} viewBox={`0 0 ${RAY_VB} ${RAY_VB}`}>
          <Defs>
            {/* userSpaceOnUse → ONE radial shared by every wedge (centred on the box),
                NOT each wedge's own bbox. That's what makes the rays melt in a clean
                circle to transparent instead of banding into a hard diamond. */}
            <RadialGradient id="crestRay" cx={RAY_C} cy={RAY_C} r={RAY_C} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={t.colors.accent} stopOpacity={0} />
              <Stop offset="0.4" stopColor={t.colors.accent} stopOpacity={0.13} />
              <Stop offset="0.78" stopColor={t.colors.accent} stopOpacity={0.02} />
              <Stop offset="1" stopColor={t.colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <G>{rayWedges(16, 'url(#crestRay)', 1, 0.4)}</G>
        </Svg>
      </Animated.View>

      {/* (2) The bee, large, resting in the radiance (its own halo suppressed). */}
      <BeeMascot size={bee} animated glow={false} />

      {/* (3) Coin-hex seal up by the bee's head — calmly floating. */}
      <Animated.View style={[coinSlot, coinBobStyle]} pointerEvents="none">
        <CoinHex size={coin} />
      </Animated.View>
    </View>
  );
}
