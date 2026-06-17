import { Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
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
//   Long-press activates reorder drag. No play button.
//
// variant='run'  (Task 10 — props designed for it, rendering deferred)
//   Receives same data shape; the run variant will add a play button and
//   status badge but shares the same card layout and token palette.
//
// Fabric gotcha: Pressable is a bare touch wrapper; all visuals live on
// inner Views (React Compiler drops function-form styles on Pressable).
// ──────────────────────────────────────────────────────────────────────────────

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
}

// ── Build card ────────────────────────────────────────────────────────────────

function BuildCard({
  label,
  category,
  durationMin,
  startAt,
  endAt,
  onDurationChange,
}: Omit<PlanTaskCardProps, 'variant' | 'id'>) {
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
    minHeight: 70,
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

  const gripLineStyle: ViewStyle = {
    width: 14,
    height: 2,
    backgroundColor: t.colors.inkFaint,
    borderRadius: t.radii.full,
  };

  const rangeText =
    startAt !== undefined && endAt !== undefined
      ? `${formatClock(startAt)}–${formatClock(endAt)}`
      : null;

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
          {rangeText !== null ? <AppText style={rangeStyle}>{rangeText}</AppText> : null}
          <AppText style={titleStyle} numberOfLines={1}>
            {label}
          </AppText>
          <AppText style={categoryStyle} numberOfLines={1}>
            {category}
          </AppText>
        </View>

        {/* Duration wheel — slim, pinned far-right */}
        <DurationWheel
          valueMin={durationMin}
          onChange={(min) => onDurationChange?.(min)}
        />
      </View>
    </Pressable>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PlanTaskCard(props: PlanTaskCardProps) {
  if (props.variant === 'build') {
    const { variant: _v, id: _id, ...rest } = props;
    return <BuildCard {...rest} />;
  }

  // Run variant — Task 10 will implement this; we return null for now so the
  // component tree compiles without a missing-return TS error.
  return null;
}
