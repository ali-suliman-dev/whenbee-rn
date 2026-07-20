import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { SheetScrollView } from '@/src/components/SheetScrollView';
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
  return (
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      <View style={{ paddingTop: 24, gap: 16 }}>
        <AppText variant="title">Padding your calendar is a Pro feature</AppText>
        <AppButton
          label="See what Pro unlocks"
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
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      <SheetScrollView
        contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[4], paddingBottom: t.space[12] }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Pad my calendar"
          subtitle="Your real buffers, mapped onto today. Nothing changes until you tap apply."
        />

        {status === 'loading' ? (
          <AppText variant="body">Reading today&apos;s plan…</AppText>
        ) : null}

        {status === 'denied' ? (
          <View style={{ gap: t.space[4] }}>
            <AppText variant="body">
              Whenbee needs calendar access to pad your calendar. You can turn it on in Settings
              whenever you&apos;re ready.
            </AppText>
            <AppButton label="Maybe later" variant="ghost" onPress={() => router.back()} />
          </View>
        ) : null}

        {status === 'empty' ? (
          <View style={{ gap: t.space[4] }}>
            <AppText variant="body">
              Today&apos;s calendar is clear. Add a few events and come back — the padding will be
              waiting.
            </AppText>
            <AppButton label="Done" variant="ghost" onPress={() => router.back()} />
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
      </SheetScrollView>
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
