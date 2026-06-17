import { View, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { RailNode, type RailNodeState } from './RailNode';

// ──────────────────────────────────────────────────────────────────────────────
// PlanRail — left-gutter column for the Run phase timeline.
//
// Renders one row at a time: the vertical spine segment + node + time/pill label.
//
// Spine coloring per row:
//   done     — dashed success green (task complete)
//   now      — primarySoft (the live segment)
//   next     — hairline (quiet upcoming)
//   breather — hairline
//
// isFirst / isLast control the top/bottom clipping of the spine so it starts
// at the node center (not the top edge) and ends at the node center on the
// last row (not the bottom edge).
// ──────────────────────────────────────────────────────────────────────────────

export interface PlanRailProps {
  state: RailNodeState;
  /** Mono time string to display above the node (e.g. "22:17"). Omit for 'now'. */
  timeLabel?: string;
  /** Show the purple "now" pill instead of the time label. */
  showNowPill?: boolean;
  /** True when this is the first row in the list (spine starts at node center). */
  isFirst?: boolean;
  /** True when this is the last row in the list (spine ends at node center). */
  isLast?: boolean;
}

export function PlanRail({
  state,
  timeLabel,
  showNowPill,
  isFirst,
  isLast,
}: PlanRailProps) {
  const t = useTheme();
  const gutterWidth = t.planRail.gutter; // 46pt
  const nodeSize = t.planRail.node; // 20pt
  const breatherSize = t.planRail.breatherNode; // 16pt
  const connectorWidth = t.planRail.connector; // 2pt
  const activeNodeSize = state === 'breather' ? breatherSize : nodeSize;

  // ── Spine segment style ─────────────────────────────────────────────────────

  function spineSegmentStyle(position: 'top' | 'bottom'): ViewStyle {
    const base: ViewStyle = {
      position: 'absolute',
      left: gutterWidth / 2 - connectorWidth / 2,
      width: connectorWidth,
    };

    if (position === 'top') {
      return {
        ...base,
        top: 0,
        bottom: '50%',
        ...(isFirst ? { display: 'none' } : {}),
      };
    }
    return {
      ...base,
      top: '50%',
      bottom: 0,
      ...(isLast ? { display: 'none' } : {}),
    };
  }

  function spineColor(): string {
    if (state === 'done') return t.colors.success;
    if (state === 'now') return t.colors.primary;
    return t.colors.hairline;
  }

  // Done uses a dashed border effect; we simulate dashes with a dashed borderStyle.
  // RN supports 'dashed' on border — but only on borderTopWidth / borderBottomWidth
  // on a View when horizontal. For a vertical dashed line, we use a View with
  // borderLeftWidth and borderStyle:'dashed', which RN supports on iOS/Android.
  function spineView(position: 'top' | 'bottom'): React.ReactNode {
    const segStyle = spineSegmentStyle(position);
    const color = spineColor();

    if (state === 'done') {
      // Dashed vertical line using borderLeft trick
      const dashStyle: ViewStyle = {
        ...segStyle,
        borderLeftWidth: connectorWidth,
        borderLeftColor: color,
        borderStyle: 'dashed',
        width: 0,
        left: gutterWidth / 2,
        backgroundColor: undefined,
      };
      return <View style={dashStyle} />;
    }

    return <View style={[segStyle, { backgroundColor: color }]} />;
  }

  // ── Label above node ────────────────────────────────────────────────────────

  const nowPillStyle: ViewStyle = {
    backgroundColor: t.colors.primary,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2],
    paddingVertical: 2,
    alignSelf: 'center',
    marginBottom: t.space[1],
  };

  const nowPillTextStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.onIndigo,
    letterSpacing: 0.2,
  };

  const timeLabelStyle: TextStyle = {
    fontFamily: t.fontFamily.mono,
    fontSize: t.fontSize.xs,
    color: state === 'done' ? t.colors.success : t.colors.inkSoft,
    marginBottom: t.space[1],
    textAlign: 'center',
  };

  // ── Container ───────────────────────────────────────────────────────────────

  const gutterContainer: ViewStyle = {
    width: gutterWidth,
    position: 'relative',
    flexDirection: 'column',
    alignItems: 'center',
  };

  return (
    <View style={gutterContainer}>
      {/* Top spine segment */}
      {spineView('top')}

      {/* Label — now pill or mono time */}
      {showNowPill ? (
        <View style={nowPillStyle}>
          <AppText style={nowPillTextStyle}>now</AppText>
        </View>
      ) : timeLabel !== undefined ? (
        <AppText style={timeLabelStyle}>{timeLabel}</AppText>
      ) : null}

      {/* Node — centered in gutter */}
      <View style={{ width: activeNodeSize, height: activeNodeSize, zIndex: 1 }}>
        <RailNode state={state} />
      </View>

      {/* Bottom spine segment */}
      {spineView('bottom')}
    </View>
  );
}
