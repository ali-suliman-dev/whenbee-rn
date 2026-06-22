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
// Two layouts, one component:
//   tile — glyph on top, label below; used in a 2-col grid for 3–4-option steps.
//   row  — glyph left, label right, full width; used for 2-option steps.
//
// Selected = indigo `primaryChip` fill on a solid `primaryEdge` coin-edge, the
// surface lifted ~2px so it reads as a card pressed proud of its edge (mirrors
// AppButton's filled-pill depth). The glyph flips to its amber `active` state.
// No border line — the fill + lift carry the selection.
//
// reactCompiler + NativeWind drop function-style `style` on a Pressable, so the
// Pressable stays a bare touch wrapper: every visual + the press dip lives on an
// inner Animated.View. Press-in dips scale to `scale.pressIn`; release springs
// back. Entering-only — no exiting layout animation (Fabric crash guard).
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

  // The coin-edge depth: how far the darker indigo edge peeks below the surface
  // when selected, and how far the surface lifts proud of it (the 2px lift).
  const EDGE = t.depth.edge;
  const LIFT = t.space[0.5]; // 2pt upward lift on select (spec)

  // Press dip lives on the surface; the bare Pressable holds no visual style.
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
    // selection-tick: the native single-select texture. lib/haptics is boundary-
    // safe + already platform-guarded (no-op on web / failures swallowed).
    if (!selected) haptics.selection();
    onPress();
  }

  // Wrapper reserves the edge depth so a selected option's coin-edge never
  // overlaps a sibling row/tile (cf. AppButton). Unselected reserves nothing.
  const wrapper: ViewStyle = {
    alignSelf: 'stretch',
    flex: isTile ? 1 : undefined,
    paddingBottom: selected ? EDGE : 0,
  };

  // Solid indigo depth edge behind the surface — only while selected.
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
    paddingVertical: isTile ? t.space[5] : t.space[4],
    paddingHorizontal: t.space[4],
    minHeight: isTile ? undefined : t.size.control.lg,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: selected ? t.colors.primaryChip : t.colors.surfaceRaised,
  };

  const labelStyle: TextStyle = {
    flexShrink: 1,
    textAlign: isTile ? 'center' : 'left',
    fontSize: t.fontSize.md,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: selected ? t.colors.primary : t.colors.ink,
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
        <ArchetypeQuizGlyph kind={glyph} active={selected} />
        <AppText style={labelStyle}>{label}</AppText>
      </Animated.View>
    </Pressable>
  );
}
