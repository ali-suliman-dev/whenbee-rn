import { View, type ViewStyle } from 'react-native';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// TimeChips — single-select rough-time grid shared by Retro + Add Task. Values
// are minutes; the label reads "Nm" up to 45 then "1h" for 60. Single-select.
// ──────────────────────────────────────────────────────────────────────────────

export const ROUGH_TIMES = [5, 10, 15, 30, 45] as const;

function timeLabel(min: number): string {
  return min >= 60 ? `${Math.round(min / 60)}h` : `${min}m`;
}

export function TimeChips({
  value,
  onChange,
  options = ROUGH_TIMES as unknown as number[],
}: {
  value: number | null;
  onChange: (min: number) => void;
  options?: number[];
}) {
  const t = useTheme();
  const row: ViewStyle = { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] };

  return (
    <View style={row}>
      {options.map((min) => (
        <Chip
          key={min}
          label={timeLabel(min)}
          selected={value === min}
          onPress={() => onChange(min)}
        />
      ))}
    </View>
  );
}
