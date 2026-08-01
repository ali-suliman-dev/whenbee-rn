import { Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// GuardrailLockedRow — the non-Pro teaser for the hyperfocus check-in.
//
// Same row frame as the Pro control, but the value is greyed with a lock glyph and
// tapping routes to the paywall (trigger 'hyperfocus_guard') rather than toggling.
// The caption sells the payoff plainly, without guilt. We never give a free user a
// one-time live nudge (a protective feature that bait-and-switches is the predatory
// pattern this audience punishes) — the honest move is to show the promise here.
// ──────────────────────────────────────────────────────────────────────────────

export function GuardrailLockedRow() {
  const t = useTheme();
  const { t: tr } = useTranslation('settings');

  function openPaywall() {
    analytics.capture('guardrail_paywall', {});
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'hyperfocus_guard' } });
  }

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    minHeight: t.size.control.lg,
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
  const valueStyle: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkFaint };
  const valueRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };

  return (
    <Pressable
      onPress={openPaywall}
      accessibilityRole="button"
      accessibilityLabel={tr('guardrail.lockedA11y')}
      style={row}
    >
      <Ionicons name="time-outline" size={t.iconSize.md} color={t.colors.inkSoft} />
      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <AppText style={titleStyle}>{tr('guardrail.title')}</AppText>
        <AppText style={captionStyle}>{tr('guardrail.captionLocked')}</AppText>
      </View>
      <View style={valueRow}>
        <Ionicons name="lock-closed" size={t.iconSize.sm} color={t.colors.inkFaint} />
        <AppText style={valueStyle}>{tr('guardrail.lockedValue')}</AppText>
      </View>
    </Pressable>
  );
}
