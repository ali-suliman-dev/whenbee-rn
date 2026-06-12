import { Pressable, View, type LayoutChangeEvent, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  interpolateColor,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
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
//   selection — the indigo border *strokes itself in* (SVG stroke-dashoffset)
//               while the tint fill cross-fades; a light haptic fires once on
//               the false → true transition.
//   press     — a subtle opacity dim, never a scale.
// All motion is reduced-motion guarded; the selected state still appears, just
// instantly (border at full, no draw).
// ──────────────────────────────────────────────────────────────────────────────

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Indigo selection stroke — drawn on top of the resting hairline.
const STROKE = 1.5;
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

  // 0 ↔ 1 drives both the border draw and the tint cross-fade.
  const selectProgress = useSharedValue(selected ? 1 : 0);
  const pressOpacity = useSharedValue(1);

  // Measured chip box — until it lands we render no SVG overlay.
  const [box, setBox] = useState({ w: 0, h: 0 });
  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
  }

  function handlePressIn() {
    pressOpacity.set(reducedMotion ? 0.6 : withTiming(0.6, { duration: t.motion.fast, easing: EASE }));
  }
  function handlePressOut() {
    pressOpacity.set(reducedMotion ? 1 : withTiming(1, { duration: t.motion.fast, easing: EASE }));
  }

  // Drive the draw on the selected change; haptic only on false → true (never mount).
  const wasSelected = useRef(selected);
  useEffect(() => {
    if (isAdd) return;
    const justSelected = selected && !wasSelected.current;
    wasSelected.current = selected;

    selectProgress.set(
      reducedMotion
        ? selected
          ? 1
          : 0
        : withTiming(selected ? 1 : 0, { duration: t.motion.slow, easing: EASE }),
    );

    if (!justSelected) return;
    // services/* is off-limits to src/components (ESLint boundary), so we tap
    // expo-haptics directly — the same pattern AppButton uses.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [selected, isAdd, reducedMotion, selectProgress, t.motion.slow]);

  // Geometry for the rounded-rect border draw, inset by half the stroke so it
  // never clips against the SVG bounds.
  const inset = STROKE / 2;
  const rw = Math.max(0, box.w - STROKE);
  const rh = Math.max(0, box.h - STROKE);
  const rr = Math.min(t.radii.pill, rh / 2);
  const perimeter =
    2 * (Math.max(0, rw - 2 * rr) + Math.max(0, rh - 2 * rr)) + 2 * Math.PI * rr;

  const borderProps = useAnimatedProps(() => ({
    strokeDashoffset: perimeter * (1 - selectProgress.get()),
  }));

  const pressStyle = useAnimatedStyle(() => ({ opacity: pressOpacity.get() }));
  const tintStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selectProgress.get(),
      [0, 1],
      [t.colors.surface, t.colors.primaryTint],
    ),
  }));

  const container: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    borderRadius: t.radii.pill,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2],
    ...(isAdd
      ? {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: t.colors.hairline,
          borderStyle: 'dashed' as ViewStyle['borderStyle'],
        }
      : {
          // Resting hairline always present; the indigo border is the SVG overlay.
          borderWidth: 1,
          borderColor: t.colors.hairline,
        }),
  };

  const labelStyle: TextStyle = {
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: t.colors.ink,
    fontSize: t.fontSize.sm,
  };

  const overlay: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

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
        <Animated.View style={[container, isAdd ? null : tintStyle]}>
          {icon ? <View>{icon}</View> : null}
          <AppText style={labelStyle}>{label}</AppText>
        </Animated.View>
        {showBorder ? (
          <Svg style={overlay} width={box.w} height={box.h} pointerEvents="none">
            <AnimatedRect
              x={inset}
              y={inset}
              width={rw}
              height={rh}
              rx={rr}
              ry={rr}
              fill="none"
              stroke={t.colors.primary}
              strokeWidth={STROKE}
              strokeDasharray={perimeter}
              animatedProps={borderProps}
            />
          </Svg>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
