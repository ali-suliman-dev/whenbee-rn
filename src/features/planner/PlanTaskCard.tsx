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
import { AppButton } from '@/src/components/AppButton';
import { DurationWheel } from './DurationWheel';
import { formatClock } from '@/src/lib/time';
import type { PlanTaskStatus } from '@/src/domain/types';

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

  // ── Run-variant props ──────────────────────────────────────────────────────
  /** Run lifecycle status for the run variant. */
  runStatus?: PlanTaskStatus;
  /** Actual minutes logged when status === 'done'. */
  actualMin?: number;
  /** Progress 0–1 for the now card's progress bar. */
  progress?: number;
  /**
   * Called when the user taps "Open timer" on the now card.
   * Task 12 will wire this to the timer screen navigation.
   */
  onOpenTimer?: (id: string) => void;
  /**
   * Called when the user taps ▶ on an upcoming card.
   * Task 12 will wire this to start the timer for this task.
   */
  onStart?: (id: string) => void;
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
    paddingVertical: t.space[0],
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

// ── Run: done card ────────────────────────────────────────────────────────────

function DoneRunCard({
  label,
  category,
  actualMin,
}: {
  label: string;
  category: string;
  actualMin?: number;
}) {
  const t = useTheme();

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
    opacity: t.opacity.disabled,
  };

  const bodyStyle: ViewStyle = {
    flex: 1,
    minWidth: 0,
    gap: t.space[0.5],
  };

  const titleStyle: TextStyle = {
    fontSize: t.fontSize.bodySm,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.ink,
    textDecorationLine: 'line-through',
    textDecorationColor: t.colors.inkFaint,
  };

  const metaStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    color: t.colors.inkSoft,
  };

  const loggedText =
    actualMin !== undefined && actualMin > 0 ? `logged ${actualMin}m` : '';

  return (
    <View style={cardStyle}>
      <View style={bodyStyle}>
        <AppText style={titleStyle} numberOfLines={1}>
          {label}
        </AppText>
        <AppText style={metaStyle} numberOfLines={1}>
          {category}
          {loggedText.length > 0 ? ` · ${loggedText}` : ''}
        </AppText>
      </View>
    </View>
  );
}

// ── Run: now card (pinned, no drag, no swipe) ─────────────────────────────────

function NowRunCard({
  id,
  label,
  category,
  endAt,
  progress = 0,
  onOpenTimer,
}: {
  id: string;
  label: string;
  category: string;
  endAt?: number;
  progress?: number;
  onOpenTimer?: (id: string) => void;
}) {
  const t = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.primary,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    flexDirection: 'column',
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[3],
    gap: t.space[2],
    // Platform-safe soft elevation (no boxShadow)
    ...({
      ios: {
        shadowColor: t.colors.shadowSoft,
        shadowOffset: { width: 0, height: t.shadow.sm.offset },
        shadowOpacity: t.shadow.sm.opacity,
        shadowRadius: t.shadow.sm.radius,
      },
      android: {
        elevation: 3,
      },
    } as ViewStyle),
  };

  const headStyle: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const runTagStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.primary,
    letterSpacing: t.letterSpacing.wide,
  };

  const lockStyle: TextStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkFaint,
  };

  const titleStyle: TextStyle = {
    fontSize: t.fontSize.bodyLg,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.ink,
  };

  const metaStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    color: t.colors.inkSoft,
    marginTop: t.space[0.5],
  };

  const doneAtText = endAt !== undefined ? `done ~${formatClock(endAt)}` : '';

  const progressTrackStyle: ViewStyle = {
    height: t.progress.track,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    overflow: 'hidden',
  };

  const progressFillStyle: ViewStyle = {
    height: '100%',
    width: `${Math.min(100, Math.max(0, progress * 100))}%`,
    backgroundColor: t.colors.primary,
    borderRadius: t.radii.full,
  };

  return (
    <View style={cardStyle}>
      {/* Head: running tag + lock */}
      <View style={headStyle}>
        <AppText style={runTagStyle}>● RUNNING</AppText>
        <AppText style={lockStyle}>🔒</AppText>
      </View>

      {/* Task identity */}
      <View>
        <AppText style={titleStyle} numberOfLines={1}>
          {label}
        </AppText>
        <AppText style={metaStyle} numberOfLines={1}>
          {category}
          {doneAtText.length > 0 ? ` · ${doneAtText}` : ''}
        </AppText>
      </View>

      {/* Progress bar */}
      <View style={progressTrackStyle}>
        <View style={progressFillStyle} />
      </View>

      {/* Open timer button — Task 12 wires the actual navigation */}
      <AppButton
        label="Open timer"
        variant="indigo"
        size="sm"
        fullWidth
        onPress={() => onOpenTimer?.(id)}
      />
    </View>
  );
}

// ── Run: next (upcoming) card ─────────────────────────────────────────────────

function NextRunCard({
  id,
  label,
  category,
  durationMin,
  onStart,
}: {
  id: string;
  label: string;
  category: string;
  durationMin: number;
  onStart?: (id: string) => void;
}) {
  const t = useTheme();
  const drag = useReorderableDrag();

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

  const dragHandleStyle: ViewStyle = {
    paddingHorizontal: t.space[1],
    justifyContent: 'center',
    alignItems: 'center',
    gap: t.space[1],
  };

  const gripLineStyle: ViewStyle = {
    width: t.size.gripW,
    height: t.space[0.5],
    backgroundColor: t.colors.inkFaint,
    borderRadius: t.radii.full,
  };

  const bodyStyle: ViewStyle = {
    flex: 1,
    minWidth: 0,
    gap: t.space[0.5],
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

  const durationStyle: TextStyle = {
    fontFamily: t.fontFamily.mono,
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    flexShrink: 0,
  };

  // Quiet soft disc — no border (the old thick ring read as a hollow target with a
  // tiny arrow). primarySoft fill keeps it a calm accent, not a second filled-indigo
  // element competing with the now card's "Open timer" (one filled indigo per screen).
  const startButtonStyle: ViewStyle = {
    width: t.size.coin,
    height: t.size.coin,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  };

  const startIconStyle: TextStyle = {
    fontSize: t.fontSize.md,
    color: t.colors.primary,
    marginLeft: t.space[0.5], // optical-centre the ▶ triangle in the disc
  };

  return (
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
          <AppText style={titleStyle} numberOfLines={1}>
            {label}
          </AppText>
          <AppText style={categoryStyle} numberOfLines={1}>
            {category}
          </AppText>
        </View>

        {/* Duration */}
        <AppText style={durationStyle}>{`${durationMin}m`}</AppText>

        {/* Start button — Task 12 wires the actual timer start.
            hitSlop enlarges the tap target; the outer Pressable only owns
            onLongPress for drag so a tap here never triggers a drag. */}
        <Pressable
          onPress={() => onStart?.(id)}
          accessibilityRole="button"
          accessibilityLabel={`Start ${label}`}
          hitSlop={8}
        >
          <View style={startButtonStyle}>
            <AppText style={startIconStyle}>▶</AppText>
          </View>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PlanTaskCard(props: PlanTaskCardProps) {
  if (props.variant === 'build') {
    const { variant: _v, ...rest } = props;
    return <BuildCard {...rest} />;
  }

  // Run variant — three sub-states: done | now (running) | next (upcoming)
  const {
    id,
    label,
    category,
    durationMin,
    endAt,
    runStatus = 'upcoming',
    actualMin,
    progress,
    onOpenTimer,
    onStart,
  } = props;

  if (runStatus === 'done') {
    return <DoneRunCard label={label} category={category} actualMin={actualMin} />;
  }

  if (runStatus === 'running') {
    return (
      <NowRunCard
        id={id}
        label={label}
        category={category}
        endAt={endAt}
        progress={progress}
        onOpenTimer={onOpenTimer}
      />
    );
  }

  // upcoming
  return (
    <NextRunCard
      id={id}
      label={label}
      category={category}
      durationMin={durationMin}
      onStart={onStart}
    />
  );
}
