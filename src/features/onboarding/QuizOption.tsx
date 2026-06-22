import { Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
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
// Selected = indigo `primaryChip` fill on a solid `primaryEdge` coin-edge, the
// surface lifted ~2px proud of that edge (mirrors AppButton's filled-pill depth).
// The glyph flips to its amber `active` state. No border line.
//
// reactCompiler drops function-style `style` on a Pressable, so the Pressable
// stays a bare touch wrapper; the visual + press dip live on the inner View.
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

  const EDGE = t.depth.edge;
  const LIFT = t.space[0.5];

  const pressScale = useSharedValue(1);
  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.get() }, { translateY: selected ? -LIFT : 0 }],
  }));

  function handlePressIn() {
    if (reducedMotion) return;
    pressScale.set(withTiming(t.scale.pressIn, { duration: t.motion.press }));
  }
  function handlePressOut() {
    if (reducedMotion) return;
    pressScale.set(withSpring(1, t.motion.spring));
  }
  function handlePress() {
    if (!selected) haptics.selection();
    onPress();
  }

  // Bare wrapper. Width comes from the parent (tile grid) or stretch (row) — never
  // a flex here, so a tile can't grow and crush its neighbours.
  const wrapper: ViewStyle = {
    alignSelf: 'stretch',
    paddingBottom: selected ? EDGE : 0,
  };

  const edgeBase: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: EDGE,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: t.colors.primaryEdge,
  };

  const surface: ViewStyle = {
    flexDirection: isTile ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: isTile ? 'center' : 'flex-start',
    gap: isTile ? t.space[2] : t.space[3],
    paddingVertical: t.space[4],
    paddingHorizontal: t.space[4],
    minHeight: isTile ? t.size.control.lg * 2 : t.size.control.lg,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    // SOLID indigo when selected (a translucent chip over the coin-edge bled into a
    // bright blur and made indigo-on-indigo text vanish). Solid fill + light text.
    backgroundColor: selected ? t.colors.primary : t.colors.surfaceRaised,
  };

  const labelStyle: TextStyle = {
    flexShrink: 1,
    textAlign: isTile ? 'center' : 'left',
    fontSize: t.fontSize.md,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: selected ? t.colors.onIndigo : t.colors.ink,
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
      {selected ? <View style={edgeBase} /> : null}
      <Animated.View style={[surface, surfaceStyle]}>
        <ArchetypeQuizGlyph kind={glyph} active={selected} size={isTile ? t.iconSize.xl : t.iconSize.md} />
        <AppText style={labelStyle}>{label}</AppText>
      </Animated.View>
    </Pressable>
  );
}
