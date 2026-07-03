import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';
import type { ReactNode } from 'react';
import { Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from './AppText';

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

type NewVariant = 'indigo' | 'amber' | 'ghost' | 'danger';
type LegacyVariant = 'primary' | 'secondary';
type Variant = NewVariant | LegacyVariant;
type Size = '2xs' | 'xs' | 'sm' | 'md' | 'lg';

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
  depth = 'standard',
  disabled = false,
  fullWidth = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  /** Coin-edge depth for FILLED variants. `shallow` = a thinner, calmer edge. */
  depth?: 'standard' | 'shallow';
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: { disabled?: boolean; selected?: boolean; checked?: boolean | 'mixed'; busy?: boolean; expanded?: boolean };
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // Coin-edge depth (filled) + squeeze (ghost), from tokens — no magic numbers.
  const shallow = depth === 'shallow';
  const EDGE = shallow ? t.depth.shallowEdge : t.depth.edge; // darker edge peeking below a FILLED pill (the 3D depth)
  const DROP = shallow ? t.depth.shallowDrop : t.depth.drop; // how far a filled pill drops onto the edge on press
  const GHOST_PRESS_SCALE = t.scale.pressIn; // ghost has no edge — a squeeze carries the press

  const resolved = resolveVariant(variant);
  const isGhost = resolved === 'ghost';
  // One coherent size scale — height, label font, and side padding all step up
  // together, so a bigger button is bigger in every axis (not just taller).
  //   2xs 28h · 10pt · 10padX     xs  32h · 12pt · 12padX
  //   sm  36h · 14pt · 16padX     md  44h · 16pt · 20padX     lg  52h · 20pt · 24padX
  const SIZE: Record<Size, { h: number; font: number; padX: number }> = {
    '2xs': { h: t.size.control.xxs, font: t.fontSize.xs, padX: t.space[2.5] },
    xs: { h: t.size.control.xs, font: t.fontSize.sm, padX: t.space[3] },
    sm: { h: t.size.control.sm, font: t.fontSize.base, padX: t.space[4] },
    md: { h: t.size.control.md, font: t.fontSize.md, padX: t.space[5] },
    lg: { h: t.size.control.lg, font: t.fontSize.lg, padX: t.space[6] },
  };
  const PILL_H = SIZE[size].h;
  const labelSize = SIZE[size].font;
  const padX = SIZE[size].padX;

  const bg: Record<NewVariant, string> = {
    indigo: t.colors.primary,
    amber: t.colors.accent,
    ghost: t.colors.surface,
    danger: t.colors.danger,
  };
  const fg: Record<NewVariant, string> = {
    indigo: t.colors.onIndigo,
    amber: t.colors.onAmber,
    ghost: t.colors.ink,
    danger: '#FFFFFF',
  };
  const edge: Record<NewVariant, string> = {
    indigo: t.colors.primaryEdge,
    amber: t.colors.accentEdge,
    ghost: 'transparent',
    danger: t.colors.dangerEdge,
  };

  // Filled pills drop onto the edge; ghost squeezes. One shared value per path.
  const pressY = useSharedValue(0);
  const pressScale = useSharedValue(1);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressY.get() }, { scale: pressScale.get() }],
  }));

  function handlePressIn() {
    // Haptic fires the instant the finger lands — before the motion guard, so
    // reduced-motion users still feel the tap even though the dip is suppressed.
    haptics.light();
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
    // NB: disabled dimming lives on the pill FACE (pillContainer), never here.
    // Parent opacity group-composites the whole subtree — the solid coin-edge
    // would wash out and stop reading as a raised edge (Android especially).
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
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: edge[resolved],
  };

  const pillContainer: ViewStyle = {
    height: PILL_H,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: bg[resolved],
    // Disabled keeps the FACE and edge fully solid/opaque (a real raised coin
    // edge) — only the LABEL mutes. Never put opacity on the face or wrapper:
    // it composites the whole pill and the edge stops reading as an edge.
    // Android drops the corner clip on press-layer promotion, squaring the pill.
    // overflow:hidden pins the rounded clip. (Edge is a sibling, not clipped.)
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: padX,
    // Ghost reads as a flat outlined control — hairline border, no depth.
    ...(isGhost ? { borderWidth: t.borderWidth.hairline, borderColor: t.colors.border } : null),
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState ?? (disabled ? { disabled: true } : undefined)}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={wrapper}
    >
      {/* Solid colored depth edge behind FILLED pills only */}
      {isGhost ? null : <View style={edgeBase} />}

      {/* Pill surface (face + edge stay fully solid) */}
      <Animated.View style={[pillContainer, pillStyle]}>
        {/* Only the CONTENT dims when disabled — face + coin edge stay opaque. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space[2],
            opacity: disabled ? t.opacity.disabled : 1,
          }}
        >
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
        </View>
      </Animated.View>
    </Pressable>
  );
}
