import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import type { ForwardAction } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// ForwardActionCard — a single, calm nudge derived from the biggest-surprise
// category: shows the planned vs overflow split as a segmented bar and suggests
// a concrete buffer to add next week. No guilt — this is just what happened.
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  action: ForwardAction;
}

export function ForwardActionCard({ action }: Props) {
  const t = useTheme();
  const total = action.plannedMin + action.overflowMin;
  const plannedFlex = total > 0 ? action.plannedMin / total : 0.5;
  const overflowFlex = total > 0 ? action.overflowMin / total : 0.5;

  const styles = StyleSheet.create({
    container: {
      padding: t.space[4],
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      borderRadius: t.radii.card,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      color: t.colors.amberText,
      letterSpacing: 1.2,
      marginBottom: t.space[1],
    },
    heading: { fontSize: 15, color: t.colors.inkSoft, marginBottom: t.space[3] },
    categoryName: { fontWeight: '700', color: t.colors.ink },
    barRow: {
      flexDirection: 'row',
      height: 40,
      borderRadius: t.radii.sm,
      overflow: 'hidden',
      gap: 2,
      marginBottom: t.space[3],
    },
    plannedSeg: {
      justifyContent: 'center',
      paddingHorizontal: t.space[2],
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    overflowSeg: {
      justifyContent: 'center',
      paddingHorizontal: t.space[2],
      backgroundColor: 'rgba(238,174,77,0.22)',
      borderWidth: 1,
      borderColor: t.colors.accent,
    },
    plannedText: { fontSize: 13, color: t.colors.inkSoft, fontWeight: '600' },
    overflowText: { fontSize: 13, color: t.colors.amberText, fontWeight: '700' },
    recommendation: { fontSize: 13, color: t.colors.inkSoft },
    recommendedMin: { color: t.colors.amberText, fontWeight: '700' },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>ONE THING TO TRY</Text>
      <Text style={styles.heading}>
        <Text style={styles.categoryName}>{action.categoryName}</Text>
        {' keeps running over.'}
      </Text>
      <View style={styles.barRow}>
        <View style={[styles.plannedSeg, { flex: plannedFlex }]}>
          <Text style={styles.plannedText} numberOfLines={1}>
            {action.plannedMin}m planned
          </Text>
        </View>
        <View style={[styles.overflowSeg, { flex: overflowFlex }]}>
          <Text style={styles.overflowText} numberOfLines={1}>
            +{action.overflowMin}m overflow
          </Text>
        </View>
      </View>
      <Text style={styles.recommendation}>
        Build in{' '}
        <Text style={styles.recommendedMin}>~{action.recommendedMin}m</Text>
        {' next week and the overflow disappears.'}
      </Text>
    </View>
  );
}
