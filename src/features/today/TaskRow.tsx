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
// TaskRow — a single task on Today's list, in two states:
//   • queued — tappable; leading indigo "play" badge, title + category sub-line,
//              the honest estimate (~N min), chevron. Tapping starts the timer.
//   • done   — non-interactive; leading success check, dimmed title, the actual
//              minutes it took (the receipt). Kept on the day as visible progress.
// Flat surface + hairline (no shadow). Title-first; category is the quiet cue.
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
    opacity: done ? 0.7 : 1,
  };
  const badge: ViewStyle = {
    width: 32,
    height: 32,
    borderRadius: t.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: done ? t.colors.successSoft : t.colors.primarySoft,
  };
  const titleText: TextStyle = {
    ...(type.bodyLg as unknown as TextStyle),
    fontSize: t.fontSize.base,
    color: t.colors.ink,
    textDecorationLine: done ? 'line-through' : 'none',
  };
  const catText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const estNum: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.md,
    color: done ? t.colors.inkSoft : t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  const estUnit: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  const rightValue =
    done && actualMin != null ? `${actualMin}` : done ? null : `~${honestMin}`;

  const content = (
    <Animated.View style={[row, pressStyle]}>
      <View style={badge}>
        <Ionicons
          name={done ? 'checkmark' : 'play'}
          size={t.iconSize.sm}
          color={done ? t.colors.success : t.colors.primary}
        />
      </View>

      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <Text style={titleText} numberOfLines={1}>
          {title}
        </Text>
        <Text style={catText}>{categoryLabel}</Text>
      </View>

      {rightValue ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
          <Text style={estNum}>{rightValue}</Text>
          <Text style={estUnit}>min</Text>
        </View>
      ) : null}

      {!done ? (
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
      ) : null}
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
