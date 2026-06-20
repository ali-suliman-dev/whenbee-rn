import { useCallback } from 'react';
import { Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';

// ──────────────────────────────────────────────────────────────────────────────
// ProUpsellCard — the single Pro "pass" entry point (Whenbee hub + Settings).
// Flat card: amber stub + dark body. No ticket chrome (no seam, notches, border).
// Liveliness via a slow crest breath + periodic diagonal shimmer sweep.
// Amber = honey/reward semantic; indigo stays scarce, never the Pro CTA.
// ──────────────────────────────────────────────────────────────────────────────

interface ProUpsellCardProps {
  title: string;
  note: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** Honeycomb cell + clock crest — "honest time, banked". */
function HoneyCrest({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 50 54">
      <Polygon
        points="25,3 43,13 43,35 25,45 7,35 7,13"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
      />
      <Circle cx={25} cy={24} r={9} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M25 24 v-5 M25 24 l4 2.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Diagonal shimmer stripe — pure SVG gradient, no expo-linear-gradient needed. */
function ShimmerStripe({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="white" stopOpacity={0} />
          <Stop offset="0.45" stopColor="white" stopOpacity={0.06} />
          <Stop offset="0.55" stopColor="white" stopOpacity={0.11} />
          <Stop offset="1" stopColor="white" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#shimmer)" />
    </Svg>
  );
}

export function ProUpsellCard({ title, note, onPress, accessibilityLabel }: ProUpsellCardProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // ── press scale ───────────────────────────────────────────────────────────
  const pressScale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.get() }] }));

  function handlePressIn() {
    if (reducedMotion) return;
    pressScale.set(withTiming(0.97, { duration: t.motion.press }));
  }
  function handlePressOut() {
    if (reducedMotion) return;
    pressScale.set(withSpring(1, t.motion.spring));
  }

  // ── crest breath (slow ambient pulse) ────────────────────────────────────
  const crestScale = useSharedValue(1);
  const crestStyle = useAnimatedStyle(() => ({ transform: [{ scale: crestScale.get() }] }));

  // ── shimmer sweep (periodic diagonal highlight) ───────────────────────────
  // Sweeps a gradient stripe across the card every ~5 seconds.
  const shimmerX = useSharedValue(-320);
  const shimmerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shimmerX.get() }, { skewX: '-18deg' }] }));

  useAmbientMotion(
    !reducedMotion,
    useCallback(() => {
      crestScale.set(
        withRepeat(
          withSequence(
            withTiming(1.07, { duration: 1800, easing: t.motion.easing.calm }),
            withTiming(1.0, { duration: 1800, easing: t.motion.easing.calm }),
          ),
          -1,
          false,
        ),
      );
      shimmerX.set(
        withRepeat(
          withSequence(
            withTiming(400, { duration: 700, easing: t.motion.easing.out }),
            withDelay(4500, withTiming(-320, { duration: 0 })),
          ),
          -1,
          false,
        ),
      );
      return () => {
        cancelAnimation(crestScale);
        cancelAnimation(shimmerX);
        crestScale.set(1);
        shimmerX.set(-320);
      };
    }, [crestScale, shimmerX, t.motion]),
  );

  // ── styles ────────────────────────────────────────────────────────────────
  const face: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
  };
  const stub: ViewStyle = {
    width: t.upsell.stub,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.accent,
  };
  const body: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    paddingVertical: t.space[3],
    paddingHorizontal: t.space[4],
  };
  // Perforation seam + notches — the visual split between stub and body.
  const seam: ViewStyle = {
    position: 'absolute',
    left: t.upsell.stub,
    top: 0,
    bottom: 0,
    width: t.borderWidth.thick,
    borderLeftWidth: t.borderWidth.thick,
    borderColor: t.colors.accentEdge,
    borderStyle: 'dashed',
    opacity: t.opacity.pressed,
  };
  const notchBase: ViewStyle = {
    position: 'absolute',
    left: t.upsell.stub - t.upsell.notch / 2,
    width: t.upsell.notch,
    height: t.upsell.notch,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.bg,
  };

  const proTag: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.amberText,
    marginBottom: t.space[1],
  };
  const titleStyle: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
  const noteStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[0.5],
  };

  return (
    <Pressable
      onPress={() => { haptics.light(); onPress(); }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <Animated.View style={[face, scaleStyle]}>
        <View style={stub}>
          <Animated.View style={crestStyle}>
            <HoneyCrest size={t.upsell.emblem} color={t.colors.onAmber} />
          </Animated.View>
        </View>
        <View style={body}>
          <View style={{ flex: 1 }}>
            <AppText style={proTag}>Pro</AppText>
            <AppText style={titleStyle}>{title}</AppText>
            <AppText style={noteStyle}>{note}</AppText>
          </View>
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.accent} />
        </View>
        <View style={seam} />
        <View style={[notchBase, { top: -t.upsell.notch / 2 }]} />
        <View style={[notchBase, { bottom: -t.upsell.notch / 2 }]} />
        {/* Shimmer sweep — absolute, full card, clipped by face overflow:hidden */}
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: 120 }, shimmerStyle]} pointerEvents="none">
          <ShimmerStripe width={120} height={200} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
