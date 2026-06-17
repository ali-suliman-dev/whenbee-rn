import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// DailyRitualLine (C11) — an opt-in "one honest thing a day" line on Today. It is
// NOT a streak: missing a day costs nothing, there is no count, no history, and no
// loss state. Before today's first honest log it reads as a calm invitation; once
// anything has been logged today it reads as a quiet "done", and resets at the
// next local day. Rendered only when the user has switched the ritual on.
// ──────────────────────────────────────────────────────────────────────────────

export function DailyRitualLine({ doneToday }: { doneToday: boolean }) {
  const t = useTheme();

  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] };
  const text: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: doneToday ? t.colors.amberText : t.colors.inkSoft,
  };

  const label = doneToday
    ? 'Logged your one thing today. Nice.'
    : 'Log one honest thing today. Skipping is fine.';

  return (
    <View style={row} accessibilityRole="text" accessibilityLabel={label}>
      <Ionicons
        name={doneToday ? 'checkmark-circle' : 'ellipse-outline'}
        size={t.iconSize.sm}
        color={doneToday ? t.colors.accent : t.colors.inkSoft}
      />
      <Text style={text}>{label}</Text>
    </View>
  );
}
