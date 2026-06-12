import { useEffect, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '@/src/lib/haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/src/theme/useTheme';
import { TabIcon, type TabIconName } from './TabIcon';

// ──────────────────────────────────────────────────────────────────────────────
// WhenbeeTabBar — a fully custom bottom bar. We render everything ourselves so
// the motion is ours to drive, not the navigator's:
//   • a single pill indicator that SLIDES between tabs on the active index
//     (the hero motion — unmistakable),
//   • per-tab custom SVG icon that *draws itself on* in indigo + colour shift
//     (secondary — see TabIcon),
//   • a light haptic + opacity press dim.
// React Navigation only supplies state/descriptors/navigation. Premium archetype:
// ease-out, no overshoot, no size pop. All reduced-motion guarded.
// ──────────────────────────────────────────────────────────────────────────────

const INDICATOR_W = 26;

// Custom glyph per route — drawn by TabIcon.
const ICONS: Record<string, TabIconName> = {
  index: 'home',
  plan: 'calendar',
  whenbee: 'bee',
  patterns: 'pulse',
};

export function WhenbeeTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const count = state.routes.length;
  const [barW, setBarW] = useState(0);
  const tabW = barW > 0 ? barW / count : 0;

  // Hero: the indicator slides to the active tab.
  const indicatorX = useSharedValue(0);
  useEffect(() => {
    if (tabW <= 0) return;
    const x = state.index * tabW + (tabW - INDICATOR_W) / 2;
    indicatorX.set(reducedMotion ? x : withTiming(x, { duration: t.motion.base, easing: t.motion.easing.standard }));
  }, [state.index, tabW, reducedMotion, indicatorX, t.motion.base, t.motion.easing.standard]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.get() }],
  }));

  function handleLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w !== barW) setBarW(w);
  }

  const bar: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    borderTopWidth: t.borderWidth.hairline,
    borderTopColor: t.colors.hairline,
    paddingTop: 8,
    paddingBottom: insets.bottom,
    height: 58 + insets.bottom,
  };

  const indicator: ViewStyle = {
    position: 'absolute',
    top: -1,
    left: 0,
    width: INDICATOR_W,
    height: 3,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
  };

  return (
    <View style={bar} onLayout={handleLayout}>
      {/* Sliding indicator rides the top edge. */}
      {tabW > 0 ? <Animated.View style={[indicator, indicatorStyle]} pointerEvents="none" /> : null}

      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key]!;
        const label =
          typeof options.title === 'string' ? options.title : route.name;

        function onPress() {
          haptics.light();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }

        return (
          <TabItem
            key={route.key}
            label={label}
            icon={ICONS[route.name] ?? 'home'}
            focused={focused}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

function TabItem({
  label,
  icon,
  focused,
  onPress,
}: {
  label: string;
  icon: TabIconName;
  focused: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const focusProgress = useSharedValue(focused ? 1 : 0);
  const pressOpacity = useSharedValue(1);

  // Calming draw-on: a slow sine-eased reveal of the indigo glyph (TabIcon reads
  // focusProgress to slide each stroke into view). Only the *draw on* animates —
  // blur snaps straight back to the resting glyph (no reverse un-draw).
  useEffect(() => {
    focusProgress.set(
      !focused || reducedMotion
        ? focused
          ? 1
          : 0
        : withTiming(1, { duration: t.motion.draw, easing: t.motion.easing.calm }),
    );
  }, [focused, reducedMotion, focusProgress, t.motion.draw, t.motion.easing.calm]);

  const pressStyle = useAnimatedStyle(() => ({ opacity: pressOpacity.get() }));
  const labelStyle = useAnimatedStyle(() => ({
    color: focusProgress.get() > 0.5 ? t.colors.primary : t.colors.inkSoft,
  }));

  function handlePressIn() {
    pressOpacity.set(reducedMotion ? t.opacity.pressed : withTiming(t.opacity.pressed, { duration: t.motion.fast, easing: t.motion.easing.standard }));
  }
  function handlePressOut() {
    pressOpacity.set(reducedMotion ? 1 : withTiming(1, { duration: t.motion.fast, easing: t.motion.easing.standard }));
  }

  const item: ViewStyle = { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[1] };
  const text: TextStyle = { fontSize: t.fontSize.xs, fontWeight: t.fontWeight.medium as TextStyle['fontWeight'] };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      style={{ flex: 1 }}
    >
      <Animated.View style={[item, pressStyle]}>
        <TabIcon icon={icon} focusProgress={focusProgress} size={24} />
        <Animated.Text style={[text, labelStyle]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}
