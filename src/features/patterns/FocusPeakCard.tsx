import { useState } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { formatWindowRange } from '@/src/lib/time';
import { FW_GATE_MIN_COMPLETED } from '@/src/engine/constants';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { FocusCurve } from '@/src/features/planner/FocusCurve';
import { FocusWindowEditorSheet } from '@/src/features/planner/FocusWindowEditorSheet';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useFocusInsights } from '@/src/features/patterns/useFocusInsights';
import { whyNarrative } from '@/src/features/patterns/focusCopy';
import { useSettingsStore } from '@/src/stores/settingsStore';

// ──────────────────────────────────────────────────────────────────────────────
// FocusPeakCard — the pinned, compact "When you're sharp" card on Patterns.
//
// Three mutually exclusive states:
//   forming            (basis === 'prior')           — dashed curve + maturity progress
//   locked (free)      (basis === 'personal' && !Pro) — frosted curve + teaser + Unlock CTA
//   personal + Pro                                    — window range + curve + why-line, taps to detail
// ──────────────────────────────────────────────────────────────────────────────

export function FocusPeakCard() {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);
  const win = useLearnedFocusWindow();
  const insights = useFocusInsights(win.startMin, win.endMin);
  const startMin = useSettingsStore((s) => s.windowStartMin);
  const endMin = useSettingsStore((s) => s.windowEndMin);
  const setFocusWindow = useSettingsStore((s) => s.setFocusWindow);
  const [editing, setEditing] = useState(false);

  const { basis, scoreByBin, sampleCount, startMin: ws, endMin: we } = win;

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    padding: t.space[5],
    gap: t.space[4],
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as TextStyle), color: t.colors.primary };
  const title: TextStyle = { ...(type.subtitle as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as TextStyle), color: t.colors.inkSoft };
  const meta: TextStyle = { ...(type.caption as TextStyle), color: t.colors.inkFaint };

  const Eyebrow = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] }}>
      <Ionicons name="flash" size={t.iconSize.xs} color={t.colors.primary} />
      <AppText style={eyebrow}>WHEN YOU&apos;RE SHARP</AppText>
    </View>
  );

  // ── forming ──
  if (basis === 'prior') {
    return (
      <View style={card}>
        <Eyebrow />
        <FocusCurve scoreByBin={scoreByBin} variant="forming" yAxis />
        <AppText style={title}>Learning your focus hours</AppText>
        <AppText style={meta} testID="focus-maturity">{`${sampleCount} / ${FW_GATE_MIN_COMPLETED} sessions`}</AppText>
        <AppButton
          label="Set my hours myself"
          variant="ghost"
          size="sm"
          onPress={() => setEditing(true)}
          accessibilityLabel="Set focus window manually"
        />
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
      </View>
    );
  }

  const whyLead = insights ? whyNarrative(insights.peakMin) : '';
  const contrastAccent = insights?.contrast != null ? `${insights.contrast.toFixed(1)}×` : null;
  const contrastRest = contrastAccent != null ? ' above your dip' : '';

  const weeks = Math.max(1, Math.round(win.distinctDays / 7));
  const footerMeta =
    win.distinctDays >= 7 ? `${sampleCount} sessions · steady for ${weeks} weeks` : `${sampleCount} sessions · ${win.distinctDays} days`;

  // ── locked (free + personal) ──
  if (!isPro) {
    const frost: ViewStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.colors.scrim,
      borderRadius: t.radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    };
    const teaser =
      insights?.contrast != null
        ? `We found your sharpest stretch — ${insights.contrast.toFixed(1)}× above your slump.`
        : 'We found your sharpest stretch.';
    return (
      <View style={card} testID="focus-locked-teaser">
        <Eyebrow />
        <View>
          <FocusCurve scoreByBin={scoreByBin} variant="locked" yAxis />
          <View style={frost} pointerEvents="none" importantForAccessibility="no" accessibilityElementsHidden>
            <Ionicons name="lock-closed" size={t.iconSize.lg} color={t.colors.onIndigo} />
          </View>
        </View>
        <AppText style={body}>{teaser}</AppText>
        <AppText style={meta}>{`Learned from ${sampleCount} sessions.`}</AppText>
        <AppButton
          label="Unlock my focus window"
          variant="indigo"
          size="md"
          fullWidth
          onPress={() => router.push({ pathname: '/(modals)/paywall', params: { trigger: 'focus_window' } })}
          accessibilityLabel="Unlock my focus window"
        />
      </View>
    );
  }

  // ── personal + Pro ──
  return (
    <Pressable
      onPress={() => router.push('/(modals)/focus-window')}
      accessibilityRole="button"
      accessibilityLabel="Open focus window detail"
    >
      <View style={card}>
        <Eyebrow />
        <AppText style={{ ...(type.honestNumberMd as unknown as TextStyle), color: t.colors.ink }} testID="focus-window-range">
          {formatWindowRange(ws, we)}
        </AppText>
        <FocusCurve
          scoreByBin={scoreByBin}
          variant="learned"
          windowStartMin={ws}
          windowEndMin={we}
          peakMin={insights?.peakMin}
          yAxis
        />
        {whyLead ? (
          <AppText style={{ ...(type.body as TextStyle), color: t.colors.ink }}>
            {whyLead}
            {contrastAccent != null ? ', ' : ''}
            {contrastAccent != null ? (
              <AppText style={{ ...(type.body as TextStyle), color: t.colors.accent, fontWeight: t.fontWeight.bold as TextStyle['fontWeight'] }}>
                {contrastAccent}
              </AppText>
            ) : null}
            {contrastRest}.
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText style={meta}>{footerMeta}</AppText>
          <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.primary }}>Open ›</AppText>
        </View>
      </View>
    </Pressable>
  );
}
