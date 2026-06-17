import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// TaskRow — one Today list task, in two states:
//   • queued — pressable; a thin indigo left edge marks it "startable" (semantic,
//              not a category color). Title + category, the honest estimate pinned
//              to the row's bottom edge in ink. No play badge, no chevron — the
//              FocusCard owns the single filled-indigo "start" affordance.
//   • done   — non-interactive; leading success check, muted title (NO strikethrough
//              — the check + dimming say "done"; a strike would read as a scold),
//              "took N min" receipt. Kept on the day as visible progress.
// Flat surface + hairline. The estimate is ink (not muted) so it reads clearly at
// the same size as the body — clarity from contrast, not from a bigger number.
// ──────────────────────────────────────────────────────────────────────────────

interface TaskRowProps {
  title: string;
  categoryLabel: string;
  /** Learned honest estimate (minutes). Shown on queued rows. */
  honestMin: number;
  /** Actual minutes once finished. Shown on done rows when known. */
  actualMin?: number | null;
  done?: boolean;
  onPress?: () => void;
}

export function TaskRow({ title, categoryLabel, honestMin, actualMin, done = false, onPress }: TaskRowProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  function pressIn() {
    if (reducedMotion || done) return;
    opacity.set(withTiming(t.opacity.pressed, { duration: t.motion.fast }));
  }
  function pressOut() {
    if (reducedMotion || done) return;
    opacity.set(withTiming(1, { duration: t.motion.fast }));
  }

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
    minHeight: t.size.control.lg,
    position: 'relative',
    overflow: 'hidden',
    opacity: done ? 0.7 : 1,
  };
  // Semantic "interactive" edge — thin indigo bar, vertically centered, on queued rows only.
  const edge: ViewStyle = {
    position: 'absolute',
    left: 0,
    top: '50%',
    width: t.row.edgeW,
    height: t.row.edgeH,
    marginTop: -t.row.edgeH / 2,
    backgroundColor: t.colors.primary,
    borderTopRightRadius: t.row.edgeW,
    borderBottomRightRadius: t.row.edgeW,
  };
  const badge: ViewStyle = {
    width: t.space[8],
    height: t.space[8],
    borderRadius: t.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.successSoft,
  };
  const titleText: TextStyle = {
    ...(type.bodyLg as unknown as TextStyle),
    fontSize: t.fontSize.base,
    color: done ? t.colors.inkSoft : t.colors.ink,
  };
  const catText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const timeWrap: ViewStyle = { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'baseline', gap: t.space[0.5] };
  const estNum: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.base,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  const estUnit: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  const content = (
    <Animated.View style={[row, pressStyle]}>
      {done ? (
        <View style={badge}>
          <Ionicons name="checkmark" size={t.iconSize.sm} color={t.colors.success} />
        </View>
      ) : (
        <View testID="taskrow-edge" style={edge} />
      )}

      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <Text style={titleText} numberOfLines={1}>
          {title}
        </Text>
        <Text style={catText}>{categoryLabel}</Text>
      </View>

      {done ? (
        actualMin != null ? (
          <View style={timeWrap}>
            <Text style={estUnit}>took </Text>
            <Text style={estNum}>{actualMin}</Text>
            <Text style={estUnit}>min</Text>
          </View>
        ) : null
      ) : (
        <View style={timeWrap}>
          <Text style={estNum}>~{honestMin}</Text>
          <Text style={estUnit}>min</Text>
        </View>
      )}
    </Animated.View>
  );

  if (done || !onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${categoryLabel}, honest estimate ${honestMin} minutes. Tap to start.`}
    >
      {content}
    </Pressable>
  );
}
