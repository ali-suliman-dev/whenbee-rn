import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ComponentProps } from 'react';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// TabBarButton + AnimatedTabIcon — premium feedback on the bottom tabs.
//
//   AnimatedTabIcon — on focus the icon cross-fades outline → filled (no scale).
//   TabBarButton — wraps the navigator's button: reads focus from
//     accessibilityState and (a) strokes a short indicator line in at the very
//     TOP edge of the bar, (b) cross-fades, (c) dims on press, keeping the haptic
//     and every navigation prop.
//
// Motion is deliberate enough to read (base/slow, not fast) and reduced-motion
// guarded; haptics use expo-haptics directly because src/components may not
// import services/* (ESLint boundary) — the AppButton pattern.
// ──────────────────────────────────────────────────────────────────────────────

const AnimatedLine = Animated.createAnimatedComponent(Line);

const EASE = Easing.out(Easing.cubic);
const INDICATOR_W = 26;
const INDICATOR_INSET = 1.5;
const INDICATOR_LEN = INDICATOR_W - INDICATOR_INSET * 2;
const PRESS_DIM = 0.6;

// Base Ionicon name — each must have an `-outline` + filled pair.
type IoniconName = ComponentProps<typeof Ionicons>['name'];

export function AnimatedTabIcon({
  focused,
  name,
  size,
}: {
  focused: boolean;
  name: 'home' | 'calendar' | 'bug' | 'pulse';
  size: number;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const focusProgress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    focusProgress.set(
      reducedMotion
        ? focused
          ? 1
          : 0
        : withTiming(focused ? 1 : 0, { duration: t.motion.base, easing: EASE }),
    );
  }, [focused, reducedMotion, focusProgress, t.motion.base]);

  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - focusProgress.get() }));
  const filledStyle = useAnimatedStyle(() => ({ opacity: focusProgress.get() }));

  const iconBox: ViewStyle = { width: size, height: size };
  const layer: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <View style={iconBox}>
      <Animated.View style={[layer, outlineStyle]}>
        <Ionicons name={`${name}-outline` as IoniconName} size={size} color={t.colors.inkSoft} />
      </Animated.View>
      <Animated.View style={[layer, filledStyle]}>
        <Ionicons name={name} size={size} color={t.colors.primary} />
      </Animated.View>
    </View>
  );
}

const fill: ViewStyle = { flex: 1, alignItems: 'center', justifyContent: 'center' };

// PlatformPressable's `ref` type is wider than RN Pressable's; drop it from the
// passthrough (it isn't needed) so the spread type-checks cleanly.
type PassthroughProps = Omit<BottomTabBarButtonProps, 'children' | 'onPress' | 'ref'>;

export function TabBarButton({ children, onPress, ...rest }: BottomTabBarButtonProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  // This navigator version flags the active tab via `aria-selected`, not
  // `accessibilityState.selected`.
  const focused =
    (rest as { 'aria-selected'?: boolean })['aria-selected'] === true ||
    rest.accessibilityState?.selected === true;

  const pressOpacity = useSharedValue(1);
  const focusProgress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    focusProgress.set(
      reducedMotion
        ? focused
          ? 1
          : 0
        : withTiming(focused ? 1 : 0, { duration: t.motion.slow, easing: EASE }),
    );
  }, [focused, reducedMotion, focusProgress, t.motion.slow]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pressOpacity.get() }));
  const indicatorProps = useAnimatedProps(() => ({
    strokeDashoffset: INDICATOR_LEN * (1 - focusProgress.get()),
  }));

  function handlePressIn() {
    pressOpacity.set(
      reducedMotion ? PRESS_DIM : withTiming(PRESS_DIM, { duration: t.motion.fast, easing: EASE }),
    );
  }
  function handlePressOut() {
    pressOpacity.set(reducedMotion ? 1 : withTiming(1, { duration: t.motion.fast, easing: EASE }));
  }

  // Indicator rides the bar's top border (cancels the bar's paddingTop + item
  // padding so the line sits at the very top edge).
  const indicatorWrap: ViewStyle = {
    position: 'absolute',
    top: -11,
    left: 0,
    right: 0,
    alignItems: 'center',
  };

  return (
    <Pressable
      {...(rest as PassthroughProps)}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={indicatorWrap} pointerEvents="none">
        <Svg width={INDICATOR_W} height={3}>
          <AnimatedLine
            x1={INDICATOR_INSET}
            y1={1.5}
            x2={INDICATOR_W - INDICATOR_INSET}
            y2={1.5}
            stroke={t.colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={INDICATOR_LEN}
            animatedProps={indicatorProps}
          />
        </Svg>
      </View>
      <Animated.View style={[fill, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
