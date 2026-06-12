import { View, Pressable, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { HonestNumber } from '@/src/components/HonestNumber';
import { categoryName } from './usePlanner';

// ──────────────────────────────────────────────────────────────────────────────
// TaskRow — one ordered plan task. Pre-filled, editable duration via a ±5m
// stepper (never forced typing). Reorder by up/down arrows (no native DnD dep),
// remove with no guilt. ≥44pt tap targets on every control.
// ──────────────────────────────────────────────────────────────────────────────

const STEP = 5;
const HIT = 44;

export function TaskRow({
  label,
  category,
  durationMin,
  isFirst,
  isLast,
  onChangeDuration,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  label: string;
  category: string;
  durationMin: number;
  isFirst: boolean;
  isLast: boolean;
  onChangeDuration: (next: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const t = useTheme();

  const iconBtn = (disabled: boolean): ViewStyle => ({
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? t.opacity.disabled : 1,
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space[2],
        paddingVertical: t.space[2],
        borderBottomWidth: t.borderWidth.hairline,
        borderBottomColor: t.colors.hairline,
      }}
    >
      {/* Reorder column */}
      <View style={{ width: HIT }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Move task up"
          disabled={isFirst}
          onPress={onMoveUp}
          style={{ ...iconBtn(isFirst), height: HIT / 2 }}
        >
          <Ionicons name="chevron-up" size={18} color={t.colors.inkSoft} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Move task down"
          disabled={isLast}
          onPress={onMoveDown}
          style={{ ...iconBtn(isLast), height: HIT / 2 }}
        >
          <Ionicons name="chevron-down" size={18} color={t.colors.inkSoft} />
        </Pressable>
      </View>

      {/* Label + category */}
      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <AppText variant="body" numberOfLines={1} style={{ fontWeight: t.fontWeight.semibold }}>
          {label}
        </AppText>
        <AppText variant="caption">{categoryName(category)}</AppText>
      </View>

      {/* Duration stepper */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease duration"
          onPress={() => onChangeDuration(Math.max(5, durationMin - STEP))}
          style={iconBtn(false)}
        >
          <Ionicons name="remove-circle-outline" size={26} color={t.colors.primary} />
        </Pressable>
        <View style={{ minWidth: 52, alignItems: 'center' }}>
          <HonestNumber value={String(durationMin)} unit="m" size="inline" tone="ink" />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase duration"
          onPress={() => onChangeDuration(durationMin + STEP)}
          style={iconBtn(false)}
        >
          <Ionicons name="add-circle-outline" size={26} color={t.colors.primary} />
        </Pressable>
      </View>

      {/* Remove */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove task"
        onPress={onRemove}
        style={iconBtn(false)}
      >
        <Ionicons name="close" size={20} color={t.colors.inkSoft} />
      </Pressable>
    </View>
  );
}
