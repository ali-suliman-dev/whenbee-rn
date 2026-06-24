import { View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// FocusWindowLocked — the non-Pro teaser. Shows the SHAPE of the value (a labelled
// empty band = "you have a window") without the packed fit (the paid payoff). The
// single CTA is indigo (never amber for a Pro CTA). No-guilt, no health framing.
// ──────────────────────────────────────────────────────────────────────────────

export function FocusWindowLocked() {
  const t = useTheme();

  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const band: ViewStyle = {
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
  };
  const bandRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const bandLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const body: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.ink };

  const openPaywall = () => {
    analytics.capture('focus_window_paywall', { source: 'plan_section' });
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'focus_window' } });
  };

  return (
    <Card style={{ gap: t.space[3] }}>
      <View style={eyebrowRow}>
        <AppText style={eyebrow}>YOUR FOCUS WINDOW</AppText>
        <Ionicons name="lock-closed" size={t.iconSize.sm} color={t.colors.inkFaint} />
      </View>

      <View style={bandRow}>
        <View style={[band, { flex: 1 }]} />
        <AppText style={bandLabel}>your window</AppText>
      </View>

      <AppText style={body}>Spend your best hours on the right things.</AppText>
      <AppButton label="Fit your focus window" variant="indigo" fullWidth onPress={openPaywall} />
    </Card>
  );
}
