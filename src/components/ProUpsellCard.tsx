import { Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';

// ──────────────────────────────────────────────────────────────────────────────
// ProUpsellCard — the single Pro "pass" entry point (Whenbee hub + Settings). A
// ticket: a gilt amber stub (the honey/reward accent — scarce, carried here, not
// in the body text) with a honeycomb-clock crest and a perforated seam, joined to
// a calm surface body with a PRO tag, title and note.
//
// It presses like AppButton's filled pill — the face drops onto a solid amber
// coin-edge (no boxShadow; RN 0.81 renders that as a hard line). Flat Tactical.
// Amber = honey/reward semantic; indigo stays scarce elsewhere, never the Pro CTA.
// ──────────────────────────────────────────────────────────────────────────────

interface ProUpsellCardProps {
  title: string;
  note: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** A honeycomb cell holding a small clock — the "honest time, banked" crest. */
function HoneyCrest({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 50 54">
      <Polygon
        points="25,3 43,13 43,35 25,45 7,35 7,13"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
      />
      <Circle cx={25} cy={24} r={9} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M25 24 v-5 M25 24 l4 2.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function ProUpsellCard({ title, note, onPress, accessibilityLabel }: ProUpsellCardProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const EDGE = t.upsell.edge;
  const DROP = EDGE - 1;

  const pressY = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pressY.get() }] }));

  function handlePressIn() {
    if (reducedMotion) return;
    pressY.set(withTiming(DROP, { duration: t.motion.press }));
  }
  function handlePressOut() {
    if (reducedMotion) return;
    pressY.set(withSpring(0, t.motion.spring));
  }

  const wrapper: ViewStyle = { paddingBottom: EDGE };
  const edge: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: EDGE,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: t.colors.accentEdge,
  };
  const face: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
  };
  const stub: ViewStyle = {
    width: t.upsell.stub,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.accent,
  };
  // Perforation: a dashed seam + two background-colored notches that "cut" the
  // ticket where the stub meets the body.
  const seam: ViewStyle = {
    position: 'absolute',
    left: t.upsell.stub,
    top: 0,
    bottom: 0,
    width: t.borderWidth.thick,
    borderLeftWidth: t.borderWidth.thick,
    borderColor: t.colors.accentEdge,
    borderStyle: 'dashed',
    opacity: t.opacity.pressed,
  };
  const notchBase: ViewStyle = {
    position: 'absolute',
    left: t.upsell.stub - t.upsell.notch / 2,
    width: t.upsell.notch,
    height: t.upsell.notch,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.bg,
  };
  const body: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    paddingVertical: t.space[3],
    paddingHorizontal: t.space[4],
  };

  const proTag: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.amberText,
    marginBottom: t.space[1],
  };
  const titleStyle: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const noteStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[0.5],
  };

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={wrapper}
    >
      <View style={edge} />
      <Animated.View style={[face, faceStyle]}>
        <View style={stub}>
          <HoneyCrest size={t.upsell.emblem} color={t.colors.onAmber} />
        </View>
        <View style={body}>
          <View style={{ flex: 1 }}>
            <AppText style={proTag}>Pro</AppText>
            <AppText style={titleStyle}>{title}</AppText>
            <AppText style={noteStyle}>{note}</AppText>
          </View>
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.accent} />
        </View>
        <View style={seam} />
        <View style={[notchBase, { top: -t.upsell.notch / 2 }]} />
        <View style={[notchBase, { bottom: -t.upsell.notch / 2 }]} />
      </Animated.View>
    </Pressable>
  );
}
