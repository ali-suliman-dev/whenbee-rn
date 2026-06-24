import { useEffect } from 'react';
import { Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { ArchetypeQuizGlyph, type QuizGlyphKind } from './ArchetypeQuizGlyph';

// ──────────────────────────────────────────────────────────────────────────────
// QuizOption — a selectable answer for the "Whenbee learns you" quiz.
//
//   tile — glyph above label, centered; the parent grid sets its WIDTH (this
//          component never sets flex/width, so it can't collapse a sibling).
//   row  — glyph left, label right, full width; for 2-option steps.
//
// TACTILE MODEL (physical radio) — every option is a real button:
//   • At rest it sits PROUD on a coin-edge (surfaceRaisedEdge), exactly like
//     AppButton's filled pill — clearly pressable.
//   • Pressing drops the surface onto its edge (the same physical push as the
//     primary buttons — not a scale "zap") + a haptic buzz.
//   • The CHOSEN option stays SEATED — pushed in, marked by an indigo RING and
//     its glyph lighting amber. The surface NEVER floods indigo: a filled-indigo
//     tile fights the one filled-indigo element per screen (the Next CTA) and
//     reads cheap. Picking another pops this one back up.
//
// reactCompiler drops function-style `style` on a Pressable, so the Pressable
// stays a bare touch wrapper; the coin-edge + push live on the inner View.
// Entering-only — no exiting layout animation (Fabric crash guard).
// ──────────────────────────────────────────────────────────────────────────────

type Layout = 'tile' | 'row';

export function QuizOption({
  layout,
  label,
  glyph,
  selected,
  onPress,
}: {
  layout: Layout;
  label: string;
  glyph: QuizGlyphKind;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const isTile = layout === 'tile';

  const EDGE = t.depth.optionEdge; // refined coin-edge (a touch prouder than shallow), small seat travel
  const H = isTile ? t.size.control.lg * 2 : t.size.control.lg + t.space[3]; // fixed surface height (edge must match)

  // pressed (finger-down) and selected both drive the surface DOWN onto its edge.
  // `selected` is a prop — mirror it into a shared value so the worklet reacts when
  // another tile steals the selection (this one pops back up).
  const pressed = useSharedValue(0);
  const selectedSv = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    selectedSv.set(selected ? 1 : 0);
  }, [selected, selectedSv]);

  const translateY = useDerivedValue(() => {
    const down = pressed.get() === 1 || selectedSv.get() === 1;
    if (reducedMotion) return down ? EDGE : 0;
    // Finger-down: snappy push. Settle/pop-up: calm ease-out — no spring bounce.
    if (pressed.get() === 1) return withTiming(EDGE, { duration: t.motion.press });
    return withTiming(down ? EDGE : 0, { duration: t.motion.base, easing: Easing.out(Easing.cubic) });
  });
  const surfaceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  function handlePressIn() {
    haptics.light(); // immediate tactile ack the instant the finger lands (cf. AppButton)
    pressed.set(1);
  }
  function handlePressOut() {
    pressed.set(0);
  }
  function handlePress() {
    if (!selected) haptics.selection(); // soft confirm as it locks in
    onPress();
  }

  // Bare wrapper. Width comes from the parent (tile grid) or stretch (row) — never
  // a flex here, so a tile can't grow and crush its neighbours. paddingBottom
  // reserves the coin-edge so it never overlaps a sibling.
  const wrapper: ViewStyle = {
    alignSelf: 'stretch',
    paddingBottom: EDGE,
  };

  // Neutral coin-edge behind the surface (hidden once the chosen tile seats down).
  const edgeBase: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: H,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceRaisedEdge,
  };

  // Surface keeps its dark fill always — selection is an indigo RING, never a
  // flood. Border is always 2px (transparent when unchosen) so geometry is fixed.
  const surface: ViewStyle = {
    height: H,
    flexDirection: isTile ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: isTile ? 'center' : 'flex-start',
    gap: isTile ? t.space[2] : t.space[3],
    paddingHorizontal: t.space[4],
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: t.borderWidth.thick,
    borderColor: selected ? t.colors.primary : 'transparent',
  };

  const labelStyle: TextStyle = {
    flexShrink: 1,
    textAlign: isTile ? 'center' : 'left',
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.ink,
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={wrapper}
    >
      <View style={edgeBase} />
      <Animated.View style={[surface, surfaceStyle]}>
        <ArchetypeQuizGlyph
          kind={glyph}
          active={selected}
          size={isTile ? t.iconSize.xl : t.iconSize.md}
        />
        <AppText style={labelStyle}>{label}</AppText>
      </Animated.View>
    </Pressable>
  );
}
