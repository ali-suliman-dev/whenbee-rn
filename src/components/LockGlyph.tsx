import { useCallback } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// LockGlyph — small animated padlock for the onboarding privacy card.
//
// 24-unit viewBox, 1.6px stroke weight (matches ReasonGlyph's glyph set).
// Indigo body (primarySoft fill + primary stroke) with an amber (accent) keyhole.
//
// Motion is INTERNAL and SMOOTH — the lock body never leaves its place and there
// is no snap/jump: the shackle eases gently open and shut on a continuous
// ease-in-out loop (reverse timing → zero discontinuity). Reduced-motion → still.
//
// Implementation note: SVG `G`/`Path` don't take style transforms via AnimatedProps
// on Fabric, so the shackle is its own Svg layer inside an Animated.View and the
// transform rides the plain RN view.
// ──────────────────────────────────────────────────────────────────────────────

const BOX = 24;
const SW = 1.6; // stroke width — matches ReasonGlyph
const LIFT = 4; // how far the shackle eases up (of the 24-box) — clearly visible

export function LockGlyph({ size = 24 }: { size?: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();

  // Shackle eases up then back down, forever — smooth, no snap.
  const open = useSharedValue(0);
  useAmbientMotion(
    !reduced,
    useCallback(() => {
      open.set(
        withRepeat(
          withTiming(1, { duration: t.motion.honeyFill, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
      return () => {
        cancelAnimation(open);
        open.set(0);
      };
    }, [open, t.motion.honeyFill]),
  );

  const shackle = useAnimatedStyle(() => ({ transform: [{ translateY: -LIFT * open.get() }] }));

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
        <Rect x={11.3} y={15.4} width={1.4} height={2.7} rx={0.7} fill={t.colors.accent} />
      </Svg>

      {/* Animated layer: shackle eases open and shut */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, shackle]}>
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
