import { useState, useCallback } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { TaskRow } from '@/src/features/today/TaskRow';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import type { DayTask } from '@/src/engine/daySelectors';

// ──────────────────────────────────────────────────────────────────────────────
// ShelfSection — a quiet collapsible "No day yet" surface that lists tasks
// with no planned date. Calm in tone: unscheduled tasks are ideas waiting for
// the right moment, not deficits. Only renders when there are shelf tasks.
// ──────────────────────────────────────────────────────────────────────────────

export interface ShelfSectionProps {
  shelfTasks: DayTask[];
  /** Called when the user triggers a move action from a shelf row.
   *  target='tomorrow' is the swipe action; more targets may follow. */
  onMoveTask: (id: string, target: 'tomorrow') => void;
  onDeleteTask?: (id: string) => void;
}

export function ShelfSection({ shelfTasks, onMoveTask, onDeleteTask }: ShelfSectionProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('today');
  const [expanded, setExpanded] = useState(false);
  const categories = useCategoriesStore((s) => s.categories);

  const categoryName = useCallback(
    (id: string): string =>
      categories.find((c) => c.id === id)?.name ?? id,
    [categories],
  );

  // Nothing to show — render nothing rather than an empty section.
  if (shelfTasks.length === 0) return null;

  const toggleExpanded = () => setExpanded((v) => !v);

  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    paddingVertical: t.space[2],
    paddingHorizontal: t.space[1],
  };

  const headerText: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
    flex: 1,
  };

  const countText: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
  };

  const list: ViewStyle = {
    gap: t.space[2],
    marginTop: t.space[1],
  };

  return (
    <View accessibilityRole="summary" accessibilityLabel={tr('shelfSection.summaryA11y', { count: shelfTasks.length })}>
      <Pressable
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityLabel={tr('shelfSection.headerA11y', {
          count: shelfTasks.length,
          action: expanded ? tr('shelfSection.collapseAction') : tr('shelfSection.expandAction'),
        })}
        hitSlop={t.size.hitSlop}
        style={headerRow}
      >
        <Text style={headerText}>{tr('shelfSection.header', { count: shelfTasks.length })}</Text>
        <View style={countText}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={t.iconSize.xs}
            color={t.colors.inkSoft}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={list}>
          {shelfTasks.map((task) => (
            <TaskRow
              key={task.id}
              title={task.label}
              categoryLabel={categoryName(task.category)}
              guessMin={task.guessMin}
              honestMin={task.guessMin}
              onMove={(target) => onMoveTask(task.id, target)}
              onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
