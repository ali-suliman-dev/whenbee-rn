import { View, Text, StyleSheet, type TextStyle } from 'react-native';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { ForwardAction } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// ForwardActionCard — a single, calm nudge derived from the biggest-surprise
// category. The planned→goal span reads as one split meter: a solid neutral
// zone (what's planned) butting straight into an amber zone (the top-up to add),
// with the overflow amount called out above the amber. No nodes, no dashed pipe,
// no measured floating label — the bar's two zones say "add this much" on sight.
// No guilt — this is just what happened, and one thing to try.
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  action: ForwardAction;
}

export function ForwardActionCard({ action }: Props) {
  const t = useTheme();
  const rv = t.reviewViz;

  // Split point: how much of the goal is already planned. Clamped so a zero or
  // over-plan never produces a negative/over-full segment.
  const recommended = action.recommendedMin > 0 ? action.recommendedMin : action.plannedMin || 1;
  const plannedFrac = Math.min(Math.max(action.plannedMin / recommended, 0), 1);
  const topUpFrac = 1 - plannedFrac;

  const styles = StyleSheet.create({
    container: { gap: t.space[3] },
    headerGroup: { gap: t.space[1] },
    eyebrow: { ...type.eyebrow, color: t.colors.amberText },
    heading: { ...type.body, color: t.colors.inkSoft },
    categoryName: { fontFamily: 'Jakarta-ExtraBold', color: t.colors.ink },
    // Own vertical padding around the meter — keeps the card on one gap rhythm
    // rather than mixing a sibling margin in.
    meterBlock: { paddingVertical: t.space[2] },
    meterInner: { position: 'relative' },
    // The overflow call-out sits above the amber (right) zone. Right-anchored, so
    // it needs no width measurement to center.
    overflowCaption: {
      ...(type.numMicro as unknown as TextStyle),
      position: 'absolute',
      top: 0,
      right: 0,
      color: t.colors.amberText,
    },
    bar: {
      flexDirection: 'row',
      height: rv.meterH,
      borderRadius: t.radii.full,
      overflow: 'hidden',
      backgroundColor: t.colors.surfaceSunken,
      marginTop: t.space[4], // room for the overflow caption above
    },
    barPlanned: { backgroundColor: t.colors.inkSoft },
    barTopUp: { backgroundColor: t.colors.accent },
    railLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: t.space[2],
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
          <Text style={styles.eyebrow}>ONE THING TO TRY</Text>
          <Text style={styles.heading}>
            <Text style={styles.categoryName}>{action.categoryName}</Text>
            {' keeps running over.'}
          </Text>
        </View>

        <View style={styles.meterBlock}>
          <View style={styles.meterInner}>
            <Text style={styles.overflowCaption}>+{action.overflowMin}m</Text>
            <View style={styles.bar}>
              <View style={[styles.barPlanned, { flex: plannedFrac }]} />
              <View style={[styles.barTopUp, { flex: topUpFrac }]} />
            </View>
          </View>
          <View style={styles.railLabels}>
            <Text style={styles.labelPlan}>
              <Text style={styles.numPlan}>{action.plannedMin}m</Text>
              {' planned'}
            </Text>
            <Text style={styles.labelGoal}>
              {'give it '}
              <Text style={styles.numGoal}>~{action.recommendedMin}m</Text>
            </Text>
          </View>
        </View>

        <Text style={styles.desc}>
          {'Plan '}
          <Text style={styles.descAmber}>~{action.recommendedMin}m</Text>
          {' next week and the overflow disappears.'}
        </Text>
      </View>
    </Card>
  );
}
