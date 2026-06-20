import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Modal, Pressable, View, type LayoutChangeEvent, type TextStyle, type ViewStyle } from 'react-native';
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
import { TabBarAddButton, type AddButtonConfig } from './TabBarAddButton';
import { QuickActionArc } from './quick/QuickActionArc';
import { router } from 'expo-router';
import { useTimerStore } from '@/src/stores/timerStore';

// ─── Add-button config ────────────────────────────────────────────────────────
//
// To switch placement, change ONE field: `placement`.
//   'center-elevated'  →  Option 2: raised rounded-square in the centre slot
//   'right-divider'    →  Option 3: right-edge slot separated by a hairline divider
//
// All other visual tokens (size, radius) live here too so a single object
// drives every dimension of the button.

const ADD_BTN = {
  placement: 'center-elevated',
  size: 54,
  borderRadius: 14,
  splitAt: 2, // tabs left of centre button (only matters for center-elevated)
} satisfies AddButtonConfig;

// Width that the button slot occupies in 'right-divider' layout.
// Tabs share the remaining bar width equally.
const DIVIDER_SLOT_W = ADD_BTN.size + 16 + 1; // button + padding + 1px divider

// ─── Route → icon map ────────────────────────────────────────────────────────

const ICONS: Record<string, TabIconName> = {
  index: 'home',
  plan: 'calendar',
  whenbee: 'bee',
  patterns: 'pulse',
};

// ─── Indicator width ─────────────────────────────────────────────────────────

const INDICATOR_W = 26;

// ─── WhenbeeTabBar ────────────────────────────────────────────────────────────
//
// Fully custom bottom bar.
//   • Sliding pill indicator that travels between active tabs.
//   • Per-tab custom SVG icon drawn on focus.
//   • Light haptic + opacity dim on press.
//   • Configurable add-button via ADD_BTN above.

export function WhenbeeTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const tabCount = state.routes.length;
  const [barW, setBarW] = useState(0);
  const [arcOpen, setArcOpen] = useState(false);
  const [btnCenter, setBtnCenter] = useState<{ x: number; y: number } | null>(null);

  // Compute effective tab-slot width based on placement.
  const tabW = computeTabW(barW, tabCount, ADD_BTN);

  // Sliding indicator.
  const indicatorX = useSharedValue(0);
  useEffect(() => {
    if (tabW <= 0) return;
    const x = computeIndicatorX(state.index, tabW, barW, tabCount, ADD_BTN);
    indicatorX.set(
      reducedMotion ? x : withTiming(x, { duration: t.motion.base, easing: t.motion.easing.standard }),
    );
  }, [state.index, tabW, barW, tabCount, reducedMotion, indicatorX, t.motion.base, t.motion.easing.standard]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.get() }],
  }));

  function handleLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w !== barW) setBarW(w);
  }

  function closeArc() { setArcOpen(false); }
  function toggleArc() { setArcOpen(v => !v); }

  function handleVoice() {
    closeArc();
    // Voice auto-start deferred: add-task modal has no trivial voice param yet.
    router.push('/(modals)/add-task');
  }
  function handleTimer() {
    closeArc();
    useTimerStore.getState().quickStart();
    router.push({ pathname: '/(modals)/timer', params: { quick: '1' } });
  }
  function handleType() {
    closeArc();
    router.push('/(modals)/add-task');
  }

  const bar: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    borderTopWidth: t.borderWidth.hairline,
    borderTopColor: t.colors.hairline,
    paddingTop: 8,
    // Trim a few px off the safe inset so the icons sit lower in the bar,
    // opening up the gap below the active indicator.
    paddingBottom: Math.max(insets.bottom - 8, 4),
    height: 52 + insets.bottom,
    alignItems: 'flex-end',
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

  if (ADD_BTN.placement === 'center-elevated') {
    return (
      <>
        <CentreElevatedBar
          state={state}
          descriptors={descriptors}
          navigation={navigation}
          bar={bar}
          indicator={indicator}
          indicatorStyle={indicatorStyle}
          tabW={tabW}
          onLayout={handleLayout}
          onToggleArc={toggleArc}
          onBtnLayout={setBtnCenter}
        />
        <Modal
          transparent
          visible={arcOpen}
          animationType="none"
          onRequestClose={closeArc}
          statusBarTranslucent
        >
          <View style={{ flex: 1 }} pointerEvents="box-none">
            <Pressable
              style={{ flex: 1, backgroundColor: t.colors.scrim }}
              onPress={closeArc}
              accessibilityLabel="Dismiss"
              accessibilityRole="button"
            />
          </View>
          {btnCenter !== null && (
            <QuickActionArc
              anchorX={btnCenter.x}
              anchorY={btnCenter.y}
              onVoice={handleVoice}
              onTimer={handleTimer}
              onType={handleType}
            />
          )}
        </Modal>
      </>
    );
  }

  return <RightDividerBar
    state={state}
    descriptors={descriptors}
    navigation={navigation}
    bar={bar}
    indicator={indicator}
    indicatorStyle={indicatorStyle}
    onLayout={handleLayout}
  />;
}

// ─── Layout: centre-elevated ──────────────────────────────────────────────────

function CentreElevatedBar({
  state, descriptors, navigation,
  bar, indicator, indicatorStyle, tabW, onLayout,
  onToggleArc, onBtnLayout,
}: BarProps & { tabW: number; onToggleArc: () => void; onBtnLayout: (center: { x: number; y: number }) => void }) {
  const insets = useSafeAreaInsets();
  const btnRef = useRef<View>(null);
  const leftRoutes = state.routes.slice(0, ADD_BTN.splitAt);
  const rightRoutes = state.routes.slice(ADD_BTN.splitAt);

  // Absolute X: center of the middle slot.
  const btnLeft = tabW > 0 ? (ADD_BTN.splitAt + 0.5) * tabW - ADD_BTN.size / 2 : 0;
  // Absolute Y from bar bottom: sits above tab labels with a clear gap.
  const btnBottom = insets.bottom + 8;

  return (
    // overflow: 'visible' lets the button escape the bar's top edge.
    <View style={[bar, { overflow: 'visible' }]} onLayout={onLayout}>
      {tabW > 0 && (
        <Animated.View
          style={[indicator, indicatorStyle] as ComponentProps<typeof Animated.View>['style']}
          pointerEvents="none"
        />
      )}

      {leftRoutes.map((route, i) => (
        <TabItem
          key={route.key}
          label={labelFor(descriptors, route)}
          icon={ICONS[route.name] ?? 'home'}
          focused={state.index === i}
          onPress={() => pressTab(navigation, state, route, state.index === i)}
        />
      ))}

      {/* Placeholder keeps the center slot's flex width so tab items stay symmetric. */}
      <View style={{ flex: 1 }} pointerEvents="none" />

      {rightRoutes.map((route, i) => {
        const routeIndex = ADD_BTN.splitAt + i;
        return (
          <TabItem
            key={route.key}
            label={labelFor(descriptors, route)}
            icon={ICONS[route.name] ?? 'home'}
            focused={state.index === routeIndex}
            onPress={() => pressTab(navigation, state, route, state.index === routeIndex)}
          />
        );
      })}

      {/* Button rendered absolutely so it can float above the bar's top edge. */}
      {tabW > 0 && (
        <View
          ref={btnRef}
          style={{ position: 'absolute', left: btnLeft, bottom: btnBottom }}
          onLayout={() => {
            // measureInWindow gives true screen coords after layout settles.
            btnRef.current?.measureInWindow((x, y, width, height) => {
              onBtnLayout({ x: x + width / 2, y: y + height / 2 });
            });
          }}
        >
          <TabBarAddButton config={ADD_BTN} onPress={onToggleArc} />
        </View>
      )}
    </View>
  );
}

// ─── Layout: right-divider ────────────────────────────────────────────────────

function RightDividerBar({
  state, descriptors, navigation,
  bar, indicator, indicatorStyle, onLayout,
}: BarProps) {
  const t = useTheme();

  const divider: ViewStyle = {
    width: 1,
    height: 28,
    backgroundColor: t.colors.hairline,
    alignSelf: 'center',
  };

  return (
    <View style={bar} onLayout={onLayout}>
      <Animated.View
        style={[indicator, indicatorStyle] as ComponentProps<typeof Animated.View>['style']}
        pointerEvents="none"
      />

      {state.routes.map((route, index) => (
        <TabItem
          key={route.key}
          label={labelFor(descriptors, route)}
          icon={ICONS[route.name] ?? 'home'}
          focused={state.index === index}
          onPress={() => pressTab(navigation, state, route, state.index === index)}
        />
      ))}

      <View style={divider} />
      <TabBarAddButton config={ADD_BTN} />
    </View>
  );
}

// ─── TabItem ──────────────────────────────────────────────────────────────────

function TabItem({
  label, icon, focused, onPress,
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

  useEffect(() => {
    focusProgress.set(
      !focused || reducedMotion
        ? focused ? 1 : 0
        : withTiming(1, { duration: t.motion.draw, easing: t.motion.easing.calm }),
    );
  }, [focused, reducedMotion, focusProgress, t.motion.draw, t.motion.easing.calm]);

  const pressStyle = useAnimatedStyle(() => ({ opacity: pressOpacity.get() }));
  const labelStyle = useAnimatedStyle(() => ({
    color: focusProgress.get() > 0.5 ? t.colors.primary : t.colors.inkSoft,
  }));

  function handlePressIn() {
    pressOpacity.set(
      reducedMotion
        ? t.opacity.pressed
        : withTiming(t.opacity.pressed, { duration: t.motion.fast, easing: t.motion.easing.standard }),
    );
  }
  function handlePressOut() {
    pressOpacity.set(
      reducedMotion
        ? 1
        : withTiming(1, { duration: t.motion.fast, easing: t.motion.easing.standard }),
    );
  }

  const item: ViewStyle = { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[1] };
  const text: TextStyle = { fontSize: t.fontSize.xs, fontWeight: t.fontWeight.medium as TextStyle['fontWeight'] };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityLabel={label}
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Children read safe-area insets via their own hook, so they only need these
// three nav props — not the full BottomTabBarProps (which would require `insets`).
type BarProps = Pick<BottomTabBarProps, 'state' | 'descriptors' | 'navigation'> & {
  bar: ViewStyle;
  indicator: ViewStyle;
  indicatorStyle: ReturnType<typeof useAnimatedStyle>;
  onLayout: (e: LayoutChangeEvent) => void;
};

function labelFor(descriptors: BottomTabBarProps['descriptors'], route: { key: string; name: string }): string {
  const opts = descriptors[route.key]?.options;
  return typeof opts?.title === 'string' ? opts.title : route.name;
}

function pressTab(
  navigation: BottomTabBarProps['navigation'],
  state: BottomTabBarProps['state'],
  route: { key: string; name: string },
  focused: boolean,
) {
  haptics.light();
  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
}

/** Effective width of each tab slot given the current placement. */
function computeTabW(barW: number, tabCount: number, config: AddButtonConfig): number {
  if (barW <= 0) return 0;
  if (config.placement === 'center-elevated') {
    // bar is divided into (tabCount + 1) equal slots: tabs + 1 button slot.
    return barW / (tabCount + 1);
  }
  // right-divider: button occupies a fixed slot; tabs share the rest.
  return (barW - DIVIDER_SLOT_W) / tabCount;
}

/** X position of the indicator for the given tab index. */
function computeIndicatorX(
  tabIndex: number,
  tabW: number,
  barW: number,
  tabCount: number,
  config: AddButtonConfig,
): number {
  if (config.placement === 'center-elevated') {
    // Visual slot: left tabs keep their index; right tabs skip the centre button slot.
    const visualSlot = tabIndex < config.splitAt ? tabIndex : tabIndex + 1;
    return visualSlot * tabW + (tabW - INDICATOR_W) / 2;
  }
  // right-divider: tabs are positioned from the left edge as normal.
  return tabIndex * tabW + (tabW - INDICATOR_W) / 2;
}

// Re-export config type so callers never reach into the internals.
export type { AddButtonConfig };
