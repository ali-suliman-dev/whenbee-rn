import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// TrialTimeline — the honest, no-dark-pattern form of the 7-day trial: a 3-step
// timeline (today → reminder → ends) so the user sees exactly what happens and when.
// Rendered by the caller only when the selected plan is a subscription (not lifetime).
// t.borderWidth.thin = 0 in this project; t.borderWidth.chip (1pt) used instead.
// ──────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { head: 'Today', desc: 'Full Pro, free' },
  { head: 'Day 5', desc: 'We remind you' },
  { head: 'Day 7', desc: 'Trial ends' },
] as const;

export function TrialTimeline() {
  const t = useTheme();
  const headStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.ink, fontFamily: 'Jakarta-Bold' };
  const descStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const dotBase: ViewStyle = {
    width: t.space[3], height: t.space[3], borderRadius: t.radii.full,
    borderWidth: t.borderWidth.chip,
  };
  return (
    <View style={{ flexDirection: 'row', gap: t.space[2] }}>
      {STEPS.map((s, i) => (
        <View key={s.head} style={{ flex: 1, gap: t.space[1.5] }}>
          <View
            style={[
              dotBase,
              i === 0
                ? { backgroundColor: t.colors.accent, borderColor: t.colors.accent }
                : { backgroundColor: t.colors.surfaceRaised, borderColor: t.colors.inkFaint },
            ]}
          />
          <Text style={headStyle}>{s.head}</Text>
          <Text style={descStyle}>{s.desc}</Text>
        </View>
      ))}
    </View>
  );
}
