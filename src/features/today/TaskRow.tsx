import { useEffect, useRef, useCallback } from 'react';
import { Pressable, View, Text, useWindowDimensions, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';

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
  /** The user's original guess (minutes). Shown as the quiet "guessed N" support. */
  guessMin: number;
  /** Learned honest estimate (minutes) — the hero figure on every queued row. */
  honestMin: number;
  /** Actual minutes once finished. Shown on done rows when known. */
  actualMin?: number | null;
  done?: boolean;
  onPress?: () => void;
  /** Delete this task (the swipe-revealed Delete tap, or the long-press sheet). */
  onDelete?: () => void;
  /** Long-press the row → present the delete sheet (a11y / discoverable path). */
  onLongPress?: () => void;
  /** First-run only: briefly reveal then re-hide the swipe once, to teach it. */
  peekHint?: boolean;
  /** When true, slide the row left off-screen then call onDelete (teaches swipe direction). */
  isExiting?: boolean;
}

export function TaskRow({
  title,
  categoryLabel,
  guessMin,
  honestMin,
  actualMin,
  done = false,
  onPress,
  onDelete,
  onLongPress,
  peekHint = false,
  isExiting = false,
}: TaskRowProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  const opacity = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  const exitX = useSharedValue(0);
  const exitStyle = useAnimatedStyle(() => ({ transform: [{ translateX: exitX.get() }] }));

  function pressIn() {
    if (reducedMotion || done) return;
    opacity.set(withTiming(t.opacity.pressed, { duration: t.motion.fast }));
  }
  function pressOut() {
    if (reducedMotion || done) return;
    opacity.set(withTiming(1, { duration: t.motion.fast }));
  }

  const triggerOnDelete = useCallback(() => { onDelete?.(); }, [onDelete]);

  useEffect(() => {
    if (!isExiting) return;
    exitX.set(
      withTiming(
        -screenWidth,
        { duration: t.motion.base, easing: Easing.in(Easing.ease) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(triggerOnDelete)();
        },
      ),
    );
  // exitX and triggerOnDelete are stable refs; screenWidth only changes on rotation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExiting]);

  const swipeRef = useRef<SwipeableMethods | null>(null);
  const hasPeeked = useRef(false);
  useEffect(() => {
    if (!peekHint || reducedMotion || !onDelete || hasPeeked.current) return;
    hasPeeked.current = true;
    const open = setTimeout(() => swipeRef.current?.openRight(), t.motion.fast);
    const close = setTimeout(() => swipeRef.current?.close(), t.motion.fast + t.motion.reveal);
    return () => {
      clearTimeout(open);
      clearTimeout(close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peekHint, reducedMotion, t.motion]);

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
    fontSize: t.fontSize.sm,
    color: done ? t.colors.inkSoft : t.colors.ink,
  };
  const catText: TextStyle = { ...(type.caption as unknown as TextStyle), fontSize: t.fontSize.xs, color: t.colors.inkSoft };
  const timeWrap: ViewStyle = { alignSelf: 'flex-end', alignItems: 'flex-end', gap: t.space[0.5] };
  const lineRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[0.5] };
  const leadNum: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.md,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  const tookNum: TextStyle = { ...leadNum, fontSize: t.fontSize.sm };
  const unit: TextStyle = { ...(type.caption as unknown as TextStyle), fontSize: t.fontSize.xs, color: t.colors.inkSoft };
  const deleteAction: ViewStyle = {
    backgroundColor: t.colors.danger,
    borderTopRightRadius: t.radii.card,
    borderBottomRightRadius: t.radii.card,
    justifyContent: 'center',
    alignItems: 'center',
    width: t.size.control.lg + t.space[5] + t.space[4],
    marginLeft: -t.radii.card,
    paddingLeft: t.radii.card,
  };
  const deleteLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    fontSize: t.fontSize.xs,
    color: t.colors.paper,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    marginTop: t.space[0.5],
  };

  const content = (
    <Animated.View style={[row, pressStyle, exitStyle]}>
      {done ? (
        <View style={badge}>
          <Ionicons name="checkmark" size={t.iconSize.sm} color={t.colors.success} />
        </View>
      ) : null}

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
          <Text style={unit}>guessed {guessMin}</Text>
        </View>
      ) : (
        <View style={timeWrap}>
          <View style={lineRow}>
            <Text style={leadNum}>~{honestMin}</Text>
            <Text style={unit}> min</Text>
          </View>
          <Text style={unit}>guessed {guessMin}</Text>
        </View>
      )}
    </Animated.View>
  );

  function renderRightActions() {
    return (
      <Pressable
        testID="taskrow-delete"
        onPress={() => {
          haptics.medium();
          onDelete?.();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${title}`}
        style={deleteAction}
      >
        <Ionicons name="trash-outline" size={t.iconSize.xs} color={t.colors.paper} />
        <Text style={deleteLabel}>Remove</Text>
      </Pressable>
    );
  }

  const interactive = (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${categoryLabel}, plan for ${honestMin} minutes, you guessed ${guessMin}. Tap to start.`}
    >
      {content}
    </Pressable>
  );

  // Done rows aren't startable but are still deletable: a bare long-press wrapper.
  const body =
    done || !onPress ? (
      onLongPress ? (
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={300}
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${categoryLabel}`}
        >
          {content}
        </Pressable>
      ) : (
        content
      )
    ) : (
      interactive
    );

  if (!onDelete) return body;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
    >
      {body}
    </ReanimatedSwipeable>
  );
}
