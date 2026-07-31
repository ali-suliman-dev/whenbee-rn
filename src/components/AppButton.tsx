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
  tone = 'surface',
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
  /** GHOST-only face color. `sunken` reads as an inset dark tile — use when the
   *  button sits directly on a card whose bg is `colors.surface` (the default
   *  ghost face), where the two would otherwise be indistinguishable. */
  tone?: 'surface' | 'sunken';
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
    ghost: tone === 'sunken' ? t.colors.surfaceSunken : t.colors.surface,
    danger: t.colors.danger,
  };
  const fg: Record<NewVariant, string> = {
    indigo: t.colors.onIndigo,
    amber: t.colors.onAmber,
    ghost: t.colors.ink,
    danger: t.colors.onIndigo, // was '#FFFFFF' — hardcoded hex, now a token
  };
  const edge: Record<NewVariant, string> = {
    indigo: t.colors.primaryEdge,
    amber: t.colors.accentEdge,
    ghost: 'transparent',
    danger: t.colors.dangerEdge,
  };

  // A disabled control mutes its FACE, never its label. onIndigo/onAmber are DARK
  // inks — fading them toward a bright fill makes them sink in (1.92:1) rather
  // than grey out. Inert face + full-opacity label reads as 3.28:1 and is
  // unmistakably not the live control.
  const faceColor = disabled ? t.colors.controlDisabled : bg[resolved];
  const labelColor = disabled ? t.colors.onControlDisabled : fg[resolved];
  const edgeColor = disabled ? t.colors.controlDisabledEdge : edge[resolved];

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
    backgroundColor: edgeColor,
  };

  const pillContainer: ViewStyle = {
    height: PILL_H,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: faceColor,
    // Disabled mutes the FACE (see faceColor above). Never put opacity on the
    // face or wrapper: it composites the whole pill and the edge stops reading
    // as an edge.
    // Keep overflow VISIBLE. `overflow:'hidden'` here dropped the label Text on
    // Android for FILLED variants inside a react-native-screens formSheet: the
    // clipped face composites to a hardware texture that fails to draw its Text
    // children when the absolute coin-edge sibling is present (the label went
    // invisible only when the button was enabled). The content never spills the
    // pill, so no clip is needed; corner-rounding on press is instead preserved by
    // keeping the press transform on the OUTER wrapper (below), so the rounded
    // face is never the promoted layer.
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: padX,
    // The disabled face sits only ~1.3:1 off the page — a hairline holds its shape.
    ...(isGhost || disabled
      ? { borderWidth: t.borderWidth.hairline, borderColor: disabled ? edgeColor : t.colors.border }
      : null),
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
      {/* Solid colored depth edge behind FILLED pills only. A disabled pill is
          flat: it is not a live coin, so it gets no raised edge. */}
      {isGhost || disabled ? null : <View style={edgeBase} />}

      {/* The press transform lives on the OUTER view; the rounded overflow-clip on
          the INNER static face. On Android an overflow:hidden view that ALSO carries
          the transform is promoted to a hardware layer that DROPS its Text children
          whenever the absolute coin-edge sibling is present (i.e. enabled filled
          variants) — that's why the label went invisible only when enabled. Keeping
          the clip off the animated layer draws the label while preserving both the
          press drop and the rounded corners. */}
      <Animated.View style={pillStyle}>
        <View testID="appbutton-face" style={pillContainer}>
          <View
            testID="appbutton-content"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.space[2],
              opacity: 1,
            }}
          >
            {icon ?? null}
            <AppText
              style={{
                fontSize: labelSize,
                fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
                color: labelColor,
              }}
            >
              {label}
            </AppText>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
