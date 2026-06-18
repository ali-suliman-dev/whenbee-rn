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
  /** The user's original guess (minutes) — now the hero figure on every row. */
  guessMin: number;
  /** Learned honest estimate (minutes). Shown as the quiet "plan ~N" support. */
  honestMin: number;
  /** Actual minutes once finished. Shown on done rows when known. */
  actualMin?: number | null;
  done?: boolean;
  onPress?: () => void;
}

export function TaskRow({ title, categoryLabel, guessMin, honestMin, actualMin, done = false, onPress }: TaskRowProps) {
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
  // Semantic "interactive" edge — thin indigo bar on queued rows only. A full-height
  // absolute track (top:0→bottom:0) centers the short bar with flexbox; `top: '50%'`
  // can't be used because the row height is content-driven (minHeight only), so the
  // percentage has no definite parent height to resolve against and the bar drops top.
  const edgeTrack: ViewStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  };
  const edge: ViewStyle = {
    width: t.row.edgeW,
    height: t.row.edgeH,
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
  const timeWrap: ViewStyle = { alignSelf: 'flex-end', alignItems: 'flex-end', gap: t.space[0.5] };
  const lineRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[0.5] };
  const leadNum: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.lg,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  const tookNum: TextStyle = { ...leadNum, fontSize: t.fontSize.base };
  const unit: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const planLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const planNum: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.sm,
    color: t.colors.amberText,
    fontVariant: ['tabular-nums'],
  };

  const content = (
    <Animated.View style={[row, pressStyle]}>
      {done ? (
        <View style={badge}>
          <Ionicons name="checkmark" size={t.iconSize.sm} color={t.colors.success} />
        </View>
      ) : (
        <View style={edgeTrack} pointerEvents="none">
          <View testID="taskrow-edge" style={edge} />
        </View>
      )}

      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <Text style={titleText} numberOfLines={1}>
          {title}
        </Text>
        <Text style={catText}>{categoryLabel}</Text>
      </View>

      {done ? (
        <View style={timeWrap}>
          {actualMin != null ? (
            <View style={lineRow}>
              <Text style={unit}>took </Text>
              <Text style={tookNum}>{actualMin}</Text>
              <Text style={unit}>min</Text>
            </View>
          ) : null}
          <Text style={planLabel}>guessed {guessMin}</Text>
        </View>
      ) : (
        <View style={timeWrap}>
          <View style={lineRow}>
            <Text style={leadNum}>{guessMin}</Text>
            <Text style={unit}>min</Text>
          </View>
          <View style={lineRow}>
            <Text style={planLabel}>plan </Text>
            <Text style={planNum}>~{honestMin}</Text>
            <Text style={unit}> min</Text>
          </View>
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
      accessibilityLabel={`${title}, ${categoryLabel}, you guessed ${guessMin} minutes, we plan ${honestMin}. Tap to start.`}
    >
      {content}
    </Pressable>
  );
}
