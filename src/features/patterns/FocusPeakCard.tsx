import { useState } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
  const { t: tr } = useTranslation('patterns');
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
      <AppText style={eyebrow}>{tr('focusPeakCard.eyebrow')}</AppText>
    </View>
  );

  // ── forming ──
  if (basis === 'prior') {
    return (
      <View style={card}>
        <Eyebrow />
        <FocusCurve scoreByBin={scoreByBin} variant="forming" yAxis />
        <AppText style={title}>{tr('focusPeakCard.forming.title')}</AppText>
        <AppText style={meta} testID="focus-maturity">
          {tr('focusPeakCard.forming.progress', { count: sampleCount, gate: FW_GATE_MIN_COMPLETED })}
        </AppText>
        <AppButton
          label={tr('focusPeakCard.forming.setHoursCta')}
          variant="ghost"
          size="sm"
          onPress={() => setEditing(true)}
          accessibilityLabel={tr('focusPeakCard.forming.setHoursA11y')}
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
  const contrastRest = contrastAccent != null ? tr('focusPeakCard.contrastSuffix') : '';

  const weeks = Math.max(1, Math.round(win.distinctDays / 7));
  const footerMeta =
    win.distinctDays >= 7
      ? tr('focusPeakCard.personal.footerMetaWeeks', { count: sampleCount, weeks })
      : tr('focusPeakCard.personal.footerMetaDays', { count: sampleCount, days: win.distinctDays });

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
        ? tr('focusPeakCard.locked.teaserWithContrast', { contrast: insights.contrast.toFixed(1) })
        : tr('focusPeakCard.locked.teaserDefault');
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
        <AppText style={meta}>{tr('focusPeakCard.locked.meta', { count: sampleCount })}</AppText>
        <Pressable
          onPress={() => router.push({ pathname: '/(modals)/paywall', params: { trigger: 'focus_window' } })}
          accessibilityRole="button"
          accessibilityLabel={tr('focusPeakCard.locked.unlockA11y')}
        >
          <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.primary }}>
            {tr('focusPeakCard.locked.unlockCta')}
          </AppText>
        </Pressable>
      </View>
    );
  }

  // ── personal + Pro ──
  return (
    <Pressable
      onPress={() => router.push('/(modals)/focus-window')}
      accessibilityRole="button"
      accessibilityLabel={tr('focusPeakCard.personal.openA11y')}
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
          <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.primary }}>
            {tr('focusPeakCard.personal.open')}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}
