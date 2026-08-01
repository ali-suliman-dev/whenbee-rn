import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';
import { useReportModel } from './useReportModel';
import { ReportPagePreview } from './ReportPagePreview';
import type { ReportWindow } from './reportModel';

// ──────────────────────────────────────────────────────────────────────────────
// ReportLockedTeaser — the non-Pro view of the report modal. It shows the user's
// REAL page-1 preview (their actual accuracy figure stays legible — that's the
// conversion lever) with a soft legibility wash over the lower body, then a calm
// Pro CTA. No countdown, no fake scarcity (this audience punishes it).
// ──────────────────────────────────────────────────────────────────────────────

function CloseButton({ onPress, label }: { onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={t.size.hitSlop} accessibilityRole="button" accessibilityLabel={label}>
      <View
        style={{
          width: t.size.control.sm,
          height: t.size.control.sm,
          borderRadius: t.radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.colors.surfaceSunken,
        }}
      >
        <Ionicons name="close" size={t.iconSize.md} color={t.colors.inkSoft} />
      </View>
    </Pressable>
  );
}

export function ReportLockedTeaser() {
  const t = useTheme();
  const { t: tr } = useTranslation('report');
  const insets = useSafeAreaInsets();
  // "All time" gives the fullest preview from whatever the user has logged.
  const [windowKind] = useState<ReportWindow['kind']>('all');
  const { model } = useReportModel(windowKind);

  useEffect(() => {
    analytics.capture('report_opened', { is_pro: false });
  }, []);

  const onUnlock = () => {
    analytics.capture('report_paywall', { trigger: 'pdf_export' });
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'pdf_export' } });
  };

  const headingStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const bodyStyle: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const microStyle: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View
        style={{
          paddingTop: t.space[1],
          paddingBottom: t.space[5],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="display" style={{ color: t.colors.ink }}>
          {tr('screenTitle')}
        </AppText>
        <CloseButton onPress={() => router.back()} label={tr('close')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: t.space[8] }}>
        {model ? (
          <Card tone="flat">
            <View>
              <ReportPagePreview model={model} />
              {/* Soft legibility wash over the lower body — keeps the accuracy figure
                  legible (it sits above the fog), only quieting the rows beneath. */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '42%',
                  backgroundColor: t.colors.surface,
                  opacity: t.opacity.wash,
                  borderBottomLeftRadius: t.radii.md,
                  borderBottomRightRadius: t.radii.md,
                }}
              />
            </View>
          </Card>
        ) : null}

        <View style={{ marginTop: t.space[5], gap: t.space[2] }}>
          <Text style={headingStyle}>{tr('locked.heading')}</Text>
          <Text style={bodyStyle}>{tr('locked.body')}</Text>
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + t.space[3], paddingTop: t.space[2], gap: t.space[2] }}>
        <AppButton label={tr('locked.unlock')} variant="indigo" fullWidth onPress={onUnlock} />
        <Text style={microStyle}>{tr('locked.onYourPhone')}</Text>
      </View>
    </Screen>
  );
}
