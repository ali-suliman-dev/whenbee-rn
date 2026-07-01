import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { ProGate } from '@/src/features/paywall/ProGate';
import { HonestDayPreview } from '@/src/features/calendar/HonestDayPreview';
import { useHonestDay } from '@/src/features/calendar/useHonestDay';

// ──────────────────────────────────────────────────────────────────────────────
// Honest-Day route (formSheet) — the single Pro surface. Thin: the hook owns the
// read + the confirmed write; the preview owns the UI. Wrapped in <ProGate> so a
// non-Pro user who somehow reaches the path is sent to the paywall, never to a
// writeable screen.
// ──────────────────────────────────────────────────────────────────────────────

function NotPro() {
  // Defensive fallback only — the Whenbee CTA already routes non-Pro users to the
  // paywall. If they land here anyway, send them on rather than show the feature.
  const { t: tr } = useTranslation('calendar');
  return (
    <Screen>
      <View style={{ paddingTop: 24, gap: 16 }}>
        <AppText variant="title">{tr('notPro.title')}</AppText>
        <AppButton
          label={tr('notPro.cta')}
          variant="amber"
          onPress={() =>
            router.replace({ pathname: '/(modals)/paywall', params: { trigger: 'make_day_honest' } })
          }
        />
      </View>
    </Screen>
  );
}

function HonestDayContent() {
  const t = useTheme();
  const { t: tr } = useTranslation('calendar');
  const { status, result, apply } = useHonestDay();
  const [applying, setApplying] = useState(false);

  async function handleApply() {
    setApplying(true);
    try {
      await apply();
    } finally {
      setApplying(false);
      router.back();
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[4], paddingBottom: t.space[12] }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={tr('screen.title')} subtitle={tr('screen.subtitle')} />

        {status === 'loading' ? <AppText variant="body">{tr('screen.loading')}</AppText> : null}

        {status === 'denied' ? (
          <View style={{ gap: t.space[4] }}>
            <AppText variant="body">{tr('screen.denied')}</AppText>
            <AppButton label={tr('screen.maybeLater')} variant="ghost" onPress={() => router.back()} />
          </View>
        ) : null}

        {status === 'empty' ? (
          <View style={{ gap: t.space[4] }}>
            <AppText variant="body">{tr('screen.empty')}</AppText>
            <AppButton label={tr('screen.done')} variant="ghost" onPress={() => router.back()} />
          </View>
        ) : null}

        {status === 'ready' && result ? (
          <HonestDayPreview
            result={result}
            applying={applying}
            onApply={handleApply}
            onCancel={() => router.back()}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

export default function HonestDayRoute() {
  return (
    <ProGate fallback={<NotPro />}>
      <HonestDayContent />
    </ProGate>
  );
}
