import { Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReorderableDrag } from 'react-native-reorderable-list';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { DurationWheel } from './DurationWheel';
import { formatClock } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// PlanTaskCard — one task row rendered inside the Build or Run list.
//
// variant='build'
//   ⠿ drag handle · [start–end range chip (mono, primary) · title · category]
//   · <DurationWheel>
//   Long-press activates reorder drag (vertical). Horizontal swipe reveals a
//   trash icon and commits a delete — gated with activeOffsetX so it does NOT
//   fight the reorderable list's vertical long-press drag.
//
//   Reduced-motion path: swipe animation is skipped; a tappable trash button
//   (permanently visible on the leading edge) is shown instead.
//
// variant='run'  (Task 10 — props designed for it, rendering deferred)
//   Receives same data shape; the run variant will add a play button and
//   status badge but shares the same card layout and token palette.
//
// Fabric gotcha: Pressable is a bare touch wrapper; all visuals live on
// inner Views (React Compiler drops function-form styles on Pressable).
// ──────────────────────────────────────────────────────────────────────────────

// Width of the revealed delete zone on swipe-left
const DELETE_ZONE_WIDTH = 72;
// How far the user must swipe (or velocity) to commit delete
const SWIPE_THRESHOLD = DELETE_ZONE_WIDTH * 0.55;
const SWIPE_VELOCITY_THRESHOLD = 600;

export interface PlanTaskCardProps {
  variant: 'build' | 'run';
  id: string;
  label: string;
  category: string;
  durationMin: number;
  /** Epoch ms when this task starts (computed by planBackward). */
  startAt?: number;
  /** Epoch ms when this task ends. */
  endAt?: number;
  /** Called when the user scrolls the duration wheel (build only). */
  onDurationChange?: (min: number) => void;
  /** Called when the user deletes this task (build only). */
  onDelete?: (id: string) => void;
}

// ── Delete reveal background ──────────────────────────────────────────────────

function DeleteBackground({ t }: { t: ReturnType<typeof useTheme> }) {
  const bgStyle: ViewStyle = {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_ZONE_WIDTH,
    backgroundColor: t.colors.inkFaint,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
  };
  const iconStyle: TextStyle = {
    fontSize: t.iconSize.md,
    color: t.colors.surface,
  };
  return (
    <View style={bgStyle}>
      <AppText style={iconStyle}>🗑</AppText>
    </View>
  );
}

// ── Build card ────────────────────────────────────────────────────────────────

function BuildCard({
  id,
  label,
  category,
  durationMin,
  startAt,
  endAt,
  onDurationChange,
  onDelete,
}: Omit<PlanTaskCardProps, 'variant'>) {
  const t = useTheme();
  const drag = useReorderableDrag();
  const reducedMotion = useReducedMotion();

  // Shared value for horizontal translation of the card face
  const translateX = useSharedValue(0);

  function commitDelete() {
    if (onDelete) {
      onDelete(id);
    }
  }

  // Horizontal swipe gesture — gated so it does not fight the vertical drag.
  // activeOffsetX fires only when horizontal movement > 10pt before vertical
  // movement > 5pt, which lets the long-press/drag own vertical intent cleanly.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((e) => {
      // Only allow left swipe (negative direction = reveal delete zone)
      const clamped = Math.min(0, e.translationX);
      translateX.set(clamped);
    })
    .onEnd((e) => {
      const pastThreshold =
        translateX.get() < -SWIPE_THRESHOLD ||
        e.velocityX < -SWIPE_VELOCITY_THRESHOLD;

      if (pastThreshold) {
        // Snap fully open then commit delete
        translateX.set(
          withTiming(
            -DELETE_ZONE_WIDTH,
            { duration: t.motion.fast },
            () => {
              runOnJS(commitDelete)();
            },
          ),
        );
      } else {
        // Snap back
        translateX.set(
          withSpring(0, {
            damping: t.motion.spring.damping,
            stiffness: t.motion.spring.stiffness,
          }),
        );
      }
    });

  const animatedFaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: reducedMotion ? 0 : translateX.get() }],
  }));

  const cardStyle: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[3],
    gap: t.space[3],
    minHeight: t.size.planCardMin,
  };

  const bodyStyle: ViewStyle = {
    flex: 1,
    minWidth: 0,
    gap: t.space[0.5],
  };

  const rangeStyle: TextStyle = {
    fontFamily: t.fontFamily.mono,
    fontSize: t.fontSize.xs,
    color: t.colors.primary,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
  };

  const titleStyle: TextStyle = {
    fontSize: t.fontSize.bodySm,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.ink,
  };

  const categoryStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    color: t.colors.inkSoft,
  };

  const dragHandleStyle: ViewStyle = {
    paddingHorizontal: t.space[1],
    justifyContent: 'center',
    alignItems: 'center',
    gap: t.space[1],
  };

  // Grip line: width from size token, height from space[0.5] (= 2pt)
  const gripLineStyle: ViewStyle = {
    width: t.size.gripW,
    height: t.space[0.5],
    backgroundColor: t.colors.inkFaint,
    borderRadius: t.radii.full,
  };

  const rangeText =
    startAt !== undefined && endAt !== undefined
      ? `${formatClock(startAt)}–${formatClock(endAt)}`
      : null;

  // Reduced-motion fallback: a plain tappable trash button replaces the swipe
  const trashFallbackStyle: ViewStyle = {
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[1],
    justifyContent: 'center',
    alignItems: 'center',
  };
  const trashIconStyle: TextStyle = {
    fontSize: t.iconSize.md,
    color: t.colors.inkFaint,
  };

  const cardFace = (
    <Pressable
      onLongPress={drag}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${durationMin} minutes. Long press to reorder.`}
      delayLongPress={200}
    >
      <View style={cardStyle}>
        {/* Drag handle */}
        <View style={dragHandleStyle} accessibilityElementsHidden>
          <View style={gripLineStyle} />
          <View style={gripLineStyle} />
          <View style={gripLineStyle} />
        </View>

        {/* Task body */}
        <View style={bodyStyle}>
          {rangeText !== null ? <AppText style={rangeStyle}>{rangeText}</AppText> : null}
          <AppText style={titleStyle} numberOfLines={1}>
            {label}
          </AppText>
          <AppText style={categoryStyle} numberOfLines={1}>
            {category}
          </AppText>
        </View>

        {/* Reduced-motion fallback delete button */}
        {reducedMotion && onDelete ? (
          <Pressable
            onPress={() => onDelete(id)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${label}`}
            style={trashFallbackStyle}
          >
            <AppText style={trashIconStyle}>🗑</AppText>
          </Pressable>
        ) : null}

        {/* Duration wheel — slim, pinned far-right */}
        <DurationWheel
          valueMin={durationMin}
          onChange={(min) => onDurationChange?.(min)}
        />
      </View>
    </Pressable>
  );

  // Swipe is only available when reduced-motion is off and onDelete is wired
  if (!reducedMotion && onDelete) {
    return (
      <View style={{ marginBottom: t.space[2] }}>
        <DeleteBackground t={t} />
        <GestureDetector gesture={swipeGesture}>
          <Animated.View style={animatedFaceStyle}>{cardFace}</Animated.View>
        </GestureDetector>
      </View>
    );
  }

  return <View style={{ marginBottom: t.space[2] }}>{cardFace}</View>;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PlanTaskCard(props: PlanTaskCardProps) {
  if (props.variant === 'build') {
    const { variant: _v, ...rest } = props;
    return <BuildCard {...rest} />;
  }

  // Run variant — Task 10 will implement this; we return null for now so the
  // component tree compiles without a missing-return TS error.
  return null;
}
