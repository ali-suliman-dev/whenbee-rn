import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// LockGlyph — small animated padlock for the onboarding privacy card.
//
// 24-unit viewBox, 1.6px stroke weight (matches ReasonGlyph's glyph set).
// Indigo body (primarySoft fill + primary stroke) with an amber (accent) keyhole.
// On mount the shackle "clicks shut" — a one-shot delight animation, reduced-motion
// guarded to the still/shut state. No glow.
//
// Implementation note: SVG `G` and `Path` animated wrappers don't accept `style`
// transforms via react-native-reanimated's AnimatedProps on Fabric. Instead the
// shackle is rendered in its own Svg layer inside an Animated.View so the
// translateY transform is applied to a plain RN view — identical visual result.
// ──────────────────────────────────────────────────────────────────────────────

const BOX = 24;
const SW = 1.6; // stroke width — matches ReasonGlyph

export function LockGlyph({ size = 24 }: { size?: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const dy = useSharedValue(reduced ? 0 : -3);

  useEffect(() => {
    if (reduced) {
      dy.set(0);
      return;
    }
    dy.set(
      withSequence(
        withTiming(0.6, { duration: t.motion.press }),
        withSpring(0, t.motion.spring),
      ),
    );
  }, [reduced, dy, t.motion.press, t.motion.spring]);

  const shackle = useAnimatedStyle(() => ({
    transform: [{ translateY: dy.get() }],
  }));

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="Locked — stored on this device"
    >
      {/* Static layer: lock body + keyhole */}
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${BOX} ${BOX}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <Rect
          x={6}
          y={11}
          width={12}
          height={9}
          rx={2.2}
          fill={t.colors.primarySoft}
          stroke={t.colors.primary}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={15} r={1.4} fill={t.colors.accent} />
        <Rect
          x={11.3}
          y={15.4}
          width={1.4}
          height={2.7}
          rx={0.7}
          fill={t.colors.accent}
        />
      </Svg>
      {/* Animated layer: shackle clicks shut on mount */}
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0 }, shackle]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
          <Path
            d="M8 11 V9 a4 4 0 0 1 8 0 V11"
            fill="none"
            stroke={t.colors.primary}
            strokeWidth={SW}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
