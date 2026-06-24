import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';
import { useReportModel } from './useReportModel';
import { useReportExport } from './useReportExport';
import { buildReportCss } from './reportCss';
import { ReportPagePreview } from './ReportPagePreview';
import { tokens } from '@/src/theme/tokens';
import type { ReportWindow } from './reportModel';

// ──────────────────────────────────────────────────────────────────────────────
// ReportBuilder — the Pro builder. Pick a time window, see your page-1 preview,
// tap once to render the PDF and hand it to the OS share sheet. Thin: the model
// hook reads the data, the export hook owns the guarded print + share. No red
// anywhere; the most-biased category is simply first in the preview, never named
// as a fault. The PDF is always built from the LIGHT palette (white paper).
// ──────────────────────────────────────────────────────────────────────────────

const WINDOWS: { kind: ReportWindow['kind']; label: string }[] = [
  { kind: '30d', label: 'Last 30 days' },
  { kind: '90d', label: 'Last 90 days' },
  { kind: 'all', label: 'All time' },
];

// The PDF is always rendered light (paper is white), so the CSS reads from the
// light palette regardless of the app's color mode.
const REPORT_CSS = buildReportCss(tokens.colors.light);

function CloseButton({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={t.size.hitSlop} accessibilityRole="button" accessibilityLabel="Close">
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

export function ReportBuilder() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [windowKind, setWindowKind] = useState<ReportWindow['kind']>('30d');
  const { model, status } = useReportModel(windowKind);
  const runExport = useReportExport({ model, status, css: REPORT_CSS });

  const [working, setWorking] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    analytics.capture('report_opened', { is_pro: true });
  }, []);

  const onCreate = async () => {
    if (working || status !== 'ready') return;
    setWorking(true);
    setErrored(false);
    const outcome = await runExport();
    setWorking(false);
    if (outcome === 'error') setErrored(true);
  };

  const eyebrowStyle: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const includedStyle: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const microStyle: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };
  const isThin = status === 'thin';

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View
        style={{
          paddingTop: t.space[5],
          paddingBottom: t.space[5],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="display" style={{ color: t.colors.ink }}>
          Export a report
        </AppText>
        <CloseButton onPress={() => router.back()} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: t.space[8] }}>
        <Text style={eyebrowStyle}>TIME WINDOW</Text>
        <View style={{ flexDirection: 'row', gap: t.space[2], marginTop: t.space[2] }}>
          {WINDOWS.map((w) => (
            <Chip
              key={w.kind}
              label={w.label}
              selected={windowKind === w.kind}
              onPress={() => setWindowKind(w.kind)}
            />
          ))}
        </View>

        <Text style={[includedStyle, { marginTop: t.space[3] }]}>
          Includes your accuracy, how long things really take you per category, and your biggest
          surprises.
        </Text>

        <View style={{ marginTop: t.space[5] }}>
          {isThin ? (
            <ThinState onUseAllTime={() => setWindowKind('all')} showUseAllTime={windowKind !== 'all'} />
          ) : model ? (
            <Card tone="flat">
              <ReportPagePreview model={model} />
            </Card>
          ) : (
            <Card tone="flat">
              <View style={{ alignItems: 'center', paddingVertical: t.space[6] }}>
                <ActivityIndicator color={t.colors.inkSoft} />
              </View>
            </Card>
          )}
        </View>

        {errored ? (
          <View
            style={{
              marginTop: t.space[3],
              padding: t.space[3],
              borderRadius: t.radii.md,
              borderCurve: 'continuous',
              backgroundColor: t.colors.surfaceSunken,
            }}
          >
            <Text style={{ ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft }}>
              Couldn&apos;t build the report just now. Try again?
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + t.space[3], paddingTop: t.space[2], gap: t.space[2] }}>
        <AppButton
          label={working ? 'Building your report…' : 'Create PDF'}
          variant="indigo"
          fullWidth
          disabled={working || isThin}
          onPress={onCreate}
          icon={working ? <ActivityIndicator color={t.colors.primaryText} /> : undefined}
        />
        <Text style={microStyle}>Made on your phone. Nothing leaves your device unless you share it.</Text>
      </View>
    </Screen>
  );
}

function ThinState({ onUseAllTime, showUseAllTime }: { onUseAllTime: () => void; showUseAllTime: boolean }) {
  const t = useTheme();
  return (
    <Card tone="flat">
      <View style={{ alignItems: 'center', gap: t.space[3], paddingVertical: t.space[5] }}>
        <Ionicons name="document-text-outline" size={t.iconSize.xl} color={t.colors.inkFaint} />
        <AppText variant="title" style={{ color: t.colors.ink, textAlign: 'center' }}>
          Not enough logged time here yet
        </AppText>
        <Text
          style={{
            ...(type.bodySm as unknown as TextStyle),
            color: t.colors.inkSoft,
            textAlign: 'center',
          }}
        >
          A report gets useful after about six finished tasks in this window. Try &quot;All
          time&quot;, or come back after a few more.
        </Text>
        {showUseAllTime ? (
          <Chip label="Use all time" selected={false} onPress={onUseAllTime} />
        ) : null}
      </View>
    </Card>
  );
}
