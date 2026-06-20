import { Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';

// ─── public types ────────────────────────────────────────────────────────────

export type AddButtonPlacement = 'center-elevated' | 'right-divider';

export interface AddButtonConfig {
  /** Visual position in the tab bar. Change this one field to swap layouts. */
  placement: AddButtonPlacement;
  /** Width and height of the button face. */
  size: number;
  /** Corner radius — 10 = rounded-square, size/2 = circle. */
  borderRadius: number;
  /**
   * center-elevated only: how many tab items sit to the LEFT of the button.
   * With 4 tabs, 2 gives a centred split.
   */
  splitAt: number;
}

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  config: AddButtonConfig;
  /** Right-divider only — width that the button slot occupies (tabs use the rest). */
  slotWidth?: number;
  /** If provided, called instead of the default route-push. Used to toggle the quick-action arc. */
  onPress?: () => void;
}

export function TabBarAddButton({ config, onPress: onPressProp }: Props) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const EDGE_DEPTH = 4;

  // Primary axis: coin sinks on press, springs back.
  const pressY = useSharedValue(0);
  // Secondary axis: subtle squash → spring pop with overshoot (the addictive moment).
  const pressScale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: pressY.get() },
      { scale: pressScale.get() },
    ],
  }));

  function onPressIn() {
    if (reducedMotion) return;
    pressY.set(withTiming(EDGE_DEPTH - 1, { duration: t.motion.press }));
    // Squash slightly — communicates the button "heard" the press.
    pressScale.set(withTiming(0.93, { duration: t.motion.press }));
  }
  function onPressOut() {
    if (reducedMotion) return;
    pressY.set(withSpring(0, t.motion.spring));
    // Pop spring: low damping creates the satisfying overshoot bounce.
    pressScale.set(withSpring(1, { damping: 10, stiffness: 240, mass: 0.5 }));
  }
  function onPress() {
    haptics.light();
    if (onPressProp != null) {
      onPressProp();
    } else {
      router.push('/(modals)/add-task');
    }
  }

  const isElevated = config.placement === 'center-elevated';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Add a task"
      style={isElevated ? elevatedWrapper : dividerWrapper}
    >
      {/*
        Fixed-size inner container — EDGE_DEPTH taller than the face so the
        coin edge peeks out below. Edge and face share the same left origin.
      */}
      <View style={{ width: config.size, height: config.size + EDGE_DEPTH }}>
        {/* Coin edge — darker slab, pinned to bottom of inner container. */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: config.size,
            height: config.size,
            borderRadius: config.borderRadius,
            backgroundColor: t.colors.primaryEdge,
          }}
        />

        {/* Button face — primary fill, slides down onto edge on press. */}
        <Animated.View
          style={[
            animStyle,
            {
              width: config.size,
              height: config.size,
              borderRadius: config.borderRadius,
              backgroundColor: t.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Animated.View>
      </View>
    </Pressable>
  );
}

// Wrapper for center-elevated: parent handles absolute positioning; button just renders.
const elevatedWrapper = {};

// Wrapper for right-divider: fixed width, centred vertically.
const dividerWrapper = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  paddingHorizontal: 8,
};
