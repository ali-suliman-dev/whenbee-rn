import { useEffect } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// RoutinesLocked — the non-Pro teaser. Shows the SHAPE of the value: one greyed,
// non-interactive sample routine (ordered steps → one honest total → one start-by),
// one line of plain value copy, and a single indigo CTA. No fog over anything free,
// no second CTA, no guilt. (Spec §9.)
// ──────────────────────────────────────────────────────────────────────────────

export function RoutinesLocked() {
  const t = useTheme();
  const { t: tr } = useTranslation('routines');
  const sampleSteps = tr('locked.sampleSteps', { returnObjects: true }) as string[];

  useEffect(() => {
    analytics.capture('routines_paywall', { trigger: 'routines' });
    // Mount-only impression — a re-render must not re-fire the funnel event.
  }, []);

  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const sampleName: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const total: TextStyle = { ...(type.honestNumberMd as unknown as TextStyle), color: t.colors.ink };
  const caption: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const startByRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const stepRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const dot: ViewStyle = {
    width: t.space[1.5],
    height: t.space[1.5],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.inkFaint,
  };
  const stepLabel: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, flex: 1 };
  const body: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.ink };

  const openPaywall = () => {
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'routines' } });
  };

  return (
    <View style={{ gap: t.space[4] }}>
      {/* The greyed, non-interactive sample — shows the shape, not the payoff. */}
      <Card
        style={{ gap: t.space[2], opacity: t.opacity.disabled }}
        pointerEvents="none"
        accessibilityElementsHidden
      >
        <View style={eyebrowRow}>
          <AppText style={sampleName}>{tr('locked.sampleName')}</AppText>
          <AppText style={caption}>{tr('list.stepCount', { count: sampleSteps.length })}</AppText>
        </View>
        <AppText style={total}>{tr('locked.sampleTotalMinutes', { count: 50 })}</AppText>
        <View style={startByRow}>
          <Ionicons name="time-outline" size={t.iconSize.sm} color={t.colors.inkSoft} />
          <AppText style={caption}>{tr('locked.sampleStartBy', { time: '8:10' })}</AppText>
        </View>
        <View style={{ gap: t.space[1], marginTop: t.space[1] }}>
          {sampleSteps.map((label) => (
            <View key={label} style={stepRow}>
              <View style={dot} />
              <AppText style={stepLabel}>{label}</AppText>
            </View>
          ))}
        </View>
      </Card>

      <AppText style={body}>{tr('locked.body')}</AppText>
      <AppButton label={tr('locked.cta')} variant="indigo" fullWidth onPress={openPaywall} />
    </View>
  );
}
