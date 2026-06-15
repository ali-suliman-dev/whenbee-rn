import { View } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { formatClock } from '@/src/lib/time';
import type { PlanTimelineItem } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// PlanTimeline — one row per task: `7:05–7:35 · Make breakfast`. Times are
// tabular so the columns line up. Pure render of the engine's placed blocks.
// ──────────────────────────────────────────────────────────────────────────────

export function PlanTimeline({ items }: { items: PlanTimelineItem[] }) {
  const t = useTheme();
  if (items.length === 0) return null;

  return (
    <View style={{ gap: t.space[2] }}>
      {items.map((item) => (
        <View key={item.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space[3] }}>
          <AppText
            variant="label"
            style={{
              fontVariant: ['tabular-nums'],
              minWidth: t.size.timelineCol,
              color: t.colors.primary,
              fontWeight: t.fontWeight.semibold,
            }}
          >
            {formatClock(item.startAt)}–{formatClock(item.endAt)}
          </AppText>
          <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
            {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}
