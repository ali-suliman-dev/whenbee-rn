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
import { FocusConfidenceMeter } from '@/src/features/planner/FocusConfidenceMeter';
import { FocusWindowEditorSheet } from '@/src/features/planner/FocusWindowEditorSheet';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { statedFocusBlock } from '@/src/features/planner/statedFocusBlock';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import { whyNarrative } from '@/src/features/patterns/focusCopy';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { formatWindowRange, formatClockMin } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// Focus Window detail sheet — the "See details" destination from the pinned
// FocusPeakCard. Warm-rhythm layout (mock 2A): coarse-honest hero while the
// window is an early read, the full curve with an amber peak dot, icon-chip
// insight rows (amber marks the peak — the one number that matters), the same
// confidence meter as the card, and evidence demoted to a caption.
// ──────────────────────────────────────────────────────────────────────────────

// Insight rows carry a small tinted icon chip. Amber is reserved for the peak
// (and the contrast ratio it earns); everything else stays indigo-soft.
type RowTone = 'accent' | 'primary';

// Header tier-pill label per engine tier. The tier is authoritative — the
// engine pins coarse windows to 'low' even when the raw confidence number is
// higher, so deriving a label from the number would contradict the meter.
const TIER_PILL_LABEL = {
  low: 'Still learning',
  building: 'Building',
  steady: 'Steady',
} as const;

export default function FocusWindowDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const win = useLearnedFocusWindow();
  const ins = useFocusInsights(win.startMin, win.endMin);
  const startMin = useSettingsStore((s) => s.windowStartMin);
  const endMin = useSettingsStore((s) => s.windowEndMin);
  const setFocusWindow = useSettingsStore((s) => s.setFocusWindow);
  const focusAnswer = useOnboardingStore((s) => s.quizAnswers.focus);
  const [editing, setEditing] = useState(false);

  // Before any timer has logged evidence, the quiz's self-reported focus block
  // is the only honest thing to show — the engine's own "coarse" read still
  // requires a few logged sessions. The moment sampleCount > 0 the engine's
  // read takes over; the two are never shown together.
  const stated = statedFocusBlock(focusAnswer);
  const showStated = win.sampleCount === 0 && stated !== null;

  const coarse = win.confidenceTier === 'low';
  const weeks = Math.max(1, Math.round(win.distinctDays / 7));
  const evidence =
    win.distinctDays >= 7
      ? `${win.sampleCount} sessions · ${weeks} wks`
      : `${win.sampleCount} sessions · ${win.distinctDays} days`;

  type Row = { k: string; v: string; icon: keyof typeof Ionicons.glyphMap; tone: RowTone };
  const rows: Row[] = [];
  if (ins) rows.push({ k: 'Peak focus', v: formatClockMin(ins.peakMin), icon: 'sunny', tone: 'accent' });
  if (ins?.contrast != null)
    rows.push({ k: 'Sharper than your slump', v: `${ins.contrast.toFixed(1)}×`, icon: 'flash', tone: 'accent' });
  if (ins?.accuracyBetterInWindow)
    rows.push({ k: 'Most accurate', v: 'Closest to your guess', icon: 'locate', tone: 'primary' });
  if (ins?.durationLongerInWindow)
    rows.push({ k: 'Longest sessions', v: 'Land here', icon: 'hourglass', tone: 'primary' });
  if (ins)
    rows.push({
      k: 'Foggiest stretch',
      v: formatWindowRange(ins.troughStartMin, ins.troughEndMin),
      icon: 'cloud',
      tone: 'primary',
    });

  const rowsBox: ViewStyle = { backgroundColor: t.colors.surfaceSunken, borderRadius: t.radii.md, paddingHorizontal: t.space[4] };
  const rowStyle = (i: number): ViewStyle => ({
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: t.space[3],
    borderTopWidth: i === 0 ? 0 : t.borderWidth.share,
    borderTopColor: t.colors.hairline,
    gap: t.space[3],
  });
  const kWrap: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2.5], flexShrink: 1 };
  const chip = (tone: RowTone): ViewStyle => ({
    width: t.space[6],
    height: t.space[6],
    borderRadius: t.radii.sm,
    backgroundColor: tone === 'accent' ? t.colors.accentSoft : t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  });
  const kS: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const vS: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };

  const contrastClause = ins?.contrast != null ? `, ${ins.contrast.toFixed(1)}× above your dip` : '';
  // At low confidence the window is a coarse early read — "sessions agree / has
  // held" would overclaim, so say what's actually true and what happens next.
  const why = coarse
    ? `An early read from ${win.sampleCount} sessions — keep timing and I'll sharpen it as your hours cluster.`
    : ins
      ? `${whyNarrative(ins.peakMin)}${contrastClause}. Your last ${win.sampleCount} sessions agree, and it has held for ${weeks} weeks.`
      : `Your last ${win.sampleCount} sessions agree, and it has held for ${weeks} weeks.`;

  return (
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: t.space[4],
          paddingBottom: insets.bottom + t.space[6],
          gap: t.space[5],
        }}
        showsVerticalScrollIndicator={false}
      >
        <SheetGrabber />
        {/* H1 header — left-aligned with the why-line/rows/meter below; the
            amber tier pill answers "how much do I trust this?" at a glance. */}
        <View style={{ gap: t.space[2.5] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] }}>
            <Ionicons name="flash" size={t.iconSize.xs} color={t.colors.primary} />
            <AppText style={{ ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary }}>WHEN YOU&apos;RE SHARP</AppText>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: t.space[3],
            }}
          >
            <View style={{ flexShrink: 1, gap: t.space[1] }}>
              {showStated && stated ? (
                <>
                  <AppText style={{ ...(type.display as unknown as TextStyle), color: t.colors.ink }}>
                    {stated.label}
                  </AppText>
                  <AppText style={{ ...(type.body as unknown as TextStyle), color: t.colors.inkSoft }}>
                    {'around '}
                    <AppText style={{ ...(type.heading as unknown as TextStyle), color: t.colors.ink }}>
                      {formatWindowRange(stated.startMin, stated.endMin)}
                    </AppText>
                  </AppText>
                  <AppText style={{ ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint }}>
                    I&apos;ll check that against your timers.
                  </AppText>
                </>
              ) : coarse ? (
                <>
                  <AppText style={{ ...(type.display as unknown as TextStyle), color: t.colors.ink }}>
                    {win.coarseBlockLabel}
                  </AppText>
                  <AppText style={{ ...(type.body as unknown as TextStyle), color: t.colors.inkSoft }}>
                    {'around '}
                    <AppText style={{ ...(type.heading as unknown as TextStyle), color: t.colors.ink }}>
                      {formatWindowRange(win.startMin, win.endMin)}
                    </AppText>
                  </AppText>
                </>
              ) : (
                <AppText style={{ ...(type.honestNumberLg as unknown as TextStyle), color: t.colors.ink }}>
                  {formatWindowRange(win.startMin, win.endMin)}
                </AppText>
              )}
            </View>
            <View
              style={{
                backgroundColor: t.colors.accentSoft,
                borderRadius: t.radii.full,
                paddingHorizontal: t.space[2.5],
                paddingVertical: t.space[1],
                marginTop: t.space[1],
              }}
            >
              <AppText style={{ ...(type.eyebrowSm as unknown as TextStyle), color: t.colors.accent }}>
                {TIER_PILL_LABEL[win.confidenceTier]}
              </AppText>
            </View>
          </View>
        </View>

        {/* grid (no yAxis): the Hi/Low gutter would indent the plot's left edge —
            every element on this sheet shares the same left/right edges. The
            vertical margins give the plot breathing room against its neighbours. */}
        <View style={{ marginVertical: t.space[2] }}>
          <FocusCurve
            scoreByBin={win.scoreByBin}
            variant="learned"
            windowStartMin={win.startMin}
            windowEndMin={win.endMin}
            grid
            height={t.focusCurve.detailH}
            peakMin={ins?.peakMin}
            peakLabel={ins ? `peak · ${formatClockMin(ins.peakMin)}` : undefined}
            peakTone="accent"
            bandVariant={coarse ? 'coarse' : 'precise'}
          />
        </View>

        <AppText style={{ ...(type.body as unknown as TextStyle), color: t.colors.ink }}>{why}</AppText>

        {rows.length > 0 ? (
          <View style={rowsBox}>
            {rows.map((r, i) => (
              <View key={r.k} style={rowStyle(i)}>
                <View style={kWrap}>
                  <View style={chip(r.tone)}>
                    <Ionicons
                      name={r.icon}
                      size={t.iconSize.xs}
                      color={r.tone === 'accent' ? t.colors.accent : t.colors.primaryBright}
                    />
                  </View>
                  <AppText style={kS}>{r.k}</AppText>
                </View>
                <AppText style={{ ...vS, color: r.tone === 'accent' ? t.colors.accent : t.colors.ink }}>
                  {r.v}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        <FocusConfidenceMeter tier={win.confidenceTier} fill={win.confidence} />
        <AppText style={{ ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint, textAlign: 'center' }}>
          {`${evidence} of evidence`}
        </AppText>

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
