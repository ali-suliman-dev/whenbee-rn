import { View, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
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

const OPTION_VALUES: GuardrailMultiple[] = ['off', '1.5x', '2x', '3x'];

export function GuardrailSettingRow() {
  const t = useTheme();
  const { t: tr } = useTranslation('settings');
  const OPTION_LABEL: Record<GuardrailMultiple, string> = {
    off: tr('guardrail.options.off'),
    '1.5x': tr('guardrail.options.oneAndHalfX'),
    '2x': tr('guardrail.options.twoX'),
    '3x': tr('guardrail.options.threeX'),
  };
  const OPTIONS: { value: GuardrailMultiple; label: string }[] = OPTION_VALUES.map((value) => ({
    value,
    label: OPTION_LABEL[value],
  }));
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
          <AppText style={titleStyle}>{tr('guardrail.title')}</AppText>
          <AppText style={captionStyle}>{tr('guardrail.captionFree')}</AppText>
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
