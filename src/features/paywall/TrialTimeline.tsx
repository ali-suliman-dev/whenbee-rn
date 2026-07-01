import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// TrialTimeline — the honest, no-dark-pattern form of the 7-day trial: a 3-step
// timeline (today → reminder → ends) so the user sees exactly what happens and when.
// Rendered by the caller only when the selected plan is a subscription (not lifetime).
// t.borderWidth.thin = 0 in this project; t.borderWidth.chip (1pt) used instead.
// ──────────────────────────────────────────────────────────────────────────────

const STEP_KEYS = ['today', 'day5', 'day7'] as const;

export function TrialTimeline() {
  const t = useTheme();
  const { t: tr } = useTranslation('paywall');
  const headStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.ink, fontFamily: 'Jakarta-Bold' };
  const descStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const dotBase: ViewStyle = {
    width: t.space[3], height: t.space[3], borderRadius: t.radii.full,
    borderWidth: t.borderWidth.chip,
  };
  return (
    <View style={{ flexDirection: 'row', gap: t.space[2] }}>
      {STEP_KEYS.map((key, i) => (
        <View key={key} style={{ flex: 1, gap: t.space[1.5] }}>
          <View
            style={[
              dotBase,
              i === 0
                ? { backgroundColor: t.colors.accent, borderColor: t.colors.accent }
                : { backgroundColor: t.colors.surfaceRaised, borderColor: t.colors.inkFaint },
            ]}
          />
          <Text style={headStyle}>{tr(`trialTimeline.${key}.head`)}</Text>
          <Text style={descStyle}>{tr(`trialTimeline.${key}.desc`)}</Text>
        </View>
      ))}
    </View>
  );
}
