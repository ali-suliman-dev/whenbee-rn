import { View, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/src/components/Chip';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { analytics } from '@/src/services/analytics';
import type { GuardrailMultiple } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// GuardrailSettingRow — the Pro Settings control for the hyperfocus check-in.
//
// A standard settings-row frame (title + caption) with a segmented row of options:
// Off · 1.5× · 2× · 3×. Writes settingsStore.setHyperfocusGuard. The selection
// chrome is indigo (the app's Chip pick) on purpose — amber stays reserved for the
// live nudge itself. No-guilt: this only chooses when the gentle nudge fires.
// ──────────────────────────────────────────────────────────────────────────────

const OPTIONS: { value: GuardrailMultiple; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: '1.5x', label: '1.5×' },
  { value: '2x', label: '2×' },
  { value: '3x', label: '3×' },
];

export function GuardrailSettingRow() {
  const t = useTheme();
  const hyperfocusGuard = useSettingsStore((s) => s.hyperfocusGuard);
  const setHyperfocusGuard = useSettingsStore((s) => s.setHyperfocusGuard);

  function select(next: GuardrailMultiple) {
    if (next === hyperfocusGuard) return;
    analytics.capture('guardrail_setting_changed', { from: hyperfocusGuard, to: next });
    setHyperfocusGuard(next);
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
        <Ionicons name="hourglass-outline" size={t.iconSize.md} color={t.colors.inkSoft} />
        <View style={{ gap: t.space[0.5] }}>
          <AppText style={titleStyle}>Hyperfocus check-in</AppText>
          <AppText style={captionStyle}>A gentle nudge when a task runs long.</AppText>
        </View>
      </View>
      <View style={options}>
        {OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={hyperfocusGuard === o.value}
            onPress={() => select(o.value)}
          />
        ))}
      </View>
    </View>
  );
}
