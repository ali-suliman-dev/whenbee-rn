import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { ForwardAction } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// ForwardActionCard — a single, calm nudge derived from the biggest-surprise
// category: draws the planned→goal span as a rail/pipe (solid = what's planned,
// dashed honey = the top-up to add) and suggests a concrete buffer for next
// week. No guilt — this is just what happened, and one thing to try.
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  action: ForwardAction;
}

export function ForwardActionCard({ action }: Props) {
  const t = useTheme();
  const { t: tt } = useTranslation('review');
  const rv = t.reviewViz;

  // The overflow caption centers over the dashed midpoint. RN transforms don't
  // support percentage translateX (unlike CSS), so the label is measured on
  // layout and shifted back by half its own rendered width.
  const [captionWidth, setCaptionWidth] = useState(0);
  const onCaptionLayout = useCallback((e: LayoutChangeEvent) => {
    setCaptionWidth(e.nativeEvent.layout.width);
  }, []);

  // Pipe geometry — solid (planned) then dashed honey (top-up) to the goal
  // node, which is inset from the SVG's right edge so it never overhangs the
  // card. The dash stops at the node's left edge (goalX − goalNodeR) so the
  // honey node caps the dash rather than sitting on top of it.
  const goalX = rv.railViewW - rv.railGoalInset;
  const dashEndX = goalX - rv.goalNodeR;
  const recommended = action.recommendedMin > 0 ? action.recommendedMin : action.plannedMin || 1;
  const splitFrac = Math.min(Math.max(action.plannedMin / recommended, 0), 1);
  const splitX = rv.railInsetL + splitFrac * (goalX - rv.railInsetL);
  // Caption centers over the dashed top-up's midpoint (split → dash end).
  const captionLeftPct = ((splitX + dashEndX) / 2 / rv.railViewW) * 100;

  const styles = StyleSheet.create({
    container: { gap: t.space[3] },
    headerGroup: { gap: t.space[1] },
    eyebrow: { ...type.eyebrow, color: t.colors.amberText },
    heading: { ...type.body, color: t.colors.inkSoft },
    categoryName: { fontFamily: 'Jakarta-ExtraBold', color: t.colors.ink },
    // Extra vertical breathing room around the pipe itself — its own padding,
    // not a sibling margin, so the card keeps one gap-based rhythm overall.
    railBlock: { paddingVertical: t.space[2] },
    railInner: { position: 'relative' },
    overflowCaption: {
      ...(type.numMicro as unknown as TextStyle),
      position: 'absolute',
      top: 0,
      color: t.colors.amberText,
    },
    svg: { marginTop: t.space[4] },
    railLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: t.space[1.5],
    },
    labelPlan: { ...type.labelXs, color: t.colors.inkFaint },
    labelGoal: { ...type.labelXs, color: t.colors.inkFaint, textAlign: 'right' },
    numPlan: { ...(type.numMicro as unknown as TextStyle), color: t.colors.ink },
    numGoal: { ...(type.numMicro as unknown as TextStyle), color: t.colors.amberText },
    desc: { ...type.bodySm, color: t.colors.inkSoft },
    descAmber: { ...type.bodySmBold, color: t.colors.amberText },
  });

  return (
    <Card tone="flat">
      <View style={styles.container}>
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>{tt('forwardAction.eyebrow')}</Text>
          <Text style={styles.heading}>
            <Text style={styles.categoryName}>{action.categoryName}</Text>
            {tt('forwardAction.headingSuffix')}
          </Text>
        </View>

        <View style={styles.railBlock}>
          <View style={styles.railInner}>
            <Text
              onLayout={onCaptionLayout}
              style={[
                styles.overflowCaption,
                {
                  left: `${captionLeftPct}%`,
                  transform: [{ translateX: -captionWidth / 2 }],
                  opacity: captionWidth > 0 ? 1 : 0,
                },
              ]}
            >
              {tt('forwardAction.overflowCaption', { min: action.overflowMin })}
            </Text>
            <Svg
              width="100%"
              height={rv.railViewH}
              viewBox={`0 0 ${rv.railViewW} ${rv.railViewH}`}
              preserveAspectRatio="xMidYMid meet"
              style={styles.svg}
            >
              <Line
                x1={rv.railInsetL}
                y1={rv.railY}
                x2={splitX}
                y2={rv.railY}
                stroke={t.colors.inkSoft}
                strokeWidth={rv.pipeStroke}
                strokeLinecap="round"
              />
              <Line
                x1={splitX}
                y1={rv.railY}
                x2={dashEndX}
                y2={rv.railY}
                stroke={t.colors.accent}
                strokeWidth={rv.pipeStroke}
                strokeLinecap="round"
                strokeDasharray={rv.pipeDash}
              />
              <Circle
                cx={splitX}
                cy={rv.railY}
                r={rv.planNodeR}
                fill={t.colors.surface}
                stroke={t.colors.inkSoft}
                strokeWidth={rv.planNodeStroke}
              />
              <Circle cx={goalX} cy={rv.railY} r={rv.goalNodeR} fill={t.colors.accent} />
            </Svg>
          </View>
          <View style={styles.railLabels}>
            <Text style={styles.labelPlan}>
              <Text style={styles.numPlan}>{tt('forwardAction.minutesLabel', { min: action.plannedMin })}</Text>
              {tt('forwardAction.plannedSuffix')}
            </Text>
            <Text style={styles.labelGoal}>
              {tt('forwardAction.giveItPrefix')}
              <Text style={styles.numGoal}>{tt('forwardAction.amountApprox', { min: action.recommendedMin })}</Text>
            </Text>
          </View>
        </View>

        <Text style={styles.desc}>
          {tt('forwardAction.descPrefix')}
          <Text style={styles.descAmber}>{tt('forwardAction.amountApprox', { min: action.recommendedMin })}</Text>
          {tt('forwardAction.descSuffix')}
        </Text>
      </View>
    </Card>
  );
}
