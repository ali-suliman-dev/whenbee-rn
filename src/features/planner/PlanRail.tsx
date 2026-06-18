import React from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
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
  /**
   * State of the row directly ABOVE this one. A connector segment is owned by its
   * upper node, so the top half is coloured by `prevState` (and the bottom half by
   * `state`). This makes each segment a single uniform colour that runs right into
   * the next circle — e.g. the now→next link stays fully purple to the ring.
   */
  prevState?: RailNodeState;
}

export function PlanRail({
  state,
  timeLabel,
  showNowPill,
  isFirst,
  isLast,
  prevState,
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

  function segColor(s: RailNodeState): string {
    if (s === 'done') return t.colors.success;
    if (s === 'now') return t.colors.primary;
    return t.colors.hairline;
  }

  // RN's single-side dashed border (borderLeftWidth + borderStyle:'dashed' on a
  // 0-width View) silently renders NOTHING on Fabric — so the old approach drew an
  // invisible spine and the nodes floated unconnected. We draw the connector with
  // react-native-svg instead: a vertical <Line> that fills the half's height, with
  // strokeDasharray for completed (done) links and a solid stroke otherwise. SVG
  // sizes off the container's resolved height, so it works at any card height.
  function spineView(position: 'top' | 'bottom'): React.ReactNode {
    const segStyle = spineSegmentStyle(position);
    if (segStyle.display === 'none') return null;
    // Top half belongs to the link from the node ABOVE → colour by prevState.
    const segState = position === 'top' ? (prevState ?? state) : state;
    const color = segColor(segState);
    const dashed = segState === 'done';

    // Overlap the seam at the 50% midpoint by a hair so the top/bottom halves read
    // as one continuous line through the node centre with no visible break.
    const containerStyle: ViewStyle = {
      ...segStyle,
      ...(position === 'top'
        ? { bottom: '50%', marginBottom: -connectorWidth }
        : { top: '50%', marginTop: -connectorWidth }),
    };

    return (
      <View style={containerStyle} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke={color}
            strokeWidth={connectorWidth}
            strokeLinecap="round"
            strokeDasharray={
              dashed
                ? `${t.planRail.dashOn} ${t.planRail.dashGap}`
                : undefined
            }
          />
        </Svg>
      </View>
    );
  }

  // ── Label above node ────────────────────────────────────────────────────────

  // Label sits ABOVE the node but is absolutely positioned, so it never shoves the
  // node off the row's vertical centre — that off-centre node is what used to leave
  // the spine floating, detached from the dot. `bottom: '50%'` anchors the label's
  // base at the node centre; marginBottom lifts it to clear the node's top edge.
  const labelWrap: ViewStyle = {
    position: 'absolute',
    bottom: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginBottom: activeNodeSize / 2 + t.space[1],
  };

  const nowPillStyle: ViewStyle = {
    backgroundColor: t.colors.primary,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
  };

  const nowPillTextStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.onIndigo,
    letterSpacing: t.letterSpacing.normal,
  };

  const timeLabelStyle: TextStyle = {
    fontFamily: t.fontFamily.mono,
    fontSize: t.fontSize.xs,
    color: state === 'done' ? t.colors.success : t.colors.inkSoft,
    textAlign: 'center',
  };

  // ── Container ───────────────────────────────────────────────────────────────
  // The gutter stretches to the FULL row height (alignSelf:'stretch'); the node and
  // both spine halves are ABSOLUTELY positioned against that height — none of them is
  // a flow child, so nothing can collapse the gutter or pull the node off-axis. The
  // node centres at vertical 50% (= the card's centre, since the card column pads
  // symmetrically) and at horizontal gutterWidth/2 — the exact x the spine sits on.
  // Rows carry no bottom margin, so each row's bottom half butts the next row's top
  // half: one unbroken line that runs straight into every circle. Holds for any card
  // height (the tall now card included) because the geometry never depends on it.

  const gutterContainer: ViewStyle = {
    width: gutterWidth,
    alignSelf: 'stretch',
    position: 'relative',
  };

  const nodeWrap: ViewStyle = {
    position: 'absolute',
    top: '50%',
    left: gutterWidth / 2,
    width: activeNodeSize,
    height: activeNodeSize,
    transform: [
      { translateX: -activeNodeSize / 2 },
      { translateY: -activeNodeSize / 2 },
    ],
    zIndex: 1,
  };

  return (
    <View style={gutterContainer}>
      {/* Spine segments — painted first; node + label sit on top */}
      {spineView('top')}
      {spineView('bottom')}

      {/* Label — now pill or mono time, floated above the node (out of flow) */}
      <View style={labelWrap} pointerEvents="none">
        {showNowPill ? (
          <View style={nowPillStyle}>
            <AppText style={nowPillTextStyle}>now</AppText>
          </View>
        ) : timeLabel !== undefined ? (
          <AppText style={timeLabelStyle}>{timeLabel}</AppText>
        ) : null}
      </View>

      {/* Node — absolutely centred on the row's vertical + horizontal axis */}
      <View style={nodeWrap}>
        <RailNode state={state} />
      </View>
    </View>
  );
}
