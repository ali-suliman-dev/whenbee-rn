import { useState } from 'react';
import { View, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { FocusCurve } from '@/src/features/planner/FocusCurve';
import { FocusWindowEditorSheet } from '@/src/features/planner/FocusWindowEditorSheet';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import { whyNarrative } from '@/src/features/patterns/focusCopy';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { confidenceLabel } from '@/src/engine';
import { formatWindowRange, formatClockMin } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// Focus Window detail sheet — the "Open" destination from the pinned
// FocusPeakCard. Shows the full focus curve (with Y-axis + peak label), the
// why-this-window narrative, and a live rows list (Tier-1 always, Tier-2 only
// when the engine has the evidence). "Edit window" opens the existing
// FocusWindowEditorSheet for manual override.
// ──────────────────────────────────────────────────────────────────────────────

export default function FocusWindowDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const win = useLearnedFocusWindow();
  const ins = useFocusInsights(win.startMin, win.endMin);
  const startMin = useSettingsStore((s) => s.windowStartMin);
  const endMin = useSettingsStore((s) => s.windowEndMin);
  const setFocusWindow = useSettingsStore((s) => s.setFocusWindow);
  const [editing, setEditing] = useState(false);

  const weeks = Math.max(1, Math.round(win.distinctDays / 7));
  const evidence =
    win.distinctDays >= 7
      ? `${win.sampleCount} sessions · ${weeks} wks`
      : `${win.sampleCount} sessions · ${win.distinctDays} days`;

  type Row = { k: string; v: string; accent?: boolean };
  const rows: Row[] = [];
  if (ins) rows.push({ k: 'Peak focus', v: formatClockMin(ins.peakMin) });
  if (ins?.contrast != null) rows.push({ k: 'Sharper than your slump', v: `${ins.contrast.toFixed(1)}×`, accent: true });
  if (ins?.accuracyBetterInWindow) rows.push({ k: 'Most accurate', v: 'Closest to your guess' });
  if (ins?.durationLongerInWindow) rows.push({ k: 'Longest sessions', v: 'Land here' });
  if (ins) rows.push({ k: 'Your foggiest stretch', v: formatClockMin(ins.troughMin) });
  rows.push({ k: 'Confidence', v: confidenceLabel(win.confidence) });
  rows.push({ k: 'Evidence', v: evidence });

  const rowsBox: ViewStyle = { backgroundColor: t.colors.surfaceSunken, borderRadius: t.radii.md, paddingHorizontal: t.space[4] };
  const rowStyle = (i: number): ViewStyle => ({
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: t.space[3],
    borderTopWidth: i === 0 ? 0 : t.borderWidth.share,
    borderTopColor: t.colors.hairline,
  });
  const kS: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const vS: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };

  const contrastClause = ins?.contrast != null ? `, ${ins.contrast.toFixed(1)}× above your dip` : '';
  const why = ins
    ? `${whyNarrative(ins.peakMin)}${contrastClause}. Your last ${win.sampleCount} sessions agree, and it has held for ${weeks} weeks.`
    : `Your last ${win.sampleCount} sessions agree, and it has held for ${weeks} weeks.`;

  return (
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + t.space[6], gap: t.space[5] }}
        showsVerticalScrollIndicator={false}
      >
        <SheetGrabber />
        <View style={{ alignItems: 'center', gap: t.space[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] }}>
            <Ionicons name="flash" size={t.iconSize.xs} color={t.colors.primary} />
            <AppText style={{ ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary }}>WHEN YOU&apos;RE SHARP</AppText>
          </View>
          <AppText style={{ ...(type.honestNumberHero as unknown as TextStyle), color: t.colors.ink, textAlign: 'center' }}>
            {formatWindowRange(win.startMin, win.endMin)}
          </AppText>
        </View>

        <FocusCurve
          scoreByBin={win.scoreByBin}
          variant="learned"
          windowStartMin={win.startMin}
          windowEndMin={win.endMin}
          yAxis
          height={t.focusCurve.detailH}
          peakMin={ins?.peakMin}
          peakLabel={ins ? `peak · ${formatClockMin(ins.peakMin)}` : undefined}
        />

        <AppText style={{ ...(type.body as unknown as TextStyle), color: t.colors.ink }}>{why}</AppText>

        <View style={rowsBox}>
          {rows.map((r, i) => (
            <View key={r.k} style={rowStyle(i)}>
              <AppText style={kS}>{r.k}</AppText>
              <AppText style={{ ...vS, color: r.accent ? t.colors.accent : t.colors.ink }}>{r.v}</AppText>
            </View>
          ))}
        </View>

        <AppButton label="Edit window" variant="ghost" size="md" fullWidth onPress={() => setEditing(true)} accessibilityLabel="Edit focus window" />
        <AppText style={{ ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint, textAlign: 'center' }}>
          Whenbee plans your day around this stretch.
        </AppText>

        <FocusWindowEditorSheet
          visible={editing}
          startMin={startMin}
          endMin={endMin}
          onConfirm={(s, e) => {
            setFocusWindow(s, e);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </ScrollView>
    </Screen>
  );
}
