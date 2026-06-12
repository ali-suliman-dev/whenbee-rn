import { useEffect, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
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

const EASE = Easing.bezier(0.4, 0, 0.2, 1);
const INDICATOR_W = 26;
const PRESS_DIM = 0.55;

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
    indicatorX.set(reducedMotion ? x : withTiming(x, { duration: t.motion.base, easing: EASE }));
  }, [state.index, tabW, reducedMotion, indicatorX, t.motion.base]);

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
    borderTopWidth: 1,
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
    borderRadius: t.radii.pill,
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
  // focusProgress to slide each stroke into view).
  useEffect(() => {
    focusProgress.set(
      reducedMotion
        ? focused
          ? 1
          : 0
        : withTiming(focused ? 1 : 0, {
            duration: t.motion.draw,
            easing: Easing.inOut(Easing.sin),
          }),
    );
  }, [focused, reducedMotion, focusProgress, t.motion.draw]);

  const pressStyle = useAnimatedStyle(() => ({ opacity: pressOpacity.get() }));
  const labelStyle = useAnimatedStyle(() => ({
    color: focusProgress.get() > 0.5 ? t.colors.primary : t.colors.inkSoft,
  }));

  function handlePressIn() {
    pressOpacity.set(reducedMotion ? PRESS_DIM : withTiming(PRESS_DIM, { duration: t.motion.fast, easing: EASE }));
  }
  function handlePressOut() {
    pressOpacity.set(reducedMotion ? 1 : withTiming(1, { duration: t.motion.fast, easing: EASE }));
  }

  const item: ViewStyle = { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 };
  const text: TextStyle = { fontSize: 11, fontWeight: '500' };

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
