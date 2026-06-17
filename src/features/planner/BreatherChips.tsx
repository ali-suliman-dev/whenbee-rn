import { View } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { Chip } from '@/src/components/Chip';

// ──────────────────────────────────────────────────────────────────────────────
// BreatherChips — select how many minutes of breathing room to leave between
// plan tasks. Off = back-to-back; +5/+10/+20 = a small pause between each.
//
// Modelled on BufferChips. Active chip = primarySoft fill + primary border
// (same visual language as every other selected chip in the app).
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
    <View style={{ gap: t.space[2] }}>
      <AppText variant="label">Breather between tasks</AppText>
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
    </View>
  );
}
