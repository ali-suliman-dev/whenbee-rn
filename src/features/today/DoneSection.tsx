import { useEffect, useState } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import { TaskRow } from './TaskRow';
import type { TodayRow } from './useToday';

// ──────────────────────────────────────────────────────────────────────────────
// DoneSection — the "DONE TODAY" list, collapsed by default so finished work stays
// reachable without crowding the screen. The header is a 44pt toggle showing the
// count + a chevron; tapping reveals the rows (entering-only FadeIn — no exit
// animation, per the Fabric exiting-crash invariant). The first-session swipe
// coach-mark is gated on expansion: it only mounts (and only starts its
// auto-dismiss timer) once the list is open, so it can't be spent while collapsed.
// ──────────────────────────────────────────────────────────────────────────────

interface DoneSectionProps {
  rows: TodayRow[];
  deletingId: string | null;
  onDelete: (id: string) => void;
  onLongPress: (id: string, label: string) => void;
  showCoachMark: boolean;
  onCoachMarkDismiss: () => void;
}

export function DoneSection({
  rows,
  deletingId,
  onDelete,
  onLongPress,
  showCoachMark,
  onCoachMarkDismiss,
}: DoneSectionProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('today');
  const [expanded, setExpanded] = useState(false);

  // The coach-mark only matters while the list is open: start its 4s auto-dismiss
  // here so a collapsed list never burns the one-shot unseen.
  useEffect(() => {
    if (!expanded || !showCoachMark) return;
    const id = setTimeout(onCoachMarkDismiss, 4000);
    return () => clearTimeout(id);
    // onCoachMarkDismiss is stable (useCallback in the parent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, showCoachMark]);

  function toggle() {
    haptics.light();
    setExpanded((v) => !v);
  }

  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.space[2],
  };
  const label: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  return (
    <View>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={tr('doneSection.headerA11y', {
          count: rows.length,
          action: expanded ? tr('doneSection.collapseAction') : tr('doneSection.expandAction'),
        })}
        hitSlop={t.size.hitSlop}
        style={header}
      >
        <Text style={label}>{tr('doneSection.header', { count: rows.length })}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={t.iconSize.sm}
          color={t.colors.inkSoft}
        />
      </Pressable>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(t.motion.base)} style={{ gap: t.space[2] }}>
          {rows.map((row, idx) => (
            <TaskRow
              key={row.id}
              title={row.label}
              categoryLabel={row.categoryLabel}
              guessMin={row.guessMin}
              honestMin={row.honestMin}
              actualMin={row.actualMin}
              done
              onDelete={() => onDelete(row.id)}
              onLongPress={() => onLongPress(row.id, row.label)}
              isExiting={deletingId === row.id}
              showCoachMark={showCoachMark && idx === 0}
              onCoachMarkDismiss={onCoachMarkDismiss}
            />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}
