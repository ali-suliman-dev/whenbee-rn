import { Pressable, View, type LayoutChangeEvent, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  interpolate,
  Extrapolation,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { haptics } from '@/src/lib/haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';

// ──────────────────────────────────────────────────────────────────────────────
// Chip — Flat Tactical UI
//
// Variants
//   default  — resting state (surface bg, hairline border)
//   selected — active state (primaryTint fill, indigo border drawn in, ink text)
//   add      — dashed "+ New" affordance (static, never selectable)
//
// Micro-interaction (Premium archetype — no size change, no overshoot)
//   selection — the indigo border + tint appear *instantly* (static, no draw);
//               only a one-shot ripple ring pings outward (radial, ease-out) so
//               the pick visibly lands. A light haptic fires once on false → true.
//   press     — a subtle opacity dim, never a scale.
// The ripple is reduced-motion guarded; the selected border + tint are already
// instant, so they read identically with motion reduced (just no ripple).
// ──────────────────────────────────────────────────────────────────────────────

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Indigo selection stroke — static, sits on top of the resting hairline.
const STROKE = 1.5;
// Slack around the chip so the ripple ring can expand past the edge un-clipped.
const PAD = 8;
const RIPPLE_SPREAD = 7;
const EASE = Easing.out(Easing.cubic);

export function Chip({
  label,
  icon,
  selected = false,
  variant = 'default',
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  variant?: 'default' | 'add';
  onPress: () => void;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const isAdd = variant === 'add';

  const pressOpacity = useSharedValue(1);
  // One-shot 0 → 1 fired on each fresh selection — drives the ripple ping.
  const pulse = useSharedValue(0);

  // Measured chip box — until it lands we render no SVG overlay.
  const [box, setBox] = useState({ w: 0, h: 0 });
  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
  }

  function handlePressIn() {
    pressOpacity.set(reducedMotion ? t.opacity.pressed : withTiming(t.opacity.pressed, { duration: t.motion.fast, easing: EASE }));
  }
  function handlePressOut() {
    pressOpacity.set(reducedMotion ? 1 : withTiming(1, { duration: t.motion.fast, easing: EASE }));
  }

  // Ping the ripple + haptic only on false → true (never on mount).
  const wasSelected = useRef(selected);
  useEffect(() => {
    if (isAdd) return;
    const justSelected = selected && !wasSelected.current;
    wasSelected.current = selected;

    if (!justSelected) return;
    // haptics lives in lib/ (boundary-safe for src/components) — same as AppButton.
    haptics.light();
    // Ping the ripple outward (restart from 0).
    if (!reducedMotion) {
      pulse.set(0);
      pulse.set(withTiming(1, { duration: t.motion.slow, easing: EASE }));
    }
  }, [selected, isAdd, reducedMotion, pulse, t.motion.slow]);

  // Geometry for the static rounded-rect border + the ripple. The SVG is padded by
  // PAD on every side so the ripple can grow past the chip edge; the border sits at
  // PAD + half the stroke so it lands exactly on the chip outline.
  const inset = STROKE / 2;
  const bx = PAD + inset;
  const rw = Math.max(0, box.w - STROKE);
  const rh = Math.max(0, box.h - STROKE);
  const rr = Math.min(t.radii.full, rh / 2);

  // Ripple ring — expands outward from the chip edge while fading to nothing.
  const rippleProps = useAnimatedProps(() => {
    const p = pulse.get();
    const spread = p * RIPPLE_SPREAD;
    return {
      x: bx - spread,
      y: bx - spread,
      width: rw + spread * 2,
      height: rh + spread * 2,
      rx: rr + spread,
      ry: rr + spread,
      // Ping: invisible at rest, jumps bright, fades to nothing as it expands.
      opacity: interpolate(p, [0, 0.12, 1], [0, 0.6, 0], Extrapolation.CLAMP),
    };
  });

  const pressStyle = useAnimatedStyle(() => ({ opacity: pressOpacity.get() }));
  // Tint is instant — plain style, no animated interpolation.
  const tint: ViewStyle = {
    backgroundColor: selected ? t.colors.primarySoft : t.colors.surface,
  };

  const container: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2],
    ...(isAdd
      ? {
          backgroundColor: 'transparent',
          borderWidth: t.borderWidth.thin,
          borderColor: t.colors.hairline,
          borderStyle: 'dashed' as ViewStyle['borderStyle'],
        }
      : {
          // Resting hairline always present; the indigo border is the SVG overlay.
          borderWidth: t.borderWidth.hairline,
          borderColor: t.colors.hairline,
        }),
  };

  const labelStyle: TextStyle = {
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: t.colors.ink,
    fontSize: t.fontSize.sm,
  };

  // Overlay is inset by -PAD so the padded SVG centres over the chip.
  const overlay: ViewStyle = { position: 'absolute', top: -PAD, left: -PAD };

  const showBorder = !isAdd && box.w > 0 && box.h > 0;

  // NativeWind's interop + React Compiler drop styles applied directly to a
  // Pressable, so the visual lives on an inner View. Pressable stays a bare
  // touch wrapper; the press dim + border overlay wrap the whole chip.
  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={6}
    >
      <Animated.View style={pressStyle} onLayout={handleLayout}>
        <Animated.View style={[container, isAdd ? null : tint]}>
          {icon ? <View>{icon}</View> : null}
          <AppText style={labelStyle}>{label}</AppText>
        </Animated.View>
        {showBorder ? (
          <Svg style={overlay} width={box.w + PAD * 2} height={box.h + PAD * 2} pointerEvents="none">
            {/* Ripple ping — under the border, dropped under reduced motion. */}
            {!reducedMotion ? (
              <AnimatedRect
                fill="none"
                stroke={t.colors.primary}
                strokeWidth={2}
                animatedProps={rippleProps}
              />
            ) : null}
            {/* Selection border — static indigo outline, only while selected. */}
            {selected ? (
              <Rect
                x={bx}
                y={bx}
                width={rw}
                height={rh}
                rx={rr}
                ry={rr}
                fill="none"
                stroke={t.colors.primary}
                strokeWidth={STROKE}
              />
            ) : null}
          </Svg>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
