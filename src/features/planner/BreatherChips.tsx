import { View } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { Chip } from '@/src/components/Chip';

// ──────────────────────────────────────────────────────────────────────────────
// BreatherChips — pure chip row for selecting breather minutes between tasks.
// Off = back-to-back; +5/+10/+20 = a small pause between each.
//
// The section label ("Breather between tasks") is rendered by the parent
// BuildView via SectionLabel — consistent with how BufferChips composes.
// Active chip = primarySoft fill + primary border (standard selected style).
// ──────────────────────────────────────────────────────────────────────────────

const OPTIONS: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: '+5', value: 5 },
  { label: '+10', value: 10 },
  { label: '+20', value: 20 },
];

export function BreatherChips({
  value,
  onChange,
}: {
  value: number;
  onChange: (min: number) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
      {OPTIONS.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={value === o.value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}
