import { Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';
import type { ReactNode } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// Tactile Pill Button — Flat Tactical UI
//
// Renders a pill with a solid-offset physical edge that compresses on press.
// The edge is an absolutely-positioned View strip BEHIND the pill (cross-platform
// safe — no reliance on shadowRadius/elevation which differ on Android).
//
// Variants
//   indigo  — primary action (bg: primary, label: onIndigo, edge: primaryEdge)
//   amber   — reward / scarce action (bg: accent, label: onAmber, edge: accentEdge)
//   ghost   — secondary / destructive (bg: surface, label: ink, edge: hairline)
//
// Backward-compat: existing call sites used variant="primary"|"secondary"|"ghost".
// "primary" maps → "indigo", "secondary" maps → "ghost" so old code keeps working.
// ──────────────────────────────────────────────────────────────────────────────

type NewVariant = 'indigo' | 'amber' | 'ghost';
type LegacyVariant = 'primary' | 'secondary';
type Variant = NewVariant | LegacyVariant;

const EDGE_HEIGHT = 6;
const PRESS_OFFSET = 5;
const PRESS_EDGE = 1;

function resolveVariant(v: Variant): NewVariant {
  if (v === 'primary') return 'indigo';
  if (v === 'secondary') return 'ghost';
  return v;
}

export function AppButton({
  label,
  onPress,
  variant = 'indigo',
  disabled = false,
  fullWidth = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const resolved = resolveVariant(variant);

  const bg: Record<NewVariant, string> = {
    indigo: t.colors.primary,
    amber: t.colors.accent,
    ghost: t.colors.surface,
  };
  const fg: Record<NewVariant, string> = {
    indigo: t.colors.onIndigo,
    amber: t.colors.onAmber,
    ghost: t.colors.ink,
  };
  const edgeColor: Record<NewVariant, string> = {
    indigo: t.colors.primaryEdge,
    amber: t.colors.accentEdge,
    ghost: t.colors.hairline,
  };

  // Shared values for press animation
  const translateY = useSharedValue(0);
  const edgeHeight = useSharedValue(EDGE_HEIGHT);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const edgeStyle = useAnimatedStyle(() => ({
    height: edgeHeight.value,
  }));

  function handlePressIn() {
    if (reducedMotion) return;
    translateY.value = withTiming(PRESS_OFFSET, { duration: t.motion.press });
    edgeHeight.value = withTiming(PRESS_EDGE, { duration: t.motion.press });
  }

  function handlePressOut() {
    if (reducedMotion) return;
    translateY.value = withTiming(0, { duration: t.motion.press });
    edgeHeight.value = withTiming(EDGE_HEIGHT, { duration: t.motion.press });
  }

  const wrapper: ViewStyle = {
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.4 : 1,
    // Extra bottom padding = edge height so the edge strip doesn't overlap siblings
    paddingBottom: EDGE_HEIGHT,
  };

  const pillContainer: ViewStyle = {
    height: 52,
    borderRadius: t.radii.pill,
    backgroundColor: bg[resolved],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: t.space[2],
    paddingHorizontal: t.space[5],
  };

  const edgeBase: ViewStyle = {
    position: 'absolute',
    bottom: 0,
    left: 4,
    right: 4,
    borderRadius: t.radii.pill,
    backgroundColor: edgeColor[resolved],
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={wrapper}
    >
      {/* Edge strip rendered behind the pill */}
      <Animated.View style={[edgeBase, edgeStyle]} />

      {/* Pill surface */}
      <Animated.View style={[pillContainer, pillStyle]}>
        {icon ?? null}
        <AppText
          style={{
            fontSize: t.fontSize.md,
            fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
            color: fg[resolved],
          }}
        >
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}
