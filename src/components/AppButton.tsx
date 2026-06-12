import { Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';
import type { ReactNode } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// Tactile Pill Button — Flat Tactical UI
//
// A pill sitting on a solid colored bottom "edge" (full-width, same radius — reads
// as one physical button, not a detached line). On press the pill drops DOWN onto
// the edge and the edge compresses, then springs back — a real push. Same look as
// the Today + FAB.
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

const PILL_H = 52; // pill height
const EDGE = 6; // how far the darker edge peeks below the pill (the 3D depth)
const DROP = EDGE - 1; // how far the pill drops on press (compresses onto the edge)

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
  const edge: Record<NewVariant, string> = {
    indigo: t.colors.primaryEdge,
    amber: t.colors.accentEdge,
    ghost: t.colors.hairline,
  };

  // The pill drops onto its edge on press, then springs back.
  const pressY = useSharedValue(0);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressY.get() }],
  }));

  function handlePressIn() {
    if (reducedMotion) return;
    pressY.set(withTiming(DROP, { duration: t.motion.press }));
  }

  function handlePressOut() {
    if (reducedMotion) return;
    pressY.set(withSpring(0, t.motion.spring));
  }

  const wrapper: ViewStyle = {
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled ? t.opacity.disabled : 1,
    // Reserve the depth so the edge doesn't overlap siblings.
    paddingBottom: EDGE,
  };

  // A full-height darker layer sitting EDGE px below the pill — only its bottom
  // sliver shows, reading as one solid 3D edge (not a detached line).
  const edgeBase: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PILL_H,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    backgroundColor: edge[resolved],
  };

  const pillContainer: ViewStyle = {
    height: PILL_H,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    backgroundColor: bg[resolved],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: t.space[2],
    paddingHorizontal: t.space[5],
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={wrapper}
    >
      {/* Solid colored depth edge behind the pill */}
      <View style={edgeBase} />

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
