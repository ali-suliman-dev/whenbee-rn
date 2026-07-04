import { View, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/src/components/Chip';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { analytics } from '@/src/services/analytics';
import type { ForgotStepIn } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// ForgotStepInRow — the free Settings control for the forgot-to-stop timer.
//
// A standard settings-row frame (title + caption) with a segmented row of options:
// Lots of room · Balanced · Step in early. Writes settingsStore.setForgotStepIn.
// Free (unlike GuardrailSettingRow), so it renders above the Pro guardrail row —
// the free net first, the Pro control second.
// ──────────────────────────────────────────────────────────────────────────────

const OPTIONS: { value: ForgotStepIn; label: string }[] = [
  { value: 'room', label: 'Lots of room' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'early', label: 'Step in early' },
];

export function ForgotStepInRow() {
  const t = useTheme();
  const forgotStepIn = useSettingsStore((s) => s.forgotStepIn);
  const setForgotStepIn = useSettingsStore((s) => s.setForgotStepIn);

  function select(next: ForgotStepIn) {
    if (next === forgotStepIn) return;
    analytics.capture('forgot_step_in_changed', { from: forgotStepIn, to: next });
    setForgotStepIn(next);
  }

  const card: ViewStyle = {
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const titleStyle: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
  const captionStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const options: ViewStyle = { flexDirection: 'row', gap: t.space[2] };

  return (
    <View style={card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
        <Ionicons name="exit-outline" size={t.iconSize.md} color={t.colors.inkSoft} />
        <View style={{ gap: t.space[0.5] }}>
          <AppText style={titleStyle}>Forgot to stop</AppText>
          <AppText style={captionStyle}>
            If a timer runs long while you&rsquo;re away, Whenbee wraps it and asks when you
            finished.
          </AppText>
        </View>
      </View>
      <View style={options}>
        {OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={forgotStepIn === o.value}
            onPress={() => select(o.value)}
          />
        ))}
      </View>
    </View>
  );
}
