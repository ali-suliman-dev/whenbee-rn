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
// Variants
//   indigo  — primary action (bg: primary, label: onIndigo, edge: primaryEdge)
//   amber   — reward / scarce action (bg: accent, label: onAmber, edge: accentEdge)
//   ghost   — secondary / destructive (flat surface + hairline border, NO edge)
//
// Depth: FILLED variants (indigo/amber) sit on a solid colored bottom edge and
// drop onto it on press — a real physical push. GHOST is flat: a hairline border
// and a subtle scale(0.97) on press. The coin-edge on a ghost read as a stray
// detached underline, so it's gone.
//
// Sizes (size prop) drive the pill height from size.control — 44pt HIG floor.
//
// Backward-compat: "primary" → "indigo", "secondary" → "ghost".
// ──────────────────────────────────────────────────────────────────────────────

type NewVariant = 'indigo' | 'amber' | 'ghost';
type LegacyVariant = 'primary' | 'secondary';
type Variant = NewVariant | LegacyVariant;
type Size = 'sm' | 'md' | 'lg';

const EDGE = 6; // how far the darker edge peeks below a FILLED pill (the 3D depth)
const DROP = EDGE - 1; // how far a filled pill drops on press (compresses onto the edge)
const GHOST_PRESS_SCALE = 0.97; // ghost has no edge — a subtle squeeze carries the press

function resolveVariant(v: Variant): NewVariant {
  if (v === 'primary') return 'indigo';
  if (v === 'secondary') return 'ghost';
  return v;
}

export function AppButton({
  label,
  onPress,
  variant = 'indigo',
  size = 'md',
  disabled = false,
  fullWidth = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const resolved = resolveVariant(variant);
  const isGhost = resolved === 'ghost';
  const PILL_H = t.size.control[size];
  const labelSize = size === 'sm' ? t.fontSize.base : t.fontSize.md;

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
    ghost: 'transparent',
  };

  // Filled pills drop onto the edge; ghost squeezes. One shared value per path.
  const pressY = useSharedValue(0);
  const pressScale = useSharedValue(1);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressY.get() }, { scale: pressScale.get() }],
  }));

  function handlePressIn() {
    if (reducedMotion) return;
    if (isGhost) pressScale.set(withSpring(GHOST_PRESS_SCALE, t.motion.spring));
    else pressY.set(withTiming(DROP, { duration: t.motion.press }));
  }

  function handlePressOut() {
    if (reducedMotion) return;
    if (isGhost) pressScale.set(withSpring(1, t.motion.spring));
    else pressY.set(withSpring(0, t.motion.spring));
  }

  const wrapper: ViewStyle = {
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled ? t.opacity.disabled : 1,
    // Reserve the depth so a filled pill's edge doesn't overlap siblings. Ghost
    // is flat, so it claims no extra bottom space (keeps it aligned with a filled
    // sibling: the filled pill's reserved EDGE matches the ghost border thickness).
    paddingBottom: isGhost ? 0 : EDGE,
  };

  // Solid colored depth edge (filled variants only). Its bottom sliver reads as
  // one 3D edge, not a detached line.
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
    // Ghost reads as a flat outlined control — hairline border, no depth.
    ...(isGhost
      ? { borderWidth: t.borderWidth.hairline, borderColor: t.colors.border }
      : null),
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
      {/* Solid colored depth edge behind FILLED pills only */}
      {isGhost ? null : <View style={edgeBase} />}

      {/* Pill surface */}
      <Animated.View style={[pillContainer, pillStyle]}>
        {icon ?? null}
        <AppText
          style={{
            fontSize: labelSize,
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
